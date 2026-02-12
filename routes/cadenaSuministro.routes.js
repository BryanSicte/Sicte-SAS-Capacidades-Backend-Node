const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { validateRequiredFields } = require('../utils/validate');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');
const { uploadFileToDrive, getMimeType, getFileFromDrive } = require('../services/googleDriveService')
const multer = require('multer');
const upload = multer();
const path = require('path');

const folderId = '1dJdsXK_WxtvoLmn0Dgcm5uvRA1YYnbuE';

router.get('/registros', validarToken, async (req, res) => {

    const usuarioToken = req.validarToken.usuario

    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_solicitud_cadena_suministro');

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
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
            `Se obtuvieron ${rows.length} registros de las solicitudes de cadena de suministro.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
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

router.post('/crearRegistro',
    validarToken,
    upload.fields([
        { name: 'diseno', maxCount: 1 },
        { name: 'facturacionEsperada', maxCount: 1 }
    ]),
    async (req, res) => {

        const usuarioToken = req.validarToken.usuario

        try {
            const data = req.body;
            const archivos = req.files;

            if (!data || Object.keys(data).length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
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
                ciudad: "Ingrese y seleccione una ciudad.",
                area: "Ingrese y seleccione un area.",
                uuidOt: "Ingrese un UUID o OT.",
                nombreProyecto: "Ingrese un nombre del proyecto.",
                fechaEntregaProyectada: "Ingrese una fecha proyectada.",
            };

            if (!validateRequiredFields(data, requiredFields, res)) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
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

            const items = JSON.parse(data.items);

            if (items.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Items',
                    datos: { itemsProporcionado: items },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Items", null, { "items": `Por favor ingrese al menos un material` });
            }

            const driveResults = [];

            if (!archivos?.diseno) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Diseño',
                    datos: { ArchivoProporcionado: archivos },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Diseño", null, { "diseno": `Ingrese un archivo .zip para el diseño.` });
            }

            if (archivos?.diseno?.[0]) {
                const disenoFile = archivos.diseno[0];

                const disenoExt = path.extname(disenoFile.originalname);
                const disenoFileName = `${data.uuidOt}_diseno_${data.fecha}${disenoExt}`;

                const fileId = await uploadFileToDrive(
                    disenoFile.buffer,
                    disenoFileName,
                    folderId
                );

                const result = {
                    tipo: 'diseno',
                    nombre: disenoFileName,
                    id: fileId.id,
                    url: fileId.url,
                    webViewLink: fileId.webViewLink
                }

                driveResults.push(result);

                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'success',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Cargar diseño exitoso',
                    detalle: 'Registro creado con exito',
                    datos: { result },
                    tablasIdsAfectados: [],
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });
            }

            if (!archivos?.facturacionEsperada) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Facturacion esperada',
                    datos: { ArchivoProporcionado: archivos },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Facturacion esperada", null, { "facturacionEsperada": `Ingrese un archivo .zip para el diseño.` });
            }

            if (archivos?.facturacionEsperada?.[0]) {
                const facturacionFile = archivos.facturacionEsperada[0];

                const factExt = path.extname(facturacionFile.originalname);
                const factFileName = `${data.uuidOt}_facturacion_${data.fecha}${factExt}`;

                const fileId = await uploadFileToDrive(
                    facturacionFile.buffer,
                    factFileName,
                    folderId
                );

                const result = {
                    tipo: 'facturacion',
                    nombre: factFileName,
                    id: fileId.id,
                    url: fileId.url,
                    webViewLink: fileId.webViewLink
                }

                driveResults.push(result);

                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'success',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Cargar facturacion exitoso',
                    detalle: 'Registro creado con exito',
                    datos: { result },
                    tablasIdsAfectados: [],
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });
            }

            const disenoResult = driveResults.find(f => f.tipo === 'diseno') || null;
            const facturacionResult = driveResults.find(f => f.tipo === 'facturacion') || null;
            const disenoJSON = disenoResult ? JSON.stringify(disenoResult) : null;
            const facturacionJSON = facturacionResult ? JSON.stringify(facturacionResult) : null;

            const resultados = [];

            let nuevoNumeroSolicitud = 1;
            const [maxRows] = await dbRailway.query('SELECT MAX(solicitud) as maxSolicitud FROM registros_solicitud_cadena_suministro');
            const maxSolicitud = maxRows[0].maxSolicitud || 0;
            nuevoNumeroSolicitud = maxSolicitud + 1;

            for (const [index, item] of items.entries()) {

                const [result] = await dbRailway.query(
                    `INSERT INTO registros_solicitud_cadena_suministro (
                        solicitud,
                        fecha,
                        cedulaUsuario,
                        nombreUsuario,
                        ciudad,
                        area,
                        uuidOt,
                        nombreProyecto,
                        fechaEntregaProyectada,
                        diseno,
                        facturacionEsperada,
                        codigo,
                        descripcion,
                        um,
                        cantidad,
                        observaciones
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        nuevoNumeroSolicitud,
                        data.fecha,
                        data.cedulaUsuario,
                        data.nombreUsuario,
                        data.ciudad,
                        data.area,
                        data.uuidOt,
                        data.nombreProyecto,
                        data.fechaEntregaProyectada,
                        disenoJSON,
                        facturacionJSON,
                        item.codigo,
                        item.descripcion,
                        item.um,
                        item.cantidad,
                        data.observaciones
                    ]
                );

                resultados.push({
                    item: item.codigo,
                    descripcion: item.descripcion,
                    cantidad: item.cantidad,
                    insertId: result.insertId,
                    solicitud: nuevoNumeroSolicitud,
                    affectedRows: result.affectedRows
                });
            }

            const idsAfectados = resultados.map(r => ({
                tabla: 'registros_solicitud_cadena_suministro',
                id: r.insertId.toString()
            }));

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'post',
                endPoint: 'crearRegistro',
                accion: 'Crear registro exitoso',
                detalle: 'Registro creado con exito',
                datos: {
                    uuidOt: req.body.uuidOt,
                    solicitud: resultados[0].solicitud,
                    totalItems: resultados.length,
                    items: resultados.map(r => ({
                        codigo: r.item,
                        cantidad: r.cantidad,
                        insertId: r.insertId
                    })),
                    archivos: {
                        diseno: disenoJSON ? JSON.parse(disenoJSON) : null,
                        facturacion: facturacionJSON ? JSON.parse(facturacionJSON) : null
                    }
                },
                tablasIdsAfectados: idsAfectados,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                `Registro creado correctamente`,
                `Se ha guardado el registro con numero de solicitud ${resultados[0].solicitud}.`,
                resultados
            );

        } catch (err) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'Error sistema',
                cedulaUsuario: usuarioToken.cedula || 'Error sistema',
                rolUsuario: usuarioToken.rol || 'Error sistema',
                nivel: 'error',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
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

router.get('/auxiliar', validarToken, async (req, res) => {

    const usuarioToken = req.validarToken.usuario

    try {
        const [rows] = await dbRailway.query('SELECT * FROM tabla_aux_cadena_de_suministro');

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'get',
            endPoint: 'auxiliar',
            accion: 'Consulta tabla auxiliar exitosa',
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
            `Se obtuvieron registros de la data auxiliar de cadena de suministro.`,
            rows
        );

    } catch (err) {

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'get',
            endPoint: 'auxiliar',
            accion: 'Error al obtener la tabla auxiliar',
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

router.post('/obtenerArchivos', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario
    const { nameDiseno, nameFacturacion } = req.body;

    try {
        const resultados = {};

        if (!nameDiseno) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'post',
                endPoint: 'obtenerArchivos',
                accion: 'Consulta archivos fallido',
                detalle: 'Registro no permitido: Nombre Diseño',
                datos: { nombreDiseñoProporcionado: nameDiseno },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Diseño", null, { "nameDiseno": `Ingrese el nombre del diseño.` });
        }

        if (nameDiseno) {
            const disenoBuffer = await getFileFromDrive(nameDiseno, folderId);
            if (disenoBuffer) {
                resultados.diseno = {
                    nombre: nameDiseno,
                    data: disenoBuffer.toString('base64'),
                    contentType: getMimeType(nameDiseno)
                };
            }
        }

        if (!nameFacturacion) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'post',
                endPoint: 'obtenerArchivos',
                accion: 'Consulta archivos fallido',
                detalle: 'Registro no permitido: Nombre Facturacion',
                datos: { nombreFacturacionProporcionado: nameFacturacion },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Facturacion", null, { "nameFacturacion": `Ingrese el nombre del diseño.` });
        }

        if (nameFacturacion) {
            const factBuffer = await getFileFromDrive(nameFacturacion, folderId);
            if (factBuffer) {
                resultados.facturacion = {
                    nombre: nameFacturacion,
                    data: factBuffer.toString('base64'),
                    contentType: getMimeType(nameFacturacion)
                };
            }
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'post',
            endPoint: 'obtenerArchivos',
            accion: 'Consulta archivos exitosa',
            detalle: `Se consultó ${resultados.length} registros`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron los archivos correctamente.`,
            resultados
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'post',
            endPoint: 'obtenerArchivos',
            accion: 'Error al obtener los archivos',
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