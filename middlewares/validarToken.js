const dbRailway = require('../db/db_railway');
const { sendError } = require('../utils/responseHandler');
const crypto = require('crypto');

async function validarToken(req, res, next) {

    try {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;

        if (!token) {
            return sendError(res, 403, "Token requerido, por favor, cierra sesión y vuelve a ingresar para restablecer tu sesión.");
        }

        const [tokenData] = await dbRailway.query(
            'SELECT * FROM tokens WHERE token = ?',
            [token]
        );

        if (!tokenData || tokenData.length === 0) {
            return sendError(res, 403, "Token invalido, por favor, cierra sesión y vuelve a ingresar para restablecer tu sesión.");
        }

        const resetToken = tokenData[0];

        const [users] = await dbRailway.query(
            'SELECT * FROM user WHERE cedula = ?',
            [resetToken.cedula || ""]
        );

        const usuario = users[0];

        if (!usuario) {
            return sendError(res, 403, "Usuario no encontrado, por favor inicia sesión de nuevo.");
        }

        const excepciones = require('../config/excepcionesHabilitados');
        const isGuest = usuario.correo === 'invitado@sicte.com' || usuario.cedula === '0000';
        const isExcepted = excepciones.includes(usuario.cedula);

        if (usuario.habilitado === 0 && !isGuest && !isExcepted) {
            return sendError(res, 403, "Usuario inhabilitado o retirado de la planta.");
        }

        const expiracionUTC = new Date(resetToken.expiryDate);
        const ahoraUTC = new Date();

        let tokenActual = token;

        if (expiracionUTC < ahoraUTC) {
            // El token expiró, pero como es un token válido en la base de datos, lo renovamos por 24 horas
            const nuevoToken = crypto.randomBytes(20).toString('hex');
            const now = new Date();
            now.setMinutes(now.getMinutes() + 1440); // 24 horas
            const newExpiryDate = now.toISOString();

            await dbRailway.query(
                `UPDATE tokens 
                 SET token = ?, expiryDate = ? 
                 WHERE token = ?`,
                [nuevoToken, newExpiryDate, token]
            );

            // Exponer y establecer el header con el nuevo token
            res.setHeader('X-New-Token', nuevoToken);
            res.setHeader('Access-Control-Expose-Headers', 'X-New-Token');

            tokenActual = nuevoToken;
        }

        req.validarToken = {
            tokenData: tokenActual,
            usuario: {
                cedula: usuario.cedula,
                nombre: usuario.nombre,
                rol: usuario.rol
            }
        };

        next();

    } catch (error) {
        return sendError(res, 500, "Error validando el token.", error);
    }
}

module.exports = validarToken;