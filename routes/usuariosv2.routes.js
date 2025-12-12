const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const sendEmail = require('../utils/mailer');
const { sendResponse, sendError } = require('../utils/responseHandler');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const validarToken = require('../middlewares/validarToken');

function generateToken() {
    return crypto.randomBytes(20).toString('hex');
}

function calculateExpiryDate(minutes) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    return now.toISOString();
}

router.post('/login', async (req, res) => {
    const { correo, contrasena } = req.body;

    if (!correo) {
        return sendError(res, 400, "Correo es requerido.", null, {"correo": "Completa este campo"});
    }

    if (!contrasena) {
        return sendError(res, 400, "Contraseña es requerido.", null, {"contrasena": "Completa este campo"});
    }

    try {
        const [rows] = await dbRailway.query(
            'SELECT * FROM user WHERE correo = ?',
            [correo]
        );

        if (rows.length === 0) {
            return sendError(res, 400, "Correo no encontrado.", null, {"correo": "Campo incorrecto"});
        }

        const usuario = rows[0];

        if (usuario.contrasena !== contrasena) {
            return sendError(res, 400, "Contraseña incorrecta.", null, {"contrasena": "Campo incorrecto"});
        }

        const [pages] = await dbRailway.query(
            'SELECT * FROM pages_per_user WHERE cedula = ?',
            [usuario.cedula]
        );

        const page = pages[0];

        if (usuario.correo === 'invitado@sicte.com' || usuario.cedula === '0000') {
            return sendResponse(
                res,
                200,
                `Sesión finalizada`,
                `Has cerrado sesión correctamente.`,
                { usuario, page }
            );
        }

        const token = generateToken();
        const expiryDate = calculateExpiryDate(1440);

        await dbRailway.query(
            `INSERT INTO tokens (cedula, email, token, expiryDate)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                email = VALUES(email),
                token = VALUES(token),
                expiryDate = VALUES(expiryDate)`,
            [usuario.cedula, usuario.correo, token, expiryDate]
        );

        const [tokenUserDB] = await dbRailway.query(
            'SELECT * FROM tokens WHERE token = ?',
            [token]
        );

        const tokenUser = tokenUserDB[0];

        return sendResponse(
            res,
            200,
            `¡Inicio de sesión exitoso!`,
            `Bienvenido, ${usuario.nombre || 'usuario'}.`,
            { usuario, page, tokenUser }
        );

    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

module.exports = router;
