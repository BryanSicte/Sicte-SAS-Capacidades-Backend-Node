const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');

router.get('/registros', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_enel_gestion_ots');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/asignarOT', async (req, res) => {
    const { ids, tipoMovil, cuadrilla, observaciones, nombreUsuario, turnoAsignado } = req.body;

    if ((!tipoMovil && cuadrilla !== 'Disponible') || !cuadrilla || !nombreUsuario || (!turnoAsignado && cuadrilla !== 'Disponible')) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Debe enviar un arreglo de IDs' });
    }

    let tipoMovilTemp = tipoMovil;
    let cuadrillaTemp = cuadrilla;
    let turnoAsignadoTemp = turnoAsignado;

    try {
        const [registros] = await dbRailway.query(
            `SELECT id, historico, cuadrilla FROM registros_enel_gestion_ots WHERE id = ?`,
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
            if (row[0].historico) {
                try {
                    historico = JSON.parse(row[0].historico);
                    if (!Array.isArray(historico)) historico = [];
                } catch {
                    historico = [];
                }
            }
            const existeHistorico = historico.length > 1;

            if (existeHistorico) {
                if (!observaciones && row[0].cuadrilla !== null) {
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
                    cuadrillaTemp = null;
                    tipoMovilTemp = null;
                    turnoAsignadoTemp = null;
                } else {
                    historico.push({
                        fecha: new Date().toISOString(),
                        usuario: nombreUsuario,
                        lote: nuevoConsecutivo,
                        detalle: `Se reasigna actividad a la cuadrilla ${cuadrillaTemp} con tipo de movil ${tipoMovilTemp} y turno ${turnoAsignadoTemp}`,
                        observacion: observaciones
                    });
                }
            } else {
                historico.push({
                    fecha: new Date().toISOString(),
                    usuario: nombreUsuario,
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
                `UPDATE registros_enel_gestion_ots SET tipoMovil = ?, cuadrilla = ?, turnoAsignado = ?, historico = ?, lotes = ? WHERE id = ?`,
                [tipoMovilTemp, cuadrillaTemp, turnoAsignadoTemp, JSON.stringify(historico), JSON.stringify(lotes), row.id]
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

router.post('/nuevasOrdenes', async (req, res) => {
    const { data, nombreUsuario } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ error: 'Debes enviar un archivo con informacion' });
    }
    if (!nombreUsuario) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    const norm = v => String(v ?? '').trim();

    try {
        const nroOrdenes = Array.from(
            new Set(
                data
                    .map(i => (i.nro_orden === undefined || i.nro_orden === null) ? '' : String(i.nro_orden).trim())
                    .filter(Boolean)
            )
        );

        if (nroOrdenes.length === 0) {
            return res.status(400).json({ error: 'No hay nro_orden válidos en el archivo' });
        }

        const [colsInfo] = await dbRailway.query('SHOW COLUMNS FROM registros_enel_gestion_ots');
        const allowedCols = new Set(colsInfo.map(c => c.Field));

        const [existentesFull] = await dbRailway.query(
            'SELECT * FROM registros_enel_gestion_ots WHERE nro_orden IN (?)',
            [nroOrdenes]
        );

        const existentesMap = new Map(
            existentesFull.map(r => [String(r.nro_orden).trim(), r])
        );

        const encontrados = existentesFull.map(r => String(r.nro_orden).trim());

        const noEncontrados = data.filter(item => !existentesMap.has(String(item.nro_orden ?? '').trim()));

        let totalInsertados = 0;

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

        if (noEncontrados.length > 0) {
            const unionCols = Array.from(new Set(noEncontrados.flatMap(obj => Object.keys(obj))));
            const insertCols = unionCols.filter(c => allowedCols.has(c));

            if (insertCols.length === 0) {
                throw new Error('No hay columnas válidas para insertar en la tabla.');
            }

            const placeholders = insertCols.map(() => '?').join(',');
            const rowsPlaceholders = noEncontrados.map(() => `(${placeholders})`).join(',');
            const values = noEncontrados.flatMap(obj => insertCols.map(col => (obj[col] === undefined ? null : obj[col])));

            const sqlInsert = `INSERT INTO registros_enel_gestion_ots (${insertCols.map(c => `\`${c}\``).join(',')}) VALUES ${rowsPlaceholders}`;
            await dbRailway.query(sqlInsert, values);
            totalInsertados = noEncontrados.length;

            const [insertedRows] = await dbRailway.query(
                'SELECT id, nro_orden, historico, lotes FROM registros_enel_gestion_ots WHERE nro_orden IN (?)',
                [noEncontrados.map(r => r.nro_orden)]
            );

            for (const row of insertedRows) {
                let historicoArr = [];
                if (row.historico) {
                    try {
                        historicoArr = JSON.parse(row.historico);
                        if (!Array.isArray(historicoArr)) historicoArr = [];
                    } catch { historicoArr = []; }
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

                historicoArr.push({
                    fecha: new Date().toISOString(),
                    usuario: nombreUsuario,
                    lote: nuevoConsecutivo,
                    detalle: `La orden fue ingresada a la base de datos`
                });

                await dbRailway.query(
                    'UPDATE registros_enel_gestion_ots SET historico = ?, lotes = ? WHERE id = ?',
                    [JSON.stringify(historicoArr), JSON.stringify(lotes), row.id]
                );
            }
        }

        let totalActualizados = 0;
        const actualizados = [];

        const dataMap = new Map(data.map(item => [String(item.nro_orden ?? '').trim(), item]));

        const [todosActualizacion] = await dbRailway.query(
            `SELECT lotes FROM registros_enel_gestion_ots WHERE lotes IS NOT NULL`
        );
        let maxConsecutivoActualizacion = 0;
        for (const row of todosActualizacion) {
            try {
                const arr = JSON.parse(row.lotes);
                if (Array.isArray(arr) && arr.length > 0) {
                    const localMax = Math.max(...arr);
                    if (localMax > maxConsecutivoActualizacion) {
                        maxConsecutivoActualizacion = localMax;
                    }
                }
            } catch { }
        }
        const nuevoConsecutivoActualizacion = maxConsecutivoActualizacion + 1;

        for (const existingRow of existentesFull) {
            const key = String(existingRow.nro_orden).trim();
            const item = dataMap.get(key);
            if (!item) continue;

            const cambios = {};
            for (const col of Object.keys(item)) {
                if (!allowedCols.has(col)) continue;
                if (col === 'id' || col === 'nro_orden') continue;
                if (col === 'historico') continue;

                const nuevo = item[col] === undefined ? null : item[col];
                const viejo = existingRow[col] === undefined ? null : existingRow[col];

                if (norm(nuevo) !== norm(viejo)) {
                    cambios[col] = nuevo;
                }
            }

            if (Object.keys(cambios).length === 0) continue;

            let historicoArr = [];
            if (existingRow.historico) {
                try {
                    historicoArr = JSON.parse(existingRow.historico);
                    if (!Array.isArray(historicoArr)) historicoArr = [];
                } catch { historicoArr = []; }
            }

            const cambiosDetalle = Object.entries(cambios).map(([c, nv]) => {
                const ov = existingRow[c] === undefined ? '' : existingRow[c];
                return `${c}: "${String(ov)}" -> "${String(nv ?? '')}"`;
            }).join('; ');

            let lotes = [];
            if (existingRow.lotes) {
                try {
                    lotes = JSON.parse(existingRow.lotes);
                    if (!Array.isArray(lotes)) lotes = [];
                } catch {
                    lotes = [];
                }
            }
            lotes.push(nuevoConsecutivoActualizacion);

            historicoArr.push({
                fecha: new Date().toISOString(),
                usuario: nombreUsuario,
                lote: nuevoConsecutivoActualizacion,
                detalle: `Actualización detectó cambios en la orden ${key}: ${cambiosDetalle}`
            });

            const setCols = Object.keys(cambios).map(c => `\`${c}\` = ?`).join(', ');
            const params = [...Object.values(cambios), JSON.stringify(historicoArr), JSON.stringify(lotes), key];
            const sqlUpdate = `UPDATE registros_enel_gestion_ots SET ${setCols}, historico = ?, lotes = ? WHERE nro_orden = ?`;

            await dbRailway.query(sqlUpdate, params);

            totalActualizados++;
            actualizados.push(key);
        }

        return res.json({
            message: 'Validación, inserción y actualización completadas',
            totalEncontrados: encontrados.length,
            totalInsertados,
            totalActualizados,
            actualizados
        });
    } catch (err) {
        console.error('Error en /nuevasOrdenes:', err);
        return res.status(500).json({ error: err.message });
    }
});


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
        if (rows.lotes) {
            try {
                lotes = JSON.parse(rows.lotes);
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
