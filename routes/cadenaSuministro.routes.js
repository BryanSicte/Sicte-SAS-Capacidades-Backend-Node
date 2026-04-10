const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { validateRequiredFields } = require('../utils/validate');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');
const { uploadFileToDrive, getMimeType, getFileFromDrive } = require('../services/googleDriveService')
const { getFechaHoraColombia } = require('../utils/formatdate');
const multer = require('multer');
const upload = multer();
const path = require('path');
const bcrypt = require('bcrypt');

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
            const fechaColombia = getFechaHoraColombia()

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
                const disenoFileName = `${data.uuidOt}_diseno_${fechaColombia}${disenoExt}`;

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
                const factFileName = `${data.uuidOt}_facturacion_${fechaColombia}${factExt}`;

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
                        observaciones,
                        estadoSolicitud,
                        estadoLogistica
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                        data.observaciones,
                        "Pendiente Logistica",
                        "Pendiente"
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

router.put('/logisticaActualizarCantidades/:id', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;

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
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'logisticaActualizarCantidades',
                accion: 'Deshabilitar proveedor fallido',
                accion: 'Actualizar cantidades fallido',
                datos: { idProporcionado: id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "ID de solicitud inválido o no proporcionado.");
        }

        const [solicitudesExistentes] = await dbRailway.query(
            'SELECT id, cantidad FROM registros_solicitud_cadena_suministro WHERE solicitud = ?',
            [id]
        );

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'logisticaActualizarCantidades',
                accion: 'Actualizar cantidades fallido',
                detalle: 'Los datos del formulario son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del formulario son requeridos.");
        }

        const fechaColombia = getFechaHoraColombia()
        const { cantidadesEditadas } = data;
        const idsActualizados = [];

        const cantidadesExistentesMap = {};
        solicitudesExistentes.forEach(solicitud => {
            cantidadesExistentesMap[solicitud.id] = solicitud.cantidad;
        });

        for (const [id, cantidadEditada] of Object.entries(cantidadesEditadas)) {

            const cantidadExistente = cantidadesExistentesMap[id];
            let estadoSolicitudRegistro = 'Validar';
            let estadoCompra = 'Validar';
            let estadoAprobacion1 = 'Validar';
            let estadoAprobacion2 = 'Validar';
            let estadoAprobacion3 = 'Validar';
            let estadoTesoreria = 'Validar';
            let estadoEntregaProveedor = 'Validar';
            let cantidadRestante = 0;

            if (parseFloat(cantidadExistente) === parseFloat(cantidadEditada)) {
                estadoSolicitudRegistro = 'Pendiente Aprobacion 1';
                estadoCompra = 'No aplica';
                estadoAprobacion1 = 'Pendiente';
                estadoAprobacion2 = 'No aplica';
                estadoAprobacion3 = 'No aplica';
                estadoTesoreria = 'No aplica';
                estadoEntregaProveedor = 'No aplica';
            } else if (parseFloat(cantidadEditada) < parseFloat(cantidadExistente)) {
                estadoSolicitudRegistro = 'Pendiente Compras';
                estadoCompra = 'Pendiente';
                estadoAprobacion1 = null;
                estadoAprobacion2 = null;
                estadoAprobacion3 = null;
                estadoTesoreria = null;
                estadoEntregaProveedor = null;
            } else if (parseFloat(cantidadEditada) > parseFloat(cantidadExistente)) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'logisticaActualizarCantidades',
                    accion: 'Actualizar cantidades fallido',
                    detalle: 'La cantidad disponible no puede ser mayor a la cantidad requerida.',
                    datos: { data },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "La cantidad disponible no puede ser mayor a la cantidad requerida.");
            } else {
                estadoSolicitudRegistro = 'Pendiente logistica';
                estadoCompra = null;
                estadoAprobacion1 = null;
                estadoAprobacion2 = null;
                estadoAprobacion3 = null;
                estadoTesoreria = null;
                estadoEntregaProveedor = null;
            }

            cantidadRestante = parseFloat(cantidadExistente) - parseFloat(cantidadEditada);

            await dbRailway.query(
                `UPDATE registros_solicitud_cadena_suministro SET 
                fechaLogistica = ?, 
                cedulaUsuarioLogistica = ?, 
                nombreUsuarioLogistica = ?, 
                disponibilidadLogistica = ?, 
                cantidadRestante = ?,
                estadoSolicitud = ?,  
                estadoLogistica = ?, 
                estadoCompra = ? ,
                estadoAprobacion1 = ?,
                estadoAprobacion2 = ?,
                estadoAprobacion3 = ?,
                estadoTesoreria = ?,
                estadoEntregaProveedor = ?
                WHERE id = ? LIMIT 1`,
                [
                    fechaColombia,
                    usuarioToken.cedula,
                    usuarioToken.nombre,
                    cantidadEditada,
                    cantidadRestante,
                    estadoSolicitudRegistro,
                    'Realizado',
                    estadoCompra,
                    estadoAprobacion1,
                    estadoAprobacion2,
                    estadoAprobacion3,
                    estadoTesoreria,
                    estadoEntregaProveedor,
                    id
                ]
            );
            idsActualizados.push(id);
        }

        const registrosActualizados = [];
        for (const id of idsActualizados) {
            const [registro] = await dbRailway.query(
                'SELECT * FROM registros_solicitud_cadena_suministro WHERE id = ?',
                [id]
            );
            if (registro.length > 0) {
                registrosActualizados.push(registro[0]);
            }
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'logisticaActualizarCantidades',
            accion: 'Actualizar cantidades exitoso',
            detalle: 'Cantidades actualizadas correctamente',
            datos: {
                solicitud: id,
                cantidadesEditadas: cantidadesEditadas,
                solicitudExistente: solicitudesExistentes,
                solicitudActual: registrosActualizados
            },
            tablasIdsAfectados: [{
                tabla: 'registros_solicitud_cadena_suministro',
                solicitud: id.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Cantidades de materiales actualizadas correctamente`,
            `Se actualizaron ${idsActualizados.length} registro(s) de cantidades.`,
            registrosActualizados
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'logisticaActualizarCantidades',
            accion: 'Error al actualizar cantidades',
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

router.put('/comprasActualizarCampos/:id', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;

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
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasActualizarCampos',
                accion: 'Actualizar campos de compra fallido',
                detalle: 'ID de solicitud inválido o no proporcionado',
                datos: { idProporcionado: id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "ID de solicitud inválido o no proporcionado.");
        }

        const [solicitudesExistentes] = await dbRailway.query(
            'SELECT * FROM registros_solicitud_cadena_suministro WHERE solicitud = ?',
            [id]
        );

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasActualizarCampos',
                accion: 'Actualizar campos de compra fallido',
                detalle: 'Los datos del formulario son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del formulario son requeridos.");
        }

        const fechaColombia = getFechaHoraColombia()
        const { editadosCompras } = data;
        const idsActualizados = [];

        for (const [key, value] of Object.entries(editadosCompras)) {
            const {
                id,
                centroCostos,
                nitProveedor,
                proveedor,
                descripcionProveedor,
                umProveedor,
                cantidadProveedor,
                formaPago,
                plazoPagoDias,
                tipoMoneda,
                precioAnticipo,
                precioUnitario,
                precioTotalSinIva,
                iva,
                precioTotalConIva,
                plazoEntrega,
                observacionCompra
            } = value;

            const camposRequeridos = [
                { nombre: 'id', valor: id },
                { nombre: 'centroCostos', valor: centroCostos },
                { nombre: 'nitProveedor', valor: nitProveedor },
                { nombre: 'proveedor', valor: proveedor },
                { nombre: 'descripcionProveedor', valor: descripcionProveedor },
                { nombre: 'umProveedor', valor: umProveedor },
                { nombre: 'cantidadProveedor', valor: cantidadProveedor },
                { nombre: 'formaPago', valor: formaPago },
                { nombre: 'plazoPagoDias', valor: plazoPagoDias },
                { nombre: 'tipoMoneda', valor: tipoMoneda },
                { nombre: 'precioAnticipo', valor: precioAnticipo },
                { nombre: 'precioUnitario', valor: precioUnitario },
                { nombre: 'precioTotalSinIva', valor: precioTotalSinIva },
                { nombre: 'iva', valor: iva },
                { nombre: 'precioTotalConIva', valor: precioTotalConIva },
                { nombre: 'plazoEntrega', valor: plazoEntrega }
            ];

            const campoVacio = camposRequeridos.find(campo => !campo.valor || campo.valor === 'No se encontraron registros');

            if (campoVacio) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'comprasActualizarCampos',
                    accion: 'Actualizar campos de compra fallido',
                    detalle: `El campo '${campoVacio.nombre}' no fue proporcionado.`,
                    datos: { data },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, `El campo '${campoVacio.nombre}' es requerido y no fue proporcionado.`);
            }

            await dbRailway.query(
                `UPDATE registros_solicitud_cadena_suministro SET 
                fechaCompra = ?, 
                cedulaUsuarioCompras = ?, 
                nombreUsuarioCompras = ?, 
                centroCostos = ?,
                nitProveedor = ?,
                proveedor = ?, 
                descripcionProveedor = ?, 
                umProveedor = ?,
                cantidadProveedor = ?,
                formaPago = ?, 
                plazoPagoDias = ?, 
                tipoMoneda = ?,
                precioAnticipo = ?,
                precioUnitario = ?,
                precioTotalSinIva = ?,
                iva = ?,
                precioTotalConIva = ?,
                plazoEntrega = ?,
                observacionCompra = ?,
                estadoCompra = ?
                WHERE id = ? LIMIT 1`,
                [
                    fechaColombia,
                    usuarioToken.cedula,
                    usuarioToken.nombre,
                    centroCostos,
                    nitProveedor,
                    proveedor,
                    descripcionProveedor,
                    umProveedor,
                    cantidadProveedor,
                    formaPago,
                    plazoPagoDias,
                    tipoMoneda,
                    precioAnticipo,
                    precioUnitario,
                    precioTotalSinIva,
                    iva,
                    precioTotalConIva,
                    plazoEntrega,
                    observacionCompra,
                    'En Proceso',
                    id
                ]
            );
            idsActualizados.push(id);
        }

        const registrosActualizados = [];
        for (const id of idsActualizados) {
            const [registro] = await dbRailway.query(
                'SELECT * FROM registros_solicitud_cadena_suministro WHERE id = ?',
                [id]
            );
            if (registro.length > 0) {
                registrosActualizados.push(registro[0]);
            }
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'comprasActualizarCampos',
            accion: 'Actualizar campos de compra exitoso',
            detalle: 'Campos de compra actualizados correctamente',
            datos: {
                solicitud: id,
                solicitudExistente: solicitudesExistentes,
                solicitudActual: registrosActualizados
            },
            tablasIdsAfectados: [{
                tabla: 'registros_solicitud_cadena_suministro',
                solicitud: id.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Campos de compra actualizados correctamente`,
            `Se actualizaron ${idsActualizados.length} registro(s) de campos de compra.`,
            registrosActualizados
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'logisticaActualizarCantidades',
            accion: 'Error al actualizar cantidades',
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

router.put('/comprasGenerarOC', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasGenerarOC',
                accion: 'Generar orden de compra fallido',
                detalle: 'Los datos del formulario son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del formulario son requeridos.");
        }

        const { contrasena, fechaOrdenCompra, totalOrdenCompra, ids } = data;

        if (!contrasena || !fechaOrdenCompra || !totalOrdenCompra || !ids || !Array.isArray(ids) || ids.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasGenerarOC',
                accion: 'Generar orden de compra fallido',
                detalle: 'Fecha, total y array de IDs son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Contraseña, fecha, total y array de IDs son requeridos");
        }

        const [firma] = await dbRailway.query(
            `SELECT * FROM firmas WHERE cedulaUsuario = ?`,
            [usuarioToken.cedula]
        );

        if (firma.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasGenerarOC',
                accion: 'Generar orden de compra fallido',
                detalle: 'Registro no permitido: Cédula de usuario no tiene firma registrada.',
                datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Cédula de usuario no tiene firma registrada.");
        }

        if (!await bcrypt.compare(contrasena, firma[0].contrasena)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasGenerarOC',
                accion: 'Generar orden de compra fallido',
                detalle: 'Registro no permitido: Contraseña actual incorrecta.',
                datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Contraseña actual incorrecta.", null, { "contrasena": `La contraseña actual proporcionada no coincide con la registrada.` });
        }

        const [registrosExistentes] = await dbRailway.query(
            `SELECT id FROM registros_solicitud_cadena_suministro WHERE id IN (?)`,
            [ids]
        );

        const idsExistentes = registrosExistentes.map(r => r.id);
        const idsNoExistentes = ids.filter(id => !idsExistentes.includes(id));

        if (idsNoExistentes.length > 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasGenerarOC',
                accion: 'Generar orden de compra fallido',
                detalle: `IDs no encontrados: ${idsNoExistentes.join(', ')}`,
                datos: { idsEnviados: ids, idsEncontrados: idsExistentes },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 404, `Los siguientes IDs no existen: ${idsNoExistentes.join(', ')}`);
        }

        const fechaColombia = getFechaHoraColombia()
        const añoActual = parseInt(fechaColombia.split('-')[0]);

        const [ultimaOrden] = await dbRailway.query(`
            SELECT ordenCompra 
            FROM registros_solicitud_cadena_suministro 
            WHERE ordenCompra IS NOT NULL 
            AND ordenCompra != '' 
            AND ordenCompra LIKE ?
            ORDER BY ordenCompra DESC 
            LIMIT 1
        `, [`OC - ${añoActual} - %`]);

        let nuevoConsecutivo = 1;

        if (ultimaOrden && ultimaOrden.length > 0) {
            const ultimoNumero = ultimaOrden[0].ordenCompra.split(' - ')[2];
            if (ultimoNumero) {
                nuevoConsecutivo = parseInt(ultimoNumero) + 1;
            }
        }

        const consecutivoFormateado = nuevoConsecutivo.toString().padStart(5, '0');
        const nuevaOrdenCompra = `OC - ${añoActual} - ${consecutivoFormateado}`;

        const connection = await dbRailway.getConnection();
        await connection.beginTransaction();

        try {
            const placeholders = ids.map(() => '?').join(',');
            const [result] = await connection.query(
                `
                UPDATE registros_solicitud_cadena_suministro 
                SET 
                    fechaOrdenCompra = ?,
                    cedulaUsuarioElaboraCompra = ?,
                    nombreUsuarioElaboraCompra = ?,
                    ordenCompra = ?,
                    totalOrdenCompra = ?,
                    firmaCompra = ?,
                    estadoSolicitud = ?,
                    estadoCompra = ?,
                    estadoAprobacion1 = ?
                WHERE id IN (${placeholders})
                `,
                [fechaOrdenCompra, usuarioToken.cedula, usuarioToken.nombre, nuevaOrdenCompra, totalOrdenCompra, firma[0].firma, 'Pendiente Aprobacion 1', 'Realizado', 'Pendiente', ...ids]
            );

            await connection.commit();

            const [registrosActualizados] = await dbRailway.query(
                `SELECT * FROM registros_solicitud_cadena_suministro WHERE id IN (?)`,
                [ids]
            );

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasGenerarOC',
                accion: 'Generar orden de compra exitoso',
                detalle: `Orden de compra ${nuevaOrdenCompra} generada para ${ids.length} registro(s)`,
                datos: {
                    ordenCompra: nuevaOrdenCompra,
                    fechaOrdenCompra,
                    totalOrdenCompra,
                    idsActualizados: ids,
                    registrosAfectados: result.affectedRows
                },
                tablasIdsAfectados: ids.map(id => ({
                    tabla: 'registros_solicitud_cadena_suministro',
                    id: id.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                `Orden de compra generada correctamente`,
                `Se generó la orden ${nuevaOrdenCompra} para ${result.affectedRows} registro(s).`,
                {
                    ordenCompra: nuevaOrdenCompra,
                    registrosActualizados: registrosActualizados,
                    idsActualizados: ids
                }
            );

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'comprasGenerarOC',
            accion: 'Error al generar la orden de compra',
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

router.put('/comprasAprobacion1/:id', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;

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
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Actualizar aprobacion 1 fallido',
                detalle: 'ID de solicitud inválido o no proporcionado',
                datos: { idProporcionado: id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "ID de solicitud inválido o no proporcionado.");
        }

        const [solicitudExistente] = await dbRailway.query(
            'SELECT * FROM registros_solicitud_cadena_suministro WHERE solicitud = ?',
            [id]
        );

        if (solicitudExistente.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Generar orden de compra fallido',
                detalle: `Solicitud no encontrada en base de datos.`,
                datos: { solicitudEnviado: id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 404, `Solicitud no encontrada en base de datos`);
        }

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Actualizar aprobacion 1 fallido',
                detalle: 'Los datos del formulario son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del formulario son requeridos.");
        }

        const { contrasena, observaciones, estado } = data;

        if (!estado) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Actualizar aprobacion 1 fallido',
                detalle: 'Estado es requerido.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "El estado es obligatorio");
        }

        if (!contrasena) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Actualizar aprobacion 1 fallido',
                detalle: 'Contraseña es requerida.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Campo Obligatorio", null, { "contrasena": `La contraseña es requerida.` });
        }

        const [firma] = await dbRailway.query(
            `SELECT * FROM firmas WHERE cedulaUsuario = ?`,
            [usuarioToken.cedula]
        );

        if (firma.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Actualizar aprobacion 1 fallido',
                detalle: 'Registro no permitido: Cédula de usuario no tiene firma registrada.',
                datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Cédula de usuario no tiene firma registrada.");
        }

        if (!await bcrypt.compare(contrasena, firma[0].contrasena)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Actualizar aprobacion 1 fallido',
                detalle: 'Registro no permitido: Contraseña actual incorrecta.',
                datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Contraseña actual incorrecta.", null, { "contrasena": `La contraseña actual proporcionada no coincide con la registrada.` });
        }

        const tieneOrdenCompra = solicitudExistente.some(registro =>
            registro.ordenCompra && registro.ordenCompra.startsWith('OC')
        );

        const fechaColombia = getFechaHoraColombia();
        const estadoSolicitud = estado === 'Aprobado' ? tieneOrdenCompra ? 'Pendiente Aprobacion 2' : 'Pendiente Despacho Bodega' : estado;

        const connection = await dbRailway.getConnection();
        await connection.beginTransaction();

        try {
            let result;

            if (estado === 'Aprobado') {
                const [resultSinOrden] = await connection.query(
                    `
                        UPDATE registros_solicitud_cadena_suministro 
                        SET 
                            fechaAprobacion1 = ?,
                            cedulaUsuarioAprobacion1 = ?,
                            nombreUsuarioAprobacion1 = ?,
                            observacionAprobacion1 = ?,
                            firmaAprobacion1 = ?,
                            estadoAprobacion1 = ?,
                            estadoSolicitud = 'Pendiente Despacho Bodega'
                        WHERE solicitud = ? 
                        AND (ordenCompra IS NULL OR ordenCompra = '' OR NOT ordenCompra LIKE 'OC%')
                    `,
                    [
                        fechaColombia,
                        usuarioToken.cedula,
                        usuarioToken.nombre,
                        observaciones || null,
                        firma[0].firma,
                        estado,
                        id
                    ]
                );

                const [resultConOrden] = await connection.query(
                    `
                        UPDATE registros_solicitud_cadena_suministro 
                        SET 
                            fechaAprobacion1 = ?,
                            cedulaUsuarioAprobacion1 = ?,
                            nombreUsuarioAprobacion1 = ?,
                            observacionAprobacion1 = ?,
                            firmaAprobacion1 = ?,
                            estadoAprobacion1 = ?,
                            estadoAprobacion2 = 'Pendiente',
                            estadoSolicitud = 'Pendiente Aprobacion 2'
                        WHERE solicitud = ? 
                        AND ordenCompra LIKE 'OC%'
                    `,
                    [
                        fechaColombia,
                        usuarioToken.cedula,
                        usuarioToken.nombre,
                        observaciones || null,
                        firma[0].firma,
                        estado,
                        id
                    ]
                );

                result = {
                    affectedRows: (resultSinOrden?.affectedRows || 0) + (resultConOrden?.affectedRows || 0)
                };

            } else {
                [result] = await connection.query(
                    `
                        UPDATE registros_solicitud_cadena_suministro 
                        SET 
                            fechaAprobacion1 = ?,
                            cedulaUsuarioAprobacion1 = ?,
                            nombreUsuarioAprobacion1 = ?,
                            observacionAprobacion1 = ?,
                            firmaAprobacion1 = ?,
                            estadoAprobacion1 = ?,
                            estadoSolicitud = ?
                        WHERE solicitud = ?
                    `,
                    [
                        fechaColombia,
                        usuarioToken.cedula,
                        usuarioToken.nombre,
                        observaciones || null,
                        firma[0].firma,
                        estado,
                        estadoSolicitud,
                        id
                    ]
                );
            }

            await connection.commit();

            const [registrosActualizados] = await dbRailway.query(
                `SELECT * FROM registros_solicitud_cadena_suministro WHERE solicitud = ?`,
                [id]
            );

            const registrosConOrden = registrosActualizados.filter(r => r.ordenCompra && r.ordenCompra.startsWith('OC'));
            const registrosSinOrden = registrosActualizados.filter(r => !r.ordenCompra || !r.ordenCompra.startsWith('OC'));

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Actualizar aprobacion 1 exitoso',
                detalle: `Aprobación 1 actualizada para la solicitud ${id}`,
                datos: {
                    solicitud: id,
                    fechaAprobacion: fechaColombia,
                    estado: estado,
                    totalRegistros: registrosActualizados.length,
                    registrosConOrden: {
                        cantidad: registrosConOrden.length,
                        estadoAsignado: 'Pendiente Aprobacion 2',
                        ids: registrosConOrden.map(r => r.id)
                    },
                    registrosSinOrden: {
                        cantidad: registrosSinOrden.length,
                        estadoAsignado: 'Pendiente Despacho Bodega',
                        ids: registrosSinOrden.map(r => r.id)
                    }
                },
                tablasIdsAfectados: registrosActualizados.map(registro => ({
                    tabla: 'registros_solicitud_cadena_suministro',
                    id: registro.id.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                `Aprobación 1 actualizada correctamente`,
                `Se actualizó la aprobación 1 para la solicitud ${id}. ${registrosConOrden.length} registro(s) con orden de compra pasaron a "Pendiente Aprobacion 2" y ${registrosSinOrden.length} registro(s) sin orden de compra pasaron a "Pendiente Despacho Bodega".`,
                {
                    registrosActualizados: registrosActualizados,
                    solicitud: id,
                    totalRegistrosAfectados: result.affectedRows,
                    detalle: {
                        registrosConOrden: registrosConOrden.length,
                        registrosSinOrden: registrosSinOrden.length
                    }
                }
            );

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'comprasAprobacion1',
            accion: 'Error al actualizar aprobación 1',
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

router.put('/comprasAprobacion', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion',
                accion: 'Actualizar aprobacion fallido',
                detalle: 'Los datos del formulario son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del formulario son requeridos.");
        }

        const { estado, contrasena, observaciones, ids, aprobacion } = data;

        if (!estado || !contrasena || !ids || !Array.isArray(ids) || ids.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion',
                accion: `Actualizar aprobacion ${aprobacion} fallido`,
                detalle: 'Estado, contrasena y array de IDs son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Estado, contrasena y array de IDs son requeridos");
        }

        const [firma] = await dbRailway.query(
            `SELECT * FROM firmas WHERE cedulaUsuario = ?`,
            [usuarioToken.cedula]
        );

        if (firma.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion',
                accion: `Actualizar aprobacion ${aprobacion} fallido`,
                detalle: 'Registro no permitido: Cédula de usuario no tiene firma registrada.',
                datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Cédula de usuario no tiene firma registrada.");
        }

        if (!await bcrypt.compare(contrasena, firma[0].contrasena)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion',
                accion: `Actualizar aprobacion ${aprobacion} fallido`,
                detalle: 'Registro no permitido: Contraseña actual incorrecta.',
                datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Contraseña actual incorrecta.", null, { "contrasena": `La contraseña actual proporcionada no coincide con la registrada.` });
        }

        const [registrosExistentes] = await dbRailway.query(
            `SELECT id, formaPago FROM registros_solicitud_cadena_suministro WHERE id IN (?)`,
            [ids]
        );

        const idsExistentes = registrosExistentes.map(r => r.id);
        const idsNoExistentes = ids.filter(id => !idsExistentes.includes(id));

        if (idsNoExistentes.length > 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion',
                accion: `Actualizar aprobacion ${aprobacion} fallido`,
                detalle: `IDs no encontrados: ${idsNoExistentes.join(', ')}`,
                datos: { idsEnviados: ids, idsEncontrados: idsExistentes },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 404, `Los siguientes IDs no existen: ${idsNoExistentes.join(', ')}`);
        }

        const fechaColombia = getFechaHoraColombia();
        const estadoAprobacion3 = aprobacion === '2' ? (estado === 'Aprobado' ? 'Pendiente' : null) : estado;
        const estadoTesoreria = aprobacion === '3' ? (estado === 'Aprobado' ? (registrosExistentes[0].formaPago === 'Anticipo' ? 'Pendiente' : 'No Aplica') : null) : null;
        const estadoSolicitud = aprobacion === '2' ? (estado === 'Aprobado' ? 'Pendiente Aprobacion 3' : estado) : (estado === 'Aprobado' ? (registrosExistentes[0].formaPago === 'Anticipo' ? 'Pendiente Tesoreria' : 'Pendiente Entrega Proveedor') : estado);
        const estadoEntregaProveedor = estadoSolicitud === 'Pendiente Entrega Proveedor' ? 'Pendiente' : null;

        const connection = await dbRailway.getConnection();
        await connection.beginTransaction();

        try {
            const placeholders = ids.map(() => '?').join(',');
            let result;

            if (aprobacion === '2') {
                [result] = await connection.query(
                    `
                        UPDATE registros_solicitud_cadena_suministro 
                        SET 
                            fechaAprobacion2 = ?,
                            cedulaUsuarioAprobacion2 = ?,
                            nombreUsuarioAprobacion2 = ?,
                            observacionAprobacion2 = ?,
                            firmaAprobacion2 = ?,
                            estadoAprobacion2 = ?,
                            estadoAprobacion3 = ?,
                            estadoSolicitud = ?
                        WHERE id IN (${placeholders})
                    `,
                    [
                        fechaColombia,
                        usuarioToken.cedula,
                        usuarioToken.nombre,
                        observaciones,
                        firma[0].firma,
                        estado,
                        estadoAprobacion3,
                        estadoSolicitud,
                        ...ids
                    ]
                );
            } else if (aprobacion === '3') {
                [result] = await connection.query(
                    `
                    UPDATE registros_solicitud_cadena_suministro 
                    SET 
                        fechaAprobacion3 = ?,
                        cedulaUsuarioAprobacion3 = ?,
                        nombreUsuarioAprobacion3 = ?,
                        observacionAprobacion3 = ?,
                        firmaAprobacion3 = ?,
                        estadoAprobacion3 = ?,
                        estadoTesoreria = ?,
                        estadoSolicitud = ?,
                        estadoEntregaProveedor = ?
                    WHERE id IN (${placeholders})
                `,
                    [
                        fechaColombia,
                        usuarioToken.cedula,
                        usuarioToken.nombre,
                        observaciones,
                        firma[0].firma,
                        estadoAprobacion3,
                        estadoTesoreria,
                        estadoSolicitud,
                        estadoEntregaProveedor,
                        ...ids
                    ]
                );
            }

            await connection.commit();

            const [registrosActualizados] = await dbRailway.query(
                `SELECT * FROM registros_solicitud_cadena_suministro WHERE id IN (?)`,
                [ids]
            );

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion',
                accion: `Actualizar aprobacion ${aprobacion} exitoso`,
                detalle: `Aprobación ${aprobacion} actualizada para ${ids.length} registro(s)`,
                datos: {
                    idsActualizados: ids,
                    registrosAfectados: result.affectedRows
                },
                tablasIdsAfectados: ids.map(id => ({
                    tabla: 'registros_solicitud_cadena_suministro',
                    ids: ids.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                `Aprobación ${aprobacion} actualizada correctamente`,
                `Se actualizó la aprobación ${aprobacion} para ${ids.length} registro(s)`,
                {
                    registrosActualizados: registrosActualizados,
                    idsActualizados: ids
                }
            );

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'comprasAprobacion',
            accion: 'Error al actualizar aprobación',
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

router.put('/despachoMaterial',
    validarToken,
    upload.fields([
        { name: 'pdfs' },
    ]),
    async (req, res) => {

        const usuarioToken = req.validarToken.usuario

        try {
            const dataString = req.body.data;
            const editadosDespachoMaterial = JSON.parse(dataString);
            const archivos = req.files;

            if (!editadosDespachoMaterial || Object.keys(editadosDespachoMaterial).length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'despachoMaterial',
                    accion: 'Actualizar despacho material fallido',
                    detalle: 'Los datos del registro son requeridos.',
                    datos: { dataString },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Los datos del registro son requeridos.");
            }

            if (!archivos?.pdfs || Object.keys(archivos).length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'despachoMaterial',
                    accion: 'Actualizar despacho material fallido',
                    detalle: 'Los soportes son necesario: PDFs',
                    datos: { ArchivoProporcionado: archivos },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Los soportes son necesario: PDFs", null, { "pdfs": `Ingrese un archivo .pdf con la salida.` });
            }

            const idsProyectos = Object.keys(editadosDespachoMaterial).filter(key => key !== 'observaciones');

            if (idsProyectos.length === 0) {
                return sendError(res, 400, "No hay IDs de proyectos para consultar");
            }

            const placeholders = idsProyectos.map(() => '?').join(',');

            const [solicitudesExistentes] = await dbRailway.query(
                `SELECT * FROM registros_solicitud_cadena_suministro WHERE id IN (${placeholders})`,
                idsProyectos
            );

            const fechaColombia = getFechaHoraColombia()
            const driveResults = [];

            if (archivos?.pdfs && Array.isArray(archivos.pdfs) && archivos.pdfs.length > 0) {
                for (let i = 0; i < archivos.pdfs.length; i++) {
                    const pdfFile = archivos.pdfs[i];
                    try {

                        const pdfExt = path.extname(pdfFile.originalname);
                        const pdfFileName = `${solicitudesExistentes[0].uuidOt}_pdf_${i + 1}_${fechaColombia}${pdfExt}`;

                        const fileId = await uploadFileToDrive(
                            pdfFile.buffer,
                            pdfFileName,
                            folderId
                        );

                        const result = {
                            tipo: 'pdf',
                            nombre: pdfFileName,
                            id: fileId.id,
                            url: fileId.url,
                            webViewLink: fileId.webViewLink,
                            indice: i,
                            size: pdfFile.size
                        }

                        driveResults.push(result);

                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'success',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'cadenaSuministro',
                            metodo: 'put',
                            endPoint: 'despachoMaterial',
                            accion: 'Cargar PDF exitoso',
                            detalle: `PDF ${i + 1} de ${archivos.pdfs.length} cargado exitosamente`,
                            datos: {
                                pdf: result,
                                totalPDFs: archivos.pdfs.length,
                                indice: i + 1
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    } catch (error) {
                        console.error(`Error procesando PDF ${i + 1}:`, error);

                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'error',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'cadenaSuministro',
                            metodo: 'put',
                            endPoint: 'despachoMaterial',
                            accion: 'Cargar PDF fallido',
                            detalle: `Error al cargar PDF ${i + 1}: ${error.message}`,
                            datos: {
                                nombreOriginal: pdfFile.originalname,
                                error: error.message
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    }
                }
            }

            const solicitudesMap = {};
            const nuevosNombres = driveResults.map(pdf => pdf.nombre);
            solicitudesExistentes.forEach(solicitud => {
                solicitudesMap[solicitud.id] = solicitud;
            });

            const connection = await dbRailway.getConnection();
            await connection.beginTransaction();

            const idsActualizados = [];

            for (id of idsProyectos) {
                const solicitud = solicitudesMap[id];

                const cantidadSolicitada = parseFloat(solicitud.cantidad);
                const cantidadDespachadaMaterial = parseFloat(solicitud.cantidadDespachadaMaterial || '0');
                const cantidadPendienteDespacho = cantidadSolicitada - cantidadDespachadaMaterial;
                const cantidadEditada = parseFloat(editadosDespachoMaterial[id] || '0')

                if (cantidadEditada === 0) {
                    continue;
                }

                if (cantidadPendienteDespacho < cantidadEditada) {
                    await registrarHistorial({
                        nombreUsuario: usuarioToken.nombre || 'No registrado',
                        cedulaUsuario: usuarioToken.cedula || 'No registrado',
                        rolUsuario: usuarioToken.rol || 'No registrado',
                        nivel: 'log',
                        plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                        app: 'cadenaSuministro',
                        metodo: 'put',
                        endPoint: 'despachoMaterial',
                        accion: 'Actualizar despacho material fallido',
                        detalle: 'La cantidad ingresada es mayor a la restante por despacho.',
                        datos: { ArchivoProporcionado: archivos },
                        tablasIdsAfectados: [],
                        ipAddress: getClientIp(req),
                        userAgent: req.headers['user-agent'] || ''
                    });

                    return sendError(res, 400, "La cantidad ingresada es mayor a la restante por despacho.");
                }

                const cantidadDespachadaNueva = cantidadDespachadaMaterial + cantidadEditada
                const cantidadRestante = cantidadPendienteDespacho - cantidadEditada;
                const pdfsExistentes = solicitud.pdfsDespachoMaterial;
                let pdfsExistentesArray = [];

                if (pdfsExistentes) {
                    try {
                        if (typeof pdfsExistentes === 'string') {
                            pdfsExistentesArray = JSON.parse(pdfsExistentes);
                        }
                        else if (Array.isArray(pdfsExistentes)) {
                            pdfsExistentesArray = pdfsExistentes;
                        }
                    } catch (error) {
                        console.error('Error parseando pdfsExistentes:', error);
                        pdfsExistentesArray = [];
                    }
                }

                const pdfsCombinados = [...pdfsExistentesArray, ...nuevosNombres];
                const pdfsJsonParaBD = JSON.stringify(pdfsCombinados);
                const estadoDespachoMaterial = cantidadRestante === 0 ? 'Realizado' : 'Parcial';
                const estadoSolicitud = cantidadRestante === 0 ? 'Material Despachado' : 'Pendiente Despacho Bodega';

                const [result] = await connection.query(
                    `
                        UPDATE registros_solicitud_cadena_suministro 
                        SET 
                            fechaDespachoMaterial = ?,
                            cedulaUsuarioDespachoMaterial = ?,
                            nombreUsuarioDespachoMaterial = ?,
                            cantidadDespachadaMaterial = ?,
                            pdfsDespachoMaterial = ?,
                            observacionDespachoMaterial = ?,
                            estadoDespachoMaterial = ?,
                            estadoSolicitud = ?
                        WHERE id = ?
                    `,
                    [
                        fechaColombia,
                        usuarioToken.cedula,
                        usuarioToken.nombre,
                        cantidadDespachadaNueva.toString(),
                        pdfsJsonParaBD,
                        editadosDespachoMaterial['observaciones'],
                        estadoDespachoMaterial,
                        estadoSolicitud,
                        id
                    ]
                );

                idsActualizados.push(id);
            }

            await connection.commit();
            connection.release();

            const [registrosActualizados] = await dbRailway.query(
                `SELECT * FROM registros_solicitud_cadena_suministro WHERE id IN (?)`,
                [idsProyectos]
            );

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'despachoMaterial',
                accion: 'Actualizar despacho material exitoso',
                detalle: `Despacho de material actualizado para ${idsActualizados.length} registro(s)`,
                datos: {
                    idsActualizados: idsActualizados,
                    registrosAfectados: idsActualizados.length
                },
                tablasIdsAfectados: idsActualizados.map(id => ({
                    tabla: 'registros_solicitud_cadena_suministro',
                    ids: id.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                "Despacho de material actualizado correctamente",
                `Se actualizó el despacho de material para ${idsActualizados.length} registro(s)`,
                {
                    registrosActualizados: registrosActualizados,
                    idsActualizados: idsActualizados,
                    pdfsSubidos: driveResults
                }
            );

        } catch (err) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'Error sistema',
                cedulaUsuario: usuarioToken.cedula || 'Error sistema',
                rolUsuario: usuarioToken.rol || 'Error sistema',
                nivel: 'error',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'despachoMaterial',
                accion: 'Actualizar despacho material fallido',
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

router.post('/obtenerArchivoPDF', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario
    const { namePDF } = req.body;

    try {
        const resultados = {};

        if (!namePDF) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'post',
                endPoint: 'obtenerArchivoPDF',
                accion: 'Consulta archivos fallido',
                detalle: 'Registro no permitido: Nombre PDF',
                datos: { nombrePDFProporcionado: namePDF },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: PDF", null, { "namePDF": `Ingrese el nombre del pdf.` });
        }

        if (namePDF) {
            const factBuffer = await getFileFromDrive(namePDF, folderId);
            if (factBuffer) {
                resultados.pdf = {
                    nombre: namePDF,
                    data: factBuffer.toString('base64'),
                    contentType: getMimeType(namePDF)
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
            endPoint: 'obtenerArchivoPDF',
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
            endPoint: 'obtenerArchivoPDF',
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

router.put('/tesoreria', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'tesoreria',
                accion: 'Actualizar tesoreria fallido',
                detalle: 'Los datos del formulario son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del formulario son requeridos.");
        }

        const { contrasena, observaciones, ids } = data;

        if (!contrasena || !ids || !Array.isArray(ids) || ids.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'tesoreria',
                accion: `Actualizar tesoreria fallido`,
                detalle: 'Contrasena y array de IDs son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Contrasena y array de IDs son requeridos");
        }

        const [firma] = await dbRailway.query(
            `SELECT * FROM firmas WHERE cedulaUsuario = ?`,
            [usuarioToken.cedula]
        );

        if (firma.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'tesoreria',
                accion: `Actualizar tesoreria fallido`,
                detalle: 'Registro no permitido: Cédula de usuario no tiene firma registrada.',
                datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Cédula de usuario no tiene firma registrada.");
        }

        if (!await bcrypt.compare(contrasena, firma[0].contrasena)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'tesoreria',
                accion: `Actualizar tesoreria fallido`,
                detalle: 'Registro no permitido: Contraseña actual incorrecta.',
                datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Contraseña actual incorrecta.", null, { "contrasena": `La contraseña actual proporcionada no coincide con la registrada.` });
        }

        const [registrosExistentes] = await dbRailway.query(
            `SELECT id FROM registros_solicitud_cadena_suministro WHERE id IN (?)`,
            [ids]
        );

        const idsExistentes = registrosExistentes.map(r => r.id);
        const idsNoExistentes = ids.filter(id => !idsExistentes.includes(id));

        if (idsNoExistentes.length > 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'tesoreria',
                accion: `Actualizar tesoreria fallido`,
                detalle: `IDs no encontrados: ${idsNoExistentes.join(', ')}`,
                datos: { idsEnviados: ids, idsEncontrados: idsExistentes },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 404, `Los siguientes IDs no existen: ${idsNoExistentes.join(', ')}`);
        }

        const fechaColombia = getFechaHoraColombia();

        const connection = await dbRailway.getConnection();
        await connection.beginTransaction();

        try {
            const placeholders = ids.map(() => '?').join(',');
            let result;

            [result] = await connection.query(
                `
                        UPDATE registros_solicitud_cadena_suministro 
                        SET 
                            fechaTesoreria = ?,
                            cedulaUsuarioTesoreria = ?,
                            nombreUsuarioTesoreria = ?,
                            observacionTesoreria = ?,
                            firmaTesoreria = ?,
                            estadoTesoreria = 'Realizado',
                            estadoEntregaProveedor = 'Pendiente',
                            estadoSolicitud = 'Pendiente Entrega Proveedor'
                        WHERE id IN (${placeholders})
                    `,
                [
                    fechaColombia,
                    usuarioToken.cedula,
                    usuarioToken.nombre,
                    observaciones,
                    firma[0].firma,
                    ...ids
                ]
            );

            await connection.commit();

            const [registrosActualizados] = await dbRailway.query(
                `SELECT * FROM registros_solicitud_cadena_suministro WHERE id IN (?)`,
                [ids]
            );

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'tesoreria',
                accion: `Actualizar tesoreria exitoso`,
                detalle: `Se actualizo tesoreria para ${ids.length} registro(s)`,
                datos: {
                    idsActualizados: ids,
                    registrosAfectados: result.affectedRows
                },
                tablasIdsAfectados: ids.map(id => ({
                    tabla: 'registros_solicitud_cadena_suministro',
                    ids: ids.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                `Tesoreria actualizo correctamente`,
                `Se actualizó tesoreria para ${ids.length} registro(s)`,
                {
                    registrosActualizados: registrosActualizados,
                    idsActualizados: ids
                }
            );

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'tesoreria',
            accion: 'Error al actualizar tesoreria',
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

router.put('/entregaProveedor',
    validarToken,
    upload.fields([
        { name: 'pdfs' },
    ]),
    async (req, res) => {

        const usuarioToken = req.validarToken.usuario

        try {
            const dataString = req.body.data;
            const editadosEntregaProveedor = JSON.parse(dataString);
            const archivos = req.files;

            if (!editadosEntregaProveedor || Object.keys(editadosEntregaProveedor).length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'entregaProveedor',
                    accion: 'Actualizar entrega material por proveedor fallido',
                    detalle: 'Los datos del registro son requeridos.',
                    datos: { dataString },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Los datos del registro son requeridos.");
            }

            if (!archivos?.pdfs || Object.keys(archivos).length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'entregaProveedor',
                    accion: 'Actualizar entrega material por proveedor fallido',
                    detalle: 'Los soportes son necesario: PDFs',
                    datos: { ArchivoProporcionado: archivos },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Los soportes son necesario: PDFs", null, { "pdfs": `Ingrese un archivo .pdf con la salida.` });
            }

            const idsProyectos = Object.keys(editadosEntregaProveedor).filter(key => key !== 'observaciones');

            if (idsProyectos.length === 0) {
                return sendError(res, 400, "No hay IDs de proyectos para consultar");
            }

            const placeholders = idsProyectos.map(() => '?').join(',');

            const [solicitudesExistentes] = await dbRailway.query(
                `SELECT * FROM registros_solicitud_cadena_suministro WHERE id IN (${placeholders})`,
                idsProyectos
            );

            const fechaColombia = getFechaHoraColombia()
            const driveResults = [];

            if (archivos?.pdfs && Array.isArray(archivos.pdfs) && archivos.pdfs.length > 0) {
                for (let i = 0; i < archivos.pdfs.length; i++) {
                    const pdfFile = archivos.pdfs[i];
                    try {

                        const pdfExt = path.extname(pdfFile.originalname);
                        const pdfFileName = `${solicitudesExistentes[0].uuidOt}_pdf_entraga_bodega_${i + 1}_${fechaColombia}${pdfExt}`;

                        const fileId = await uploadFileToDrive(
                            pdfFile.buffer,
                            pdfFileName,
                            folderId
                        );

                        const result = {
                            tipo: 'pdf',
                            nombre: pdfFileName,
                            id: fileId.id,
                            url: fileId.url,
                            webViewLink: fileId.webViewLink,
                            indice: i,
                            size: pdfFile.size
                        }

                        driveResults.push(result);

                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'success',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'cadenaSuministro',
                            metodo: 'put',
                            endPoint: 'entregaProveedor',
                            accion: 'Cargar PDF exitoso',
                            detalle: `PDF ${i + 1} de ${archivos.pdfs.length} cargado exitosamente`,
                            datos: {
                                pdf: result,
                                totalPDFs: archivos.pdfs.length,
                                indice: i + 1
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    } catch (error) {
                        console.error(`Error procesando PDF ${i + 1}:`, error);

                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'error',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'cadenaSuministro',
                            metodo: 'put',
                            endPoint: 'entregaProveedor',
                            accion: 'Cargar PDF fallido',
                            detalle: `Error al cargar PDF ${i + 1}: ${error.message}`,
                            datos: {
                                nombreOriginal: pdfFile.originalname,
                                error: error.message
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    }
                }
            }

            const solicitudesMap = {};
            const nuevosNombres = driveResults.map(pdf => pdf.nombre);
            solicitudesExistentes.forEach(solicitud => {
                solicitudesMap[solicitud.id] = solicitud;
            });

            const connection = await dbRailway.getConnection();
            await connection.beginTransaction();

            const idsActualizados = [];

            for (id of idsProyectos) {
                const solicitud = solicitudesMap[id];

                const cantidadSolicitada = parseFloat(solicitud.cantidadProveedor);
                const cantidadEntregaProveedor = parseFloat(solicitud.cantidadEntregaProveedor || '0');
                const cantidadPendienteEntrega = cantidadSolicitada - cantidadEntregaProveedor;
                const cantidadEditada = parseFloat(editadosEntregaProveedor[id] || '0')

                if (cantidadEditada === 0) {
                    continue;
                }

                const cantidadEntregaProveedorNueva = cantidadEntregaProveedor + cantidadEditada
                const cantidadRestante = cantidadPendienteEntrega - cantidadEditada;
                const pdfsExistentes = solicitud.pdfsEntregaProveedor;
                let pdfsExistentesArray = [];

                if (pdfsExistentes) {
                    try {
                        if (typeof pdfsExistentes === 'string') {
                            pdfsExistentesArray = JSON.parse(pdfsExistentes);
                        }
                        else if (Array.isArray(pdfsExistentes)) {
                            pdfsExistentesArray = pdfsExistentes;
                        }
                    } catch (error) {
                        console.error('Error parseando pdfsExistentes:', error);
                        pdfsExistentesArray = [];
                    }
                }

                const pdfsCombinados = [...pdfsExistentesArray, ...nuevosNombres];
                const pdfsJsonParaBD = JSON.stringify(pdfsCombinados);
                const estadoEntregaProveedor = cantidadRestante === 0 || cantidadRestante < 0 ? 'Realizado' : 'Parcial';
                const estadoDespachoMaterial = cantidadRestante === 0 || cantidadRestante < 0 ? 'Pendiente' : null;
                const estadoSolicitud = cantidadRestante === 0 || cantidadRestante < 0 ? 'Pendiente Despacho Bodega' : 'Pendiente Entrega Proveedor';

                const [result] = await connection.query(
                    `
                        UPDATE registros_solicitud_cadena_suministro 
                        SET 
                            fechaEntregaProveedor = ?,
                            cedulaUsuarioEntregaProveedor = ?,
                            nombreUsuarioEntregaProveedor = ?,
                            cantidadEntregaProveedor = ?,
                            pdfsEntregaProveedor = ?,
                            observacionEntregaProveedor = ?,
                            estadoEntregaProveedor = ?,
                            estadoDespachoMaterial = ?,
                            estadoSolicitud = ?
                        WHERE id = ?
                    `,
                    [
                        fechaColombia,
                        usuarioToken.cedula,
                        usuarioToken.nombre,
                        cantidadEntregaProveedorNueva.toString(),
                        pdfsJsonParaBD,
                        editadosEntregaProveedor['observaciones'],
                        estadoEntregaProveedor,
                        estadoDespachoMaterial,
                        estadoSolicitud,
                        id
                    ]
                );

                idsActualizados.push(id);
            }

            await connection.commit();
            connection.release();

            const [registrosActualizados] = await dbRailway.query(
                `SELECT * FROM registros_solicitud_cadena_suministro WHERE id IN (?)`,
                [idsProyectos]
            );

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'entregaProveedor',
                accion: 'Actualizar entrega material por proveedor exitoso',
                detalle: `Entrega de material por proveedor actualizado para ${idsActualizados.length} registro(s)`,
                datos: {
                    idsActualizados: idsActualizados,
                    registrosAfectados: idsActualizados.length
                },
                tablasIdsAfectados: idsActualizados.map(id => ({
                    tabla: 'registros_solicitud_cadena_suministro',
                    ids: id.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                "Entrega de material por proveedor actualizado correctamente",
                `Se actualizó la entraga de material por proveedor para ${idsActualizados.length} registro(s)`,
                {
                    registrosActualizados: registrosActualizados,
                    idsActualizados: idsActualizados,
                    pdfsSubidos: driveResults
                }
            );

        } catch (err) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'Error sistema',
                cedulaUsuario: usuarioToken.cedula || 'Error sistema',
                rolUsuario: usuarioToken.rol || 'Error sistema',
                nivel: 'error',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'entregaProveedor',
                accion: 'Actualizar entrega material por proveedor fallido',
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