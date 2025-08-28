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
    const { id, tipoMovil, cuadrilla, observaciones, nombreUsuario, turnoAsignado } = req.body;

    if (!id || (!tipoMovil && cuadrilla !== 'Disponible') || !cuadrilla || !nombreUsuario || (!turnoAsignado && cuadrilla !== 'Disponible')) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    let tipoMovilTemp = tipoMovil;
    let cuadrillaTemp = cuadrilla;
    let turnoAsignadoTemp = turnoAsignado;

    try {
        const [rows] = await dbRailway.query(
            `SELECT historico, cuadrilla FROM registros_enel_gestion_ots WHERE id = ?`,
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
        const existeHistorico = historico.length > 1;

        if (existeHistorico) {
            if (!observaciones && rows[0].cuadrilla !== null) {
                return res.status(400).json({ error: 'Falta la observacion' });
            }

            if (cuadrillaTemp === 'Disponible') {
                historico.push({
                    fecha: new Date().toISOString(),
                    usuario: nombreUsuario,
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
                    detalle: `Se reasigna actividad a la cuadrilla ${cuadrillaTemp} con tipo de movil ${tipoMovilTemp} y turno ${turnoAsignadoTemp}`,
                    observacion: observaciones
                });
            }
        } else {
            historico.push({
                fecha: new Date().toISOString(),
                usuario: nombreUsuario,
                detalle: `Se asigna actividad a la movil ${cuadrillaTemp} con tipo de movil ${tipoMovilTemp} y turno ${turnoAsignadoTemp}`
            });
        }

        const [result] = await dbRailway.query(
            `UPDATE registros_enel_gestion_ots SET tipoMovil = ?, cuadrilla = ?, turnoAsignado = ?, historico = ? WHERE id = ?`,
            [tipoMovilTemp, cuadrillaTemp, turnoAsignadoTemp, JSON.stringify(historico), id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        res.json({ message: 'Registro actualizado correctamente' });
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
            `SELECT id, nro_orden, historico FROM registros_enel_gestion_ots WHERE nro_orden IN (?)`,
            [ordenes]
        );

        const encontrados = existentes.map(row => row.nro_orden);
        const noEncontrados = ordenes.filter(o => !encontrados.includes(o));

        if (encontrados.length > 0) {
            await dbRailway.query(
                `UPDATE registros_enel_gestion_ots SET atendida = 'OK' WHERE nro_orden IN (?)`,
                [encontrados]
            );

            for (const row of existentes) {
                let historico = [];
                if (row.historico) {
                    try {
                        historico = JSON.parse(row.historico);
                        if (!Array.isArray(historico)) historico = [];
                    } catch {
                        historico = [];
                    }
                }

                historico.push({
                    fecha: new Date().toISOString(),
                    usuario: nombreUsuario,
                    detalle: `La orden fue marcada como atendida`
                });

                await dbRailway.query(
                    `UPDATE registros_enel_gestion_ots SET historico = ? WHERE id = ?`,
                    [JSON.stringify(historico), row.id]
                );
            }
        }

        res.json({
            message: `Actualización completada`,
            totalEncontrados: encontrados.length,
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

    try {
        const nroOrdenes = data.map(item => item.nro_orden);

        const [existentes] = await dbRailway.query(
            `SELECT nro_orden, historico FROM registros_enel_gestion_ots WHERE nro_orden IN (?)`,
            [nroOrdenes]
        );

        const norm = v => String(v ?? '').trim();

        const encontrados = existentes.map(row => row.nro_orden);
        const encontradosSet = new Set(encontrados.map(norm));

        const noEncontrados = data.filter(item => !encontradosSet.has(norm(item.nro_orden)));

        if (noEncontrados.length > 0) {
            const columnasDB = Object.keys(noEncontrados[0]);
            const placeholders = columnasDB.map(() => '?').join(',');
            const values = noEncontrados.map(obj =>
                columnasDB.map(col => obj[col])
            );

            await dbRailway.query(
                `INSERT INTO registros_enel_gestion_ots (${columnasDB.join(',')}) VALUES ${values.map(() => `(${placeholders})`).join(',')}`,
                values.flat()
            );

            const [insertados] = await dbRailway.query(
                `SELECT id, nro_orden, historico FROM registros_enel_gestion_ots WHERE nro_orden IN (?)`,
                [noEncontrados.map(r => r.nro_orden)]
            );

            for (const row of insertados) {
                let historico = [];
                if (row.historico) {
                    try {
                        historico = JSON.parse(row.historico);
                        if (!Array.isArray(historico)) historico = [];
                    } catch {
                        historico = [];
                    }
                }

                historico.push({
                    fecha: new Date().toISOString(),
                    usuario: nombreUsuario,
                    detalle: `La orden fue ingresada a la base de datos`
                });

                await dbRailway.query(
                    `UPDATE registros_enel_gestion_ots SET historico = ? WHERE id = ?`,
                    [JSON.stringify(historico), row.id]
                );
            }
        }

        res.json({
            message: 'Validación e inserción completada',
            totalEncontrados: encontrados.length,
            totalInsertados: noEncontrados.length
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
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
            `SELECT historico FROM registros_enel_gestion_ots WHERE id = ?`,
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
        
        historico.push({
            fecha: new Date().toISOString(),
            usuario: nombreUsuario,
            detalle: `Se rehabilita la orden de trabajo`,
            observacion: observaciones
        });

        const [result] = await dbRailway.query(
            `UPDATE registros_enel_gestion_ots SET tipoMovil = ?, cuadrilla = ?, turnoAsignado = ?, historico = ?, atendida = ? WHERE id = ?`,
            [tipoMovilTemp, cuadrillaTemp, turnoAsignadoTemp, JSON.stringify(historico), atendidaTemp, id]
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
