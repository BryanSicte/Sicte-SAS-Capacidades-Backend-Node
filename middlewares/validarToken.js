const dbRailway = require('../db/db_railway');
const { sendError } = require('../utils/responseHandler');

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

        if (resetToken.length === 0) {
            return sendError(res, 403, "Token invalido, por favor, cierra sesión y vuelve a ingresar para restablecer tu sesión.");
        }

        const expiracionUTC = new Date(tokenData.expiryDate);
        const ahoraUTC = new Date();

        if (expiracionUTC < ahoraUTC) {
            return sendError(res, 403, "Token expirado, por favor, cierra sesión y vuelve a ingresar para restablecer tu sesión.");
        }

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

        req.validarToken = {
            tokenData: tokenData.token,
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