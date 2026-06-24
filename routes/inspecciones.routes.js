const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const dbAplicativosClaro = require('../db/db_aplicativos_claro');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { validateRequiredFields } = require('../utils/validate');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');
const { uploadFileToDrive, getFileFromDrive } = require('../services/googleDriveService');
const { getFechaHoraColombia } = require('../utils/formatdate');
const path = require('path');
const multer = require('multer');
const upload = multer();

const folderId = '1ZJcZf8P3VH7ktLQI2Sq9j6EOjORipOXy';

const DEFAULT_INSPECTION_TYPE = "BOTIQUÍN";

// Asynchronous DB initialization
async function initDatabase() {
    try {
        console.log("Inicializando base de datos para Inspecciones...");

        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS inspecciones_registros (
                id INT AUTO_INCREMENT PRIMARY KEY,
                gen_fechaRegistro VARCHAR(45) DEFAULT NULL,
                gen_fechaInspeccion VARCHAR(45) DEFAULT NULL,
                gen_cedulaUsuario VARCHAR(200) DEFAULT NULL,
                gen_nombreUsuario VARCHAR(200) DEFAULT NULL,
                gen_responsableCedula VARCHAR(200) DEFAULT NULL,
                gen_responsableNombre VARCHAR(200) DEFAULT NULL,
                gen_supervisorCedula VARCHAR(200) DEFAULT NULL,
                gen_supervisorNombre VARCHAR(200) DEFAULT NULL,
                gen_proyecto VARCHAR(200) DEFAULT NULL,
                gen_nombreProyecto VARCHAR(200) DEFAULT NULL,
                gen_tipoInspeccion VARCHAR(200) DEFAULT NULL,
                gen_nombreInspeccion VARCHAR(200) DEFAULT NULL,
                gen_direccion VARCHAR(200) DEFAULT NULL,
                gen_ciudad VARCHAR(100) DEFAULT NULL,
                gen_proceso VARCHAR(45) DEFAULT NULL,
                gen_numeroContrato VARCHAR(45) DEFAULT NULL,
                gen_ubicacion VARCHAR(45) DEFAULT NULL,
                gen_observaciones TEXT DEFAULT NULL,
                respuestas_capitulos JSON DEFAULT NULL,
                no_cumplimientos JSON DEFAULT NULL,
                resultado_inicial VARCHAR(45) DEFAULT NULL,
                resultado_final VARCHAR(45) DEFAULT NULL,
                datos_especificos JSON DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
        `);

        console.log("Bases de datos para Inspecciones inicializadas correctamente.");
    } catch (err) {
        console.error("Error inicializando base de datos para Inspecciones:", err);
    }
}

// Run DB init
initDatabase();



router.get('/ciudades', validarToken, async (req, res) => {

    const usuarioToken = req.validarToken.usuario

    try {

        let result;
        const query = `SELECT * FROM ciudad`;
        [result] = await dbRailway.query(query);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'get',
            endPoint: 'ciudades',
            accion: 'Obtener ciudades',
            detalle: 'Ciudades obtenidas con exito',
            datos: {},
            tablasIdsAfectados: [],
            tablasIdsAfectados: [{
                tabla: 'wfm_operaciones_centro_actividades',
                id: result.insertId?.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });


        return sendResponse(
            res,
            200,
            `Ciudades obtenidas correctamente`,
            `Se han obtenido las ciudades correctamente.`,
            result
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'get',
            endPoint: 'ciudades',
            accion: 'Error al obtener ciudades',
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

        let result;
        const query = `SELECT * FROM tabla_aux_inspecciones`;
        [result] = await dbRailway.query(query);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'get',
            endPoint: 'auxiliar',
            accion: 'Obtener tabla auxiliar',
            detalle: 'Tabla auxiliar obtenido con exito',
            datos: {},
            tablasIdsAfectados: [],
            tablasIdsAfectados: [{
                tabla: 'wfm_operaciones_centro_actividades',
                id: result.insertId?.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });


        return sendResponse(
            res,
            200,
            `Tabla auxiliar obtenida correctamente`,
            `Se ha obtenido la tabla auxiliar correctamente.`,
            result
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'get',
            endPoint: 'auxiliar',
            accion: 'Error al obtener tabla auxiliar',
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

router.get('/registros', validarToken, async (req, res) => {

    const usuarioToken = req.validarToken.usuario

    try {
        const [rows] = await dbRailway.query('SELECT * FROM inspecciones_registros');

        const unpackedRows = rows.map(row => {
            let capData = {};
            if (row.respuestas_capitulos) {
                try {
                    capData = typeof row.respuestas_capitulos === 'string'
                        ? JSON.parse(row.respuestas_capitulos)
                        : row.respuestas_capitulos;
                } catch (e) {
                    console.error("Error parsing respuestas_capitulos:", e);
                }
            }
            let specData = {};
            if (row.datos_especificos) {
                try {
                    specData = typeof row.datos_especificos === 'string'
                        ? JSON.parse(row.datos_especificos)
                        : row.datos_especificos;
                } catch (e) {
                    console.error("Error parsing datos_especificos:", e);
                }
            }
            const unpackedRow = { ...row, ...capData, ...specData, tipo_inspeccion: row.gen_nombreInspeccion || row.gen_tipoInspeccion || DEFAULT_INSPECTION_TYPE };
            delete unpackedRow.respuestas_capitulos;
            delete unpackedRow.datos_especificos;
            return unpackedRow;
        });

        unpackedRows.sort((a, b) => {
            const dateA = a.gen_fechaRegistro || '';
            const dateB = b.gen_fechaRegistro || '';
            return dateB.localeCompare(dateA);
        });

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'get',
            endPoint: 'registros',
            accion: 'Consulta registros exitosa',
            detalle: `Se consultó ${unpackedRows.length} registros`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${unpackedRows.length} registros de inspecciones.`,
            unpackedRows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
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

router.post('/crearRegistroBotiquin', validarToken, upload.any(), async (req, res) => {

    const usuarioToken = req.validarToken.usuario

    try {
        let data = req.body;

        if (data.data && typeof data.data === 'string') {
            try {
                data = JSON.parse(data.data);
            } catch (e) {
            }
        }

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'inspecciones',
                metodo: 'post',
                endPoint: 'crearRegistroBotiquin',
                accion: 'Crear registro fallido',
                detalle: 'Los datos del registro son requeridos.',
                datos: { data: req.body },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del registro son requeridos.");
        }

        const requiredFields = {
            gen_fechaRegistro: "Fecha de registro faltante.",
            gen_fechaInspeccion: "Fecha de inspección faltante.",
            gen_proyecto: "El campo Proyecto es obligatorio.",
            gen_responsableNombre: "El nombre del responsable es obligatorio.",
            gen_responsableCedula: "La cédula del responsable es obligatoria.",
            gen_ubicacion: "La ubicación es obligatoria.",
            gen_tipoBotiquin: "El tipo de botiquín es obligatorio.",
            gen_precinto: "El número de precinto es obligatorio.",
            gen_supervisorNombre: "El nombre del supervisor es obligatorio.",
            gen_supervisorCedula: "La cédula del supervisor es obligatoria.",
            gen_cedulaUsuario: "ID de usuario faltante.",
            gen_nombreUsuario: "Nombre de usuario faltante.",
            gen_proceso: "El proceso es obligatorio.",
            gen_numeroContrato: "El número de contrato es obligatorio.",
            gen_tipoInspeccion: "El tipo de inspección es obligatorio.",
            gen_nombreProyecto: "El nombre del proyecto es obligatorio.",
            gen_direccion: "La dirección es obligatoria.",
            gen_ciudad: "La ciudad es obligatoria.",
            cap1Guantes: "Cap 1: Guantes faltante.",
            cap1Tapabocas: "Cap 1: Tapabocas faltante.",
            cap1Monogafas: "Cap 1: Monogafas faltante.",
            cap1Mascara: "Cap 1: Máscara faltante.",
            cap1Bolsa: "Cap 1: Bolsa roja faltante.",
            cap1GuantesFecha: "Cap 1: Fecha de guantes faltante.",
            cap2CompresaGasa: "Cap 2: Compresa gasa faltante.",
            cap2CompresaGasaFecha: "Cap 2: Fecha compresa gasa faltante.",
            cap2Bajalenguas: "Cap 2: Bajalenguas faltante.",
            cap2BajalenguasFecha: "Cap 2: Fecha bajalenguas faltante.",
            cap2Curitas: "Cap 2: Curitas faltante.",
            cap2GasasEsteriles: "Cap 2: Gasas estériles faltante.",
            cap2GasasEsterilesFecha: "Cap 2: Fecha gasas estériles faltante.",
            cap2Esparadrapo: "Cap 2: Esparadrapo faltante.",
            cap2EsparadrapoFecha: "Cap 2: Fecha esparadrapo faltante.",
            cap2Microporo: "Cap 2: Microporo faltante.",
            cap2MicroporoFecha: "Cap 2: Fecha microporo faltante.",
            cap2VendajesElasticos2x5: "Cap 2: Venda 2x5 faltante.",
            cap2VendajesElasticos2x5Fecha: "Cap 2: Fecha venda 2x5 faltante.",
            cap2VendajesElasticos3x5: "Cap 2: Venda 3x5 faltante.",
            cap2VendajesElasticos3x5Fecha: "Cap 2: Fecha venda 3x5 faltante.",
            cap2VendajesElasticos5x5: "Cap 2: Venda 5x5 faltante.",
            cap2VendaAlgodon: "Cap 2: Venda algodón faltante.",
            cap2VendaAlgodonFecha: "Cap 2: Fecha venda algodón faltante.",
            cap2OclusoresOculares: "Cap 2: Oclusores oculares faltante.",
            cap3KitInmovilizadores: "Cap 3: Kit inmovilizadores faltante.",
            cap3InmovilizadorCervical: "Cap 3: Inmovilizador cervical faltante.",
            cap3VendajeTriangular: "Cap 3: Vendaje triangular faltante.",
            cap4SolucionSalina: "Cap 4: Solución salina faltante.",
            cap4SolucionSalinaFecha: "Cap 4: Fecha solución salina faltante.",
            cap5TijerasTrauma: "Cap 5: Tijeras trauma faltante.",
            cap5BolsaHermetica: "Cap 5: Bolsa hermética faltante.",
            cap5Linterna: "Cap 5: Linterna faltante.",
            cap5Cuadernillo: "Cap 5: Cuadernillo faltante.",
            cap5Esfero: "Cap 5: Esfero faltante.",
            cap5Pito: "Cap 5: Pito faltante.",
            cap5BotiquinFijo: "Cap 5: Botiquín fijo faltante."
        };

        if (!validateRequiredFields(data, requiredFields, res)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'inspecciones',
                metodo: 'post',
                endPoint: 'crearRegistroBotiquin',
                accion: 'Crear registro fallido',
                detalle: 'Faltan campos obligatorios por diligenciar.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return;
        }

        const archivos = req.files;
        const mappedEvidencias = {};
        const mappedNoCumplimientos = {};
        const fechaColombia = getFechaHoraColombia();

        if (archivos && archivos.length > 0) {
            for (let i = 0; i < archivos.length; i++) {
                const file = archivos[i];

                if (file.fieldname.startsWith('cap') && file.fieldname.endsWith('Evidencia')) {
                    const fieldName = file.fieldname;
                    if (!mappedEvidencias[fieldName]) mappedEvidencias[fieldName] = [];

                    const ext = path.extname(file.originalname);
                    const fileName = `inspeccion_${data.gen_cedulaUsuario}_${fieldName}_${fechaColombia}_${mappedEvidencias[fieldName].length + 1}${ext}`;

                    try {
                        const uploadResult = await uploadFileToDrive(
                            file.buffer,
                            fileName,
                            folderId
                        );

                        const result = {
                            nombre: fileName,
                            id: uploadResult.id,
                            url: uploadResult.url,
                            webViewLink: uploadResult.webViewLink,
                            size: file.size
                        };

                        mappedEvidencias[fieldName].push(result);

                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'success',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'inspecciones',
                            metodo: 'post',
                            endPoint: 'crearRegistroBotiquin',
                            accion: 'Cargar evidencia exitosa',
                            detalle: `Archivo ${mappedEvidencias[fieldName].length} para ${fieldName} cargado exitosamente`,
                            datos: {
                                campo: fieldName,
                                evidencia: result
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    } catch (uploadErr) {
                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'error',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'inspecciones',
                            metodo: 'post',
                            endPoint: 'crearRegistroBotiquin',
                            accion: 'Cargar evidencia fallida',
                            detalle: `Error al cargar archivo en ${fieldName}: ${uploadErr.message}`,
                            datos: {
                                campo: fieldName,
                                nombreOriginal: file.originalname,
                                error: uploadErr.message
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    }
                } else if (file.fieldname.startsWith('no_cumplimiento_')) {
                    const fieldName = file.fieldname;
                    const actualField = fieldName.replace('no_cumplimiento_', '');
                    if (!mappedNoCumplimientos[actualField]) mappedNoCumplimientos[actualField] = [];

                    const ext = path.extname(file.originalname);
                    const fileName = `inspeccion_${data.gen_cedulaUsuario}_noCumplimiento_${actualField}_${fechaColombia}_${mappedNoCumplimientos[actualField].length + 1}${ext}`;

                    try {
                        const uploadResult = await uploadFileToDrive(
                            file.buffer,
                            fileName,
                            folderId
                        );

                        const result = {
                            nombre: fileName,
                            id: uploadResult.id,
                            url: uploadResult.url,
                            webViewLink: uploadResult.webViewLink,
                            size: file.size
                        };

                        mappedNoCumplimientos[actualField].push(result);
                    } catch (uploadErr) {
                        console.error(`Error al cargar evidencia de no cumplimiento en ${actualField}:`, uploadErr.message);
                    }
                }
            }
        }

        for (const [campo, listaArchivos] of Object.entries(mappedEvidencias)) {
            data[campo] = JSON.stringify(listaArchivos);
        }

        // Merge no_cumplimientos
        let noCumplimientosObj = {};
        if (data.no_cumplimientos) {
            if (typeof data.no_cumplimientos === 'string') {
                try {
                    noCumplimientosObj = JSON.parse(data.no_cumplimientos);
                } catch (e) {
                    noCumplimientosObj = {};
                }
            } else {
                noCumplimientosObj = data.no_cumplimientos;
            }
        }

        for (const [actualField, filesList] of Object.entries(mappedNoCumplimientos)) {
            if (!noCumplimientosObj[actualField]) {
                noCumplimientosObj[actualField] = { evidencia: [], observacion: "" };
            }
            const existingFiles = noCumplimientosObj[actualField].evidencia || [];
            noCumplimientosObj[actualField].evidencia = [...existingFiles, ...filesList];
        }

        data.no_cumplimientos = JSON.stringify(noCumplimientosObj);

        // Evaluate compliance results considering non-compliance support
        let finalResult = "CUMPLE";
        for (const [key, val] of Object.entries(data)) {
            if (key.startsWith("cap") && !key.endsWith("Evidencia") && !key.endsWith("Fecha") && key !== "no_cumplimientos") {
                if (val === "NO CUMPLE") {
                    const nc = noCumplimientosObj[key];
                    const hasSupport = nc && nc.observacion && nc.observacion.trim() !== "" && Array.isArray(nc.evidencia) && nc.evidencia.length > 0;
                    if (!hasSupport) {
                        finalResult = "NO CUMPLE";
                        break;
                    }
                }
            }
        }
        data.resultado_inicial = finalResult;
        data.resultado_final = finalResult;

        // Pack all cap* fields into a single JSON object 'respuestas_capitulos'
        const respuestasCapitulos = {};
        for (const [key, val] of Object.entries(data)) {
            if (key.startsWith("cap")) {
                respuestasCapitulos[key] = val;
                delete data[key];
            }
        }
        data.respuestas_capitulos = JSON.stringify(respuestasCapitulos);

        const keys = Object.keys(data);
        const values = Object.values(data).map(val => {
            if (val && typeof val === 'object' && !(val instanceof Date)) {
                return JSON.stringify(val);
            }
            return val;
        });

        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO inspecciones_botiquin (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'post',
            endPoint: 'crearRegistroBotiquin',
            accion: 'Crear registro exitoso',
            detalle: 'Inspección de botiquín creada con éxito',
            datos: { data: { ...data, ...respuestasCapitulos } },
            tablasIdsAfectados: [{
                tabla: 'inspecciones_botiquin',
                id: result.insertId?.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Inspección guardada correctamente`,
            `Se ha guardado el registro con ID ${result.insertId}.`,
            { id: result.insertId, ...data, ...respuestasCapitulos }
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'post',
            endPoint: 'crearRegistroBotiquin',
            accion: 'Error al crear registro de inspección',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado al guardar la inspección.", err);
    }
});

router.put('/editarRegistroBotiquin/:id', validarToken, upload.any(), async (req, res) => {
    const usuarioToken = req.validarToken.usuario;
    const { id } = req.params;

    try {
        let data = req.body;

        if (data.data && typeof data.data === 'string') {
            try {
                data = JSON.parse(data.data);
            } catch (e) {
            }
        }

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'inspecciones',
                metodo: 'put',
                endPoint: `editarRegistroBotiquin/${id}`,
                accion: 'Editar registro fallido',
                detalle: 'Los datos del registro son requeridos.',
                datos: { data: req.body },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del registro son requeridos.");
        }

        // Remove id and tipo_inspeccion if present in data object
        delete data.id;
        delete data.tipo_inspeccion;

        const archivos = req.files;
        const mappedEvidencias = {};
        const mappedNoCumplimientos = {};
        const fechaColombia = getFechaHoraColombia();

        if (archivos && archivos.length > 0) {
            for (let i = 0; i < archivos.length; i++) {
                const file = archivos[i];

                if (file.fieldname.startsWith('cap') && file.fieldname.endsWith('Evidencia')) {
                    const fieldName = file.fieldname;
                    if (!mappedEvidencias[fieldName]) mappedEvidencias[fieldName] = [];

                    const ext = path.extname(file.originalname);
                    const fileName = `inspeccion_${data.gen_cedulaUsuario}_${fieldName}_${fechaColombia}_${mappedEvidencias[fieldName].length + 1}${ext}`;

                    try {
                        const uploadResult = await uploadFileToDrive(
                            file.buffer,
                            fileName,
                            folderId
                        );

                        const result = {
                            nombre: fileName,
                            id: uploadResult.id,
                            url: uploadResult.url,
                            webViewLink: uploadResult.webViewLink,
                            size: file.size
                        };

                        mappedEvidencias[fieldName].push(result);
                    } catch (uploadErr) {
                        console.error(`Error al cargar evidencia en ${fieldName}:`, uploadErr.message);
                    }
                } else if (file.fieldname.startsWith('no_cumplimiento_')) {
                    const fieldName = file.fieldname;
                    const actualField = fieldName.replace('no_cumplimiento_', '');
                    if (!mappedNoCumplimientos[actualField]) mappedNoCumplimientos[actualField] = [];

                    const ext = path.extname(file.originalname);
                    const fileName = `inspeccion_${data.gen_cedulaUsuario}_noCumplimiento_${actualField}_${fechaColombia}_${mappedNoCumplimientos[actualField].length + 1}${ext}`;

                    try {
                        const uploadResult = await uploadFileToDrive(
                            file.buffer,
                            fileName,
                            folderId
                        );

                        const result = {
                            nombre: fileName,
                            id: uploadResult.id,
                            url: uploadResult.url,
                            webViewLink: uploadResult.webViewLink,
                            size: file.size
                        };

                        mappedNoCumplimientos[actualField].push(result);
                    } catch (uploadErr) {
                        console.error(`Error al cargar evidencia de no cumplimiento en ${actualField}:`, uploadErr.message);
                    }
                }
            }
        }

        // Merge existing evidences with newly uploaded ones if necessary, or assign new ones
        for (const [campo, listaArchivos] of Object.entries(mappedEvidencias)) {
            data[campo] = JSON.stringify(listaArchivos);
        }

        // Merge no_cumplimientos
        let noCumplimientosObj = {};
        if (data.no_cumplimientos) {
            if (typeof data.no_cumplimientos === 'string') {
                try {
                    noCumplimientosObj = JSON.parse(data.no_cumplimientos);
                } catch (e) {
                    noCumplimientosObj = {};
                }
            } else {
                noCumplimientosObj = data.no_cumplimientos;
            }
        }

        for (const [actualField, filesList] of Object.entries(mappedNoCumplimientos)) {
            if (!noCumplimientosObj[actualField]) {
                noCumplimientosObj[actualField] = { evidencia: [], observacion: "" };
            }
            const existingFiles = noCumplimientosObj[actualField].evidencia || [];
            noCumplimientosObj[actualField].evidencia = [...existingFiles, ...filesList];
        }

        data.no_cumplimientos = JSON.stringify(noCumplimientosObj);

        // Evaluate compliance results considering non-compliance support
        let finalResult = "CUMPLE";
        for (const [key, val] of Object.entries(data)) {
            if (key.startsWith("cap") && !key.endsWith("Evidencia") && !key.endsWith("Fecha") && key !== "no_cumplimientos") {
                if (val === "NO CUMPLE") {
                    const nc = noCumplimientosObj[key];
                    const hasSupport = nc && nc.observacion && nc.observacion.trim() !== "" && Array.isArray(nc.evidencia) && nc.evidencia.length > 0;
                    if (!hasSupport) {
                        finalResult = "NO CUMPLE";
                        break;
                    }
                }
            }
        }
        data.resultado_final = finalResult;

        // Pack all cap* fields into a single JSON object 'respuestas_capitulos'
        const respuestasCapitulos = {};
        for (const [key, val] of Object.entries(data)) {
            if (key.startsWith("cap")) {
                respuestasCapitulos[key] = val;
                delete data[key];
            }
        }
        data.respuestas_capitulos = JSON.stringify(respuestasCapitulos);

        const keys = Object.keys(data);
        const values = Object.values(data).map(val => {
            if (val && typeof val === 'object' && !(val instanceof Date)) {
                return JSON.stringify(val);
            }
            return val;
        });

        const setClause = keys.map(key => `${key} = ?`).join(', ');

        const query = `
            UPDATE inspecciones_botiquin
            SET ${setClause}
            WHERE id = ?
        `;

        const [result] = await dbRailway.query(query, [...values, id]);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'put',
            endPoint: `editarRegistroBotiquin/${id}`,
            accion: 'Editar registro exitoso',
            detalle: 'Inspección de botiquín editada con éxito',
            datos: { data: { ...data, ...respuestasCapitulos } },
            tablasIdsAfectados: [{
                tabla: 'inspecciones_botiquin',
                id: id
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Inspección editada correctamente`,
            `Se ha actualizado el registro con ID ${id}.`,
            { id, ...data, ...respuestasCapitulos }
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'put',
            endPoint: `editarRegistroBotiquin/${id}`,
            accion: 'Error al editar registro de inspección',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado al editar la inspección.", err);
    }
});

router.post('/crearRegistroGuantes', validarToken, upload.any(), async (req, res) => {
    const usuarioToken = req.validarToken.usuario;

    try {
        let data = req.body;

        if (data.data && typeof data.data === 'string') {
            try {
                data = JSON.parse(data.data);
            } catch (e) {
            }
        }

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'inspecciones',
                metodo: 'post',
                endPoint: 'crearRegistroGuantes',
                accion: 'Crear registro fallido',
                detalle: 'Los datos del registro son requeridos.',
                datos: { data: req.body },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del registro son requeridos.");
        }

        const requiredFields = {
            gen_fechaRegistro: "Fecha de registro faltante.",
            gen_fechaInspeccion: "Fecha de inspección faltante.",
            gen_proyecto: "El campo Proyecto es obligatorio.",
            gen_responsableNombre: "El nombre del responsable es obligatorio.",
            gen_responsableCedula: "La cédula del responsable es obligatoria.",
            gen_ubicacion: "La ubicación es obligatoria.",
            gen_supervisorNombre: "El nombre del supervisor es obligatorio.",
            gen_supervisorCedula: "La cédula del supervisor es obligatoria.",
            gen_cedulaUsuario: "ID de usuario faltante.",
            gen_nombreUsuario: "Nombre de usuario faltante.",
            gen_proceso: "El proceso es obligatorio.",
            gen_numeroContrato: "El número de contrato es obligatorio.",
            gen_tipoInspeccion: "El tipo de inspección es obligatorio.",
            gen_nombreProyecto: "El nombre del proyecto es obligatorio.",
            gen_direccion: "La dirección es obligatoria.",
            gen_ciudad: "La ciudad es obligatoria.",
            cap1GuantinesCuenta: "Cap 1: Guantines cuenta es obligatorio.",
            cap1GuantinesHebras: "Cap 1: Guantines hebras es obligatorio.",
            cap1GuantinesPerforaciones: "Cap 1: Guantines perforaciones es obligatorio.",
            cap1GuantinesBolsa: "Cap 1: Guantines bolsa es obligatorio.",
            cap1GuantinesBuenUso: "Cap 1: Guantines buen uso es obligatorio.",
            cap2GuantesCuenta: "Cap 2: Guantes cuenta es obligatorio.",
            cap2GuantesHebras: "Cap 2: Guantes hebras es obligatorio.",
            cap2GuantesPerforaciones: "Cap 2: Guantes perforaciones es obligatorio.",
            cap2GuantesBolsa: "Cap 2: Guantes bolsa es obligatorio.",
            cap2GuantesBuenUso: "Cap 2: Guantes buen uso es obligatorio.",
            cap3GuantesCuenta: "Cap 3: Guantes cuenta es obligatorio.",
            cap3GuantesPerforaciones: "Cap 3: Guantes perforaciones es obligatorio.",
            cap3GuantesContaminacion: "Cap 3: Guantes contaminacion es obligatorio.",
            cap3GuantesSerialDerecho: "Cap 3: Serial Derecho es obligatorio.",
            cap3GuantesSerialIzquierdo: "Cap 3: Serial Izquierdo es obligatorio.",
            cap3GuantesMarca: "Cap 3: Marca es obligatoria.",
            cap3GuantesTalla: "Cap 3: Talla es obligatoria.",
            cap3GuantesFuncionamiento: "Cap 3: Funcionamiento correcto es obligatorio.",
            cap3GuantesAprobados: "Cap 3: Aprobados es obligatorio."
        };

        if (!validateRequiredFields(data, requiredFields, res)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'inspecciones',
                metodo: 'post',
                endPoint: 'crearRegistroGuantes',
                accion: 'Crear registro fallido',
                detalle: 'Faltan campos obligatorios por diligenciar.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return;
        }

        const archivos = req.files;
        const mappedEvidencias = {};
        const mappedNoCumplimientos = {};
        const fechaColombia = getFechaHoraColombia();

        if (archivos && archivos.length > 0) {
            for (let i = 0; i < archivos.length; i++) {
                const file = archivos[i];

                if (file.fieldname.startsWith('cap') && file.fieldname.endsWith('Evidencia')) {
                    const fieldName = file.fieldname;
                    if (!mappedEvidencias[fieldName]) mappedEvidencias[fieldName] = [];

                    const ext = path.extname(file.originalname);
                    const fileName = `inspeccion_${data.gen_cedulaUsuario}_${fieldName}_${fechaColombia}_${mappedEvidencias[fieldName].length + 1}${ext}`;

                    try {
                        const uploadResult = await uploadFileToDrive(
                            file.buffer,
                            fileName,
                            folderId
                        );

                        const result = {
                            nombre: fileName,
                            id: uploadResult.id,
                            url: uploadResult.url,
                            webViewLink: uploadResult.webViewLink,
                            size: file.size
                        };

                        mappedEvidencias[fieldName].push(result);

                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'success',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'inspecciones',
                            metodo: 'post',
                            endPoint: 'crearRegistroGuantes',
                            accion: 'Cargar evidencia exitosa',
                            detalle: `Archivo ${mappedEvidencias[fieldName].length} para ${fieldName} cargado exitosamente`,
                            datos: {
                                campo: fieldName,
                                evidencia: result
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    } catch (uploadErr) {
                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'error',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'inspecciones',
                            metodo: 'post',
                            endPoint: 'crearRegistroGuantes',
                            accion: 'Cargar evidencia fallida',
                            detalle: `Error al cargar archivo en ${fieldName}: ${uploadErr.message}`,
                            datos: {
                                campo: fieldName,
                                nombreOriginal: file.originalname,
                                error: uploadErr.message
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    }
                } else if (file.fieldname.startsWith('no_cumplimiento_')) {
                    const fieldName = file.fieldname;
                    const actualField = fieldName.replace('no_cumplimiento_', '');
                    if (!mappedNoCumplimientos[actualField]) mappedNoCumplimientos[actualField] = [];

                    const ext = path.extname(file.originalname);
                    const fileName = `inspeccion_${data.gen_cedulaUsuario}_noCumplimiento_${actualField}_${fechaColombia}_${mappedNoCumplimientos[actualField].length + 1}${ext}`;

                    try {
                        const uploadResult = await uploadFileToDrive(
                            file.buffer,
                            fileName,
                            folderId
                        );

                        const result = {
                            nombre: fileName,
                            id: uploadResult.id,
                            url: uploadResult.url,
                            webViewLink: uploadResult.webViewLink,
                            size: file.size
                        };

                        mappedNoCumplimientos[actualField].push(result);
                    } catch (uploadErr) {
                        console.error(`Error al cargar evidencia de no cumplimiento en ${actualField}:`, uploadErr.message);
                    }
                }
            }
        }

        for (const [campo, listaArchivos] of Object.entries(mappedEvidencias)) {
            data[campo] = JSON.stringify(listaArchivos);
        }

        // Merge no_cumplimientos
        let noCumplimientosObj = {};
        if (data.no_cumplimientos) {
            if (typeof data.no_cumplimientos === 'string') {
                try {
                    noCumplimientosObj = JSON.parse(data.no_cumplimientos);
                } catch (e) {
                    noCumplimientosObj = {};
                }
            } else {
                noCumplimientosObj = data.no_cumplimientos;
            }
        }

        for (const [actualField, filesList] of Object.entries(mappedNoCumplimientos)) {
            if (!noCumplimientosObj[actualField]) {
                noCumplimientosObj[actualField] = { evidencia: [], observacion: "" };
            }
            const existingFiles = noCumplimientosObj[actualField].evidencia || [];
            noCumplimientosObj[actualField].evidencia = [...existingFiles, ...filesList];
        }

        data.no_cumplimientos = JSON.stringify(noCumplimientosObj);

        // Evaluate compliance results considering non-compliance support, excluding text fields
        const textFields = ["cap3GuantesSerialDerecho", "cap3GuantesSerialIzquierdo", "cap3GuantesMarca", "cap3GuantesTalla"];
        let finalResult = "CUMPLE";
        for (const [key, val] of Object.entries(data)) {
            if (key.startsWith("cap") && !key.endsWith("Evidencia") && !key.endsWith("Fecha") && key !== "no_cumplimientos" && !textFields.includes(key)) {
                if (val === "NO CUMPLE") {
                    const nc = noCumplimientosObj[key];
                    const hasSupport = nc && nc.observacion && nc.observacion.trim() !== "" && Array.isArray(nc.evidencia) && nc.evidencia.length > 0;
                    if (!hasSupport) {
                        finalResult = "NO CUMPLE";
                        break;
                    }
                }
            }
        }
        data.resultado_inicial = finalResult;
        data.resultado_final = finalResult;

        // Pack all cap* fields into a single JSON object 'respuestas_capitulos'
        const respuestasCapitulos = {};
        for (const [key, val] of Object.entries(data)) {
            if (key.startsWith("cap")) {
                respuestasCapitulos[key] = val;
                delete data[key];
            }
        }
        data.respuestas_capitulos = JSON.stringify(respuestasCapitulos);

        const keys = Object.keys(data);
        const values = Object.values(data).map(val => {
            if (val && typeof val === 'object' && !(val instanceof Date)) {
                return JSON.stringify(val);
            }
            return val;
        });

        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO inspecciones_guantes_dielectricos (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'post',
            endPoint: 'crearRegistroGuantes',
            accion: 'Crear registro exitoso',
            detalle: 'Inspección de guantes dieléctricos creada con éxito',
            datos: { data: { ...data, ...respuestasCapitulos } },
            tablasIdsAfectados: [{
                tabla: 'inspecciones_guantes_dielectricos',
                id: result.insertId?.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Inspección guardada correctamente`,
            `Se ha guardado el registro con ID ${result.insertId}.`,
            { id: result.insertId, ...data, ...respuestasCapitulos }
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'post',
            endPoint: 'crearRegistroGuantes',
            accion: 'Error al crear registro de inspección',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado al guardar la inspección.", err);
    }
});

router.put('/editarRegistroGuantes/:id', validarToken, upload.any(), async (req, res) => {
    const usuarioToken = req.validarToken.usuario;
    const { id } = req.params;

    try {
        let data = req.body;

        if (data.data && typeof data.data === 'string') {
            try {
                data = JSON.parse(data.data);
            } catch (e) {
            }
        }

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'inspecciones',
                metodo: 'put',
                endPoint: `editarRegistroGuantes/${id}`,
                accion: 'Editar registro fallido',
                detalle: 'Los datos del registro son requeridos.',
                datos: { data: req.body },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del registro son requeridos.");
        }

        delete data.id;
        delete data.tipo_inspeccion;

        const archivos = req.files;
        const mappedEvidencias = {};
        const mappedNoCumplimientos = {};
        const fechaColombia = getFechaHoraColombia();

        if (archivos && archivos.length > 0) {
            for (let i = 0; i < archivos.length; i++) {
                const file = archivos[i];

                if (file.fieldname.startsWith('cap') && file.fieldname.endsWith('Evidencia')) {
                    const fieldName = file.fieldname;
                    if (!mappedEvidencias[fieldName]) mappedEvidencias[fieldName] = [];

                    const ext = path.extname(file.originalname);
                    const fileName = `inspeccion_${data.gen_cedulaUsuario}_${fieldName}_${fechaColombia}_${mappedEvidencias[fieldName].length + 1}${ext}`;

                    try {
                        const uploadResult = await uploadFileToDrive(
                            file.buffer,
                            fileName,
                            folderId
                        );

                        const result = {
                            nombre: fileName,
                            id: uploadResult.id,
                            url: uploadResult.url,
                            webViewLink: uploadResult.webViewLink,
                            size: file.size
                        };

                        mappedEvidencias[fieldName].push(result);
                    } catch (uploadErr) {
                        console.error(`Error al cargar evidencia en ${fieldName}:`, uploadErr.message);
                    }
                } else if (file.fieldname.startsWith('no_cumplimiento_')) {
                    const fieldName = file.fieldname;
                    const actualField = fieldName.replace('no_cumplimiento_', '');
                    if (!mappedNoCumplimientos[actualField]) mappedNoCumplimientos[actualField] = [];

                    const ext = path.extname(file.originalname);
                    const fileName = `inspeccion_${data.gen_cedulaUsuario}_noCumplimiento_${actualField}_${fechaColombia}_${mappedNoCumplimientos[actualField].length + 1}${ext}`;

                    try {
                        const uploadResult = await uploadFileToDrive(
                            file.buffer,
                            fileName,
                            folderId
                        );

                        const result = {
                            nombre: fileName,
                            id: uploadResult.id,
                            url: uploadResult.url,
                            webViewLink: uploadResult.webViewLink,
                            size: file.size
                        };

                        mappedNoCumplimientos[actualField].push(result);
                    } catch (uploadErr) {
                        console.error(`Error al cargar evidencia de no cumplimiento en ${actualField}:`, uploadErr.message);
                    }
                }
            }
        }

        for (const [campo, listaArchivos] of Object.entries(mappedEvidencias)) {
            data[campo] = JSON.stringify(listaArchivos);
        }

        let noCumplimientosObj = {};
        if (data.no_cumplimientos) {
            if (typeof data.no_cumplimientos === 'string') {
                try {
                    noCumplimientosObj = JSON.parse(data.no_cumplimientos);
                } catch (e) {
                    noCumplimientosObj = {};
                }
            } else {
                noCumplimientosObj = data.no_cumplimientos;
            }
        }

        for (const [actualField, filesList] of Object.entries(mappedNoCumplimientos)) {
            if (!noCumplimientosObj[actualField]) {
                noCumplimientosObj[actualField] = { evidencia: [], observacion: "" };
            }
            const existingFiles = noCumplimientosObj[actualField].evidencia || [];
            noCumplimientosObj[actualField].evidencia = [...existingFiles, ...filesList];
        }

        data.no_cumplimientos = JSON.stringify(noCumplimientosObj);

        // Evaluate compliance results considering non-compliance support, excluding text fields
        const textFields = ["cap3GuantesSerialDerecho", "cap3GuantesSerialIzquierdo", "cap3GuantesMarca", "cap3GuantesTalla"];
        let finalResult = "CUMPLE";
        for (const [key, val] of Object.entries(data)) {
            if (key.startsWith("cap") && !key.endsWith("Evidencia") && !key.endsWith("Fecha") && key !== "no_cumplimientos" && !textFields.includes(key)) {
                if (val === "NO CUMPLE") {
                    const nc = noCumplimientosObj[key];
                    const hasSupport = nc && nc.observacion && nc.observacion.trim() !== "" && Array.isArray(nc.evidencia) && nc.evidencia.length > 0;
                    if (!hasSupport) {
                        finalResult = "NO CUMPLE";
                        break;
                    }
                }
            }
        }
        data.resultado_final = finalResult;

        const respuestasCapitulos = {};
        for (const [key, val] of Object.entries(data)) {
            if (key.startsWith("cap")) {
                respuestasCapitulos[key] = val;
                delete data[key];
            }
        }
        data.respuestas_capitulos = JSON.stringify(respuestasCapitulos);

        const keys = Object.keys(data);
        const values = Object.values(data).map(val => {
            if (val && typeof val === 'object' && !(val instanceof Date)) {
                return JSON.stringify(val);
            }
            return val;
        });

        const setClause = keys.map(key => `${key} = ?`).join(', ');

        const query = `
            UPDATE inspecciones_guantes_dielectricos
            SET ${setClause}
            WHERE id = ?
        `;

        const [result] = await dbRailway.query(query, [...values, id]);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'put',
            endPoint: `editarRegistroGuantes/${id}`,
            accion: 'Editar registro exitoso',
            detalle: 'Inspección de guantes dieléctricos editada con éxito',
            datos: { data: { ...data, ...respuestasCapitulos } },
            tablasIdsAfectados: [{
                tabla: 'inspecciones_guantes_dielectricos',
                id: id
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Inspección editada correctamente`,
            `Se ha actualizado el registro con ID ${id}.`,
            { id, ...data, ...respuestasCapitulos }
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'put',
            endPoint: `editarRegistroGuantes/${id}`,
            accion: 'Error al editar registro de inspección',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado al editar la inspección.", err);
    }
});

router.post('/obtenerArchivosEvidencias', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;
    const { archivosEvidencias } = req.body;

    try {
        if (!archivosEvidencias || !Array.isArray(archivosEvidencias) || archivosEvidencias.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'inspecciones',
                metodo: 'post',
                endPoint: 'obtenerArchivosEvidencias',
                accion: 'Obtener evidencias fallido',
                detalle: 'Los nombres de los archivos son requeridos.',
                datos: { archivosEvidencias },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                400,
                "Solicitud inválida",
                "Se requiere un array de nombres de archivos en el campo 'archivosEvidencias'",
                null
            );
        }

        const { getMimeType } = require('../services/googleDriveService');

        const resultados = {
            archivos: [],
            errores: []
        };

        for (const nombreArchivo of archivosEvidencias) {
            try {
                const buffer = await getFileFromDrive(nombreArchivo, folderId);
                if (buffer) {
                    const mimeType = getMimeType(nombreArchivo);
                    resultados.archivos.push({
                        nombre: nombreArchivo,
                        data: buffer.toString('base64'),
                        contentType: mimeType
                    });
                } else {
                    resultados.errores.push({
                        nombre: nombreArchivo,
                        error: "No se pudo obtener el archivo de Drive"
                    });
                }
            } catch (error) {
                resultados.errores.push({
                    nombre: nombreArchivo,
                    error: error.message || "Error al obtener el archivo"
                });
            }
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'post',
            endPoint: 'obtenerArchivosEvidencias',
            accion: 'Consulta de evidencias exitosa',
            detalle: `Se consultaron ${resultados.archivos.length} archivos de evidencias`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron los archivos de evidencias correctamente.`,
            resultados
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'post',
            endPoint: 'obtenerArchivosEvidencias',
            accion: 'Error al obtener evidencias',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado al obtener las evidencias.", err);
    }
});

router.post('/registro', validarToken, upload.any(), async (req, res) => {
    const usuarioToken = req.validarToken.usuario;

    try {
        let data = req.body;

        if (data.data && typeof data.data === 'string') {
            try {
                data = JSON.parse(data.data);
            } catch (e) {
            }
        }

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'inspecciones',
                metodo: 'post',
                endPoint: 'crearRegistro',
                accion: 'Crear registro unificado fallido',
                detalle: 'Los datos del registro son requeridos.',
                datos: { data: req.body },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del registro son requeridos.");
        }

        const commonRequired = {
            gen_fechaRegistro: "Fecha de registro faltante.",
            gen_fechaInspeccion: "Fecha de inspección faltante.",
            gen_proyecto: "El campo Proyecto es obligatorio.",
            gen_responsableNombre: "El nombre del responsable es obligatorio.",
            gen_responsableCedula: "La cédula del responsable es obligatoria.",
            gen_ubicacion: "La ubicación es obligatoria.",
            gen_supervisorNombre: "El nombre del supervisor es obligatorio.",
            gen_supervisorCedula: "La cédula del supervisor es obligatoria.",
            gen_cedulaUsuario: "ID de usuario faltante.",
            gen_nombreUsuario: "Nombre de usuario faltante.",
            gen_proceso: "El proceso es obligatorio.",
            gen_numeroContrato: "El número de contrato es obligatorio.",
            gen_tipoInspeccion: "El tipo de inspección es obligatorio.",
            gen_nombreProyecto: "El nombre del proyecto es obligatorio.",
            gen_direccion: "La dirección es obligatoria.",
            gen_ciudad: "La ciudad es obligatoria."
        };

        if (!validateRequiredFields(data, commonRequired, res)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'inspecciones',
                metodo: 'post',
                endPoint: 'crearRegistro',
                accion: 'Crear registro unificado fallido',
                detalle: 'Faltan campos obligatorios comunes por diligenciar.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });
            return;
        }

        const archivos = req.files;
        const mappedEvidencias = {};
        const mappedNoCumplimientos = {};
        const fechaColombia = getFechaHoraColombia();

        if (archivos && archivos.length > 0) {
            for (let i = 0; i < archivos.length; i++) {
                const file = archivos[i];

                if (file.fieldname.startsWith('cap') && file.fieldname.endsWith('Evidencia')) {
                    const fieldName = file.fieldname;
                    if (!mappedEvidencias[fieldName]) mappedEvidencias[fieldName] = [];

                    const ext = path.extname(file.originalname);
                    const fileName = `inspeccion_${data.gen_cedulaUsuario}_${fieldName}_${fechaColombia}_${mappedEvidencias[fieldName].length + 1}${ext}`;

                    try {
                        const uploadResult = await uploadFileToDrive(
                            file.buffer,
                            fileName,
                            folderId
                        );

                        const result = {
                            nombre: fileName,
                            id: uploadResult.id,
                            url: uploadResult.url,
                            webViewLink: uploadResult.webViewLink,
                            size: file.size
                        };

                        mappedEvidencias[fieldName].push(result);

                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'success',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'inspecciones',
                            metodo: 'post',
                            endPoint: 'crearRegistro',
                            accion: 'Cargar evidencia exitosa',
                            detalle: `Archivo ${mappedEvidencias[fieldName].length} para ${fieldName} cargado exitosamente`,
                            datos: {
                                campo: fieldName,
                                evidencia: result
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    } catch (uploadErr) {
                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'error',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'inspecciones',
                            metodo: 'post',
                            endPoint: 'crearRegistro',
                            accion: 'Cargar evidencia fallida',
                            detalle: `Error al cargar archivo en ${fieldName}: ${uploadErr.message}`,
                            datos: {
                                campo: fieldName,
                                nombreOriginal: file.originalname,
                                error: uploadErr.message
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    }
                } else if (file.fieldname.startsWith('no_cumplimiento_')) {
                    const fieldName = file.fieldname;
                    const actualField = fieldName.replace('no_cumplimiento_', '');
                    if (!mappedNoCumplimientos[actualField]) mappedNoCumplimientos[actualField] = [];

                    const ext = path.extname(file.originalname);
                    const fileName = `inspeccion_${data.gen_cedulaUsuario}_noCumplimiento_${actualField}_${fechaColombia}_${mappedNoCumplimientos[actualField].length + 1}${ext}`;

                    try {
                        const uploadResult = await uploadFileToDrive(
                            file.buffer,
                            fileName,
                            folderId
                        );

                        const result = {
                            nombre: fileName,
                            id: uploadResult.id,
                            url: uploadResult.url,
                            webViewLink: uploadResult.webViewLink,
                            size: file.size
                        };

                        mappedNoCumplimientos[actualField].push(result);
                    } catch (uploadErr) {
                        console.error(`Error al cargar evidencia de no cumplimiento en ${actualField}:`, uploadErr.message);
                    }
                }
            }
        }

        for (const [campo, listaArchivos] of Object.entries(mappedEvidencias)) {
            data[campo] = JSON.stringify(listaArchivos);
        }

        let noCumplimientosObj = {};
        if (data.no_cumplimientos) {
            if (typeof data.no_cumplimientos === 'string') {
                try {
                    noCumplimientosObj = JSON.parse(data.no_cumplimientos);
                } catch (e) {
                    noCumplimientosObj = {};
                }
            } else {
                noCumplimientosObj = data.no_cumplimientos;
            }
        }

        for (const [actualField, filesList] of Object.entries(mappedNoCumplimientos)) {
            if (!noCumplimientosObj[actualField]) {
                noCumplimientosObj[actualField] = { evidencia: [], observacion: "" };
            }
            const existingFiles = noCumplimientosObj[actualField].evidencia || [];
            noCumplimientosObj[actualField].evidencia = [...existingFiles, ...filesList];
        }

        data.no_cumplimientos = JSON.stringify(noCumplimientosObj);

        // Evaluate compliance dynamically, ignoring dynamic text keys
        let finalResult = "CUMPLE";
        for (const [key, val] of Object.entries(data)) {
            if (key.startsWith("cap") && !key.endsWith("Evidencia") && !key.endsWith("Fecha") && key !== "no_cumplimientos") {
                const isGuantesText = key === "cap3GuantesSerialDerecho" || key === "cap3GuantesSerialIzquierdo" || key === "cap3GuantesMarca" || key === "cap3GuantesTalla";
                if (!isGuantesText && (val === "NO CUMPLE" || val === "Mal Estado" || val === "Mal Uso")) {
                    const nc = noCumplimientosObj[key];
                    const hasSupport = nc && nc.observacion && nc.observacion.trim() !== "" && Array.isArray(nc.evidencia) && nc.evidencia.length > 0;
                    if (!hasSupport) {
                        finalResult = "NO CUMPLE";
                        break;
                    }
                }
            }
        }
        data.resultado_inicial = finalResult;
        data.resultado_final = finalResult;

        const commonColumns = [
            "gen_fechaRegistro", "gen_fechaInspeccion", "gen_cedulaUsuario", "gen_nombreUsuario",
            "gen_responsableCedula", "gen_responsableNombre", "gen_supervisorCedula", "gen_supervisorNombre",
            "gen_proyecto", "gen_nombreProyecto", "gen_tipoInspeccion", "gen_nombreInspeccion", "gen_direccion", "gen_ciudad",
            "gen_proceso", "gen_numeroContrato", "gen_ubicacion", "gen_observaciones", "resultado_inicial", "resultado_final"
        ];

        const respuestasCapitulos = {};
        const datosEspecificos = {};
        const dbData = {};

        for (const [key, val] of Object.entries(data)) {
            if (key.startsWith("cap")) {
                respuestasCapitulos[key] = val;
            } else if (commonColumns.includes(key)) {
                dbData[key] = val;
            } else if (key === "no_cumplimientos") {
                dbData[key] = val;
            } else {
                datosEspecificos[key] = val;
            }
        }

        dbData.respuestas_capitulos = JSON.stringify(respuestasCapitulos);
        dbData.datos_especificos = JSON.stringify(datosEspecificos);

        const keys = Object.keys(dbData);
        const values = Object.values(dbData).map(val => {
            if (val && typeof val === 'object' && !(val instanceof Date)) {
                return JSON.stringify(val);
            }
            return val;
        });

        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO inspecciones_registros (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'post',
            endPoint: 'crearRegistro',
            accion: 'Crear registro unificado exitoso',
            detalle: `Inspección de ${data.gen_tipoInspeccion} creada con éxito`,
            datos: { data: { ...dbData, ...respuestasCapitulos } },
            tablasIdsAfectados: [{
                tabla: 'inspecciones_registros',
                id: result.insertId?.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Inspección guardada correctamente`,
            `Se ha guardado el registro con ID ${result.insertId}.`,
            { id: result.insertId, ...data }
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'post',
            endPoint: 'crearRegistro',
            accion: 'Error al crear registro unificado',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado al crear el registro.", err);
    }
});

router.put('/registro/:id', validarToken, upload.any(), async (req, res) => {
    const usuarioToken = req.validarToken.usuario;
    const { id } = req.params;

    try {
        let data = req.body;

        if (data.data && typeof data.data === 'string') {
            try {
                data = JSON.parse(data.data);
            } catch (e) {
            }
        }

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'inspecciones',
                metodo: 'put',
                endPoint: `editarRegistro/${id}`,
                accion: 'Editar registro unificado fallido',
                detalle: 'Los datos del registro son requeridos.',
                datos: { data: req.body },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del registro son requeridos.");
        }

        delete data.id;
        delete data.tipo_inspeccion;

        const archivos = req.files;
        const mappedEvidencias = {};
        const mappedNoCumplimientos = {};
        const fechaColombia = getFechaHoraColombia();

        if (archivos && archivos.length > 0) {
            for (let i = 0; i < archivos.length; i++) {
                const file = archivos[i];

                if (file.fieldname.startsWith('cap') && file.fieldname.endsWith('Evidencia')) {
                    const fieldName = file.fieldname;
                    if (!mappedEvidencias[fieldName]) mappedEvidencias[fieldName] = [];

                    const ext = path.extname(file.originalname);
                    const fileName = `inspeccion_${data.gen_cedulaUsuario}_${fieldName}_${fechaColombia}_${mappedEvidencias[fieldName].length + 1}${ext}`;

                    try {
                        const uploadResult = await uploadFileToDrive(
                            file.buffer,
                            fileName,
                            folderId
                        );

                        const result = {
                            nombre: fileName,
                            id: uploadResult.id,
                            url: uploadResult.url,
                            webViewLink: uploadResult.webViewLink,
                            size: file.size
                        };

                        mappedEvidencias[fieldName].push(result);
                    } catch (uploadErr) {
                        console.error(`Error al cargar evidencia en ${fieldName}:`, uploadErr.message);
                    }
                } else if (file.fieldname.startsWith('no_cumplimiento_')) {
                    const fieldName = file.fieldname;
                    const actualField = fieldName.replace('no_cumplimiento_', '');
                    if (!mappedNoCumplimientos[actualField]) mappedNoCumplimientos[actualField] = [];

                    const ext = path.extname(file.originalname);
                    const fileName = `inspeccion_${data.gen_cedulaUsuario}_noCumplimiento_${actualField}_${fechaColombia}_${mappedNoCumplimientos[actualField].length + 1}${ext}`;

                    try {
                        const uploadResult = await uploadFileToDrive(
                            file.buffer,
                            fileName,
                            folderId
                        );

                        const result = {
                            nombre: fileName,
                            id: uploadResult.id,
                            url: uploadResult.url,
                            webViewLink: uploadResult.webViewLink,
                            size: file.size
                        };

                        mappedNoCumplimientos[actualField].push(result);
                    } catch (uploadErr) {
                        console.error(`Error al cargar evidencia de no cumplimiento en ${actualField}:`, uploadErr.message);
                    }
                }
            }
        }

        // Merge mappedEvidencias with existing list if any
        for (const [campo, listaArchivos] of Object.entries(mappedEvidencias)) {
            let existingFiles = [];
            if (data[campo]) {
                if (typeof data[campo] === 'string') {
                    try {
                        existingFiles = JSON.parse(data[campo]);
                    } catch (e) {
                        existingFiles = [];
                    }
                } else if (Array.isArray(data[campo])) {
                    existingFiles = data[campo];
                }
            }
            data[campo] = JSON.stringify([...existingFiles, ...listaArchivos]);
        }

        // Merge no_cumplimientos
        let noCumplimientosObj = {};
        if (data.no_cumplimientos) {
            if (typeof data.no_cumplimientos === 'string') {
                try {
                    noCumplimientosObj = JSON.parse(data.no_cumplimientos);
                } catch (e) {
                    noCumplimientosObj = {};
                }
            } else {
                noCumplimientosObj = data.no_cumplimientos;
            }
        }

        for (const [actualField, filesList] of Object.entries(mappedNoCumplimientos)) {
            if (!noCumplimientosObj[actualField]) {
                noCumplimientosObj[actualField] = { evidencia: [], observacion: "" };
            }
            const existingFiles = noCumplimientosObj[actualField].evidencia || [];
            noCumplimientosObj[actualField].evidencia = [...existingFiles, ...filesList];
        }

        data.no_cumplimientos = JSON.stringify(noCumplimientosObj);

        // Evaluate compliance dynamically, ignoring dynamic text keys
        let finalResult = "CUMPLE";
        for (const [key, val] of Object.entries(data)) {
            if (key.startsWith("cap") && !key.endsWith("Evidencia") && !key.endsWith("Fecha") && key !== "no_cumplimientos") {
                const isGuantesText = key === "cap3GuantesSerialDerecho" || key === "cap3GuantesSerialIzquierdo" || key === "cap3GuantesMarca" || key === "cap3GuantesTalla";
                if (!isGuantesText && (val === "NO CUMPLE" || val === "Mal Estado" || val === "Mal Uso")) {
                    const nc = noCumplimientosObj[key];
                    const hasSupport = nc && nc.observacion && nc.observacion.trim() !== "" && Array.isArray(nc.evidencia) && nc.evidencia.length > 0;
                    if (!hasSupport) {
                        finalResult = "NO CUMPLE";
                        break;
                    }
                }
            }
        }
        data.resultado_final = finalResult;
        // resultado_inicial no se modifica en edición: conserva el resultado de la inspección original

        const commonColumns = [
            "gen_fechaRegistro", "gen_fechaInspeccion", "gen_cedulaUsuario", "gen_nombreUsuario",
            "gen_responsableCedula", "gen_responsableNombre", "gen_supervisorCedula", "gen_supervisorNombre",
            "gen_proyecto", "gen_nombreProyecto", "gen_tipoInspeccion", "gen_nombreInspeccion", "gen_direccion", "gen_ciudad",
            "gen_proceso", "gen_numeroContrato", "gen_ubicacion", "gen_observaciones", "resultado_final"
            // resultado_inicial no se actualiza en edición, solo se guarda al crear
        ];

        const respuestasCapitulos = {};
        const datosEspecificos = {};
        const dbData = {};

        for (const [key, val] of Object.entries(data)) {
            if (key.startsWith("cap")) {
                respuestasCapitulos[key] = val;
            } else if (commonColumns.includes(key)) {
                dbData[key] = val;
            } else if (key === "no_cumplimientos") {
                dbData[key] = val;
            } else {
                datosEspecificos[key] = val;
            }
        }

        dbData.respuestas_capitulos = JSON.stringify(respuestasCapitulos);
        dbData.datos_especificos = JSON.stringify(datosEspecificos);

        const updates = [];
        const values = [];

        for (const [key, val] of Object.entries(dbData)) {
            updates.push(`${key} = ?`);
            if (val && typeof val === 'object' && !(val instanceof Date)) {
                values.push(JSON.stringify(val));
            } else {
                values.push(val);
            }
        }

        values.push(id);

        const query = `
            UPDATE inspecciones_registros
            SET ${updates.join(', ')}
            WHERE id = ?
        `;

        await dbRailway.query(query, values);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'put',
            endPoint: `editarRegistro/${id}`,
            accion: 'Editar registro unificado exitoso',
            detalle: `Inspección de ${data.gen_tipoInspeccion} editada con éxito`,
            datos: { data: { ...dbData, ...respuestasCapitulos } },
            tablasIdsAfectados: [{
                tabla: 'inspecciones_registros',
                id: id
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Inspección editada correctamente`,
            `Se ha editado el registro con ID ${id}.`,
            { id, ...data }
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
            metodo: 'put',
            endPoint: `editarRegistro/${id}`,
            accion: 'Error al editar registro unificado',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado al editar el registro.", err);
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
                app: 'inspecciones',
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
                app: 'inspecciones',
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

        const [rows] = await dbRailway.query('SELECT * FROM rol_inspecciones where cedula = ?', [data.cedula]);

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
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
            `Se obtuvieron ${rows.length} registros de roles en inspecciones.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inspecciones',
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
