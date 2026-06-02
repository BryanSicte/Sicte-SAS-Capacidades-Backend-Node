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
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const days = Math.floor(serial);
    const ms = Math.round((serial - days) * 24 * 60 * 60 * 1000);
    const utcDate = new Date(excelEpoch.getTime() + days * 86400000 + ms);
    return new Date(
        utcDate.getUTCFullYear(),
        utcDate.getUTCMonth(),
        utcDate.getUTCDate(),
        utcDate.getUTCHours(),
        utcDate.getUTCMinutes(),
        utcDate.getUTCSeconds()
    );
}

function formatDateToStandard(d, includeTime = true) {
    if (!d || isNaN(d.getTime())) return null;
    const pad = n => String(n).padStart(2, "0");
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    
    if (includeTime && (d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0)) {
        return `${dateStr} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    return dateStr;
}

function parseAndFormatDate(val) {
    if (val === undefined || val === null || val === '') return null;

    if (val instanceof Date) {
        return formatDateToStandard(val, true);
    }

    if (typeof val === 'number') {
        const d = excelToJSDate(val);
        const hasTime = Math.abs(val % 1) > 1e-5;
        return d ? formatDateToStandard(d, hasTime) : null;
    }

    if (typeof val === 'string') {
        const str = val.trim();
        if (!str || str === '-') return null;

        // Pattern 1: DD/MM/YYYY HH:mm:ss or DD/MM/YYYY
        const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
        if (dmyMatch) {
            const day = parseInt(dmyMatch[1], 10);
            const month = parseInt(dmyMatch[2], 10) - 1;
            const year = parseInt(dmyMatch[3], 10);
            const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
            const minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
            const second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
            const d = new Date(year, month, day, hour, minute, second);
            if (!isNaN(d.getTime())) {
                const hasTime = !!dmyMatch[4];
                return formatDateToStandard(d, hasTime);
            }
        }

        // Pattern 2: YYYY-MM-DD HH:mm:ss or YYYY-MM-DD
        const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
        if (ymdMatch) {
            const year = parseInt(ymdMatch[1], 10);
            const month = parseInt(ymdMatch[2], 10) - 1;
            const day = parseInt(ymdMatch[3], 10);
            const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
            const minute = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
            const second = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
            const d = new Date(year, month, day, hour, minute, second);
            if (!isNaN(d.getTime())) {
                const hasTime = !!ymdMatch[4];
                return formatDateToStandard(d, hasTime);
            }
        }

        // Fallback Date.parse
        const parsed = Date.parse(str);
        if (!isNaN(parsed)) {
            const d = new Date(parsed);
            const hasTime = str.includes(':');
            return formatDateToStandard(d, hasTime);
        }
        return str;
    }

    return String(val);
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

const activeImports = new Map();

async function procesarCargueNuevasEnSegundoPlano(
    consecutivo,
    jsonData,
    nrosInExcel,
    table,
    tipo_proceso,
    nombreUsuario,
    fechaLocal,
    usuarioToken,
    clientIp,
    userAgent
) {
    try {
        const [colsInfo] = await dbRailway.query(`SHOW COLUMNS FROM ${table}`);
        const allowedCols = new Set(colsInfo.map(c => c.Field));

        let insertadosCount = 0;
        let actualizadosCount = 0;

        for (const row of jsonData) {
            const columnasFecha = ["fecha_ingreso", "fecha_programacion", "fecha_levantamiento", "fecha_ejecucion", "ahora"];
            for (const col of columnasFecha) {
                if (row[col] !== undefined) {
                    row[col] = parseAndFormatDate(row[col]);
                }
            }

            if (row.x !== undefined && row.x !== null) {
                row.x = String(row.x).replace(',', '.').trim();
            }
            if (row.y !== undefined && row.y !== null) {
                row.y = String(row.y).replace(',', '.').trim();
            }

            const nro_orden = String(row.nro_orden || '').trim();
            if (!nro_orden) {
                const progress = activeImports.get(consecutivo);
                if (progress) {
                    progress.procesados++;
                    activeImports.set(consecutivo, progress);
                }
                continue;
            }

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

                let reactivada = false;
                if (record.atendida === 'OK') {
                    updateFields.push('`atendida` = ?');
                    updateValues.push(null);

                    const resetFields = ['cuadrilla', 'cedula_cuadrilla', 'nombre_cuadrilla', 'tipoMovil', 'turnoAsignado', 'fecha_programacion'];
                    for (const field of resetFields) {
                        if (allowedCols.has(field)) {
                            updateFields.push(`\`${field}\` = ?`);
                            updateValues.push(null);
                        }
                    }
                    cambiosDetalles.push('atendida: "OK" -> NULL (Reactivada por cargue de base, programación reseteada)');
                    reactivada = true;
                }

                const yaAgregados = new Set(reactivada ? ['atendida', 'cuadrilla', 'cedula_cuadrilla', 'nombre_cuadrilla', 'tipoMovil', 'turnoAsignado', 'fecha_programacion'] : []);

                for (const key of Object.keys(row)) {
                    if (allowedCols.has(key) && !['id', 'nro_orden', 'historico', 'lotes'].includes(key) && !yaAgregados.has(key)) {
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

            const progress = activeImports.get(consecutivo);
            if (progress) {
                progress.procesados++;
                progress.insertadosCount = insertadosCount;
                progress.actualizadosCount = actualizadosCount;
                activeImports.set(consecutivo, progress);
            }
        }

        let atendidasNoPresentesCount = 0;
        const [noPresentes] = await dbRailway.query(
            `SELECT id, historico, lotes, atendida FROM ${table} WHERE nro_orden NOT IN (?) AND (atendida IS NULL OR atendida != 'OK')`,
            [nrosInExcel]
        );

        for (const record of noPresentes) {
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
                detalle: "Orden marcada como ATENDIDA (OK) por no estar presente en el cargue masivo de base"
            });
            lotesArr.push(consecutivo);

            await dbRailway.query(
                `UPDATE ${table} SET atendida = 'OK', historico = ?, lotes = ? WHERE id = ?`,
                [JSON.stringify(historicoArr), JSON.stringify(lotesArr), record.id]
            );
            atendidasNoPresentesCount++;
        }

        const progress = activeImports.get(consecutivo);
        if (progress) {
            progress.atendidasNoPresentesCount = atendidasNoPresentesCount;
            activeImports.set(consecutivo, progress);
        }

        const totalAfectados = insertadosCount + actualizadosCount + atendidasNoPresentesCount;
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
                    `Cargue de base Excel: ${insertadosCount} órdenes nuevas insertadas, ${actualizadosCount} actualizadas, y ${atendidasNoPresentesCount} órdenes no presentes marcadas como OK.`
                ]
            );
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(userAgent || ''),
            app: 'gestionOtsV2',
            metodo: 'post',
            endPoint: 'subirExcelNuevasOrdenes',
            accion: 'Carga masiva de base exitosa',
            detalle: `Archivo Excel procesado en segundo plano. ${insertadosCount} insertadas, ${actualizadosCount} actualizadas, ${atendidasNoPresentesCount} marcadas OK por no estar presentes. Lote #${consecutivo}`,
            datos: { tipo_proceso, insertados: insertadosCount, actualizados: actualizadosCount, atendidasNoPresentes: atendidasNoPresentesCount },
            tablasIdsAfectados: [],
            ipAddress: clientIp,
            userAgent: userAgent || ''
        });

        const finalProgress = activeImports.get(consecutivo);
        if (finalProgress) {
            finalProgress.status = 'completado';
            activeImports.set(consecutivo, finalProgress);
        }
    } catch (err) {
        console.error("Error en procesarCargueNuevasEnSegundoPlano:", err);
        const finalProgress = activeImports.get(consecutivo);
        if (finalProgress) {
            finalProgress.status = 'error';
            finalProgress.error = err.message || "Error desconocido";
            activeImports.set(consecutivo, finalProgress);
        }
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(userAgent || ''),
            app: 'gestionOtsV2',
            metodo: 'post',
            endPoint: 'subirExcelNuevasOrdenes',
            accion: 'Error en cargue de base en segundo plano',
            detalle: err.message,
            datos: null,
            tablasIdsAfectados: [],
            ipAddress: clientIp,
            userAgent: userAgent || ''
        });
    }
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
            const term = `%${search}%`;
            sql += ` AND (
                nro_orden           LIKE ? OR
                direccion           LIKE ? OR
                nombre              LIKE ? OR
                tipo_falla          LIKE ? OR
                no_rotulo           LIKE ? OR
                localidad_descrip   LIKE ? OR
                numero_localidad    LIKE ? OR
                referencia_barrio   LIKE ? OR
                telefono            LIKE ? OR
                cod                 LIKE ? OR
                asignado            LIKE ? OR
                nro_transformador   LIKE ? OR
                lbt                 LIKE ? OR
                tipo                LIKE ? OR
                codigo_cto          LIKE ? OR
                uso                 LIKE ? OR
                cd_preventivo       LIKE ? OR
                estado_actual       LIKE ? OR
                proyecto            LIKE ? OR
                observaciones_para_programacion LIKE ? OR
                movil               LIKE ? OR
                turno               LIKE ? OR
                estado_reprogramada LIKE ? OR
                bolsa               LIKE ? OR
                condicion           LIKE ? OR
                tipoMovil           LIKE ? OR
                cuadrilla           LIKE ? OR
                nombre_cuadrilla    LIKE ? OR
                turnoAsignado       LIKE ?
            ) `;
            params.push(...Array(29).fill(term));
        }

        if (estado) {
            if (estado === 'Pendiente') {
                sql += ` AND (atendida IS NULL OR atendida != 'OK') AND (cuadrilla IS NULL OR cuadrilla = '') `;
            } else if (estado === 'Asignado') {
                sql += ` AND (atendida IS NULL OR atendida != 'OK') AND (cuadrilla IS NOT NULL AND cuadrilla != '') `;
            } else if (estado === 'Atendida') {
                sql += ` AND (atendida = 'OK') `;
            } else if (estado === 'Asignado y Pendiente') {
                sql += ` AND (atendida IS NULL OR atendida != 'OK') `;
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

// 2b. GET /auxiliares: Obtiene tipoMovil y turnos desde tabla_aux_gestion_de_ots
router.get('/auxiliares', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken?.usuario || {};
    try {
        const [rows] = await dbRailway.query(
            'SELECT id, tipoMovil, turnos FROM tabla_aux_gestion_de_ots ORDER BY id ASC'
        );

        const tiposMovil = [...new Set(rows.map(r => r.tipoMovil).filter(Boolean))];
        const turnos = [...new Set(rows.map(r => r.turnos).filter(Boolean))];

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'get',
            endPoint: 'auxiliares',
            accion: 'Consulta de auxiliares exitosa',
            detalle: `tiposMovil: ${tiposMovil.length}, turnos: ${turnos.length}`,
            datos: null,
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Auxiliares obtenidos", "Se listaron los auxiliares correctamente.", { tiposMovil, turnos });
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'gestionOtsV2',
            metodo: 'get',
            endPoint: 'auxiliares',
            accion: 'Error al obtener auxiliares',
            detalle: err.message,
            datos: null,
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener auxiliares", err);
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

// 4. POST /subirExcelNuevasOrdenes: Cargar nuevas órdenes (Segunda Plano)
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
        let jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
            return sendError(res, 400, "El archivo Excel está vacío");
        }

        if (tipo_proceso === 'modernizacion') {
            jsonData = jsonData.map(originalRow => {
                const row = {};
                for (const key of Object.keys(originalRow)) {
                    row[key.trim()] = originalRow[key];
                }
                const mappedRow = {};
                const getVal = (keys) => {
                    for (const key of keys) {
                        if (row[key] !== undefined) return row[key];
                    }
                    return undefined;
                };

                const nro_orden = getVal(['GOM', 'gom', 'nro_orden', 'orden']);
                if (nro_orden !== undefined) mappedRow.nro_orden = String(nro_orden).trim();

                const fecha_ingreso = getVal(['Fecha Asignación', 'fecha_asignacion', 'fecha_ingreso']);
                if (fecha_ingreso !== undefined) mappedRow.fecha_ingreso = fecha_ingreso;

                const direccion = getVal(['Sector', 'sector', 'direccion']);
                if (direccion !== undefined) mappedRow.direccion = direccion;

                const no_rotulo = getVal(['ROTULO', 'rotulo', 'no_rotulo']);
                if (no_rotulo !== undefined) mappedRow.no_rotulo = no_rotulo;

                const x = getVal(['Coordenada X', 'coordenada_x', 'x']);
                if (x !== undefined) mappedRow.x = x;

                const y = getVal(['Coordenada Y', 'coordenada_y', 'y']);
                if (y !== undefined) mappedRow.y = y;

                const estado_actual = getVal(['ESTADO', 'estado', 'estado_actual']);
                if (estado_actual !== undefined) mappedRow.estado_actual = estado_actual;

                const proyecto = getVal(['Código Proyecto', 'codigo_proyecto', 'proyecto']);
                if (proyecto !== undefined) mappedRow.proyecto = proyecto;

                const movil = getVal(['Móvil para ejecución', 'movil_ejecucion', 'movil']);
                if (movil !== undefined) mappedRow.movil = movil;

                const turno = getVal(['Turno', 'turno']);
                if (turno !== undefined) mappedRow.turno = turno;

                const fecha_ejecucion = getVal(['Fecha Ejecución', 'fecha_ejecucion']);
                if (fecha_ejecucion !== undefined) mappedRow.fecha_ejecucion = fecha_ejecucion;

                const condicion = getVal(['Esta Rótulo', 'esta_rotulo', 'condicion']);
                if (condicion !== undefined) mappedRow.condicion = condicion;

                const tipo = getVal(['Perfil a usar', 'perfil_usar', 'tipo']);
                if (tipo !== undefined) mappedRow.tipo = tipo;

                const codigo_cto = getVal(['circuito', 'Código circuito', 'codigo_circuito', 'codigo_cto']);
                if (codigo_cto !== undefined) mappedRow.codigo_cto = codigo_cto;

                const uso = getVal(['Tipo de Vía (UAESP)', 'tipo_via_uaesp', 'uso']);
                if (uso !== undefined) mappedRow.uso = uso;

                const cd_preventivo = getVal(['CD', 'cd_preventivo']);
                if (cd_preventivo !== undefined) mappedRow.cd_preventivo = cd_preventivo;

                const lbt = getVal(['Altura Lum', 'altura_lum', 'lbt']);
                if (lbt !== undefined) mappedRow.lbt = lbt;

                const tipo_poste = getVal(['Tipo Poste', 'tipo_poste']);
                if (tipo_poste !== undefined) mappedRow.tipo_poste = tipo_poste;

                const cod = getVal(['ITEM', 'item', 'cod']);
                if (cod !== undefined) mappedRow.cod = cod;

                const nro_transformador = getVal(['Potencia', 'potencia', 'nro_transformador']);
                if (nro_transformador !== undefined) mappedRow.nro_transformador = nro_transformador;

                const nombre = getVal(['Supervisor', 'supervisor', 'nombre']);
                if (nombre !== undefined) mappedRow.nombre = nombre;

                // Extra Modernización fields
                const orientacion = getVal(['Orientación', 'orientacion']);
                if (orientacion !== undefined) mappedRow.orientacion = orientacion;

                const fuente = getVal(['Fuente', 'fuente']);
                if (fuente !== undefined) mappedRow.fuente = fuente;

                const fecha_levantamiento = getVal(['Fecha Levantamiento', 'fecha_levantamiento']);
                if (fecha_levantamiento !== undefined) mappedRow.fecha_levantamiento = fecha_levantamiento;

                const nodo_anterior = getVal(['Nodo Anterior', 'nodo_anterior']);
                if (nodo_anterior !== undefined) mappedRow.nodo_anterior = nodo_anterior;

                const nodo_actual = getVal(['Nodo Actual', 'nodo_actual']);
                if (nodo_actual !== undefined) mappedRow.nodo_actual = nodo_actual;

                const punto_fisico = getVal(['Punto Físico', 'punto_fisico']);
                if (punto_fisico !== undefined) mappedRow.punto_fisico = punto_fisico;

                const estructura_bt = getVal(['Estructura BT', 'estructura_bt']);
                if (estructura_bt !== undefined) mappedRow.estructura_bt = estructura_bt;

                const estructura_t = getVal(['Estructura T', 'estructura_t']);
                if (estructura_t !== undefined) mappedRow.estructura_t = estructura_t;

                const tipo_perfil = getVal(['Tipo Perfil', 'tipo_perfil']);
                if (tipo_perfil !== undefined) mappedRow.tipo_perfil = tipo_perfil;

                const interdistancia = getVal(['Interdistancia', 'interdistancia']);
                if (interdistancia !== undefined) mappedRow.interdistancia = interdistancia;

                const ancho_anden = getVal(['Ancho Anden', 'ancho_anden']);
                if (ancho_anden !== undefined) mappedRow.ancho_anden = ancho_anden;

                const ancho_ciclo_ruta_anden = getVal(['Ancho ciclo ruta anden', 'ancho_ciclo_ruta_anden']);
                if (ancho_ciclo_ruta_anden !== undefined) mappedRow.ancho_ciclo_ruta_anden = ancho_ciclo_ruta_anden;

                const ancho_calzada_mixta_1 = getVal(['Ancho calzada mixta 1', 'ancho_calzada_mixta_1']);
                if (ancho_calzada_mixta_1 !== undefined) mappedRow.ancho_calzada_mixta_1 = ancho_calzada_mixta_1;

                const ancho_calzada_mixta_2 = getVal(['Ancho calzada mixta 2', 'ancho_calzada_mixta_2']);
                if (ancho_calzada_mixta_2 !== undefined) mappedRow.ancho_calzada_mixta_2 = ancho_calzada_mixta_2;

                const ancho_separador_1 = getVal(['Ancho separador 1', 'ancho_separador_1']);
                if (ancho_separador_1 !== undefined) mappedRow.ancho_separador_1 = ancho_separador_1;

                const ancho_separador_2 = getVal(['Ancho separador 2', 'ancho_separador_2']);
                if (ancho_separador_2 !== undefined) mappedRow.ancho_separador_2 = ancho_separador_2;

                const ancho_calzada_transmilenio = getVal(['Ancho calzada transmilenio', 'ancho_calzada_transmilenio']);
                if (ancho_calzada_transmilenio !== undefined) mappedRow.ancho_calzada_transmilenio = ancho_calzada_transmilenio;

                const ancho_separador_central = getVal(['Ancho separador central', 'ancho_separador_central']);
                if (ancho_separador_central !== undefined) mappedRow.ancho_separador_central = ancho_separador_central;

                const ancho_anden_2 = getVal(['Ancho anden 2', 'ancho_anden_2']);
                if (ancho_anden_2 !== undefined) mappedRow.ancho_anden_2 = ancho_anden_2;

                const ancho_ciclo_ruta_2 = getVal(['Ancho ciclo ruta 2', 'ancho_ciclo_ruta_2']);
                if (ancho_ciclo_ruta_2 !== undefined) mappedRow.ancho_ciclo_ruta_2 = ancho_ciclo_ruta_2;

                const retroceso = getVal(['Retroceso', 'retroceso']);
                if (retroceso !== undefined) mappedRow.retroceso = retroceso;

                const paramento = getVal(['Paramento', 'paramento']);
                if (paramento !== undefined) mappedRow.paramento = paramento;

                const altura_poste = getVal(['Altura Poste', 'altura_poste']);
                if (altura_poste !== undefined) mappedRow.altura_poste = altura_poste;

                const longitud = getVal(['Longitud', 'longitud']);
                if (longitud !== undefined) mappedRow.longitud = longitud;

                const carga_ruptura_poste = getVal(['Carga de ruptura del poste', 'carga_ruptura_poste']);
                if (carga_ruptura_poste !== undefined) mappedRow.carga_ruptura_poste = carga_ruptura_poste;

                const codigo_circuito = getVal(['Código circuito', 'codigo_circuito']);
                if (codigo_circuito !== undefined) mappedRow.codigo_circuito = codigo_circuito;

                const tipo_red = getVal(['Tipo de Red', 'tipo_red']);
                if (tipo_red !== undefined) mappedRow.tipo_red = tipo_red;

                const tipo_via = getVal(['Tipo de Via', 'tipo_via']);
                if (tipo_via !== undefined) mappedRow.tipo_via = tipo_via;

                const red_telematicos = getVal(['Red telemáticos', 'red_telematicos']);
                if (red_telematicos !== undefined) mappedRow.red_telematicos = red_telematicos;

                const collarin = getVal(['Collarin', 'collarin']);
                if (collarin !== undefined) mappedRow.collarin = collarin;

                const seguridad = getVal(['Seguridad', 'seguridad']);
                if (seguridad !== undefined) mappedRow.seguridad = seguridad;

                const coordenada_x_utm = getVal(['Coordenada X (UTM)', 'coordenada_x_utm']);
                if (coordenada_x_utm !== undefined) mappedRow.coordenada_x_utm = coordenada_x_utm;

                const coordenada_y_utm = getVal(['Coordenada Y (UTM)', 'coordenada_y_utm']);
                if (coordenada_y_utm !== undefined) mappedRow.coordenada_y_utm = coordenada_y_utm;

                const observaciones_para_programacion = getVal(['OBSERVACIONES', 'observaciones_para_programacion']);
                if (observaciones_para_programacion !== undefined) mappedRow.observaciones_para_programacion = observaciones_para_programacion;

                const observaciones = getVal(['Observaciones', 'observaciones']);
                if (observaciones !== undefined) mappedRow.observaciones = observaciones;

                for (const key of Object.keys(row)) {
                    if (mappedRow[key] === undefined && !['OBSERVACIONES', 'Observaciones'].includes(key)) {
                        mappedRow[key] = row[key];
                    }
                }

                return mappedRow;
            });
        }

        const nrosInExcel = jsonData
            .map(row => String(row.nro_orden || '').trim())
            .filter(Boolean);

        if (nrosInExcel.length === 0) {
            return sendError(res, 400, "El archivo Excel no contiene órdenes con nro_orden válido");
        }

        const fechaLocal = fechaHoraLocalBogota();
        const consecutivo = await getSiguienteConsecutivo();
        const clientIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        // Initialize progress state in memory map
        activeImports.set(consecutivo, {
            status: 'procesando',
            total: jsonData.length,
            procesados: 0,
            insertadosCount: 0,
            actualizadosCount: 0,
            atendidasNoPresentesCount: 0,
            error: null
        });

        // Trigger processing asynchronously in background
        procesarCargueNuevasEnSegundoPlano(
            consecutivo,
            jsonData,
            nrosInExcel,
            table,
            tipo_proceso,
            nombreUsuario,
            fechaLocal,
            usuarioToken,
            clientIp,
            userAgent
        );

        const resData = {
            message: "Cargue de archivo iniciado en segundo plano con éxito",
            consecutivo,
            total: jsonData.length
        };

        return sendResponse(res, 200, "Cargue Iniciado", `Consecutivo: ${consecutivo}. Procesando ${jsonData.length} órdenes en segundo plano.`, resData);
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
            accion: 'Error al iniciar cargue de nuevas órdenes',
            detalle: err.message,
            datos: null,
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al iniciar el cargue del archivo", err);
    }
});

// 4b. GET /cargueProgreso/:consecutivo: Consultar progreso de cargue masivo
router.get('/cargueProgreso/:consecutivo', validarToken, async (req, res) => {
    try {
        const { consecutivo } = req.params;
        const progress = activeImports.get(Number(consecutivo));
        if (!progress) {
            return sendError(res, 404, "No se encontró el consecutivo de cargue");
        }

        // If completed or failed, schedule a clean-up after 5 minutes
        if (progress.status === 'completado' || progress.status === 'error') {
            setTimeout(() => {
                activeImports.delete(Number(consecutivo));
            }, 1000 * 60 * 5);
        }

        return sendResponse(res, 200, "Progreso obtenido", "Estado del cargue en segundo plano", progress);
    } catch (err) {
        console.error("Error en GET /cargueProgreso:", err);
        return sendError(res, 500, "Error al consultar progreso de cargue", err);
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
            const nro_orden = String(row.GOM || row.gom || row.nro_orden || row.orden || Object.values(row)[0] || '').trim();
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

    const nombreUsuario = usuarioToken.nombre;

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
            } catch { }
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
