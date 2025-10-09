const dbRailway = require('../db/db_railway');
const { sendError } = require('../utils/responseHandler');

async function validarToken(req, res, next) {
    try {
        const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;

        if (!token) {
            return sendError(res, 400, "Token requerido.", err);
        }

        const [rows] = await dbRailway.query(
            'SELECT * FROM tokens WHERE token = ?',
            [token]
        );

        if (rows.length === 0) {
            return sendError(res, 400, "Token inválido.", err);
        }

        const tokenData = rows[0];
        const expiracionUTC = new Date(tokenData.expiryDate);
        const ahoraUTC = new Date();

        if (expiracionUTC < ahoraUTC) {
            return sendError(res, 400, "Token expirado.", err);
        }

        req.token = {
            tokenData
        };

        next();

    } catch (error) {
        return sendError(res, 500, "Error validando el token.", err);
    }
}

module.exports = validarToken;


// const express = require('express');
// const router = express.Router();
// const validarToken = require('../middlewares/validarToken');

// router.get('/perfil', validarToken, async (req, res) => {
//     res.json({
//         message: 'Token válido, acceso concedido',
//         usuario: req.usuario
//     });
// });