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

module.exports = router;
