const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');

router.get('/RegistroCometas', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM RegistroCometas');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/crearRegistroCometas', async (req, res) => {

    try {
        const data = req.body;

        const keys = Object.keys(data);
        const values = Object.values(data);

        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO registros_encuesta_cometas (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM registros_encuesta_cometas WHERE id = ?', [result.insertId]);
        res.status(201).json(registroGuardado[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
