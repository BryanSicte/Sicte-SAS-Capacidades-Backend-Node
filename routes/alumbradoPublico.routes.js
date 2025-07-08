const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');

router.get('/registros', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_alumbrado_publico');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/crearRegistro', async (req, res) => {

    try {
        const data = req.body;

        const keys = Object.keys(data);
        const values = Object.values(data);

        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO registros_alumbrado_publico (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM registros_alumbrado_publico WHERE id = ?', [result.insertId]);
        res.status(201).json(registroGuardado[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/actualizarRegistro', async (req, res) => {
    try {
        const data = req.body;

        if (!data.id) {
            return res.status(400).json({ message: 'Se requiere el campo "id" para actualizar.' });
        }

        const { id, ...camposAActualizar } = data;

        const keys = Object.keys(camposAActualizar);
        const values = Object.values(camposAActualizar);

        const updates = keys.map(key => `${key} = ?`).join(', ');

        const query = `UPDATE registros_alumbrado_publico SET ${updates} WHERE id = ?`;

        await dbRailway.query(query, [...values, id]);

        const [registroActualizado] = await dbRailway.query('SELECT * FROM registros_alumbrado_publico WHERE id = ?', [id]);

        res.status(200).json(registroActualizado[0]);

    } catch (err) {
        console.error('❌ Error al actualizar:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;