const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const sendEmail = require('../utils/mailer');
const { sendResponse, sendError } = require('../utils/responseHandler');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const validarToken = require('../middlewares/validarToken');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');
const { syncAllUsers, syncSingleUser } = require('../services/usuarioSyncService');

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

    // Sincronizar en caliente el estado del usuario por su correo electrónico antes de verificar
    try {
        const excepciones = require('../config/excepcionesHabilitados');
        await dbRailway.query(`
            UPDATE user u
            SET u.habilitado = CASE 
                WHEN u.correo = ? AND u.cedula IN (?) THEN 1
                WHEN EXISTS (
                    SELECT 1 FROM plantaenlinea p 
                    WHERE p.nit = u.cedula AND p.perfil <> 'RETIRADO'
                ) THEN 1 
                ELSE 0 
            END
            WHERE u.correo = ?
        `, [correo, excepciones.length > 0 ? excepciones : ['__NONE__'], correo]);
    } catch (syncErr) {
        console.error('Error al sincronizar habilitado en login:', syncErr);
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

        if (usuario.habilitado === 0 && usuario.correo !== 'invitado@sicte.com' && usuario.cedula !== '0000') {
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
                detalle: 'Usuario inhabilitado o retirado de la planta',
                datos: { correoProporcionado: correo },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 403, "Usuario inhabilitado o retirado de la planta.");
        }

        let isMatch = false;
        if (usuario.contrasena && usuario.contrasena.startsWith('$2') && usuario.contrasena.length === 60) {
            isMatch = await bcrypt.compare(contrasena, usuario.contrasena);
        } else {
            isMatch = (usuario.contrasena === contrasena);
        }

        if (!isMatch) {
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

        // Generar una contraseña temporal aleatoria de 8 caracteres
        const tempPass = Math.random().toString(36).slice(-8);
        const hashedTempPass = await bcrypt.hash(tempPass, 10);

        await dbRailway.query(
            'UPDATE user SET contrasena = ? WHERE id = ?',
            [hashedTempPass, usuario.id]
        );

        const mensaje = `Hola,\n\nRecibimos una solicitud para recuperar el acceso a tu cuenta para la pagina del CCOT.\n\nTu contraseña temporal es:\n${tempPass}\n\nTe recomendamos iniciar sesión y cambiar tu contraseña inmediatamente.\n\nSi no realizaste esta solicitud, puedes ignorar este mensaje.`;

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

        let isActualMatch = false;
        if (usuario[0].contrasena && usuario[0].contrasena.startsWith('$2') && usuario[0].contrasena.length === 60) {
            isActualMatch = await bcrypt.compare(contrasenaActual, usuario[0].contrasena);
        } else {
            isActualMatch = (usuario[0].contrasena === contrasenaActual);
        }

        if (!isActualMatch) {
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

        let isNuevaMatch = false;
        if (usuario[0].contrasena && usuario[0].contrasena.startsWith('$2') && usuario[0].contrasena.length === 60) {
            isNuevaMatch = await bcrypt.compare(contrasenaNueva, usuario[0].contrasena);
        } else {
            isNuevaMatch = (usuario[0].contrasena === contrasenaNueva);
        }

        if (isNuevaMatch) {
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

        const hashedNueva = await bcrypt.hash(contrasenaNueva, 10);
        await dbRailway.query(
            'UPDATE user SET contrasena = ? WHERE correo = ?',
            [hashedNueva, tokenData[0].email]
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

router.get('/plantaEnLineaCedulaNombreActivos', async (req, res) => {

    const usuarioToken = req.validarToken?.usuario || null;

    try {
        const [rows] = await dbRailway.query("SELECT nit, nombre, perfil FROM plantaenlinea WHERE perfil <> 'RETIRADO'");

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'plantaEnLineaCedulaNombreActivos',
            accion: 'Consulta planta en linea exitosa',
            detalle: `Se consultó ${rows.length} registros`,
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
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
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

    const usuarioToken = req.validarToken.usuario

    try {
        const [rows] = await dbRailway.query("SELECT * FROM registros_ubicacion_usuarios");

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'ubicacionUsuarios',
            accion: 'Consulta ubicacion de usuarios exitosa',
            detalle: `Se consultó ${rows.length} registros`,
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
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
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

        const usuarioToken = req.validarToken?.usuario;
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'ubicacionUsuarios',
            accion: 'Sincronización de ubicaciones exitosa',
            detalle: `Se sincronizaron ${syncedIds.length} registros de ubicación`,
            datos: { cantidad: syncedIds.length },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Sincronización completada`,
            `Se han sin sincronizado ${syncedIds.length} registros.`,
            { syncedIds }
        );

    } catch (err) {
        const usuarioToken = req.validarToken?.usuario;
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'ubicacionUsuarios',
            accion: 'Error al sincronizar ubicaciones',
            detalle: 'Error interno del servidor',
            datos: { error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.get('/plantaenlinea', validarToken, async (req, res) => {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || "";

    if (page < 1) page = 1;
    if (limit === -1 || req.query.limit === 'all' || req.query.limit === '-1') {
        limit = 100000;
    } else if (limit < 1 || limit > 200) {
        limit = 50;
    }
    const offset = (page - 1) * limit;

    try {
        let countQuery = "SELECT COUNT(*) as total FROM plantaenlinea";
        let selectQuery = "SELECT * FROM plantaenlinea";
        const countParams = [];
        const selectParams = [];
        const whereClauses = [];

        if (search) {
            const searchPattern = `%${search}%`;
            whereClauses.push("(nit LIKE ? OR nombre LIKE ? OR cargo LIKE ? OR ciudad LIKE ?)");
            countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
            selectParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        const colFilters = ["nit", "nombre", "ciudad", "cargo", "perfil", "f_ingreso", "f_retiro"];
        colFilters.forEach(col => {
            if (req.query[col]) {
                whereClauses.push(`${col} LIKE ?`);
                const val = `%${req.query[col]}%`;
                countParams.push(val);
                selectParams.push(val);
            }
        });

        if (whereClauses.length > 0) {
            const whereStr = " WHERE " + whereClauses.join(" AND ");
            countQuery += whereStr;
            selectQuery += whereStr;
        }

        selectQuery += " LIMIT ? OFFSET ?";
        selectParams.push(limit, offset);

        const [countResult] = await dbRailway.query(countQuery, countParams);
        const total = countResult[0].total;

        const [rows] = await dbRailway.query(selectQuery, selectParams);

        const usuarioToken = req.validarToken?.usuario;
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'plantaenlinea',
            accion: 'Consulta planta en línea exitosa',
            detalle: `Se obtuvieron ${rows.length} registros de planta en línea (pag ${page})`,
            datos: { page, limit, search },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Consulta exitosa", "Se obtuvo la planta en línea correctamente.", {
            data: rows,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error("Error al obtener plantaenlinea:", err);
        const usuarioToken = req.validarToken?.usuario;
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'plantaenlinea',
            accion: 'Error al obtener planta en línea',
            detalle: 'Error interno del servidor',
            datos: { error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener planta en línea", err);
    }
});

router.get('/users', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken?.usuario;
    try {
        try {
            await syncAllUsers();
        } catch (syncErr) {
            console.error('Error al sincronizar usuarios en GET /users:', syncErr);
        }

        const [rows] = await dbRailway.query('SELECT id, cedula, correo, nombre, rol, telefono, contrasena, habilitado FROM user');

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'users',
            accion: 'Consulta de usuarios exitosa',
            detalle: `Se obtuvieron ${rows.length} registros de usuarios`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Consulta exitosa", "Se obtuvieron los usuarios correctamente.", rows);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'users',
            accion: 'Error al consultar usuarios',
            detalle: 'Error interno del servidor',
            datos: { error: err.message },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado al consultar usuarios", err);
    }
});

router.post('/users', validarToken, async (req, res) => {
    const { nombre, correo, cedula, rol, telefono, contrasena } = req.body;
    const usuarioToken = req.validarToken?.usuario;

    if (!nombre || !correo || !cedula || !rol || !telefono || !contrasena) {
        return sendError(res, 400, "Faltan campos obligatorios: nombre, correo, cedula, rol, telefono o contrasena.");
    }

    try {
        const [existentes] = await dbRailway.query(
            'SELECT * FROM user WHERE cedula = ? OR correo = ?',
            [cedula, correo]
        );

        if (existentes.length > 0) {
            const esCedula = existentes.some(u => u.cedula === cedula);
            const msg = esCedula
                ? "Ya existe un usuario registrado con esa cédula."
                : "Ya existe un usuario registrado con ese correo electrónico.";
            return sendError(res, 400, msg);
        }

        const hashedPassword = await bcrypt.hash(contrasena, 10);
        const [result] = await dbRailway.query(
            'INSERT INTO user (nombre, correo, cedula, rol, telefono, contrasena) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, correo, cedula, rol, telefono, hashedPassword]
        );

        const nuevoUsuarioId = result.insertId;

        await dbRailway.query(
            'INSERT IGNORE INTO pages_per_user (cedula) VALUES (?)',
            [cedula]
        );

        try {
            await syncSingleUser(cedula);
        } catch (syncErr) {
            console.error('Error al sincronizar habilitado en POST /users:', syncErr);
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'users',
            accion: 'Creación de usuario exitosa',
            detalle: `Se creó el usuario ${nombre} con cédula ${cedula}`,
            datos: { nombre, correo, cedula, rol, telefono },
            tablasIdsAfectados: [{ tabla: 'user', id: nuevoUsuarioId.toString() }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        const nuevoUsuario = { id: nuevoUsuarioId, nombre, correo, cedula, rol, telefono, contrasena };
        return sendResponse(res, 201, "Usuario creado", "El usuario ha sido creado exitosamente.", nuevoUsuario);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'post',
            endPoint: 'users',
            accion: 'Error al crear usuario',
            detalle: 'Error interno del servidor',
            datos: { error: err.message, body: req.body },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado al crear usuario", err);
    }
});

router.put('/users/:id', validarToken, async (req, res) => {
    const { id } = req.params;
    const { nombre, correo, cedula, rol, telefono, contrasena } = req.body;
    const usuarioToken = req.validarToken?.usuario;

    if (!nombre || !correo || !cedula || !rol || !telefono) {
        return sendError(res, 400, "Faltan campos obligatorios: nombre, correo, cedula, rol o telefono.");
    }

    try {
        const [existentes] = await dbRailway.query('SELECT * FROM user WHERE id = ?', [id]);
        if (existentes.length === 0) {
            return sendError(res, 404, "Usuario no encontrado.");
        }

        const usuarioOriginal = existentes[0];

        const [duplicados] = await dbRailway.query(
            'SELECT * FROM user WHERE (cedula = ? OR correo = ?) AND id != ?',
            [cedula, correo, id]
        );

        if (duplicados.length > 0) {
            const esCedula = duplicados.some(u => u.cedula === cedula);
            const msg = esCedula
                ? "Ya existe otro usuario registrado con esa cédula."
                : "Ya existe otro usuario registrado con ese correo electrónico.";
            return sendError(res, 400, msg);
        }

        if (contrasena && contrasena.trim() !== "") {
            const isBcrypt = typeof contrasena === 'string' && contrasena.startsWith('$2') && contrasena.length === 60;
            const passwordToSave = isBcrypt ? contrasena : await bcrypt.hash(contrasena, 10);

            await dbRailway.query(
                'UPDATE user SET nombre = ?, correo = ?, contrasena = ?, cedula = ?, rol = ?, telefono = ? WHERE id = ?',
                [nombre, correo, passwordToSave, cedula, rol, telefono, id]
            );
        } else {
            await dbRailway.query(
                'UPDATE user SET nombre = ?, correo = ?, cedula = ?, rol = ?, telefono = ? WHERE id = ?',
                [nombre, correo, cedula, rol, telefono, id]
            );
        }

        if (usuarioOriginal.cedula !== cedula) {
            const [pages] = await dbRailway.query('SELECT * FROM pages_per_user WHERE cedula = ?', [usuarioOriginal.cedula]);
            if (pages.length > 0) {
                await dbRailway.query(
                    'UPDATE pages_per_user SET cedula = ? WHERE cedula = ?',
                    [cedula, usuarioOriginal.cedula]
                );
            } else {
                await dbRailway.query(
                    'INSERT IGNORE INTO pages_per_user (cedula) VALUES (?)',
                    [cedula]
                );
            }
        }

        try {
            await syncSingleUser(cedula);
        } catch (syncErr) {
            console.error('Error al sincronizar habilitado en PUT /users/:id:', syncErr);
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'put',
            endPoint: 'users/:id',
            accion: 'Actualización de usuario exitosa',
            detalle: `Se actualizó el usuario ${nombre} con ID ${id}`,
            datos: { nombre, correo, cedula, rol, telefono },
            tablasIdsAfectados: [{ tabla: 'user', id: id.toString() }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        const usuarioActualizado = { id, nombre, correo, cedula, rol, telefono, contrasena };
        return sendResponse(res, 200, "Usuario actualizado", "El usuario ha sido actualizado exitosamente.", usuarioActualizado);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'put',
            endPoint: 'users/:id',
            accion: 'Error al actualizar usuario',
            detalle: 'Error interno del servidor',
            datos: { error: err.message, id, body: req.body },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado al actualizar usuario", err);
    }
});

router.delete('/users/:id', validarToken, async (req, res) => {
    const { id } = req.params;
    const usuarioToken = req.validarToken?.usuario;

    try {
        const [existentes] = await dbRailway.query('SELECT * FROM user WHERE id = ?', [id]);
        if (existentes.length === 0) {
            return sendError(res, 404, "Usuario no encontrado.");
        }

        const usuario = existentes[0];

        if (usuario.cedula === usuarioToken?.cedula) {
            return sendError(res, 400, "No puedes eliminar tu propio usuario.");
        }

        await dbRailway.query('DELETE FROM user WHERE id = ?', [id]);

        if (usuario.cedula) {
            await dbRailway.query('DELETE FROM pages_per_user WHERE cedula = ?', [usuario.cedula]);
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'delete',
            endPoint: 'users/:id',
            accion: 'Eliminación de usuario exitosa',
            detalle: `Se eliminó el usuario ${usuario.nombre} con cédula ${usuario.cedula} e ID ${id}`,
            datos: { id, cedula: usuario.cedula, nombre: usuario.nombre },
            tablasIdsAfectados: [{ tabla: 'user', id: id.toString() }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Usuario eliminado", "El usuario ha sido eliminado exitosamente.", { id });
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'delete',
            endPoint: 'users/:id',
            accion: 'Error al eliminar usuario',
            detalle: 'Error interno del servidor',
            datos: { error: err.message, id },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado al eliminar usuario", err);
    }
});

router.get('/pages/schema', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken?.usuario;
    try {
        const [columns] = await dbRailway.query('SHOW COLUMNS FROM pages_per_user');
        const pages = columns
            .map(col => col.Field)
            .filter(field => field !== 'id' && field !== 'cedula');

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'pages/schema',
            accion: 'Consulta esquema de páginas exitosa',
            detalle: `Se obtuvieron ${pages.length} columnas de páginas`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Esquema de páginas obtenido", "Se obtuvieron las páginas existentes.", pages);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'pages/schema',
            accion: 'Error al obtener esquema de páginas',
            detalle: 'Error interno del servidor',
            datos: { error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener esquema de páginas", err);
    }
});

router.get('/pages/all', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken?.usuario;
    try {
        const [rows] = await dbRailway.query('SELECT * FROM pages_per_user');

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'pages/all',
            accion: 'Consulta de todos los permisos exitosa',
            detalle: `Se obtuvieron permisos de ${rows.length} usuarios`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Todos los permisos obtenidos", "Se obtuvieron los permisos de todos los usuarios.", rows);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'pages/all',
            accion: 'Error al obtener todos los permisos',
            detalle: 'Error interno del servidor',
            datos: { error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener todos los permisos", err);
    }
});

router.get('/pages/user/:cedula', validarToken, async (req, res) => {
    const { cedula } = req.params;
    const usuarioToken = req.validarToken?.usuario;
    try {
        const [rows] = await dbRailway.query('SELECT * FROM pages_per_user WHERE cedula = ?', [cedula]);
        if (rows.length === 0) {
            await dbRailway.query('INSERT IGNORE INTO pages_per_user (cedula) VALUES (?)', [cedula]);
            const [newRows] = await dbRailway.query('SELECT * FROM pages_per_user WHERE cedula = ?', [cedula]);

            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'get',
                endPoint: 'pages/user/:cedula',
                accion: 'Consulta páginas de usuario exitosa (nuevo registro creado)',
                detalle: `Se creó y consultó el registro de páginas para la cédula ${cedula}`,
                datos: { cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(res, 200, "Páginas del usuario", "Se obtuvieron las páginas asociadas al usuario.", newRows[0] || {});
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'pages/user/:cedula',
            accion: 'Consulta páginas de usuario exitosa',
            detalle: `Se consultaron los permisos de páginas para la cédula ${cedula}`,
            datos: { cedula },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Páginas del usuario", "Se obtuvieron las páginas asociadas al usuario.", rows[0]);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'pages/user/:cedula',
            accion: 'Error al obtener páginas del usuario',
            detalle: 'Error interno del servidor',
            datos: { cedula, error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener páginas del usuario", err);
    }
});

router.put('/pages/user/:cedula', validarToken, async (req, res) => {
    const { cedula } = req.params;
    const fields = req.body;
    const usuarioToken = req.validarToken?.usuario;

    if (!fields || Object.keys(fields).length === 0) {
        return sendError(res, 400, "No se proporcionaron campos para actualizar.");
    }

    try {
        const [existing] = await dbRailway.query('SELECT * FROM pages_per_user WHERE cedula = ?', [cedula]);
        if (existing.length === 0) {
            await dbRailway.query('INSERT IGNORE INTO pages_per_user (cedula) VALUES (?)', [cedula]);
        }

        const columns = Object.keys(fields);
        const values = Object.values(fields);
        const setClause = columns.map(col => `${col} = ?`).join(', ');
        values.push(cedula);

        const sql = `UPDATE pages_per_user SET ${setClause} WHERE cedula = ?`;
        await dbRailway.query(sql, values);

        const [updated] = await dbRailway.query('SELECT * FROM pages_per_user WHERE cedula = ?', [cedula]);

        try {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'put',
                endPoint: 'pages/user/:cedula',
                accion: 'Actualización de permisos de páginas',
                detalle: `Se actualizaron los permisos para la cédula ${cedula}`,
                datos: fields,
                tablasIdsAfectados: [{ tabla: 'pages_per_user', id: updated[0]?.id?.toString() || '0' }],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });
        } catch (histErr) { }

        return sendResponse(res, 200, "Permisos actualizados", "Los permisos de páginas se han guardado correctamente.", updated[0]);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'put',
            endPoint: 'pages/user/:cedula',
            accion: 'Error al actualizar permisos de páginas',
            detalle: 'Error interno del servidor',
            datos: { cedula, error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al actualizar permisos de páginas", err);
    }
});

router.put('/pages/page-key/bulk', validarToken, async (req, res) => {
    const { pageKey, value } = req.body;
    const usuarioToken = req.validarToken?.usuario;

    if (!pageKey || (value !== 0 && value !== 1)) {
        return sendError(res, 400, "Parámetros inválidos.");
    }

    try {
        const sql = `UPDATE pages_per_user SET ${pageKey} = ?`;
        await dbRailway.query(sql, [value]);

        try {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'put',
                endPoint: 'pages/page-key/bulk',
                accion: 'Actualización masiva de permisos de página',
                detalle: `Se actualizó el permiso de la página ${pageKey} a ${value} para todos los usuarios.`,
                datos: { pageKey, value },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });
        } catch (histErr) { }

        return sendResponse(res, 200, "Permisos masivos actualizados", `Se actualizó la página para todos los usuarios.`);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'put',
            endPoint: 'pages/page-key/bulk',
            accion: 'Error al actualizar permisos masivos de página',
            detalle: 'Error interno del servidor',
            datos: { pageKey, value, error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al actualizar permisos de página masivos", err);
    }
});

// --- ENDPOINTS PARA ROLES POR APLICATIVO ---

router.get('/roles/tables', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken?.usuario;
    try {
        const [rows] = await dbRailway.query("SHOW TABLES LIKE 'rol_%'");
        const tables = rows.map(row => Object.values(row)[0]);

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'roles/tables',
            accion: 'Consulta tablas de roles exitosa',
            detalle: `Se obtuvieron ${tables.length} tablas de roles`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Tablas de roles obtenidas", "Se obtuvieron las tablas de roles correctamente.", tables);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'roles/tables',
            accion: 'Error al obtener tablas de roles',
            detalle: 'Error interno del servidor',
            datos: { error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener tablas de roles", err);
    }
});

async function getPagePermissionColumn(tableName) {
    const cleanTableName = tableName.replace(/^rol_/i, '');
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');
    const targetNormalized = normalize(cleanTableName);

    try {
        const [columns] = await dbRailway.query('SHOW COLUMNS FROM pages_per_user');
        const dbColumns = columns.map(col => col.Field);

        for (const col of dbColumns) {
            if (col === 'id' || col === 'cedula') continue;
            const cleanCol = col.replace(/^(aplicativos|facturacion|productividad|indicadores|hseq|puntuacion|operacion|logistica|administracion|parqueAutomotor|gestionHumana)/i, '');
            if (normalize(cleanCol) === targetNormalized) {
                return col;
            }
        }
    } catch (err) {
        console.error("Error al obtener columnas de pages_per_user:", err);
    }

    // Fallback dinámico si no hay match exacto en DB
    let camel = cleanTableName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    return 'aplicativos' + camel;
}

router.get('/roles/table/:tableName', validarToken, async (req, res) => {
    const { tableName } = req.params;
    const tableNameRegex = /^rol_[a-zA-Z0-9_]+$/;
    if (!tableNameRegex.test(tableName)) {
        return sendError(res, 400, "Nombre de tabla inválido.");
    }

    try {
        const pageCol = await getPagePermissionColumn(tableName);

        // Verificar si la columna del permiso existe en pages_per_user
        const [colCheck] = await dbRailway.query(`SHOW COLUMNS FROM pages_per_user LIKE ?`, [pageCol]);
        let allowedCedulas = [];

        if (colCheck.length > 0) {
            // Eliminar de la tabla rol_ a aquellos usuarios que no tienen permiso (0, NULL o no tienen registro)
            const [toDelete] = await dbRailway.query(`
                SELECT r.cedula 
                FROM ${tableName} r
                LEFT JOIN pages_per_user p ON r.cedula = p.cedula
                WHERE p.cedula IS NULL OR p.${pageCol} = 0 OR p.${pageCol} IS NULL
            `);

            if (toDelete.length > 0) {
                const cedulasToDelete = toDelete.map(row => row.cedula).filter(Boolean);
                if (cedulasToDelete.length > 0) {
                    await dbRailway.query(`DELETE FROM ${tableName} WHERE cedula IN (?)`, [cedulasToDelete]);
                }
            }

            // Obtener cédulas de usuarios con permiso activo (1)
            const [allowedRows] = await dbRailway.query(`SELECT cedula FROM pages_per_user WHERE ${pageCol} = 1`);
            allowedCedulas = allowedRows.map(row => String(row.cedula));
        } else {
            // Fallback en caso de que la columna de permisos no exista en pages_per_user
            const [allUsers] = await dbRailway.query(`SELECT cedula FROM user`);
            allowedCedulas = allUsers.map(row => String(row.cedula));
        }

        const [columns] = await dbRailway.query(`SHOW COLUMNS FROM ${tableName}`);
        const modules = columns
            .map(col => col.Field)
            .filter(field => field !== 'id' && field !== 'cedula');

        const [rows] = await dbRailway.query(`SELECT * FROM ${tableName}`);

        const usuarioToken = req.validarToken?.usuario;
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'roles/table/:tableName',
            accion: 'Consulta datos de tabla de roles exitosa',
            detalle: `Se consultó la tabla ${tableName} con ${rows.length} registros`,
            datos: { tableName },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Datos de roles obtenidos", "Se obtuvieron columnas y registros correctamente.", {
            columns: modules,
            data: rows,
            allowedCedulas: allowedCedulas
        });
    } catch (err) {
        const usuarioToken = req.validarToken?.usuario;
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'get',
            endPoint: 'roles/table/:tableName',
            accion: 'Error al obtener datos de tabla de roles',
            detalle: 'Error interno del servidor',
            datos: { tableName, error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, `Error al obtener datos de la tabla ${tableName}`, err);
    }
});

router.put('/roles/update', validarToken, async (req, res) => {
    const { tableName, cedula, column, permissions } = req.body;
    const usuarioToken = req.validarToken?.usuario;

    const tableNameRegex = /^rol_[a-zA-Z0-9_]+$/;
    const columnNameRegex = /^[a-zA-Z0-9_]+$/;

    if (!tableName || !cedula || !column || !permissions) {
        return sendError(res, 400, "Faltan campos obligatorios: tableName, cedula, column o permissions.");
    }

    if (!tableNameRegex.test(tableName)) {
        return sendError(res, 400, "Nombre de tabla inválido.");
    }

    if (!columnNameRegex.test(column)) {
        return sendError(res, 400, "Nombre de columna inválido.");
    }

    let permissionsObj = permissions;
    if (typeof permissions === 'string') {
        try {
            permissionsObj = JSON.parse(permissions);
        } catch (e) {
            permissionsObj = {};
        }
    }

    const normalized = {
        c: String(permissionsObj?.c === "1" || permissionsObj?.c === 1 || permissionsObj?.c === true ? "1" : "0"),
        r: String(permissionsObj?.r === "1" || permissionsObj?.r === 1 || permissionsObj?.r === true ? "1" : "0"),
        u: String(permissionsObj?.u === "1" || permissionsObj?.u === 1 || permissionsObj?.u === true ? "1" : "0"),
        d: String(permissionsObj?.d === "1" || permissionsObj?.d === 1 || permissionsObj?.d === true ? "1" : "0")
    };

    try {
        let columnsToUpdate = [column];
        if (column === 'all') {
            const [colsResult] = await dbRailway.query(`SHOW COLUMNS FROM ${tableName}`);
            columnsToUpdate = colsResult
                .map(col => col.Field)
                .filter(field => field !== 'id' && field !== 'cedula');
        }

        if (columnsToUpdate.length === 0) {
            return sendError(res, 400, "No se encontraron columnas válidas para actualizar.");
        }

        const [existing] = await dbRailway.query(`SELECT * FROM ${tableName} WHERE cedula = ?`, [cedula]);
        const permString = JSON.stringify(normalized);

        if (existing.length > 0) {
            const setClause = columnsToUpdate.map(col => `${col} = ?`).join(', ');
            const updateValues = [...columnsToUpdate.map(() => permString), cedula];
            await dbRailway.query(`UPDATE ${tableName} SET ${setClause} WHERE cedula = ?`, updateValues);
        } else {
            const columnsList = ['cedula', ...columnsToUpdate].join(', ');
            const placeholders = ['?', ...columnsToUpdate.map(() => '?')].join(', ');
            const insertValues = [cedula, ...columnsToUpdate.map(() => permString)];
            await dbRailway.query(`INSERT INTO ${tableName} (${columnsList}) VALUES (${placeholders})`, insertValues);
        }

        try {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'usuarios',
                metodo: 'put',
                endPoint: 'roles/update',
                accion: 'Actualización de rol de aplicativo',
                detalle: `Se actualizó el rol en ${tableName} para la columna ${column} y cédula ${cedula}`,
                datos: { tableName, cedula, column, permissions: normalized },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });
        } catch (histErr) { }

        return sendResponse(res, 200, "Permisos actualizados", "Los permisos de rol del aplicativo se han guardado correctamente.");
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'usuarios',
            metodo: 'put',
            endPoint: 'roles/update',
            accion: 'Error al actualizar rol de aplicativo',
            detalle: 'Error interno del servidor',
            datos: { tableName, cedula, column, error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al actualizar los permisos de rol del aplicativo", err);
    }
});

module.exports = router;
