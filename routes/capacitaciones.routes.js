const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { validateRequiredFields } = require('../utils/validate');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');
const { handleFirmaUpload } = require('../utils/base64')
const { getFileByNameBase64 } = require('../services/googleDriveService');

const folderId = '1HVkPL6fUoTkOMqeVLZfaNskcKGCBQF33';

router.get('/registros', async (req, res) => {

    const usuarioToken = req.validarToken?.usuario || null;

    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_capacitaciones');

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'get',
            endPoint: 'registros',
            accion: 'Consulta registros exitosa',
            detalle: `Se consultó ${rows.length} registros`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de capacitaciones.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'get',
            endPoint: 'registros',
            accion: 'Error al obtener los registros',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.post('/crearRegistro', async (req, res) => {
    const usuarioToken = req.validarToken?.usuario || null;

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'capacitaciones',
                metodo: 'post',
                endPoint: 'crearRegistro',
                accion: 'Crear registro fallido',
                detalle: 'Los datos del registro son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del registro son requeridos.");
        }

        const requiredFields = {
            fecha: "No se pudo obtener la fecha del registro.",
            nombreCapacitacion: "Ingrese y seleccione el nombre de la capacitacion.",
            regional: "Ingrese y seleccione la regional.",
            ciudad: "Ingrese y seleccione la ciudad.",
            area: "Ingrese y seleccione el area.",
            capacitador: "Ingrese el capacitador.",
            numeroHoras: "Ingrese el numero de horas.",
            cedula: "Ingrese y seleccione la cedula.",
            nombre: "Ingrese y seleccione el nombre.",
            nomina: "Ingrese la nomina.",
            telefono: "Ingrese el telefono.",
            firma: "Ingrese la firma.",
        };

        if (!validateRequiredFields(data, requiredFields, res)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'capacitaciones',
                metodo: 'post',
                endPoint: 'crearRegistro',
                accion: 'Crear registro fallido',
                detalle: 'Falta campos obligatorios por diligenciar.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return;
        }

        const { nombreCapacitacion, regional, ciudad, area, cedula, firma } = data;

        if (nombreCapacitacion) {
            const [dataRows] = await dbRailway.query(`SELECT nombreCapacitacion FROM capacitaciones WHERE nombreCapacitacion = ?`, [nombreCapacitacion]);

            if (dataRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken?.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                    rolUsuario: usuarioToken?.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'capacitaciones',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Nombre de capacitador',
                    datos: { nombreCapacitacionProporcionado: nombreCapacitacion },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Nombre de capacitador", null, { "nombreCapacitacion": `El nombre del capacitador ${nombreCapacitacion} no se encuentra registrado en el sistema.` });
            }

            const ahora = new Date();
            const opcionesZonaHoraria = { timeZone: 'America/Bogota' };
            const ahoraColombia = new Date(ahora.toLocaleString('en-US', opcionesZonaHoraria));

            const [capacitacionEnCurso] = await dbRailway.query(`
                SELECT id, nombreCapacitacion, fechaInicio, fechaFin, cedulaCapacitador, nombreCapacitador FROM capacitaciones WHERE nombreCapacitacion = ? AND ? BETWEEN fechaInicio AND fechaFin LIMIT 1
            `, [nombreCapacitacion, ahoraColombia]);

            if (capacitacionEnCurso.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken?.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                    rolUsuario: usuarioToken?.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'capacitaciones',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'La capacitacion no esta en curso',
                    datos: {
                        horaActualColombia: ahoraColombia,
                        nombreCapacitacionSolicitado: nombreCapacitacion,
                        mensaje: 'No hay una sesión activa de esta capacitación en este momento'
                    },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, `La capacitación "${nombreCapacitacion}" no está en curso en este momento.`, null, { "nombreCapacitacion": `La capacitación "${nombreCapacitacion}" no está en curso en este momento.` });
            }
        }

        if (regional) {
            const [dataRows] = await dbRailway.query(`SELECT regional FROM tabla_aux_capacitaciones WHERE regional = ?`, [regional]);

            if (dataRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken?.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                    rolUsuario: usuarioToken?.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'capacitaciones',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Regional',
                    datos: { regionalProporcionado: regional },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Regional", null, { "regional": `La regional ${regional} no se encuentra registrado en el sistema.` });
            }
        }

        if (ciudad) {
            const [dataRows] = await dbRailway.query(`SELECT ciudad FROM tabla_aux_capacitaciones WHERE ciudad = ?`, [ciudad]);

            if (dataRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken?.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                    rolUsuario: usuarioToken?.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'capacitaciones',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Ciudad',
                    datos: { ciudadProporcionado: ciudad },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Ciudad", null, { "ciudad": `La ciudad ${regional} no se encuentra registrado en el sistema.` });
            }
        }

        if (area) {
            const [dataRows] = await dbRailway.query(`SELECT area FROM tabla_aux_capacitaciones WHERE area = ?`, [area]);

            if (dataRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken?.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                    rolUsuario: usuarioToken?.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'capacitaciones',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Area',
                    datos: { areaProporcionado: area },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Area", null, { "area": `El area ${regional} no se encuentra registrado en el sistema.` });
            }
        }

        if (cedula) {
            const [dataRows] = await dbRailway.query(`SELECT nit FROM plantaenlinea WHERE nit = ?`, [cedula]);

            if (dataRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken?.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                    rolUsuario: usuarioToken?.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'capacitaciones',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Cedula',
                    datos: { cedulaProporcionado: cedula },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Cedula", null, { "cedula": `La cedula ${regional} no se encuentra registrado en el sistema.` });
            }
        }

        if (firma) {
            if (!firma.includes('base64,')) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken?.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                    rolUsuario: usuarioToken?.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'capacitaciones',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Firma',
                    datos: { cedulaProporcionado: cedula },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Firma", null, { "firma": `Formato de firma inválido. Debe ser Base64 con prefijo data:image/.` });
            }
        }

        const fileId = await handleFirmaUpload(data.firma, data.cedula, folderId);

        const datosParaBD = {
            ...data,
            firma: fileId.nameFile ? fileId.nameFile : null,
        };
        const keys = Object.keys(datosParaBD);
        const values = Object.values(datosParaBD);
        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO registros_capacitaciones (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM registros_capacitaciones WHERE id = ?', [result.insertId]);

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'post',
            endPoint: 'crearRegistro',
            accion: 'Crear registro exitoso',
            detalle: 'Registro creado con exito',
            datos: { datosParaBD },
            tablasIdsAfectados: [{
                tabla: 'registros_capacitaciones',
                id: result.insertId?.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Registro creado correctamente`,
            `Se ha guardado el registro con ID ${result.insertId}.`,
            registroGuardado[0]
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'post',
            endPoint: 'crearRegistro',
            accion: 'Error al crear registro',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.get('/ciudades', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken?.usuario || null;

    try {
        const [rows] = await dbRailway.query('SELECT nombre FROM ciudad');

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'get',
            endPoint: 'ciudades',
            accion: 'Consulta base exitosa',
            detalle: `Se consultó ${rows.length} registros`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} ciudades de la base de datos.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'get',
            endPoint: 'ciudades',
            accion: 'Error al obtener la base',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.get('/auxiliar', async (req, res) => {
    const usuarioToken = req.validarToken?.usuario || null;

    try {
        const [rows] = await dbRailway.query('SELECT * FROM tabla_aux_capacitaciones');

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'get',
            endPoint: 'auxiliar',
            accion: 'Consulta base exitosa',
            detalle: `Se consultó ${rows.length} registros`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de la tabla auxiliar de capacitaciones.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'get',
            endPoint: 'auxiliar',
            accion: 'Error al obtener la base',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.post('/obtenerImagen', async (req, res) => {
    const usuarioToken = req.validarToken?.usuario || null;
    const { imageName } = req.body;

    if (!imageName) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'log',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'post',
            endPoint: 'obtenerImagen',
            accion: 'Obtencion de imagen fallido',
            detalle: 'Imagen no encontrada',
            datos: { cedulaProporcionado: cedula },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 400, "Debe proporcionar el nombre de la imagen");
    }

    try {
        const imageData = await getFileByNameBase64(imageName, folderId);

        if (!imageData) {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'capacitaciones',
                metodo: 'post',
                endPoint: 'obtenerImagen',
                accion: 'Obtencion de imagen fallido',
                detalle: 'Imagen no encontrada',
                datos: { cedulaProporcionado: cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Imagen no encontrada");
        }

        if (!imageData.startsWith('data:')) {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'capacitaciones',
                metodo: 'post',
                endPoint: 'obtenerImagen',
                accion: 'Obtencion de imagen fallido',
                detalle: 'Formato de imagen inválido',
                datos: { cedulaProporcionado: cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Formato de imagen inválido");
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'post',
            endPoint: 'obtenerImagen',
            accion: 'Consulta imagen exitosa',
            detalle: `Se obtuvo la imagen ${imageName} exitosamente.`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvo la imagen ${imageName} exitosamente.`,
            {
                imageName: imageName,
                imageData: imageData,
                format: 'base64',
            }
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'post',
            endPoint: 'obtenerImagen',
            accion: 'Error al obtener la imagen',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.get('/capacitaciones', async (req, res) => {

    const usuarioToken = req.validarToken?.usuario || null;

    try {
        const [rows] = await dbRailway.query('SELECT * FROM capacitaciones');

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'get',
            endPoint: 'capacitaciones',
            accion: 'Consulta registros exitosa',
            detalle: `Se consultó ${rows.length} registros`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} capacitaciones.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'get',
            endPoint: 'capacitaciones',
            accion: 'Error al obtener los registros',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.post('/crearCapacitacion', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken?.usuario || null;

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'capacitaciones',
                metodo: 'post',
                endPoint: 'crearCapacitacion',
                accion: 'Crear registro fallido',
                detalle: 'Los datos del registro son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del registro son requeridos.");
        }

        const requiredFields = {
            fechaRegistro: "No se pudo obtener la fecha del registro.",
            cedulaUsuario: "No se pudo identificar la cedula del usuario.",
            nombreUsuario: "No se pudo identificar el nombre del usuario.",
            nombreCapacitacion: "Ingrese el nombre de la capacitacion.",
            cedulaCapacitador: "Ingrese y seleccione la cedula del capacitador.",
            nombreCapacitador: "Ingrese y seleccione el nombre del capacitador.",
            numeroHoras: "Ingrese el numero de horas.",
            fechaInicio: "Seleccione la fecha de inicio.",
            fechaFin: "Seleccione la fecha de fin.",

        };

        if (!validateRequiredFields(data, requiredFields, res)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'capacitaciones',
                metodo: 'post',
                endPoint: 'crearCapacitacion',
                accion: 'Crear registro fallido',
                detalle: 'Falta campos obligatorios por diligenciar.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return;
        }

        const { cedulaCapacitador } = data;

        if (cedulaCapacitador) {
            const [dataRows] = await dbRailway.query(`SELECT nit FROM plantaenlinea WHERE nit = ?`, [cedulaCapacitador]);

            if (dataRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken?.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                    rolUsuario: usuarioToken?.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'capacitaciones',
                    metodo: 'post',
                    endPoint: 'crearCapacitacion',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Cedula',
                    datos: { cedulaProporcionado: cedula },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Cedula", null, { "cedula": `La cedula ${regional} no se encuentra registrado en el sistema.` });
            }
        }

        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO capacitaciones (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM capacitaciones WHERE id = ?', [result.insertId]);

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'post',
            endPoint: 'crearCapacitacion',
            accion: 'Crear registro exitoso',
            detalle: 'Registro creado con exito',
            datos: { data },
            tablasIdsAfectados: [{
                tabla: 'capacitaciones',
                id: result.insertId?.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Registro creado correctamente`,
            `Se ha guardado el registro con ID ${result.insertId}.`,
            registroGuardado[0]
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'post',
            endPoint: 'crearCapacitacion',
            accion: 'Error al crear registro',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.delete('/eliminarCapacitacion/:id', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken?.usuario || null;;
    const { id } = req.params;

    try {
        if (!id) {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'capacitaciones',
                metodo: 'delete',
                endPoint: 'eliminarCapacitacion',
                accion: 'Eliminar registro fallido',
                detalle: 'El ID del registro es requerido.',
                datos: { id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "El ID del registro es requerido.");
        }

        const [existeRegistro] = await dbRailway.query(
            'SELECT * FROM capacitaciones WHERE id = ?',
            [id]
        );

        if (existeRegistro.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'capacitaciones',
                metodo: 'delete',
                endPoint: 'eliminarCapacitacion',
                accion: 'Eliminar registro fallido',
                detalle: 'El registro no existe o ya fue eliminado.',
                datos: { id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 404, "El registro no existe o ya fue eliminado.");
        }

        const registroEliminado = existeRegistro[0];

        const [result] = await dbRailway.query(
            'DELETE FROM capacitaciones WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            throw new Error('No se pudo eliminar el registro.');
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'delete',
            endPoint: 'eliminarCapacitacion',
            accion: 'Eliminar registro exitoso',
            detalle: `Registro ID ${id} eliminado correctamente`,
            datos: {
                id,
                registroEliminado
            },
            tablasIdsAfectados: [{
                tabla: 'capacitaciones',
                id: id.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Registro eliminado correctamente`,
            `Se ha eliminado el registro con ID ${id}.`,
            {
                id: id,
                eliminado: true,
                registro: registroEliminado
            }
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'delete',
            endPoint: 'eliminarCapacitacion',
            accion: 'Error al eliminar registro',
            detalle: 'Error interno del servidor',
            datos: {
                id,
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado al eliminar el registro.", err);
    }
});

router.post('/roles', async (req, res) => {

    const usuarioToken = req.validarToken?.usuario || null;

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'capacitaciones',
                metodo: 'post',
                endPoint: 'roles',
                accion: 'Consulta registros fallido',
                detalle: 'Los datos de usuario son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos de usuario son requeridos.");
        }

        if (!data?.cedula) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'capacitaciones',
                metodo: 'post',
                endPoint: 'roles',
                accion: 'Consulta archivos fallido',
                detalle: 'Se requiere la cedula para la consulta',
                datos: { dataProporcionado: data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Se requiere la cedula para la consulta");
        }

        const [rows] = await dbRailway.query('SELECT * FROM rol_capacitaciones where cedula = ?', [data.cedula]);

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'post',
            endPoint: 'roles',
            accion: 'Consulta registros exitosa',
            detalle: `Se consultó ${rows.length} registros`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de roles en capacitaciones.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacitaciones',
            metodo: 'post',
            endPoint: 'roles',
            accion: 'Error al obtener los registros',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado.", err);
    }
});

module.exports = router;