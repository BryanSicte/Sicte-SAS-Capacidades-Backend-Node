const express = require('express');
const router = express.Router();
const dbGestion = require('../db/db_gestion_humana');

router.get('/', async (req, res) => {
    try {
        const [rows] = await dbGestion.query('SELECT * FROM registros_chatbot');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
