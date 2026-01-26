const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { validateRequiredFields } = require('../utils/validate');

router.post('/crearRegistro', validarToken, async (req, res) => {

    try {
        const data = req.body;

        console.log(data);

    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.get('/ciudades', validarToken, async (req, res) => {
    try {

        const [rows] = await dbRailway.query('SELECT nombre FROM ciudad');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} ciudades de la base de datos.`,
            rows
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.get('/ciudades', validarToken, async (req, res) => {
    try {

        const [rows] = await dbRailway.query('SELECT nombre FROM ciudad');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} ciudades de la base de datos.`,
            rows
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.get('/auxiliar', validarToken, async (req, res) => {
    try {

        const [rows] = await dbRailway.query('SELECT * FROM tabla_aux_capacitaciones');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de la tabla auxiliar de capacitaciones.`,
            rows
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

module.exports = router;