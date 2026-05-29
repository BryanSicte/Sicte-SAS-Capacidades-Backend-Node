const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const multer = require("multer");
const XLSX = require("xlsx");
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');

const upload = multer({ storage: multer.memoryStorage() });

// Helpers
function excelToJSDate(serial) {
    if (!serial || isNaN(serial)) return null;
    const excelEpoch = new Date(1899, 11, 30);
    const days = Math.floor(serial);
    const ms = (serial - days) * 24 * 60 * 60 * 1000;
    return new Date(excelEpoch.getTime() + days * 86400000 + ms);
}

function formatDate(d) {
    if (!d) return null;
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fechaHoraLocalBogota() {
    const fecha = new Date();
    const opciones = {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    };
    const partes = fecha.toLocaleString("es-CO", opciones);
    const [fechaPart, horaPart] = partes.split(", ");
    const [dia, mes, año] = fechaPart.split("/");
    return `${año}-${mes}-${dia} ${horaPart}`;
}

async function getSiguienteConsecutivo() {
    const [rows] = await dbRailway.query("SELECT COALESCE(MAX(consecutivo), 0) AS max_consec FROM enel_gestion_ots_v2_movimientos");
    return Number(rows[0].max_consec) + 1;
}

function getTableName(tipo_proceso) {
    if (tipo_proceso === 'modernizacion') {
        return 'enel_gestion_ots_v2_modernizacion_registros';
    }
    return 'enel_gestion_ots_v2_mantenimiento_registros';
}

// 1. GET /registros: Obtiene registros por tipo_proceso con filtros
router.get('/registros', validarToken, async (req, res) => {
    const { tipo_proceso, search, estado, fecha_inicio, fecha_fin } = req.query;
    const usuarioToken = req.validarToken?.usuario || {};

    if (!tipo_proceso) {
        return sendError(res, 400, "Falta tipo_proceso ('mantenimiento' o 'modernizacion')");
    }

    try {
        const table = getTableName(tipo_proceso);
        let sql = `
            SELECT *,
                CASE 
                    WHEN atendida IS NULL OR atendida = ''
                        THEN DATEDIFF(NOW(), STR_TO_DATE(fecha_ingreso, '%Y-%m-%d %H:%i'))
                    ELSE NULL
                END AS dias_diferencia
            FROM ${table}
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            sql += ` AND (nro_orden LIKE ? OR direccion LIKE ? OR nombre LIKE ? OR tipo_falla LIKE ? OR no_rotulo LIKE ?) `;
            const term = `%${search}%`;
            params.push(term, term, term, term, term);
        }

        if (estado) {
            if (estado === 'Pendiente') {
                sql += ` AND (atendida IS NULL OR atendida != 'OK') AND (cuadrilla IS NULL OR cuadrilla = '') `;
            } else if (estado === 'Asignado') {
                sql += ` AND (atendida IS NULL OR atendida != 'OK') AND (cuadrilla IS NOT NULL AND cuadrilla != '') `;
            } else if (estado === 'Atendida') {
                sql += ` AND (atendida = 'OK') `;
            }
        }

        if (fecha_inicio && fecha_fin) {
            sql += ` AND STR_TO_DATE(fecha_ingreso, '%Y-%m-%d %H:%i') BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d') `;
            params.push(fecha_inicio, fecha_fin);
        }

        sql += ` ORDER BY id DESC `;

        const [rows] = await dbRailway.query(sql, params);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'get',
            endPoint: 'registros',
            accion: 'Consulta de órdenes exitosa',
            detalle: `Se consultaron ${rows.length} órdenes para ${tipo_proceso}`,
            datos: { tipo_proceso, search, estado, fecha_inicio, fecha_fin },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Órdenes obtenidas", `Se listaron las órdenes de ${tipo_proceso} correctamente.`, rows);
    } catch (err) {
        console.error("Error en GET /registros:", err);
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'get',
            endPoint: 'registros',
            accion: 'Error al obtener lista de órdenes',
            detalle: err.message,
            datos: { tipo_proceso },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener órdenes", err);
    }
});

// 2. GET /cuadrillas: Obtiene cuadrillas
router.get('/cuadrillas', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken?.usuario || {};
    try {
        const [rows] = await dbRailway.query('SELECT * FROM cuadrillas_enel_alumbrado_publico');

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'get',
            endPoint: 'cuadrillas',
            accion: 'Consulta de cuadrillas exitosa',
            detalle: `Se consultaron ${rows.length} cuadrillas`,
            datos: null,
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Cuadrillas obtenidas", "Se listaron las cuadrillas correctamente.", rows);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'get',
            endPoint: 'cuadrillas',
            accion: 'Error al obtener cuadrillas',
            detalle: err.message,
            datos: null,
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener cuadrillas", err);
    }
});

// 3. GET /movimientos: Historial global de movimientos
router.get('/movimientos', validarToken, async (req, res) => {
    const { tipo_servicio, search } = req.query;
    const usuarioToken = req.validarToken?.usuario || {};
    try {
        let sql = `SELECT * FROM enel_gestion_ots_v2_movimientos WHERE 1=1`;
        const params = [];

        if (tipo_servicio) {
            sql += ` AND tipo_servicio = ?`;
            params.push(tipo_servicio);
        }
        if (search) {
            sql += ` AND (usuario LIKE ? OR detalle LIKE ? OR tipo_movimiento LIKE ?)`;
            const term = `%${search}%`;
            params.push(term, term, term);
        }

        sql += ` ORDER BY consecutivo DESC`;
        const [rows] = await dbRailway.query(sql, params);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'get',
            endPoint: 'movimientos',
            accion: 'Consulta de movimientos exitosa',
            detalle: `Se consultaron ${rows.length} movimientos de historial`,
            datos: { tipo_servicio, search },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Movimientos obtenidos", "Se listaron los movimientos correctamente.", rows);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'get',
            endPoint: 'movimientos',
            accion: 'Error al obtener movimientos',
            detalle: err.message,
            datos: { tipo_servicio },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener movimientos", err);
    }
});

// 4. POST /subirExcelNuevasOrdenes: Cargar nuevas órdenes
router.post('/subirExcelNuevasOrdenes', validarToken, upload.single('file'), async (req, res) => {
    const usuarioToken = req.validarToken?.usuario || {};
    try {
        if (!req.file) {
            return sendError(res, 400, "No se envió ningún archivo");
        }

        const { tipo_proceso } = req.body;
        if (!tipo_proceso) {
            return sendError(res, 400, "Falta campo obligatorio: tipo_proceso");
        }

        const nombreUsuario = usuarioToken.nombre || 'Usuario CCOT';
        const table = getTableName(tipo_proceso);
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames.includes("Ordenes") ? "Ordenes" : workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
            return sendError(res, 400, "El archivo Excel está vacío");
        }

        const fechaLocal = fechaHoraLocalBogota();
        const consecutivo = await getSiguienteConsecutivo();

        const [colsInfo] = await dbRailway.query(`SHOW COLUMNS FROM ${table}`);
        const allowedCols = new Set(colsInfo.map(c => c.Field));

        let insertadosCount = 0;
        let actualizadosCount = 0;

        for (const row of jsonData) {
            const columnasFecha = ["fecha_ingreso", "ahora"];
            for (const col of columnasFecha) {
                if (row[col] !== undefined) {
                    if (typeof row[col] === 'number') {
                        const d = excelToJSDate(row[col]);
                        row[col] = d ? formatDate(d) : null;
                    }
                }
            }

            const nro_orden = String(row.nro_orden || '').trim();
            if (!nro_orden) continue;

            const [existente] = await dbRailway.query(
                `SELECT * FROM ${table} WHERE nro_orden = ?`,
                [nro_orden]
            );

            if (existente.length === 0) {
                const insertFields = [];
                const insertValues = [];
                const placeholders = [];

                for (const key of Object.keys(row)) {
                    if (allowedCols.has(key) && key !== 'id') {
                        insertFields.push(`\`${key}\``);
                        insertValues.push(row[key]);
                        placeholders.push('?');
                    }
                }

                const historicoArr = [{
                    fecha: fechaLocal,
                    usuario: nombreUsuario,
                    lote: consecutivo,
                    detalle: "Orden ingresada por cargue masivo de base"
                }];

                insertFields.push('`historico`', '`lotes`');
                insertValues.push(JSON.stringify(historicoArr), JSON.stringify([consecutivo]));
                placeholders.push('?', '?');

                const sqlInsert = `INSERT INTO ${table} (${insertFields.join(', ')}) VALUES (${placeholders.join(', ')})`;
                await dbRailway.query(sqlInsert, insertValues);
                insertadosCount++;
            } else {
                const record = existente[0];
                const updateFields = [];
                const updateValues = [];
                const cambiosDetalles = [];

                for (const key of Object.keys(row)) {
                    if (allowedCols.has(key) && !['id', 'nro_orden', 'historico', 'lotes'].includes(key)) {
                        const nuevoVal = row[key] !== undefined ? String(row[key]).trim() : null;
                        const viejoVal = record[key] !== null ? String(record[key]).trim() : null;

                        if (nuevoVal !== viejoVal) {
                            updateFields.push(`\`${key}\` = ?`);
                            updateValues.push(row[key]);
                            cambiosDetalles.push(`${key}: "${viejoVal || ''}" -> "${row[key] || ''}"`);
                        }
                    }
                }

                if (updateFields.length > 0) {
                    let historicoArr = [];
                    try {
                        historicoArr = JSON.parse(record.historico || '[]');
                        if (!Array.isArray(historicoArr)) historicoArr = [];
                    } catch {
                        historicoArr = [];
                    }

                    let lotesArr = [];
                    try {
                        lotesArr = JSON.parse(record.lotes || '[]');
                        if (!Array.isArray(lotesArr)) lotesArr = [];
                    } catch {
                        lotesArr = [];
                    }

                    historicoArr.push({
                        fecha: fechaLocal,
                        usuario: nombreUsuario,
                        lote: consecutivo,
                        detalle: `Actualización por cargue masivo. Cambios: ${cambiosDetalles.join(', ')}`
                    });
                    lotesArr.push(consecutivo);

                    updateFields.push('`historico` = ?', '`lotes` = ?');
                    updateValues.push(JSON.stringify(historicoArr), JSON.stringify(lotesArr));

                    updateValues.push(record.id);
                    const sqlUpdate = `UPDATE ${table} SET ${updateFields.join(', ')} WHERE id = ?`;
                    await dbRailway.query(sqlUpdate, updateValues);
                    actualizadosCount++;
                }
            }
        }

        const totalAfectados = insertadosCount + actualizadosCount;
        if (totalAfectados > 0) {
            await dbRailway.query(
                `INSERT INTO enel_gestion_ots_v2_movimientos 
                (consecutivo, fecha, usuario, tipo_movimiento, tipo_servicio, cantidad_ordenes, detalle) 
                VALUES (?, NOW(), ?, 'CARGUE_NUEVAS', ?, ?, ?)`,
                [
                    consecutivo,
                    nombreUsuario,
                    tipo_proceso,
                    totalAfectados,
                    `Cargue de base Excel: ${insertadosCount} órdenes nuevas insertadas, ${actualizadosCount} actualizadas.`
                ]
            );
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'post',
            endPoint: 'subirExcelNuevasOrdenes',
            accion: 'Carga masiva de base exitosa',
            detalle: `Archivo Excel procesado. ${insertadosCount} insertadas, ${actualizadosCount} actualizadas. Lote #${consecutivo}`,
            datos: { tipo_proceso, insertados: insertadosCount, actualizados: actualizadosCount },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        const resData = {
            message: "Cargue de archivo completado con éxito",
            consecutivo,
            insertados: insertadosCount,
            actualizados: actualizadosCount,
            totalAfectados
        };

        return sendResponse(res, 200, "Cargue Completado", `Consecutivo: ${consecutivo}. Insertadas: ${insertadosCount}, Actualizadas: ${actualizadosCount}`, resData);
    } catch (err) {
        console.error("Error en /subirExcelNuevasOrdenes:", err);
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'post',
            endPoint: 'subirExcelNuevasOrdenes',
            accion: 'Error al subir excel de nuevas órdenes',
            detalle: err.message,
            datos: null,
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al subir el archivo", err);
    }
});

// 5. POST /marcarAtendidasExcel: Marcar órdenes como atendidas masivamente
router.post('/marcarAtendidasExcel', validarToken, upload.single('file'), async (req, res) => {
    const usuarioToken = req.validarToken?.usuario || {};
    try {
        if (!req.file) {
            return sendError(res, 400, "No se envió ningún archivo");
        }

        const { tipo_proceso } = req.body;
        if (!tipo_proceso) {
            return sendError(res, 400, "Falta campo obligatorio: tipo_proceso");
        }

        const nombreUsuario = usuarioToken.nombre || 'Usuario CCOT';
        const table = getTableName(tipo_proceso);
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
            return sendError(res, 400, "El archivo está vacío");
        }

        const fechaLocal = fechaHoraLocalBogota();
        const consecutivo = await getSiguienteConsecutivo();

        let atendidasCount = 0;
        const noEncontradas = [];

        for (const row of jsonData) {
            const nro_orden = String(row.nro_orden || row.orden || Object.values(row)[0] || '').trim();
            if (!nro_orden) continue;

            const [existentes] = await dbRailway.query(
                `SELECT * FROM ${table} WHERE nro_orden = ?`,
                [nro_orden]
            );

            if (existentes.length > 0) {
                const record = existentes[0];
                if (record.atendida !== 'OK') {
                    let historicoArr = [];
                    try {
                        historicoArr = JSON.parse(record.historico || '[]');
                        if (!Array.isArray(historicoArr)) historicoArr = [];
                    } catch {
                        historicoArr = [];
                    }

                    let lotesArr = [];
                    try {
                        lotesArr = JSON.parse(record.lotes || '[]');
                        if (!Array.isArray(lotesArr)) lotesArr = [];
                    } catch {
                        lotesArr = [];
                    }

                    historicoArr.push({
                        fecha: fechaLocal,
                        usuario: nombreUsuario,
                        lote: consecutivo,
                        detalle: "Orden marcada como ATENDIDA por archivo masivo"
                    });
                    lotesArr.push(consecutivo);

                    await dbRailway.query(
                        `UPDATE ${table} 
                        SET atendida = 'OK', historico = ?, lotes = ? 
                        WHERE id = ?`,
                        [JSON.stringify(historicoArr), JSON.stringify(lotesArr), record.id]
                    );
                    atendidasCount++;
                }
            } else {
                noEncontradas.push(nro_orden);
            }
        }

        if (atendidasCount > 0) {
            await dbRailway.query(
                `INSERT INTO enel_gestion_ots_v2_movimientos 
                (consecutivo, fecha, usuario, tipo_movimiento, tipo_servicio, cantidad_ordenes, detalle) 
                VALUES (?, NOW(), ?, 'MARCAR_ATENDIDAS', ?, ?, ?)`,
                [
                    consecutivo,
                    nombreUsuario,
                    tipo_proceso,
                    atendidasCount,
                    `Marcación masiva de atendidas: ${atendidasCount} órdenes marcadas como OK.`
                ]
            );
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'post',
            endPoint: 'marcarAtendidasExcel',
            accion: 'Carga masiva de atendidas exitosa',
            detalle: `Se marcaron ${atendidasCount} órdenes como atendidas. Consecutivo lote #${consecutivo}`,
            datos: { tipo_proceso, atendidas: atendidasCount, noEncontradasCount: noEncontradas.length },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        const resData = {
            message: "Marcación de atendidas completada",
            consecutivo,
            atendidas: atendidasCount,
            noEncontradas
        };

        return sendResponse(res, 200, "Procesado Correctamente", `Consecutivo: ${consecutivo}. Atendidas marcadas: ${atendidasCount}`, resData);
    } catch (err) {
        console.error("Error en /marcarAtendidasExcel:", err);
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'post',
            endPoint: 'marcarAtendidasExcel',
            accion: 'Error al marcar atendidas por excel',
            detalle: err.message,
            datos: null,
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al marcar atendidas masivamente", err);
    }
});

// 6. POST /asignarOTV2: Asignar móviles de forma masiva o individual
router.post('/asignarOTV2', validarToken, async (req, res) => {
    const { ids, cuadrilla, cedula_cuadrilla, nombre_cuadrilla, tipoMovil, turnoAsignado, fecha_programacion, observaciones, tipo_proceso } = req.body;
    const usuarioToken = req.validarToken?.usuario || {};

    if (!Array.isArray(ids) || ids.length === 0) {
        return sendError(res, 400, "Debe proporcionar un arreglo de IDs");
    }

    if (!tipo_proceso) {
        return sendError(res, 400, "Falta campo requerido: tipo_proceso");
    }

    const nombreUsuario = usuarioToken.nombre || 'Usuario CCOT';

    try {
        const table = getTableName(tipo_proceso);
        const fechaLocal = fechaHoraLocalBogota();
        const consecutivo = await getSiguienteConsecutivo();

        let asignadasCount = 0;

        for (const id of ids) {
            const [existente] = await dbRailway.query(
                `SELECT * FROM ${table} WHERE id = ?`,
                [id]
            );

            if (existente.length > 0) {
                const record = existente[0];

                let historicoArr = [];
                try {
                    historicoArr = JSON.parse(record.historico || '[]');
                    if (!Array.isArray(historicoArr)) historicoArr = [];
                } catch {
                    historicoArr = [];
                }

                let lotesArr = [];
                try {
                    lotesArr = JSON.parse(record.lotes || '[]');
                    if (!Array.isArray(lotesArr)) lotesArr = [];
                } catch {
                    lotesArr = [];
                }

                let detalleLog = "";
                let finalCuadrilla = cuadrilla;
                let finalCedula = cedula_cuadrilla;
                let finalNombre = nombre_cuadrilla;
                let finalTipoMovil = tipoMovil;
                let finalTurno = turnoAsignado;
                let finalFechaProg = fecha_programacion;

                if (cuadrilla === 'Disponible') {
                    detalleLog = `La actividad queda disponible (sin móvil asignado).`;
                    finalCuadrilla = null;
                    finalCedula = null;
                    finalNombre = null;
                    finalTipoMovil = null;
                    finalTurno = null;
                    finalFechaProg = null;
                } else {
                    if (record.cuadrilla && record.cuadrilla !== cuadrilla) {
                        detalleLog = `Reasignación de orden del móvil ${record.cuadrilla} al móvil ${cuadrilla} (${nombre_cuadrilla}) con tipo ${tipoMovil} y turno ${turnoAsignado}`;
                    } else {
                        detalleLog = `Asignación de móvil ${cuadrilla} (${nombre_cuadrilla}) con tipo ${tipoMovil} y turno ${turnoAsignado}`;
                    }
                }

                historicoArr.push({
                    fecha: fechaLocal,
                    usuario: nombreUsuario,
                    lote: consecutivo,
                    detalle: detalleLog,
                    observacion: observaciones || ""
                });
                lotesArr.push(consecutivo);

                await dbRailway.query(
                    `UPDATE ${table} 
                    SET cuadrilla = ?, cedula_cuadrilla = ?, nombre_cuadrilla = ?, tipoMovil = ?, turnoAsignado = ?, fecha_programacion = ?, observaciones_para_programacion = ?, historico = ?, lotes = ? 
                    WHERE id = ?`,
                    [
                        finalCuadrilla,
                        finalCedula,
                        finalNombre,
                        finalTipoMovil,
                        finalTurno,
                        finalFechaProg,
                        observaciones || record.observaciones_para_programacion,
                        JSON.stringify(historicoArr),
                        JSON.stringify(lotesArr),
                        record.id
                    ]
                );
                asignadasCount++;
            }
        }

        if (asignadasCount > 0) {
            await dbRailway.query(
                `INSERT INTO enel_gestion_ots_v2_movimientos 
                (consecutivo, fecha, usuario, tipo_movimiento, tipo_servicio, cantidad_ordenes, detalle) 
                VALUES (?, NOW(), ?, 'ASIGNACION', ?, ?, ?)`,
                [
                    consecutivo,
                    nombreUsuario,
                    tipo_proceso,
                    asignadasCount,
                    `Asignación de cuadrilla: ${asignadasCount} órdenes asignadas a móvil: ${cuadrilla}.`
                ]
            );
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'post',
            endPoint: 'asignarOTV2',
            accion: 'Asignación de órdenes exitosa',
            detalle: `Se asignaron ${asignadasCount} órdenes al móvil: ${cuadrilla}. Lote consecutivo #${consecutivo}`,
            datos: { ids, cuadrilla, tipo_proceso },
            tablasIdsAfectados: ids,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        const resData = {
            message: "Asignación realizada correctamente",
            consecutivo,
            totalAsignados: asignadasCount
        };

        return sendResponse(res, 200, "Asignación Completa", `Consecutivo: ${consecutivo}. Órdenes actualizadas: ${asignadasCount}`, resData);
    } catch (err) {
        console.error("Error en /asignarOTV2:", err);
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'post',
            endPoint: 'asignarOTV2',
            accion: 'Error en la asignación de órdenes',
            detalle: err.message,
            datos: { ids, cuadrilla },
            tablasIdsAfectados: ids,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al realizar asignación", err);
    }
});

// 7. POST /actualizarOrden: Actualizar información de orden manual
router.post('/actualizarOrden', validarToken, async (req, res) => {
    const { id, campos, tipo_proceso } = req.body;
    const usuarioToken = req.validarToken?.usuario || {};

    if (!id || !campos || typeof campos !== 'object' || !tipo_proceso) {
        return sendError(res, 400, "Faltan campos obligatorios: id, campos, tipo_proceso");
    }

    const nombreUsuario = usuarioToken.nombre || 'Usuario CCOT';

    try {
        const table = getTableName(tipo_proceso);
        const [existente] = await dbRailway.query(
            `SELECT * FROM ${table} WHERE id = ?`,
            [id]
        );

        if (existente.length === 0) {
            return sendError(res, 404, "Registro no encontrado");
        }

        const record = existente[0];
        const [colsInfo] = await dbRailway.query(`SHOW COLUMNS FROM ${table}`);
        const allowedCols = new Set(colsInfo.map(c => c.Field));

        const updateFields = [];
        const updateValues = [];
        const cambios = [];

        for (const key of Object.keys(campos)) {
            if (allowedCols.has(key) && !['id', 'historico', 'lotes'].includes(key)) {
                const nuevoVal = campos[key] !== undefined ? String(campos[key]).trim() : null;
                const viejoVal = record[key] !== null ? String(record[key]).trim() : null;

                if (nuevoVal !== viejoVal) {
                    updateFields.push(`\`${key}\` = ?`);
                    updateValues.push(campos[key]);
                    cambios.push(`${key}: "${viejoVal || ''}" -> "${campos[key] || ''}"`);
                }
            }
        }

        if (updateFields.length === 0) {
            return sendResponse(res, 200, "Sin Cambios", "No se detectaron cambios en el registro.", { consecutivo: null });
        }

        const fechaLocal = fechaHoraLocalBogota();
        const consecutivo = await getSiguienteConsecutivo();

        let historicoArr = [];
        try {
            historicoArr = JSON.parse(record.historico || '[]');
            if (!Array.isArray(historicoArr)) historicoArr = [];
        } catch {
            historicoArr = [];
        }

        let lotesArr = [];
        try {
            lotesArr = JSON.parse(record.lotes || '[]');
            if (!Array.isArray(lotesArr)) lotesArr = [];
        } catch {
            lotesArr = [];
        }

        historicoArr.push({
            fecha: fechaLocal,
            usuario: nombreUsuario,
            lote: consecutivo,
            detalle: `Edición manual de campos: ${cambios.join(', ')}`
        });
        lotesArr.push(consecutivo);

        updateFields.push('`historico` = ?', '`lotes` = ?');
        updateValues.push(JSON.stringify(historicoArr), JSON.stringify(lotesArr));
        updateValues.push(id);

        const sql = `UPDATE ${table} SET ${updateFields.join(', ')} WHERE id = ?`;
        await dbRailway.query(sql, updateValues);

        await dbRailway.query(
            `INSERT INTO enel_gestion_ots_v2_movimientos 
            (consecutivo, fecha, usuario, tipo_movimiento, tipo_servicio, cantidad_ordenes, detalle) 
            VALUES (?, NOW(), ?, 'ACTUALIZACION_MANUAL', ?, 1, ?)`,
            [
                consecutivo,
                nombreUsuario,
                tipo_proceso,
                `Actualización manual orden ${record.nro_orden || record.id}: ${cambios.join(', ')}`
            ]
        );

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'post',
            endPoint: 'actualizarOrden',
            accion: 'Edición de orden exitosa',
            detalle: `Orden ${record.nro_orden || record.id} actualizada manualmente: ${cambios.join(', ')}. Lote consecutivo #${consecutivo}`,
            datos: { id, cambios, tipo_proceso },
            tablasIdsAfectados: [id],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        const resData = {
            message: "Orden actualizada con éxito",
            consecutivo,
            cambios
        };

        return sendResponse(res, 200, "Orden Editada", `Consecutivo: ${consecutivo}`, resData);
    } catch (err) {
        console.error("Error en /actualizarOrden:", err);
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'post',
            endPoint: 'actualizarOrden',
            accion: 'Error al actualizar orden manualmente',
            detalle: err.message,
            datos: { id },
            tablasIdsAfectados: [id],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al guardar edición", err);
    }
});

// 8. GET /movimientoDetalle/:consecutivo: Obtiene las órdenes afectadas por un consecutivo
router.get('/movimientoDetalle/:consecutivo', validarToken, async (req, res) => {
    const { consecutivo } = req.params;
    const { tipo_servicio } = req.query;
    const usuarioToken = req.validarToken?.usuario || {};

    if (!consecutivo) {
        return sendError(res, 400, "Falta consecutivo");
    }
    if (!tipo_servicio) {
        return sendError(res, 400, "Falta tipo_servicio ('mantenimiento' o 'modernizacion')");
    }

    try {
        const table = getTableName(tipo_servicio);
        const sql = `
            SELECT id, nro_orden, direccion, tipo_falla, atendida, cuadrilla, historico, lotes 
            FROM ${table} 
            WHERE lotes LIKE ?
        `;
        const [rows] = await dbRailway.query(sql, [`%${consecutivo}%`]);
        
        const filteredRows = rows.filter(r => {
            try {
                const arr = JSON.parse(r.lotes || '[]');
                return Array.isArray(arr) && arr.map(Number).includes(Number(consecutivo));
            } catch {
                return false;
            }
        });

        const detOrdenes = filteredRows.map(r => {
            let hist = [];
            try {
                hist = JSON.parse(r.historico || '[]');
            } catch {}
            if (!Array.isArray(hist)) hist = [];
            
            const histFiltrado = hist.filter(h => Number(h.lote) === Number(consecutivo));
            
            return {
                id: r.id,
                nro_orden: r.nro_orden,
                direccion: r.direccion,
                tipo_falla: r.tipo_falla,
                atendida: r.atendida,
                cuadrilla: r.cuadrilla,
                cambios: histFiltrado.map(h => h.detalle).join(' | '),
                observacion: histFiltrado.map(h => h.observacion).filter(Boolean).join(' | ')
            };
        });

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'get',
            endPoint: `movimientoDetalle/${consecutivo}`,
            accion: 'Consulta de detalle de movimiento exitosa',
            detalle: `Se consultó el detalle del lote #${consecutivo} para ${tipo_servicio}. Encontrados: ${detOrdenes.length} registros.`,
            datos: { consecutivo, tipo_servicio },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Detalles de movimiento obtenidos", "Se listó el detalle correctamente.", detOrdenes);
    } catch (err) {
        console.error("Error en GET /movimientoDetalle:", err);
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'get',
            endPoint: `movimientoDetalle/${consecutivo}`,
            accion: 'Error al obtener detalle de movimiento',
            detalle: err.message,
            datos: { consecutivo, tipo_servicio },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener detalle de movimiento", err);
    }
});

module.exports = router;
