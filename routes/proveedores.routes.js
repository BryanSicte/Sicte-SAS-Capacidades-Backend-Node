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

const folderId = '11ddDcKvZCk--jhaSIsHgb5ud8WW73AMJ';

router.get('/registros', validarToken, async (req, res) => {

    const usuarioToken = req.validarToken.usuario

    try {
        const [rows] = await dbRailway.query('SELECT * FROM proveedores where estado = true');

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'proveedores',
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
            `Se obtuvieron ${rows.length} registros de proveedores.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'proveedores',
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

router.post('/crearRegistro', validarToken,
    upload.fields([
        { name: 'rut', maxCount: 1 },
        { name: 'camaraComercio', maxCount: 1 },
        { name: 'certificacionBancaria', maxCount: 1 },
        { name: 'cedulaRepresentanteLegal', maxCount: 1 }
    ]), async (req, res) => {

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
                    app: 'proveedores',
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
                cedulaUsuario: "No se pudo identificar la cédula del usuario.",
                nombreUsuario: "No se pudo identificar el nombre del usuario.",
                nit: "Ingrese el nit.",
                nombreProveedor: "Ingrese un nombre del proveedor.",
                nombreContacto: "Ingrese un nombre de contacto.",
                direccion: "Ingrese la direccion.",
                telefono: "Ingrese el telefono.",
                correo: "Ingrese el correo.",
                paginaWeb: "Ingrese la pagina web.",
            };

            if (!validateRequiredFields(data, requiredFields, res)) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'proveedores',
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

            const { cedulaUsuario, nit } = data;

            if (cedulaUsuario) {
                const [userRows] = await dbRailway.query(`SELECT cedula FROM user WHERE cedula = ? LIMIT 1`, [cedulaUsuario]);

                if (userRows.length === 0) {
                    await registrarHistorial({
                        nombreUsuario: usuarioToken.nombre || 'No registrado',
                        cedulaUsuario: usuarioToken.cedula || 'No registrado',
                        rolUsuario: usuarioToken.rol || 'No registrado',
                        nivel: 'log',
                        plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                        app: 'proveedores',
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
            }

            if (nit) {
                const [dataRows] = await dbRailway.query(`SELECT nit FROM proveedores WHERE nit = ?`, [nit]);

                if (dataRows.length !== 0) {
                    await registrarHistorial({
                        nombreUsuario: usuarioToken.nombre || 'No registrado',
                        cedulaUsuario: usuarioToken.cedula || 'No registrado',
                        rolUsuario: usuarioToken.rol || 'No registrado',
                        nivel: 'log',
                        plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                        app: 'proveedores',
                        metodo: 'post',
                        endPoint: 'crearRegistro',
                        accion: 'Crear registro fallido',
                        detalle: 'Registro no permitido: Proveedor ya existente',
                        datos: { nitProporcionado: nit },
                        tablasIdsAfectados: [],
                        ipAddress: getClientIp(req),
                        userAgent: req.headers['user-agent'] || ''
                    });

                    return sendError(res, 400, "Registro no permitido: Proveedor", null, { "nit": `NIT ${nit} ya encuentra registrado en la tabla de proveedores.` });
                }
            }

            const driveResults = [];
            const fechaColombia = getFechaHoraColombia()

            if (archivos?.rut?.[0]) {
                const file = archivos.rut[0];

                const ext = path.extname(file.originalname);
                const fileName = `${data.nit}_rut_${fechaColombia}${ext}`;

                const fileId = await uploadFileToDrive(
                    file.buffer,
                    fileName,
                    folderId
                );

                const result = {
                    tipo: 'rut',
                    nombre: fileName,
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
                    app: 'proveedores',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Cargar rut exitoso',
                    detalle: 'Registro creado con exito',
                    datos: { result },
                    tablasIdsAfectados: [],
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });
            }

            if (archivos?.camaraComercio?.[0]) {
                const file = archivos.camaraComercio[0];

                const ext = path.extname(file.originalname);
                const fileName = `${data.nit}_camara_de_comercio_${fechaColombia}${ext}`;

                const fileId = await uploadFileToDrive(
                    file.buffer,
                    fileName,
                    folderId
                );

                const result = {
                    tipo: 'camaraComercio',
                    nombre: fileName,
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
                    app: 'proveedores',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Cargar camara de comercio exitoso',
                    detalle: 'Registro creado con exito',
                    datos: { result },
                    tablasIdsAfectados: [],
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });
            }

            if (archivos?.certificacionBancaria?.[0]) {
                const file = archivos.certificacionBancaria[0];

                const ext = path.extname(file.originalname);
                const fileName = `${data.nit}_certificacion_bancaria_${fechaColombia}${ext}`;

                const fileId = await uploadFileToDrive(
                    file.buffer,
                    fileName,
                    folderId
                );

                const result = {
                    tipo: 'certificacionBancaria',
                    nombre: fileName,
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
                    app: 'proveedores',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Cargar certificacion bancaria exitoso',
                    detalle: 'Registro creado con exito',
                    datos: { result },
                    tablasIdsAfectados: [],
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });
            }

            if (archivos?.cedulaRepresentanteLegal?.[0]) {
                const file = archivos.cedulaRepresentanteLegal[0];

                const ext = path.extname(file.originalname);
                const fileName = `${data.nit}_cedula_representante_legal_${fechaColombia}${ext}`;

                const fileId = await uploadFileToDrive(
                    file.buffer,
                    fileName,
                    folderId
                );

                const result = {
                    tipo: 'cedulaRepresentanteLegal',
                    nombre: fileName,
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
                    app: 'proveedores',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Cargar cedula representante legal exitoso',
                    detalle: 'Registro creado con exito',
                    datos: { result },
                    tablasIdsAfectados: [],
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });
            }

            const rutResult = driveResults.find(f => f.tipo === 'rut') || null;
            const rutJSON = rutResult ? JSON.stringify(rutResult) : null;
            const camaraComercioResult = driveResults.find(f => f.tipo === 'camaraComercio') || null;
            const camaraComercioJSON = camaraComercioResult ? JSON.stringify(camaraComercioResult) : null;
            const certificacionBancariaResult = driveResults.find(f => f.tipo === 'certificacionBancaria') || null;
            const certificacionBancariaJSON = certificacionBancariaResult ? JSON.stringify(certificacionBancariaResult) : null;
            const cedulaRepresentanteLegalResult = driveResults.find(f => f.tipo === 'cedulaRepresentanteLegal') || null;
            const cedulaRepresentanteLegalJSON = cedulaRepresentanteLegalResult ? JSON.stringify(cedulaRepresentanteLegalResult) : null;

            const [result] = await dbRailway.query(
                `INSERT INTO proveedores (
                    fecha,
                    cedulaUsuario,
                    nombreUsuario,
                    nit,
                    nombreProveedor,
                    nombreContacto,
                    direccion,
                    telefono,
                    correo,
                    paginaWeb,
                    rut,
                    camaraComercio,
                    certificacionBancaria,
                    cedulaRepresentanteLegal,
                    observaciones,
                    estado
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    data.fecha,
                    data.cedulaUsuario,
                    data.nombreUsuario,
                    data.nit,
                    data.nombreProveedor,
                    data.nombreContacto,
                    data.direccion,
                    data.telefono,
                    data.correo,
                    data.paginaWeb,
                    rutJSON,
                    camaraComercioJSON,
                    certificacionBancariaJSON,
                    cedulaRepresentanteLegalJSON,
                    data.observaciones,
                    true
                ]
            );

            const [registroGuardado] = await dbRailway.query('SELECT * FROM proveedores WHERE id = ?', [result.insertId]);

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
                metodo: 'post',
                endPoint: 'crearRegistro',
                accion: 'Crear registro exitoso',
                detalle: 'Registro creado con exito',
                datos: { data },
                tablasIdsAfectados: [],
                tablasIdsAfectados: [{
                    tabla: 'proveedores',
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
                nombreUsuario: usuarioToken.nombre || 'Error sistema',
                cedulaUsuario: usuarioToken.cedula || 'Error sistema',
                rolUsuario: usuarioToken.rol || 'Error sistema',
                nivel: 'error',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
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

router.put('/editarRegistro/:id', validarToken,
    upload.fields([
        { name: 'rut', maxCount: 1 },
        { name: 'camaraComercio', maxCount: 1 },
        { name: 'certificacionBancaria', maxCount: 1 },
        { name: 'cedulaRepresentanteLegal', maxCount: 1 }
    ]), async (req, res) => {
        const usuarioToken = req.validarToken.usuario;
        const { id } = req.params;

        try {
            const data = req.body;
            const archivos = req.files;

            if (!id || isNaN(id)) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'proveedores',
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
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'proveedores',
                    metodo: 'put',
                    endPoint: 'editarRegistro',
                    accion: 'Editar registro fallido',
                    detalle: 'No hay datos para actualizar',
                    datos: { id, data },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "No hay datos para actualizar.");
            }

            const requiredFields = {
                fecha: "No se pudo obtener la fecha del registro.",
                cedulaUsuario: "No se pudo identificar la cédula del usuario.",
                nombreUsuario: "No se pudo identificar el nombre del usuario.",
                nit: "Ingrese el nit.",
                nombreProveedor: "Ingrese un nombre del proveedor.",
                nombreContacto: "Ingrese un nombre de contacto.",
                direccion: "Ingrese la direccion.",
                telefono: "Ingrese el telefono.",
                correo: "Ingrese el correo.",
                paginaWeb: "Ingrese la pagina web.",
            };

            if (!validateRequiredFields(data, requiredFields, res)) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'proveedores',
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

            const { cedulaUsuario } = data;

            if (cedulaUsuario) {
                const [userRows] = await dbRailway.query(`SELECT cedula FROM user WHERE cedula = ? LIMIT 1`, [cedulaUsuario]);

                if (userRows.length === 0) {
                    await registrarHistorial({
                        nombreUsuario: usuarioToken.nombre || 'No registrado',
                        cedulaUsuario: usuarioToken.cedula || 'No registrado',
                        rolUsuario: usuarioToken.rol || 'No registrado',
                        nivel: 'log',
                        plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                        app: 'proveedores',
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
            }

            const [registroExistente] = await dbRailway.query(
                'SELECT * FROM proveedores WHERE id = ? LIMIT 1',
                [id]
            );

            if (registroExistente.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'proveedores',
                    metodo: 'put',
                    endPoint: 'editarRegistro',
                    accion: 'Editar registro fallido',
                    detalle: 'Registro no encontrado',
                    datos: { id },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 404, `Registro con ID ${id} no encontrado.`);
            }

            if (data.nit && data.nit !== registroExistente[0].nit) {
                if (nitExistente.length > 0) {
                    await registrarHistorial({
                        nombreUsuario: usuarioToken.nombre || 'No registrado',
                        cedulaUsuario: usuarioToken.cedula || 'No registrado',
                        rolUsuario: usuarioToken.rol || 'No registrado',
                        nivel: 'log',
                        plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                        app: 'proveedores',
                        metodo: 'put',
                        endPoint: 'editarRegistro',
                        accion: 'Editar registro fallido',
                        detalle: 'NIT ya está en uso por otro proveedor',
                        datos: { nitProporcionado: data.nit },
                        tablasIdsAfectados: [],
                        ipAddress: getClientIp(req),
                        userAgent: req.headers['user-agent'] || ''
                    });

                    return sendError(res, 400, "Registro no permitido: NIT", null, { "nit": `NIT ${data.nit} ya está en uso por otro proveedor.` });
                }
            }

            const driveResults = [];
            const fechaColombia = getFechaHoraColombia()

            if (archivos?.rut?.[0] && !archivos?.rut?.base64) {
                const file = archivos.rut[0];

                const ext = path.extname(file.originalname);
                const fileName = `${data.nit}_rut_${fechaColombia}${ext}`;

                const fileId = await uploadFileToDrive(
                    file.buffer,
                    fileName,
                    folderId
                );

                const result = {
                    tipo: 'rut',
                    nombre: fileName,
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
                    app: 'proveedores',
                    metodo: 'put',
                    endPoint: 'editarRegistro',
                    accion: 'Cargar rut exitoso',
                    detalle: 'Registro creado con exito',
                    datos: { result },
                    tablasIdsAfectados: [],
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });
            }

            if (archivos?.camaraComercio?.[0] && !archivos?.camaraComercio?.base64) {
                const file = archivos.camaraComercio[0];

                const ext = path.extname(file.originalname);
                const fileName = `${data.nit}_camara_de_comercio_${fechaColombia}${ext}`;

                const fileId = await uploadFileToDrive(
                    file.buffer,
                    fileName,
                    folderId
                );

                const result = {
                    tipo: 'camaraComercio',
                    nombre: fileName,
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
                    app: 'proveedores',
                    metodo: 'put',
                    endPoint: 'editarRegistro',
                    accion: 'Cargar camara de comercio exitoso',
                    detalle: 'Registro creado con exito',
                    datos: { result },
                    tablasIdsAfectados: [],
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });
            }

            if (archivos?.certificacionBancaria?.[0] && !archivos?.certificacionBancaria?.base64) {
                const file = archivos.certificacionBancaria[0];

                const ext = path.extname(file.originalname);
                const fileName = `${data.nit}_certificacion_bancaria_${fechaColombia}${ext}`;

                const fileId = await uploadFileToDrive(
                    file.buffer,
                    fileName,
                    folderId
                );

                const result = {
                    tipo: 'certificacionBancaria',
                    nombre: fileName,
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
                    app: 'proveedores',
                    metodo: 'put',
                    endPoint: 'editarRegistro',
                    accion: 'Cargar certificacion bancaria exitoso',
                    detalle: 'Registro creado con exito',
                    datos: { result },
                    tablasIdsAfectados: [],
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });
            }

            if (archivos?.cedulaRepresentanteLegal?.[0] && !archivos?.cedulaRepresentanteLegal?.base64) {
                const file = archivos.cedulaRepresentanteLegal[0];

                const ext = path.extname(file.originalname);
                const fileName = `${data.nit}_cedula_representante_legal_${fechaColombia}${ext}`;

                const fileId = await uploadFileToDrive(
                    file.buffer,
                    fileName,
                    folderId
                );

                const result = {
                    tipo: 'cedulaRepresentanteLegal',
                    nombre: fileName,
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
                    app: 'proveedores',
                    metodo: 'put',
                    endPoint: 'editarRegistro',
                    accion: 'Cargar cedula representante legal exitoso',
                    detalle: 'Registro creado con exito',
                    datos: { result },
                    tablasIdsAfectados: [],
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });
            }

            const camposNoEditables = ['id', 'fecha', 'cedulaUsuario', 'nombreUsuario'];
            for (const campo of camposNoEditables) {
                if (data[campo] !== undefined) {
                    delete data[campo];
                }
            }

            const updateData = { ...data };

            const rutResult = driveResults.find(f => f.tipo === 'rut') || null;
            if (rutResult) updateData.rut = JSON.stringify(rutResult);
            const camaraComercioResult = driveResults.find(f => f.tipo === 'camaraComercio') || null;
            if (camaraComercioResult) updateData.camaraComercio = JSON.stringify(camaraComercioResult);
            const certificacionBancariaResult = driveResults.find(f => f.tipo === 'certificacionBancaria') || null;
            if (certificacionBancariaResult) updateData.certificacionBancaria = JSON.stringify(certificacionBancariaResult);
            const cedulaRepresentanteLegalResult = driveResults.find(f => f.tipo === 'cedulaRepresentanteLegal') || null;
            if (cedulaRepresentanteLegalResult) updateData.cedulaRepresentanteLegal = JSON.stringify(cedulaRepresentanteLegalResult);

            const camposActualizados = {};
            Object.keys(updateData).forEach(key => {
                if (updateData[key] !== undefined && updateData[key] !== null && updateData[key] !== '') {
                    camposActualizados[key] = updateData[key];
                }
            });

            const keys = Object.keys(camposActualizados);
            if (keys.length === 0) {
                return sendError(res, 400, "No hay campos válidos para actualizar.");
            }

            const setClause = keys.map(key => `${key} = ?`).join(', ');
            const values = [...Object.values(camposActualizados), id];

            const query = `
                UPDATE proveedores 
                SET ${setClause}
                WHERE id = ?
            `;

            const [result] = await dbRailway.query(query, values);

            if (result.affectedRows === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'proveedores',
                    metodo: 'put',
                    endPoint: 'editarRegistro',
                    accion: 'Editar registro fallido',
                    detalle: 'No se pudo actualizar el registro',
                    datos: { id, data },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 500, "No se pudo actualizar el registro.");
            }

            const [registroActualizado] = await dbRailway.query(
                'SELECT * FROM proveedores WHERE id = ?',
                [id]
            );

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
                metodo: 'put',
                endPoint: 'editarRegistro',
                accion: 'Editar registro exitoso',
                detalle: 'Registro actualizado con éxito',
                datos: {
                    id,
                    cambios: data,
                    registroAnterior: registroExistente[0]
                },
                tablasIdsAfectados: [{
                    tabla: 'proveedores',
                    id: id.toString()
                }],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                `Registro actualizado correctamente`,
                `Se ha actualizado el registro con ID ${id}.`,
                registroActualizado[0]
            );

        } catch (err) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'Error sistema',
                cedulaUsuario: usuarioToken.cedula || 'Error sistema',
                rolUsuario: usuarioToken.rol || 'Error sistema',
                nivel: 'error',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
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

router.put('/deshabilitarProveedor/:id', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;
    const { id } = req.params;

    try {
        if (!id || isNaN(id)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
                metodo: 'put',
                endPoint: 'deshabilitarProveedor',
                accion: 'Deshabilitar proveedor fallido',
                detalle: 'ID de proveedor inválido o no proporcionado',
                datos: { idProporcionado: id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "ID de proveedor inválido o no proporcionado.");
        }

        const [proveedorExistente] = await dbRailway.query(
            'SELECT * FROM proveedores WHERE id = ? LIMIT 1',
            [id]
        );

        if (proveedorExistente.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
                metodo: 'put',
                endPoint: 'deshabilitarProveedor',
                accion: 'Deshabilitar proveedor fallido',
                detalle: 'Proveedor no encontrado',
                datos: { id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 404, `Proveedor con ID ${id} no encontrado.`);
        }

        if (proveedorExistente[0].estado === false) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
                metodo: 'put',
                endPoint: 'deshabilitarProveedor',
                accion: 'Deshabilitar proveedor fallido',
                detalle: 'El proveedor ya está deshabilitado',
                datos: {
                    id,
                    estadoActual: proveedorExistente[0].estado
                },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, `El proveedor con ID ${id} ya está deshabilitado.`);
        }

        const [result] = await dbRailway.query(
            'UPDATE proveedores SET estado = ? WHERE id = ?',
            [false, id]
        );

        if (result.affectedRows === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
                metodo: 'put',
                endPoint: 'deshabilitarProveedor',
                accion: 'Deshabilitar proveedor fallido',
                detalle: 'No se pudo deshabilitar el proveedor',
                datos: { id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 500, "No se pudo deshabilitar el proveedor.");
        }

        const [proveedorActualizado] = await dbRailway.query(
            'SELECT * FROM proveedores WHERE id = ?',
            [id]
        );

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'proveedores',
            metodo: 'put',
            endPoint: 'deshabilitarProveedor',
            accion: 'Deshabilitar proveedor exitoso',
            detalle: 'Proveedor deshabilitado correctamente',
            datos: {
                id,
                proveedorAnterior: proveedorExistente[0],
                proveedorActual: proveedorActualizado[0]
            },
            tablasIdsAfectados: [{
                tabla: 'proveedores',
                id: id.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Proveedor deshabilitado correctamente`,
            `El proveedor "${proveedorExistente[0].nombreProveedor}" ha sido deshabilitado.`,
            proveedorActualizado[0]
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'proveedores',
            metodo: 'put',
            endPoint: 'deshabilitarProveedor',
            accion: 'Error al deshabilitar proveedor',
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
    const { nameRut, nameCamaraComercio, nameCertificacionBancaria, nameCedulaRepresentanteLegal } = req.body;

    try {
        const resultados = {};

        if (nameRut) {
            const buffer = await getFileFromDrive(nameRut, folderId);
            if (buffer) {
                resultados.rut = {
                    nombre: nameRut,
                    data: buffer.toString('base64'),
                    contentType: getMimeType(nameRut)
                };
            }
        }

        if (nameCamaraComercio) {
            const buffer = await getFileFromDrive(nameCamaraComercio, folderId);
            if (buffer) {
                resultados.camaraComercio = {
                    nombre: nameCamaraComercio,
                    data: buffer.toString('base64'),
                    contentType: getMimeType(nameCamaraComercio)
                };
            }
        }

        if (nameCertificacionBancaria) {
            const buffer = await getFileFromDrive(nameCertificacionBancaria, folderId);
            if (buffer) {
                resultados.certificacionBancaria = {
                    nombre: nameCertificacionBancaria,
                    data: buffer.toString('base64'),
                    contentType: getMimeType(nameCertificacionBancaria)
                };
            }
        }

        if (nameCedulaRepresentanteLegal) {
            const buffer = await getFileFromDrive(nameCedulaRepresentanteLegal, folderId);
            if (buffer) {
                resultados.cedulaRepresentanteLegal = {
                    nombre: nameCedulaRepresentanteLegal,
                    data: buffer.toString('base64'),
                    contentType: getMimeType(nameCedulaRepresentanteLegal)
                };
            }
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'proveedores',
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
            app: 'proveedores',
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
                app: 'proveedores',
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
                app: 'proveedores',
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

        const [rows] = await dbRailway.query('SELECT * FROM rol_proveedores where cedula = ?', [data.cedula]);

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'proveedores',
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
            app: 'proveedores',
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