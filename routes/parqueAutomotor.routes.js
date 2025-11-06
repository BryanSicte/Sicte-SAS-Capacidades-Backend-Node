const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');

router.get('/registros', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_parque_automotor');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros del parque automotor.`,
            rows
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.post('/crearRegistro', validarToken, async (req, res) => {

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            return sendError(res, 400, "Los datos del registro son requeridos.");
        }

        const keys = Object.keys(data);
        const values = Object.values(data);

        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO registros_parque_automotor (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM registros_parque_automotor WHERE id = ?', [result.insertId]);

        return sendResponse(
            res,
            200,
            `Registro creado correctamente`,
            `Se ha guardado el registro con ID ${result.insertId}.`,
            registroGuardado[0]
        );

    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.get('/base', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM parque_automotor');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de la base de parque automotor.`,
            rows
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

module.exports = router;