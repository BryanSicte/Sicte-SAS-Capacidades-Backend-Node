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
        return sendError(res, 400, "Campo obligatorio: Correo", null, { "correo": "Ingresa tu correo." });
    }

    if (!contrasena) {
        return sendError(res, 400, "Campo obligatorio: Contraseña", null, { "contrasena": "Ingresa tu contraseña." });
    }

    try {
        const [rows] = await dbRailway.query(
            'SELECT * FROM user WHERE correo = ?',
            [correo]
        );

        if (rows.length === 0) {
            return sendError(res, 400, "No se encontró la cuenta", null, { "correo": "No existe una cuenta asociada a este correo." });
        }

        const usuario = rows[0];

        if (usuario.contrasena !== contrasena) {
            return sendError(res, 400, "Credenciales incorrectas", null, { "contrasena": "La contraseña ingresada no es correcta." });
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
            `Bienvenido, ${usuario.nombre}.`,
            { usuario, page, tokenUser }
        );

    } catch (err) {
        return sendError(res, 500, "Error inesperado", err);
    }
});

router.post('/recibir', async (req, res) => {
    const { correo } = req.body;

    if (!correo) {
        return sendError(res, 400, "Campo obligatorio: Correo", null, { "correo": "Ingresa tu correo." });
    }

    try {
        const [users] = await dbRailway.query(
            'SELECT * FROM user WHERE correo = ?',
            [correo]
        );

        if (!users.length) {
            return sendError(res, 404, "No se encontró la cuenta", null, { "correo": "No existe una cuenta asociada a este correo electrónico." });
        }

        const user = users[0]

        const mensaje = `Hola,\n\nRecibimos una solicitud para recuperar el acceso a tu cuenta para la pagina del CCOT.\n\nTu contraseña es:\n${user.contrasena}\n\nTe recomendamos mantener esta información en un lugar seguro.\n\nSi no realizaste esta solicitud, puedes ignorar este mensaje.`;

        await sendEmail(user.correo, 'CCOT - Recibir Contraseña', mensaje);

        return sendResponse(
            res,
            200,
            "Correo enviado",
            "Hemos enviado un correo con la información para acceder a tu cuenta."
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado", err);
    }
});

router.post('/cambiar', async (req, res) => {
    const { correo } = req.body;

    if (!correo) {
        return sendError(res, 400, "Campo obligatorio: Correo", null, { "correo": "Ingresa tu correo." });
    }

    const token = generateToken();
    const expiryDate = calculateExpiryDate(30);

    try {
        const [users] = await dbRailway.query(
            'SELECT * FROM user WHERE correo = ?',
            [correo]
        );

        if (!users.length) {
            return sendError(res, 404, "No se encontró la cuenta", null, { "correo": "No existe una cuenta asociada a este correo electrónico." });
        }

        const user = users[0]

        await dbRailway.query(
            `INSERT INTO tokens (cedula, email, token, expiryDate)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                email = VALUES(email),
                token = VALUES(token),
                expiryDate = VALUES(expiryDate)`,
            [user.cedula, correo, token, expiryDate]
        );

        const resetLink = `https://sicte-sas-ccot.up.railway.app/cambiarContrasena?token=${token}`;
        const mensaje = `Hola,\n\nRecibimos una solicitud para cambiar el acceso a tu cuenta para la pagina del CCOT.\n\nHaz clic en el siguiente enlace para cambiar tu contraseña, recuerda que solo tiene 30 minutos para hacer el cambio:\n${resetLink}\n\nTe recomendamos mantener esta información en un lugar seguro.\n\nSi no realizaste esta solicitud, puedes ignorar este mensaje.`;

        await sendEmail(correo, 'CCOT - Cambiar Contraseña', mensaje);

        return sendResponse(
            res,
            200,
            "Correo enviado",
            "Hemos enviado un correo con la información para acceder a tu cuenta."
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado", err);
    }
});

router.post('/validarToken', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return sendError(res, 400, "Token requerido");
    }

    try {
        const [rows] = await dbRailway.query(
            'SELECT * FROM tokens WHERE token = ?',
            [token]
        );

        if (rows.length === 0) {
            return sendError(res, 400, "Token inválido");
        }

        const resetToken = rows[0];
        const expiracion = new Date(resetToken.expiryDate);

        if (expiracion < new Date()) {
            return sendError(res, 400, "Token expirado");
        }

        return sendResponse(
            res,
            200,
            "Token valido",
            "El enlace es válido. Puedes continuar con el cambio de contraseña."
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado", err);
    }
});

router.post('/actualizarContrasena', async (req, res) => {
    const { token, contrasenaActual, contrasenaNueva } = req.body;

    if (!token) {
        return sendError(res, 400, "Token es requerido");
    }

    if (!contrasenaActual) {
        return sendError(res, 400, "Campo obligatorio: Contraseña actual", null, { "passwordActual": "Ingresa tu contraseña actual." });
    }

    if (!contrasenaNueva) {
        return sendError(res, 400, "Campo obligatorio: Contraseña nueva", null, { "passwordNueva": "Ingresa una nueva contraseña." });
    }

    try {
        const [rowsToken] = await dbRailway.query(
            'SELECT * FROM tokens WHERE token = ?',
            [token]
        );

        if (rowsToken.length < 1) {
            return sendError(res, 400, "Token inválido");
        }

        const [rows] = await dbRailway.query(
            'SELECT * FROM user WHERE correo = ?',
            [rowsToken[0].email]
        );

        if (rows.length < 1) {
            return sendError(res, 400, "Usuario no encontrado");
        }

        if (rows[0].contrasena !== contrasenaActual) {
            return sendError(res, 400, "Contraseña incorrecta", null, { "passwordActual": "La contraseña actual no es correcta." });
        }

        if (rows[0].contrasena === contrasenaNueva) {
            return sendError(res, 400, "Contraseña no permitida", null, { "passwordNueva": "La nueva contraseña debe ser diferente a la actual." });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(contrasenaNueva)) {
            return sendError(res, 400, "Contraseña no válida", null, { passwordNueva: "Debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número." });
        }

        await dbRailway.query(
            'UPDATE user SET contrasena = ? WHERE correo = ?',
            [contrasenaNueva, rowsToken[0].email]
        );

        return sendResponse(
            res,
            200,
            "Contraseña actualizada",
            "Tu contraseña se ha cambiado correctamente."
        );

    } catch (err) {
        return sendError(res, 500, "Error inesperado", err);
    }
});

router.get('/plantaEnLineaCedulaNombreActivos', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query("SELECT nit, nombre FROM plantaenlinea WHERE perfil <> 'RETIRADO'");

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de la planta.`,
            rows
        );

    } catch (err) {
        return sendError(res, 500, "Error inesperado", err);
    }
});

module.exports = router;
