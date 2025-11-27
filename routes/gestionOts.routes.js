const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const multer = require("multer");
const XLSX = require("xlsx");

const upload = multer({ storage: multer.memoryStorage() });

router.get('/cuadrillasEnelAlumbradoPublico', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM cuadrillas_enel_alumbrado_publico');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/registros', async (req, res) => {
    try {
        const [rows] = await dbRailway.query(`SELECT *,
                CASE 
                    WHEN atendida is null
                        THEN DATEDIFF(NOW(), STR_TO_DATE(fecha_ingreso, '%Y-%m-%d %H:%i'))
                    ELSE NULL
                END AS dias_diferencia
            FROM railway.registros_enel_gestion_ots
            WHERE atendida IS NULL
            OR (atendida = 'OK' 
                AND STR_TO_DATE(fecha_ingreso, '%Y-%m-%d %H:%i') >= NOW() - INTERVAL 5 DAY)
            ORDER BY STR_TO_DATE(fecha_ingreso, '%Y-%m-%d %H:%i') DESC`);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/asignarOT', async (req, res) => {
    const { ids, fecha_programacion, tipoMovil, cuadrilla, cedula_cuadrilla, nombre_cuadrilla, observaciones, nombreUsuario, turnoAsignado } = req.body;

    if ((!tipoMovil && cuadrilla !== 'Disponible') || (!fecha_programacion && cuadrilla !== 'Disponible') || !cuadrilla || (!cedula_cuadrilla && cuadrilla !== 'Disponible') || (!nombre_cuadrilla && cuadrilla !== 'Disponible') || !nombreUsuario || (!turnoAsignado && cuadrilla !== 'Disponible')) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Debe enviar un arreglo de IDs' });
    }

    let fechaProgramacionTemp = fecha_programacion;
    let tipoMovilTemp = tipoMovil;
    let cuadrillaTemp = cuadrilla;
    let cedulaCuadrillaTemp = cedula_cuadrilla;
    let nombreCuadrillaTemp = nombre_cuadrilla;
    let turnoAsignadoTemp = turnoAsignado;

    try {
        const [registros] = await dbRailway.query(
            `SELECT id, historico, cuadrilla, lotes FROM registros_enel_gestion_ots WHERE id IN (?)`,
            [ids]
        );

        if (registros.length === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        const [todos] = await dbRailway.query(
            `SELECT lotes FROM registros_enel_gestion_ots WHERE lotes IS NOT NULL`
        );
        let maxConsecutivo = 0;
        for (const row of todos) {
            try {
                const arr = JSON.parse(row.lotes);
                if (Array.isArray(arr) && arr.length > 0) {
                    const localMax = Math.max(...arr);
                    if (localMax > maxConsecutivo) {
                        maxConsecutivo = localMax;
                    }
                }
            } catch { }
        }
        const nuevoConsecutivo = maxConsecutivo + 1;

        for (const row of registros) {
            let historico = [];
            if (row.historico) {
                try {
                    historico = JSON.parse(row.historico);
                    if (!Array.isArray(historico)) historico = [];
                } catch {
                    historico = [];
                }
            }
            const existeHistorico = historico.length > 1;

            if (existeHistorico) {
                if (!observaciones && row.cuadrilla !== null) {
                    return res.status(400).json({ error: 'Falta la observacion' });
                }

                if (cuadrillaTemp === 'Disponible') {
                    historico.push({
                        fecha: new Date().toISOString(),
                        usuario: nombreUsuario,
                        lote: nuevoConsecutivo,
                        detalle: `La actividad queda disponible`,
                        observacion: observaciones
                    });
                    fechaProgramacionTemp = null;
                    tipoMovilTemp = null;
                    turnoAsignadoTemp = null;
                    cuadrillaTemp = null;
                    cedulaCuadrillaTemp = null;
                    nombreCuadrillaTemp = null;

                } else {
                    historico.push({
                        fecha: new Date().toISOString(),
                        usuario: nombreUsuario,
                        fechaProgramacion: fechaProgramacionTemp,
                        tipoMovil: tipoMovilTemp,
                        turno: turnoAsignadoTemp,
                        cuadrilla: cuadrillaTemp,
                        cedula_cuadrilla: cedulaCuadrillaTemp,
                        nombre_cuadrilla: nombreCuadrillaTemp,
                        lote: nuevoConsecutivo,
                        detalle: `Se reasigna actividad a la cuadrilla ${cuadrillaTemp} con tipo de movil ${tipoMovilTemp} y turno ${turnoAsignadoTemp}`,
                        observacion: observaciones
                    });
                }
            } else {
                historico.push({
                    fecha: new Date().toISOString(),
                    usuario: nombreUsuario,
                    fechaProgramacion: fechaProgramacionTemp,
                    tipoMovil: tipoMovilTemp,
                    turno: turnoAsignadoTemp,
                    cuadrilla: cuadrillaTemp,
                    cedula_cuadrilla: cedulaCuadrillaTemp,
                    nombre_cuadrilla: nombreCuadrillaTemp,
                    lote: nuevoConsecutivo,
                    detalle: `Se asigna actividad a la movil ${cuadrillaTemp} con tipo de movil ${tipoMovilTemp} y turno ${turnoAsignadoTemp}`
                });
            }

            let lotes = [];
            if (row.lotes) {
                try {
                    lotes = JSON.parse(row.lotes);
                    if (!Array.isArray(lotes)) lotes = [];
                } catch {
                    lotes = [];
                }
            }
            lotes.push(nuevoConsecutivo);

            const [result] = await dbRailway.query(
                `UPDATE registros_enel_gestion_ots SET fecha_programacion = ?, tipoMovil = ?, cuadrilla = ?, cedula_cuadrilla = ?, nombre_cuadrilla = ?, turnoAsignado = ?, historico = ?, lotes = ? WHERE id = ?`,
                [fechaProgramacionTemp, tipoMovilTemp, cuadrillaTemp, cedulaCuadrillaTemp, nombreCuadrillaTemp, turnoAsignadoTemp, JSON.stringify(historico), JSON.stringify(lotes), row.id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Registro no encontrado' });
            }
        }

        res.json({
            message: 'Registros actualizados correctamente',
            totalActualizados: registros.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/marcarAtendidas', async (req, res) => {
    const { ordenes, nombreUsuario } = req.body;

    if (!Array.isArray(ordenes) || ordenes.length === 0) {
        return res.status(400).json({ error: 'Debe enviar un arreglo de órdenes' });
    }

    if (!nombreUsuario) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    try {
        const [existentes] = await dbRailway.query(
            `SELECT id, nro_orden, historico, lotes, atendida FROM registros_enel_gestion_ots WHERE nro_orden IN (?)`,
            [ordenes]
        );

        const encontrados = existentes.map(row => row.nro_orden);
        const noEncontrados = ordenes.filter(o => !encontrados.includes(o));

        const pendientes = existentes.filter(row => row.atendida !== 'OK');

        if (pendientes.length > 0) {
            const [todos] = await dbRailway.query(
                `SELECT lotes FROM registros_enel_gestion_ots WHERE lotes IS NOT NULL`
            );

            let maxConsecutivo = 0;
            for (const row of todos) {
                try {
                    const arr = JSON.parse(row.lotes);
                    if (Array.isArray(arr) && arr.length > 0) {
                        const localMax = Math.max(...arr);
                        if (localMax > maxConsecutivo) {
                            maxConsecutivo = localMax;
                        }
                    }
                } catch { }
            }

            const nuevoConsecutivo = maxConsecutivo + 1;

            for (const row of pendientes) {
                let historico = [];
                if (row.historico) {
                    try {
                        historico = JSON.parse(row.historico);
                        if (!Array.isArray(historico)) historico = [];
                    } catch {
                        historico = [];
                    }
                }

                let lotes = [];
                if (row.lotes) {
                    try {
                        lotes = JSON.parse(row.lotes);
                        if (!Array.isArray(lotes)) lotes = [];
                    } catch {
                        lotes = [];
                    }
                }
                lotes.push(nuevoConsecutivo);

                historico.push({
                    fecha: new Date().toISOString(),
                    usuario: nombreUsuario,
                    lote: nuevoConsecutivo,
                    detalle: `La orden fue marcada como atendida`
                });

                await dbRailway.query(
                    `UPDATE registros_enel_gestion_ots SET atendida = 'OK', historico = ?, lotes = ? WHERE id = ?`,
                    [JSON.stringify(historico), JSON.stringify(lotes), row.id]
                );
            }
        }

        res.json({
            message: `Actualización completada`,
            totalEncontrados: encontrados.length,
            totalActualizados: pendientes.length,
            totalNoEncontrados: noEncontrados.length,
            noEncontrados
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/subirExcelNuevasOrdenes', upload.single('file'), async (req, res) => {

    try {
        if (!req.file) {
            return res.status(400).json({ error: "No se envió archivo" });
        }

        const nombreUsuario = req.body.nombreUsuario;
        if (!nombreUsuario) {
            return res.status(400).json({ error: "Falta nombreUsuario" });
        }

        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });

        if (!workbook.SheetNames.includes("Ordenes")) {
            return res.status(400).json({ error: 'La hoja "Ordenes" no existe en el archivo' });
        }

        const worksheet = workbook.Sheets["Ordenes"];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
            return res.status(400).json({ error: "La hoja está vacía" });
        }

        return procesarNuevasOrdenes(jsonData, nombreUsuario, res);

    } catch (err) {
        console.error("Error en /subirExcel:", err);
        return res.status(500).json({ error: "Error procesando archivo" });
    }
});

router.post('/nuevasOrdenes', async (req, res) => {
    const { data, nombreUsuario } = req.body;
    return procesarNuevasOrdenes(data, nombreUsuario, res);
});

async function procesarNuevasOrdenes(data, nombreUsuario, res) {
    const norm = v => String(v ?? '').trim();
    const parseArray = v => {
        try {
            const arr = JSON.parse(v);
            return Array.isArray(arr) ? arr : [];
        } catch {
            return [];
        }
    };

    try {
        if (!Array.isArray(data) || data.length === 0)
            return res.status(400).json({ error: "Debes enviar un archivo con informacion" });

        if (!nombreUsuario)
            return res.status(400).json({ error: "Faltan datos requeridos" });

        const nroOrdenes = [...new Set(
            data
                .map(v => norm(v.nro_orden))
                .filter(Boolean)
        )];

        if (nroOrdenes.length === 0)
            return res.status(400).json({ error: "No hay nro_orden válidos en el archivo" });

        const [colsInfo] = await dbRailway.query("SHOW COLUMNS FROM registros_enel_gestion_ots");
        const allowedCols = new Set(colsInfo.map(c => c.Field));

        const [existentesFull] = await dbRailway.query(
            "SELECT * FROM registros_enel_gestion_ots WHERE nro_orden IN (?)",
            [nroOrdenes]
        );

        const existentesMap = new Map(
            existentesFull.map(r => [norm(r.nro_orden), r])
        );

        const encontrados = existentesFull.map(r => norm(r.nro_orden));

        const noEncontrados = data.filter(item => !existentesMap.has(norm(item.nro_orden)));

        const [todosLotes] = await dbRailway.query(
            "SELECT lotes FROM registros_enel_gestion_ots WHERE lotes IS NOT NULL"
        );

        let currentMax = 0;
        for (const row of todosLotes) {
            const arr = parseArray(row.lotes);
            const max = Math.max(0, ...arr);
            if (max > currentMax) currentMax = max;
        }

        const consecutivoInsert = currentMax + 1;
        const consecutivoUpdate = consecutivoInsert + 1;

        let totalInsertados = 0;

        if (noEncontrados.length > 0) {
            const unionCols = [...new Set(noEncontrados.flatMap(o => Object.keys(o)))];
            const insertCols = unionCols.filter(c => allowedCols.has(c));

            if (insertCols.length === 0)
                throw new Error("No hay columnas válidas para insertar en la tabla");

            const placeholders = "(" + insertCols.map(() => "?").join(",") + ")";
            const rowsPlaceholder = noEncontrados.map(() => placeholders).join(",");
            const values = noEncontrados.flatMap(obj =>
                insertCols.map(col => obj[col] ?? null)
            );

            const sql = `
                INSERT INTO registros_enel_gestion_ots 
                (\`${insertCols.join("`,`")}\`) 
                VALUES ${rowsPlaceholder}
            `;

            await dbRailway.query(sql, values);

            totalInsertados = noEncontrados.length;

            const [insertedRows] = await dbRailway.query(
                "SELECT id, nro_orden, historico, lotes FROM registros_enel_gestion_ots WHERE nro_orden IN (?)",
                [noEncontrados.map(r => r.nro_orden)]
            );

            for (const row of insertedRows) {
                const historicoArr = parseArray(row.historico);
                const lotes = parseArray(row.lotes);

                lotes.push(consecutivoInsert);

                historicoArr.push({
                    fecha: new Date().toISOString(),
                    usuario: nombreUsuario,
                    lote: consecutivoInsert,
                    detalle: `La orden fue ingresada a la base de datos`
                });

                await dbRailway.query(
                    "UPDATE registros_enel_gestion_ots SET historico=?, lotes=? WHERE id=?",
                    [JSON.stringify(historicoArr), JSON.stringify(lotes), row.id]
                );
            }
        }

        let totalActualizados = 0;
        const actualizados = [];
        const dataMap = new Map(data.map(i => [norm(i.nro_orden), i]));
        let index = 0;
        const total = existentesFull.length;

        const batchSize = 50;
        let updates = [];

        for (const existing of existentesFull) {
            index++;
            console.log(`Gestion OTs, actualizando ordenes procesando ${index} de ${total} ( ${((index / total) * 100).toFixed(2)}% )`);

            const key = norm(existing.nro_orden);
            const item = dataMap.get(key);
            if (!item) continue;

            const cambios = {};

            for (const col of Object.keys(item)) {
                if (!allowedCols.has(col)) continue;
                if (["id", "nro_orden", "historico"].includes(col)) continue;

                const nuevo = item[col] ?? null;
                const viejo = existing[col] ?? null;

                if (norm(nuevo) !== norm(viejo)) {
                    cambios[col] = nuevo;
                }
            }

            if (Object.keys(cambios).length === 0) continue;

            const historicoArr = parseArray(existing.historico);
            const lotes = parseArray(existing.lotes);

            const cambiosDetalle = Object.entries(cambios)
                .map(([c, nv]) => `${c}: "${existing[c] ?? ""}" -> "${nv ?? ""}"`)
                .join("; ");

            lotes.push(consecutivoUpdate);

            historicoArr.push({
                fecha: new Date().toISOString(),
                usuario: nombreUsuario,
                lote: consecutivoUpdate,
                detalle: `Actualización detectó cambios en la orden ${key}: ${cambiosDetalle}`
            });

            const setCols = Object.keys(cambios).map(c => `\`${c}\`=?`).join(", ");
            const params = [...Object.values(cambios), JSON.stringify(historicoArr), JSON.stringify(lotes), key];

            updates.push(
                dbRailway.query(
                    `UPDATE registros_enel_gestion_ots SET ${setCols}, historico=?, lotes=? WHERE nro_orden=?`,
                    params
                )
            );

            if (updates.length >= batchSize) {
                await Promise.all(updates);
                updates = [];
            }
        }

        if (updates.length > 0) {
            await Promise.all(updates);
        }

        return res.json({
            message: "Validación, inserción y actualización completadas",
            totalEncontrados: encontrados.length,
            totalInsertados,
            totalActualizados,
            actualizados
        });

    } catch (err) {
        console.error("Error en /nuevasOrdenes:", err);
        return res.status(500).json({ error: err.message });
    }
}


router.post('/rehabilitarOT', async (req, res) => {
    const { id, observaciones, nombreUsuario } = req.body;

    if (!id || !observaciones || !nombreUsuario) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    let tipoMovilTemp = null;
    let cuadrillaTemp = null;
    let turnoAsignadoTemp = null;
    let atendidaTemp = null;

    try {
        const [rows] = await dbRailway.query(
            `SELECT historico, lotes FROM registros_enel_gestion_ots WHERE id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        let historico = [];
        if (rows[0].historico) {
            try {
                historico = JSON.parse(rows[0].historico);
                if (!Array.isArray(historico)) historico = [];
            } catch {
                historico = [];
            }
        }

        const [todos] = await dbRailway.query(
            `SELECT lotes FROM registros_enel_gestion_ots WHERE lotes IS NOT NULL`
        );

        let maxConsecutivo = 0;
        for (const row of todos) {
            try {
                const arr = JSON.parse(row.lotes);
                if (Array.isArray(arr) && arr.length > 0) {
                    const localMax = Math.max(...arr);
                    if (localMax > maxConsecutivo) {
                        maxConsecutivo = localMax;
                    }
                }
            } catch { }
        }

        const nuevoConsecutivo = maxConsecutivo + 1;

        let lotes = [];
        if (rows[0].lotes) {
            try {
                lotes = JSON.parse(rows[0].lotes);
                if (!Array.isArray(lotes)) lotes = [];
            } catch {
                lotes = [];
            }
        }
        lotes.push(nuevoConsecutivo);

        historico.push({
            fecha: new Date().toISOString(),
            usuario: nombreUsuario,
            lote: nuevoConsecutivo,
            detalle: `Se rehabilita la orden de trabajo`,
            observacion: observaciones
        });

        const [result] = await dbRailway.query(
            `UPDATE registros_enel_gestion_ots SET tipoMovil = ?, cuadrilla = ?, turnoAsignado = ?, historico = ?, atendida = ?, lotes = ? WHERE id = ?`,
            [tipoMovilTemp, cuadrillaTemp, turnoAsignadoTemp, JSON.stringify(historico), atendidaTemp, JSON.stringify(lotes), id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        res.json({ message: 'Registro actualizado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
