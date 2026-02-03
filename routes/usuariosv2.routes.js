const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const sendEmail = require('../utils/mailer');
const { sendResponse, sendError } = require('../utils/responseHandler');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const validarToken = require('../middlewares/validarToken');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');

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
    const tokenOld = req.headers.authorization?.replace('Bearer ', '') || "";

    if (!correo) {
        await registrarHistorial({
            nombreUsuario: 'No registrado',
            cedulaUsuario: 'No registrado',
            rolUsuario: 'No registrado',
            nivel: 'log',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'login',
            accion: 'Inicio de sesion fallido',
            detalle: 'Campo obligatorio: Correo',
            datos: { correoProporcionado: correo },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 400, "Campo obligatorio: Correo", null, { "correo": "Ingresa tu correo." });
    }

    const [users] = await dbRailway.query(
        'SELECT * FROM user WHERE correo = ?',
        [correo]
    );

    const usuario = users[0];

    if (!contrasena) {
        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'No registrado',
            cedulaUsuario: usuario.cedula || 'No registrado',
            rolUsuario: usuario.rol || 'No registrado',
            nivel: 'log',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'login',
            accion: 'Inicio de sesion fallido',
            detalle: 'Campo obligatorio: Contraseña',
            datos: { correoProporcionado: correo },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 400, "Campo obligatorio: Contraseña", null, { "contrasena": "Ingresa tu contraseña." });
    }

    try {

        if (users.length === 0) {
            await registrarHistorial({
                nombreUsuario: 'No registrado',
                cedulaUsuario: 'No registrado',
                rolUsuario: 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'post',
                endPoint: 'login',
                accion: 'Inicio de sesion fallido',
                detalle: 'No se encontró la cuenta',
                datos: {
                    correoBuscado: correo
                },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "No se encontró la cuenta", null, { "correo": "No existe una cuenta asociada a este correo." });
        }

        if (usuario.contrasena !== contrasena) {
            await registrarHistorial({
                nombreUsuario: usuario.nombre || 'No registrado',
                cedulaUsuario: usuario.cedula || 'No registrado',
                rolUsuario: usuario.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'post',
                endPoint: 'login',
                accion: 'Inicio de sesion fallido',
                detalle: 'Credenciales incorrectas',
                datos: {
                    correoIntentado: correo,
                    contrasenaIntentada: contrasena
                },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Credenciales incorrectas", null, { "contrasena": "La contraseña ingresada no es correcta." });
        }

        if (usuario.correo !== 'invitado@sicte.com') {
            await registrarHistorial({
                nombreUsuario: usuario.nombre || 'No registrado',
                cedulaUsuario: usuario.cedula || 'No registrado',
                rolUsuario: usuario.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'post',
                endPoint: 'login',
                accion: 'Inicio de sesion exitoso',
                detalle: 'Ingreso correcto',
                datos: {
                    correo: usuario.correo,
                    metodo: 'Credenciales',
                },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });
        }

        const [pages] = await dbRailway.query(
            'SELECT * FROM pages_per_user WHERE cedula = ?',
            [usuario.cedula]
        );

        const page = pages[0];

        if (usuario.correo === 'invitado@sicte.com' || usuario.cedula === '0000') {
            let usuarioOld = null;
            try {
                const [tokenData] = await dbRailway.query(
                    'SELECT * FROM tokens WHERE token = ?',
                    [tokenOld]
                );

                const resetToken = tokenData[0];

                const [users] = await dbRailway.query(
                    'SELECT * FROM user WHERE cedula = ?',
                    [resetToken.cedula || ""]
                );

                usuarioOld = users[0];

            } catch (err) {
            }

            await registrarHistorial({
                nombreUsuario: usuarioOld?.nombre || 'No registrado',
                cedulaUsuario: usuarioOld?.cedula || 'No registrado',
                rolUsuario: usuarioOld?.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'post',
                endPoint: 'login',
                accion: 'Sesión finalizada automáticamente',
                detalle: 'Sesión cerrada automáticamente',
                datos: {},
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

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

        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'No registrado',
            cedulaUsuario: usuario.cedula || 'No registrado',
            rolUsuario: usuario.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'login',
            accion: 'Token creado',
            detalle: 'Token de sesión generado',
            datos: {
                expiryDate: expiryDate,
            },
            tablasIdsAfectados: [{
                tabla: 'tokens',
                id: tokenUser.id?.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `¡Inicio de sesión exitoso!`,
            `Bienvenido, ${usuario.nombre}.`,
            { usuario, page, tokenUser }
        );

    } catch (err) {

        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'Error sistema',
            cedulaUsuario: usuario.cedula || 'Error sistema',
            rolUsuario: usuario.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'login',
            accion: 'Error al iniciar sesion',
            detalle: 'Error interno del servidor',
            datos: {
                correoProporcionado: correo,
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado", err);
    }
});

router.post('/recibir', async (req, res) => {
    const { correo } = req.body;

    if (!correo) {
        await registrarHistorial({
            nombreUsuario: 'No registrado',
            cedulaUsuario: 'No registrado',
            rolUsuario: 'No registrado',
            nivel: 'log',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'recibir',
            accion: 'Recibir correo con contraseña fallido',
            detalle: 'Campo obligatorio: Correo',
            datos: { correoProporcionado: correo },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 400, "Campo obligatorio: Correo", null, { "correo": "Ingresa tu correo." });
    }

    const [users] = await dbRailway.query(
        'SELECT * FROM user WHERE correo = ?',
        [correo]
    );

    const usuario = users[0];

    try {

        if (users.length === 0) {
            await registrarHistorial({
                nombreUsuario: 'No registrado',
                cedulaUsuario: 'No registrado',
                rolUsuario: 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'post',
                endPoint: 'recibir',
                accion: 'Recibir correo con contraseña fallido',
                detalle: 'No se encontró la cuenta',
                datos: {
                    correoProporcionado: correo
                },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 404, "No se encontró la cuenta", null, { "correo": "No existe una cuenta asociada a este correo electrónico." });
        }

        const mensaje = `Hola,\n\nRecibimos una solicitud para recuperar el acceso a tu cuenta para la pagina del CCOT.\n\nTu contraseña es:\n${user.contrasena}\n\nTe recomendamos mantener esta información en un lugar seguro.\n\nSi no realizaste esta solicitud, puedes ignorar este mensaje.`;

        await sendEmail(usuario.correo, 'CCOT - Recibir Contraseña', mensaje);

        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'No registrado',
            cedulaUsuario: usuario.cedula || 'No registrado',
            rolUsuario: usuario.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'recibir',
            accion: 'Correo enviado con contraseña',
            detalle: 'Correo enviado con contraseña con exito',
            datos: {
                correoProporcionado: correo
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            "Correo enviado",
            "Hemos enviado un correo con la información para acceder a tu cuenta."
        );
    } catch (err) {

        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'Error sistema',
            cedulaUsuario: usuario.cedula || 'Error sistema',
            rolUsuario: usuario.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'recibir',
            accion: 'Error al procesar enviar correo con contraseña',
            detalle: 'Error interno del servidor',
            datos: {
                correoProporcionado: correo,
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado", err);
    }
});

router.post('/cambiar', async (req, res) => {
    const { correo } = req.body;

    if (!correo) {
        await registrarHistorial({
            nombreUsuario: 'No registrado',
            cedulaUsuario: 'No registrado',
            rolUsuario: 'No registrado',
            nivel: 'log',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'cambiar',
            accion: 'Recibir correo para cambiar contraseña fallido',
            detalle: 'Campo obligatorio: Correo',
            datos: { correoProporcionado: correo },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 400, "Campo obligatorio: Correo", null, { "correo": "Ingresa tu correo." });
    }

    const token = generateToken();
    const expiryDate = calculateExpiryDate(30);

    const [users] = await dbRailway.query(
        'SELECT * FROM user WHERE correo = ?',
        [correo]
    );

    const usuario = users[0];

    try {

        if (users.length === 0) {
            await registrarHistorial({
                nombreUsuario: 'No registrado',
                cedulaUsuario: 'No registrado',
                rolUsuario: 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'post',
                endPoint: 'cambiar',
                accion: 'Recibir correo para cambiar contraseña fallido',
                detalle: 'No se encontró la cuenta',
                datos: {
                    correoProporcionado: correo
                },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 404, "No se encontró la cuenta", null, { "correo": "No existe una cuenta asociada a este correo electrónico." });
        }

        await dbRailway.query(
            `INSERT INTO tokens (cedula, email, token, expiryDate)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                email = VALUES(email),
                token = VALUES(token),
                expiryDate = VALUES(expiryDate)`,
            [usuario.cedula, correo, token, expiryDate]
        );

        const resetLink = `https://sicte-sas-ccot.up.railway.app/cambiarContrasena?token=${token}`;
        const mensaje = `Hola,\n\nRecibimos una solicitud para cambiar el acceso a tu cuenta para la pagina del CCOT.\n\nHaz clic en el siguiente enlace para cambiar tu contraseña, recuerda que solo tiene 30 minutos para hacer el cambio:\n${resetLink}\n\nTe recomendamos mantener esta información en un lugar seguro.\n\nSi no realizaste esta solicitud, puedes ignorar este mensaje.`;

        await sendEmail(correo, 'CCOT - Cambiar Contraseña', mensaje);

        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'No registrado',
            cedulaUsuario: usuario.cedula || 'No registrado',
            rolUsuario: usuario.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'cambiar',
            accion: 'Correo enviado para cambiar contraseña',
            detalle: 'Correo enviado para cambiar contraseña con exito',
            datos: {
                correoProporcionado: correo
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            "Correo enviado",
            "Hemos enviado un correo con la información para acceder a tu cuenta."
        );

    } catch (err) {

        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'Error sistema',
            cedulaUsuario: usuario.cedula || 'Error sistema',
            rolUsuario: usuario.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'cambiar',
            accion: 'Error al procesar enviar correo para cambiar contraseña',
            detalle: 'Error interno del servidor',
            datos: {
                correoProporcionado: correo,
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado", err);
    }
});

router.post('/validarToken', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        await registrarHistorial({
            nombreUsuario: 'No registrado',
            cedulaUsuario: 'No registrado',
            rolUsuario: 'No registrado',
            nivel: 'log',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'validarToken',
            accion: 'Token valido fallido',
            detalle: 'Falta campo token',
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 400, "Falta campo token");
    }

    const [tokenData] = await dbRailway.query(
        'SELECT * FROM tokens WHERE token = ?',
        [token]
    );

    const resetToken = tokenData[0];

    const [users] = await dbRailway.query(
        'SELECT * FROM user WHERE cedula = ?',
        [resetToken.cedula || ""]
    );

    const usuario = users[0];

    try {

        if (tokenData.length === 0) {
            await registrarHistorial({
                nombreUsuario: 'No registrado',
                cedulaUsuario: 'No registrado',
                rolUsuario: 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'post',
                endPoint: 'validarToken',
                accion: 'Token valido fallido',
                detalle: 'Token no encontrado',
                datos: {},
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Token no encontrado");
        }

        const expiracion = new Date(resetToken.expiryDate);

        if (expiracion < new Date()) {
            await registrarHistorial({
                nombreUsuario: usuario.nombre || 'No registrado',
                cedulaUsuario: usuario.cedula || 'No registrado',
                rolUsuario: usuario.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'post',
                endPoint: 'validarToken',
                accion: 'Token valido fallido',
                detalle: 'Token expirado',
                datos: { tokenProporcionado: token },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Token expirado");
        }

        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'No registrado',
            cedulaUsuario: usuario.cedula || 'No registrado',
            rolUsuario: usuario.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'validarToken',
            accion: 'Token valido exitoso',
            detalle: 'Token validado exitosamente',
            datos: { tokenProporcionado: token },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            "Token valido",
            "El enlace es válido. Puedes continuar con el cambio de contraseña."
        );
    } catch (err) {

        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'Error sistema',
            cedulaUsuario: usuario.cedula || 'Error sistema',
            rolUsuario: usuario.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'validarToken',
            accion: 'Error al validar token',
            detalle: 'Error interno del servidor',
            datos: {
                tokenProporcionado: token,
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado", err);
    }
});

router.post('/actualizarContrasena', async (req, res) => {
    const { token, contrasenaActual, contrasenaNueva } = req.body;

    if (!token) {
        await registrarHistorial({
            nombreUsuario: 'No registrado',
            cedulaUsuario: 'No registrado',
            rolUsuario: 'No registrado',
            nivel: 'log',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'actualizarContrasena',
            accion: 'Actualizar contraseña fallido',
            detalle: 'Falta campo token',
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 400, "Falta campo token");
    }

    const [tokenData] = await dbRailway.query(
        'SELECT * FROM tokens WHERE token = ?',
        [token]
    );

    const resetToken = tokenData[0];

    const [users] = await dbRailway.query(
        'SELECT * FROM user WHERE cedula = ?',
        [resetToken.cedula || ""]
    );

    const usuario = users[0];

    if (!contrasenaActual) {
        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'No registrado',
            cedulaUsuario: usuario.cedula || 'No registrado',
            rolUsuario: usuario.rol || 'No registrado',
            nivel: 'log',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'actualizarContrasena',
            accion: 'Actualizar contraseña fallido',
            detalle: 'Campo obligatorio: Contraseña actual',
            datos: { tokenProporcionado: token },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 400, "Campo obligatorio: Contraseña actual", null, { "passwordActual": "Ingresa tu contraseña actual." });
    }

    if (!contrasenaNueva) {
        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'No registrado',
            cedulaUsuario: usuario.cedula || 'No registrado',
            rolUsuario: usuario.rol || 'No registrado',
            nivel: 'log',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'actualizarContrasena',
            accion: 'Actualizar contraseña fallido',
            detalle: 'Campo obligatorio: Contraseña nueva',
            datos: { tokenProporcionado: token },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 400, "Campo obligatorio: Contraseña nueva", null, { "passwordNueva": "Ingresa una nueva contraseña." });
    }

    try {
        if (tokenData.length === 0) {
            await registrarHistorial({
                nombreUsuario: 'No registrado',
                cedulaUsuario: 'No registrado',
                rolUsuario: 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'post',
                endPoint: 'actualizarContrasena',
                accion: 'Actualizar contraseña fallido',
                detalle: 'Token no encontrado',
                datos: {},
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Token inválido");
        }

        if (usuario.length === 0) {
            await registrarHistorial({
                nombreUsuario: 'No registrado',
                cedulaUsuario: 'No registrado',
                rolUsuario: 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'post',
                endPoint: 'actualizarContrasena',
                accion: 'Actualizar contraseña fallido',
                detalle: 'Usuario no encontrado',
                datos: {},
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Usuario no encontrado");
        }

        if (usuario[0].contrasena !== contrasenaActual) {
            await registrarHistorial({
                nombreUsuario: usuario.nombre || 'No registrado',
                cedulaUsuario: usuario.cedula || 'No registrado',
                rolUsuario: usuario.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'post',
                endPoint: 'actualizarContrasena',
                accion: 'Actualizar contraseña fallido',
                detalle: 'Contraseña actual incorrecta',
                datos: {},
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Contraseña actual incorrecta", null, { "passwordActual": "La contraseña actual no es correcta." });
        }

        if (usuario[0].contrasena === contrasenaNueva) {
            await registrarHistorial({
                nombreUsuario: usuario.nombre || 'No registrado',
                cedulaUsuario: usuario.cedula || 'No registrado',
                rolUsuario: usuario.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'post',
                endPoint: 'actualizarContrasena',
                accion: 'Actualizar contraseña fallido',
                detalle: 'Contraseña no permitida',
                datos: {},
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Contraseña no permitida", null, { "passwordNueva": "La nueva contraseña debe ser diferente a la actual." });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(contrasenaNueva)) {
            await registrarHistorial({
                nombreUsuario: usuario.nombre || 'No registrado',
                cedulaUsuario: usuario.cedula || 'No registrado',
                rolUsuario: usuario.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'post',
                endPoint: 'actualizarContrasena',
                accion: 'Actualizar contraseña fallido',
                detalle: 'Contraseña no válida',
                datos: {},
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Contraseña no válida", null, { passwordNueva: "Debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número." });
        }

        await dbRailway.query(
            'UPDATE user SET contrasena = ? WHERE correo = ?',
            [contrasenaNueva, tokenData[0].email]
        );

        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'No registrado',
            cedulaUsuario: usuario.cedula || 'No registrado',
            rolUsuario: usuario.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'actualizarContrasena',
            accion: 'Actualizar contraseña exitoso',
            detalle: 'Contraseña actualizada exitosamente',
            datos: {},
            tablasIdsAfectados: [{
                tabla: 'user',
                id: usuario.id?.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            "Contraseña actualizada",
            "Tu contraseña se ha cambiado correctamente."
        );

    } catch (err) {

        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'Error sistema',
            cedulaUsuario: usuario.cedula || 'Error sistema',
            rolUsuario: usuario.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'actualizarContrasena',
            accion: 'Error al actualizar contraseña',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado", err);
    }
});

router.get('/plantaEnLineaCedulaNombreActivos', validarToken, async (req, res) => {

    const usuario = req.validarToken.usuario

    try {
        const [rows] = await dbRailway.query("SELECT nit, nombre, perfil FROM plantaenlinea WHERE perfil <> 'RETIRADO'");

        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'No registrado',
            cedulaUsuario: usuario.cedula || 'No registrado',
            rolUsuario: usuario.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'plantaEnLineaCedulaNombreActivos',
            accion: 'Consulta planta en linea exitosa',
            detalle: `Usuario ${usuario?.nombre || 'desconocido'} consultó ${rows.length} registros de planta en linea`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de la planta.`,
            rows
        );

    } catch (err) {

        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'Error sistema',
            cedulaUsuario: usuario.cedula || 'Error sistema',
            rolUsuario: usuario.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'plantaEnLineaCedulaNombreActivos',
            accion: 'Error al obtener la planta en linea',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado", err);
    }
});

router.get('/ubicacionUsuarios', validarToken, async (req, res) => {

    const usuario = req.validarToken.usuario

    try {
        const [rows] = await dbRailway.query("SELECT * FROM registros_ubicacion_usuarios");

        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'No registrado',
            cedulaUsuario: usuario.cedula || 'No registrado',
            rolUsuario: usuario.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'ubicacionUsuarios',
            accion: 'Consulta ubicacion de usuarios exitosa',
            detalle: `Usuario ${usuario?.nombre || 'desconocido'} consultó ${rows.length} registros de ubicación de usuarios`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de ubicacion de usuarios.`,
            rows
        );

    } catch (err) {

        await registrarHistorial({
            nombreUsuario: usuario.nombre || 'Error sistema',
            cedulaUsuario: usuario.cedula || 'Error sistema',
            rolUsuario: usuario.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'ubicacionUsuarios',
            accion: 'Error al obtener la ubicacion de usuarios',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.post('/ubicacionUsuarios', validarToken, async (req, res) => {
    const data = req.body;

    if (!Array.isArray(data) || data.length === 0) {
        return sendError(res, 400, "Se espera un arreglo de ubicaciones.");
    }

    const syncedIds = [];
    const values = [];

    for (const item of data) {

        const {
            localId,
            fechaToma,
            cedulaUsuario,
            nombreUsuario,
            latitud,
            longitud,
            precisionLatLon,
            altitud,
            precisionAltitud,
            direccionGrados,
            velocidad,
            origen,
            tipoMuestra
        } = item;

        if (!fechaToma || !cedulaUsuario || !nombreUsuario || !latitud || !longitud || !origen || !tipoMuestra) {
            continue;
        }

        values.push([
            fechaToma,
            cedulaUsuario,
            nombreUsuario,
            latitud,
            longitud,
            precisionLatLon,
            altitud,
            precisionAltitud,
            direccionGrados,
            velocidad,
            origen,
            tipoMuestra,
            localId
        ]);
    }

    if (!values.length) {
        return sendResponse(res, 200, "Sin datos válidos", { syncedIds: [] });
    }

    try {

        const query = `
            INSERT IGNORE INTO registros_ubicacion_usuarios
            (
                fechaToma,
                cedulaUsuario,
                nombreUsuario,
                latitud,
                longitud,
                precisionLatLon,
                altitud,
                precisionAltitud,
                direccionGrados,
                velocidad,
                origen,
                tipoMuestra
            )
            VALUES ?
        `;

        const [result] = await dbRailway.query(query, [values.map(v => v.slice(0, -1))]);

        for (const v of values) {
            syncedIds.push(v[v.length - 1]);
        }

        return sendResponse(
            res,
            200,
            `Sincronización completada`,
            `Se han sin sincronizado ${syncedIds.length} registros.`,
            { syncedIds }
        );

    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }

});

module.exports = router;
