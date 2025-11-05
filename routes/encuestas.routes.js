const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');

router.get('/Registros', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_encuestas');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/crearRegistro', async (req, res) => {

    return res.status(503).json({
        success: false,
        message: '🚧 El servicio de encuestas está en mantenimiento. Intenta nuevamente más tarde.'
    });
    
    try {
        const data = Object.fromEntries(
            Object.entries(req.body).map(([key, value]) => {
                if (typeof value !== 'string') return [key, value];

                const valorLimpio = value.trim();

                if (key === 'nombreCompleto' || key === 'correo') {
                    return [key, valorLimpio.toLowerCase()];
                }

                return [key, valorLimpio];
            })
        );

        const { nombreCompleto, correo, nombreEncuesta } = data;

        const [existentes] = await dbRailway.query(
            'SELECT * FROM registros_encuestas WHERE (nombreCompleto = ? OR correo = ?) AND nombreEncuesta = ?',
            [nombreCompleto, correo, nombreEncuesta]
        );

        if (existentes.length > 0) {
            return res.status(400).json({
                error: 'Ya existe un registro con el mismo nombre o correo en esta encuesta.'
            });
        }

        const keys = Object.keys(data);
        const values = Object.values(data);

        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO registros_encuestas (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM registros_encuestas WHERE id = ?', [result.insertId]);
        res.status(201).json(registroGuardado[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
