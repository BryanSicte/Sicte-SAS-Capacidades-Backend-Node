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
    const { id, tipoMovil, cuadrilla, observaciones } = req.body;

    if (!id || (!tipoMovil && cuadrilla !== 'Disponible') || !cuadrilla) {
        return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    let tipoMovilTemp = tipoMovil;
    let cuadrillaTemp = cuadrilla;

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

        const existeHistorico = historico.length > 0;

        if (existeHistorico && rows?.[0]?.cuadrilla?.length > 0) {
            if (!observaciones) {
                return res.status(400).json({ error: 'Falta la observacion' });
            }

            if (cuadrillaTemp === 'Disponible') {
                historico.push({
                    fecha: new Date().toISOString(),
                    detalle: `La actividad queda disponible`,
                    observacion: observaciones
                });
                cuadrillaTemp = null;
                tipoMovilTemp = null;
            } else {
                historico.push({
                    fecha: new Date().toISOString(),
                    detalle: `Se reasigna actividad a la cuadrilla ${cuadrillaTemp} con tipo de movil ${tipoMovilTemp}`,
                    observacion: observaciones
                });
            }
        } else {
            historico.push({
                fecha: new Date().toISOString(),
                detalle: `Se asigna actividad a la movil ${cuadrillaTemp} con tipo de movil ${tipoMovilTemp}`
            });
        }

        const [result] = await dbRailway.query(
            `UPDATE registros_enel_gestion_ots SET tipoMovil = ?, cuadrilla = ?, historico = ? WHERE id = ?`,
            [tipoMovilTemp, cuadrillaTemp, JSON.stringify(historico), id]
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
