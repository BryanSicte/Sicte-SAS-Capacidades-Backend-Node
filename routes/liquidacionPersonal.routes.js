const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { validateRequiredFields } = require('../utils/validate');

router.get('/plantaActivaGyA', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM planta_activa_gya');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de la planta activa gya.`,
            rows
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

module.exports = router;