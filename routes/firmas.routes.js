const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { validateRequiredFields } = require('../utils/validate');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');
const { handleFirmaUpload } = require('../utils/base64')
const { getFileByNameBase64 } = require('../services/googleDriveService');
const bcrypt = require('bcrypt');

const folderId = '1iZnIeWxmANB1Tp0Kj6AY62pxlW2cAlca';

router.get('/registros', validarToken, async (req, res) => {

    const usuarioToken = req.validarToken?.usuario || null;

    try {
        const [rows] = await dbRailway.query('SELECT * FROM firmas');

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'firmas',
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
            `Se obtuvieron ${rows.length} registros de firmas.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'firmas',
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

router.post('/registro', validarToken, async (req, res) => {

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
                app: 'firmas',
                metodo: 'post',
                endPoint: 'registro',
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
                app: 'firmas',
                metodo: 'post',
                endPoint: 'registro',
                accion: 'Consulta registros fallido',
                detalle: 'Se requiere la cedula para la consulta',
                datos: { dataProporcionado: data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Se requiere la cedula para la consulta");
        }

        const [rows] = await dbRailway.query('SELECT * FROM firmas where cedulaUsuario = ?', [data.cedula]);

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'firmas',
            metodo: 'post',
            endPoint: 'registro',
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
            `Se obtuvieron ${rows.length} registros de firmas.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'firmas',
            metodo: 'post',
            endPoint: 'registro',
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

router.post('/crearRegistro', validarToken, async (req, res) => {
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
                app: 'firmas',
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
            cedulaUsuario: "No se pudo identificar la cedula del usuario.",
            nombreUsuario: "No se pudo identificar el nombre del usuario.",
            firma: "Ingrese la firma.",
            contrasena: "Ingrese la contraseña.",
        };

        if (!validateRequiredFields(data, requiredFields, res)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'firmas',
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

        const { cedulaUsuario, firma, contrasena } = data;

        if (cedulaUsuario) {
            const [userRows] = await dbRailway.query(`SELECT cedula FROM user WHERE cedula = ? LIMIT 1`, [cedulaUsuario]);

            if (userRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'firmas',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Cédula de usuario',
                    datos: { cedulaUsuarioProporcionado: cedulaUsuario },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Cédula de usuario", null, { "cedulaUsuario": `La cédula ${cedulaUsuario} no se encuentra registrada en el sistema.` });
            }

            const [firmaRows] = await dbRailway.query(`SELECT cedulaUsuario FROM firmas WHERE cedulaUsuario = ? LIMIT 1`, [cedulaUsuario]);

            if (firmaRows.length > 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'firmas',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Cédula de usuario ya tiene firma registrada.',
                    datos: { cedulaUsuarioProporcionado: cedulaUsuario },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Cédula de usuario ya tiene firma registrada.", null, { "cedulaUsuario": `La cédula ${cedulaUsuario} ya tiene una firma registrada.` });
            }
        }

        if (contrasena) {

            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
            if (!passwordRegex.test(contrasena)) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'firmas',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Contraseña no cumple requisitos',
                    datos: {
                        contrasenaProporcionado: contrasena
                    },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: La contraseña no cumple con los requisitos de seguridad", null, {
                    "contrasena": "La contraseña debe tener al menos 8 caracteres, una letra mayúscula, una letra minúscula y un número."
                });
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
                    app: 'firmas',
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

        const fileId = await handleFirmaUpload(data.firma, data.cedulaUsuario, folderId);
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(contrasena, saltRounds);

        const datosParaBD = {
            ...data,
            firma: fileId.nameFile ? fileId.nameFile : null,
            contrasena: hashedPassword
        };
        const keys = Object.keys(datosParaBD);
        const values = Object.values(datosParaBD);
        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO firmas (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM firmas WHERE id = ?', [result.insertId]);

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'firmas',
            metodo: 'post',
            endPoint: 'crearRegistro',
            accion: 'Crear registro exitoso',
            detalle: 'Registro creado con exito',
            datos: { datosParaBD },
            tablasIdsAfectados: [{
                tabla: 'firmas',
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
            app: 'firmas',
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

router.post('/roles', validarToken, async (req, res) => {

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
                app: 'firmas',
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
                app: 'firmas',
                metodo: 'post',
                endPoint: 'roles',
                accion: 'Consulta registros fallido',
                detalle: 'Se requiere la cedula para la consulta',
                datos: { dataProporcionado: data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Se requiere la cedula para la consulta");
        }

        const [rows] = await dbRailway.query('SELECT * FROM rol_firmas where cedula = ?', [data.cedula]);

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'firmas',
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
            `Se obtuvieron ${rows.length} registros de roles en firmas.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'firmas',
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

router.post('/obtenerImagen', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken?.usuario || null;
    const { imageName } = req.body;

    if (!imageName) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'log',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'firmas',
            metodo: 'post',
            endPoint: 'obtenerImagen',
            accion: 'Obtencion de imagen fallido',
            detalle: 'Imagen no encontrada',
            datos: { imageName: imageName },
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
                app: 'firmas',
                metodo: 'post',
                endPoint: 'obtenerImagen',
                accion: 'Obtencion de imagen fallido',
                detalle: 'Imagen no encontrada',
                datos: { imageName: imageName },
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
                app: 'firmas',
                metodo: 'post',
                endPoint: 'obtenerImagen',
                accion: 'Obtencion de imagen fallido',
                detalle: 'Formato de imagen inválido',
                datos: { imageName: imageName },
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
            app: 'firmas',
            metodo: 'post',
            endPoint: 'obtenerImagen',
            accion: 'Consulta imagen exitosa',
            detalle: `Se obtuvo la imagen ${imageName} exitosamente.`,
            datos: { imageName: imageName },
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
            app: 'firmas',
            metodo: 'post',
            endPoint: 'obtenerImagen',
            accion: 'Error al obtener la imagen',
            detalle: 'Error interno del servidor',
            datos: {
                imageName: imageName,
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

router.put('/editarRegistro/:id', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken?.usuario || null;

    try {
        const { id } = req.params;
        const data = req.body;

        if (!id || isNaN(id)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'firmas',
                metodo: 'put',
                endPoint: 'editarRegistro',
                accion: 'Editar registro fallido',
                detalle: 'ID de registro inválido o no proporcionado',
                datos: { idProporcionado: id, data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "ID de registro inválido o no proporcionado.");
        }

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'firmas',
                metodo: 'put',
                endPoint: 'editarRegistro',
                accion: 'Editar registro fallido',
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
            cedulaUsuario: "No se pudo identificar la cedula del usuario.",
            nombreUsuario: "No se pudo identificar el nombre del usuario.",
            firma: "Ingrese la firma.",
            actualContrasena: "Ingrese la contraseña actual.",
            contrasena: "Ingrese la contraseña.",
        };

        if (!validateRequiredFields(data, requiredFields, res)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'firmas',
                metodo: 'put',
                endPoint: 'editarRegistro',
                accion: 'Editar registro fallido',
                detalle: 'Falta campos obligatorios por diligenciar.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return;
        }

        const { cedulaUsuario, firma, contrasena } = data;
        const { actualContrasena, ...dataSinActualContrasena } = data;

        if (cedulaUsuario) {
            const [userRows] = await dbRailway.query(`SELECT cedula FROM user WHERE cedula = ? LIMIT 1`, [cedulaUsuario]);

            if (userRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'firmas',
                    metodo: 'put',
                    endPoint: 'editarRegistro',
                    accion: 'Editar registro fallido',
                    detalle: 'Registro no permitido: Cédula de usuario',
                    datos: { cedulaUsuarioProporcionado: cedulaUsuario },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Cédula de usuario", null, { "cedulaUsuario": `La cédula ${cedulaUsuario} no se encuentra registrada en el sistema.` });
            }

            const [firmaRows] = await dbRailway.query(`SELECT cedulaUsuario, contrasena FROM firmas WHERE cedulaUsuario = ? LIMIT 1`, [cedulaUsuario]);

            if (firmaRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'firmas',
                    metodo: 'put',
                    endPoint: 'editarRegistro',
                    accion: 'Editar registro fallido',
                    detalle: 'Registro no permitido: Cédula de usuario no tiene firma registrada.',
                    datos: { cedulaUsuarioProporcionado: cedulaUsuario },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Cédula de usuario no tiene firma registrada.", null, { "cedulaUsuario": `La cédula ${cedulaUsuario} no tiene una firma registrada.` });
            }

            if (!await bcrypt.compare(actualContrasena, firmaRows[0].contrasena)) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'firmas',
                    metodo: 'put',
                    endPoint: 'editarRegistro',
                    accion: 'Editar registro fallido',
                    detalle: 'Registro no permitido: Contraseña actual incorrecta.',
                    datos: { cedulaUsuarioProporcionado: cedulaUsuario },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Contraseña actual incorrecta.", null, { "actualContrasena": `La contraseña actual proporcionada no coincide con la registrada.` });
            }
        }

        if (contrasena) {
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
            if (!passwordRegex.test(contrasena)) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'firmas',
                    metodo: 'put',
                    endPoint: 'editarRegistro',
                    accion: 'Editar registro fallido',
                    detalle: 'Registro no permitido: Contraseña no cumple requisitos',
                    datos: {
                        contrasenaProporcionado: contrasena
                    },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: La contraseña no cumple con los requisitos de seguridad", null, {
                    "contrasena": "La contraseña debe tener al menos 8 caracteres, una letra mayúscula, una letra minúscula y un número."
                });
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
                    app: 'firmas',
                    metodo: 'put',
                    endPoint: 'editarRegistro',
                    accion: 'Editar registro fallido',
                    detalle: 'Registro no permitido: Firma',
                    datos: { cedulaProporcionado: cedula },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Firma", null, { "firma": `Formato de firma inválido. Debe ser Base64 con prefijo data:image/.` });
            }
        }

        const fileId = await handleFirmaUpload(data.firma, data.cedulaUsuario, folderId);
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(contrasena, saltRounds);

        const datosParaBD = {
            ...dataSinActualContrasena,
            firma: fileId.nameFile ? fileId.nameFile : null,
            contrasena: hashedPassword
        };

        const camposActualizados = {};
        Object.keys(datosParaBD).forEach(key => {
            if (datosParaBD[key] !== undefined && datosParaBD[key] !== null && datosParaBD[key] !== '') {
                camposActualizados[key] = datosParaBD[key];
            }
        });

        const keys = Object.keys(camposActualizados);
        if (keys.length === 0) {
            return sendError(res, 400, "No hay campos válidos para actualizar.");
        }

        const setClause = keys.map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(camposActualizados), id];

        const query = `
            UPDATE firmas 
            SET ${setClause}
            WHERE id = ?
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM firmas WHERE id = ?', [result.insertId]);

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'firmas',
            metodo: 'put',
            endPoint: 'editarRegistro',
            accion: 'Editar registro exitoso',
            detalle: 'Registro editado con exito',
            datos: { datosParaBD },
            tablasIdsAfectados: [{
                tabla: 'firmas',
                id: result.insertId?.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Registro editado correctamente`,
            `Se ha editado el registro con ID ${id}.`,
            registroGuardado[0]
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'firmas',
            metodo: 'put',
            endPoint: 'editarRegistro',
            accion: 'Error al editar registro',
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

router.put('/eliminarRegistro/:id', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken?.usuario || null;

    try {
        const { id } = req.params;
        const data = req.body;

        if (!id || isNaN(id)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'firmas',
                metodo: 'put',
                endPoint: 'eliminarRegistro',
                accion: 'Eliminar registro exitoso',
                detalle: 'Registro eliminado con éxito',
                datos: { idProporcionado: id, data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "ID de registro inválido o no proporcionado.");
        }

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'firmas',
                metodo: 'put',
                endPoint: 'eliminarRegistro',
                accion: 'Eliminar registro fallido',
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
            cedulaUsuario: "No se pudo identificar la cedula del usuario.",
            nombreUsuario: "No se pudo identificar el nombre del usuario.",
            actualContrasena: "Ingrese la contraseña actual.",
        };

        if (!validateRequiredFields(data, requiredFields, res)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'firmas',
                metodo: 'put',
                endPoint: 'eliminarRegistro',
                accion: 'Eliminar registro fallido',
                detalle: 'Falta campos obligatorios por diligenciar.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return;
        }

        const { cedulaUsuario, actualContrasena } = data;

        const [registroGuardado] = await dbRailway.query('SELECT * FROM firmas WHERE id = ?', [id]);

        if (cedulaUsuario) {
            const [userRows] = await dbRailway.query(`SELECT cedula FROM user WHERE cedula = ? LIMIT 1`, [cedulaUsuario]);

            if (userRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'firmas',
                    metodo: 'put',
                    endPoint: 'eliminarRegistro',
                    accion: 'Eliminar registro fallido',
                    detalle: 'Registro no permitido: Cédula de usuario',
                    datos: { cedulaUsuarioProporcionado: cedulaUsuario },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Cédula de usuario", null, { "cedulaUsuario": `La cédula ${cedulaUsuario} no se encuentra registrada en el sistema.` });
            }

            const [firmaRows] = await dbRailway.query(`SELECT cedulaUsuario, contrasena FROM firmas WHERE cedulaUsuario = ? LIMIT 1`, [cedulaUsuario]);

            if (firmaRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'firmas',
                    metodo: 'put',
                    endPoint: 'eliminarRegistro',
                    accion: 'Eliminar registro fallido',
                    detalle: 'Registro no permitido: Cédula de usuario no tiene firma registrada.',
                    datos: { cedulaUsuarioProporcionado: cedulaUsuario },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Cédula de usuario no tiene firma registrada.", null, { "cedulaUsuario": `La cédula ${cedulaUsuario} no tiene una firma registrada.` });
            }

            if (!await bcrypt.compare(actualContrasena, firmaRows[0].contrasena)) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'firmas',
                    metodo: 'put',
                    endPoint: 'eliminarRegistro',
                    accion: 'Eliminar registro fallido',
                    detalle: 'Registro no permitido: Contraseña actual incorrecta.',
                    datos: { cedulaUsuarioProporcionado: cedulaUsuario },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Contraseña actual incorrecta.", null, { "actualContrasena": `La contraseña actual proporcionada no coincide con la registrada.` });
            }
        }

        const [result] = await dbRailway.query(
            `DELETE FROM firmas WHERE id = ?`,
            [id]
        );

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'firmas',
            metodo: 'put',
            endPoint: 'eliminarRegistro',
            accion: 'Eliminar registro exitoso',
            detalle: 'Registro eliminado con exito',
            datos: { datosEliminados: registroGuardado[0] },
            tablasIdsAfectados: [{
                tabla: 'firmas',
                id: id
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Registro eliminado correctamente`,
            `Se ha eliminado el registro con ID ${id}.`,
            registroGuardado[0]
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'firmas',
            metodo: 'put',
            endPoint: 'eliminarRegistro',
            accion: 'Error al eliminar registro',
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