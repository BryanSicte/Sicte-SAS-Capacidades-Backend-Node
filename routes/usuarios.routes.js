const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const sendEmail = require('../utils/mailer');
const { sendResponse, sendError } = require('../utils/responseHandler');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const validarToken = require('../middlewares/validarToken');
const { syncAllUsers } = require('../services/usuarioSyncService');

router.get('/users', async (req, res) => {
    try {
        try {
            await syncAllUsers();
        } catch (syncErr) {
            console.error('Error al sincronizar usuarios en GET /users:', syncErr);
        }

        const [rows] = await dbRailway.query('SELECT * FROM user');

        return res.status(200).json(rows);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.get('/users/id/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await dbRailway.query('SELECT * FROM user WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        return res.status(200).json(rows[0]);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
        return res.status(400).json({ message: 'Correo y contraseña son requeridos' });
    }

    try {
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
            console.error('Error al sincronizar habilitado en login (v1):', syncErr);
        }

        const [rows] = await dbRailway.query(
            'SELECT * FROM user WHERE correo = ?',
            [correo]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const usuario = rows[0];

        if (usuario.habilitado === 0 && usuario.correo !== 'invitado@sicte.com' && usuario.cedula !== '0000') {
            return res.status(403).json({ message: 'Usuario inhabilitado o retirado de la planta' });
        }

        let isMatch = false;
        if (usuario.contrasena && usuario.contrasena.startsWith('$2') && usuario.contrasena.length === 60) {
            isMatch = await bcrypt.compare(contrasena, usuario.contrasena);
        } else {
            isMatch = (usuario.contrasena === contrasena);
        }

        if (!isMatch) {
            return res.status(401).json({ message: 'Contraseña incorrecta' });
        }

        return res.status(200).json(usuario);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, correo, cedula, rol, telefono, contrasena } = req.body;

    try {
        const [existingUserRows] = await dbRailway.query(
            'SELECT * FROM user WHERE id = ?',
            [id]
        );

        if (existingUserRows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
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

        const [updatedUserRows] = await dbRailway.query(
            'SELECT * FROM user WHERE id = ?',
            [id]
        );

        return res.status(200).json(updatedUserRows[0]);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [existingUserRows] = await dbRailway.query(
            'SELECT * FROM user WHERE id = ?',
            [id]
        );

        if (existingUserRows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        await dbRailway.query(
            'DELETE FROM user WHERE id = ?',
            [id]
        );

        return res.sendStatus(204);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post('/actualizarContrasena', async (req, res) => {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
        return res.status(400).json({ message: 'correo y contraseña son requeridos' });
    }

    try {
        const [rows] = await dbRailway.query(
            'SELECT * FROM user WHERE correo = ?',
            [correo]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const hashedPassword = await bcrypt.hash(contrasena, 10);
        await dbRailway.query(
            'UPDATE user SET contrasena = ? WHERE correo = ?',
            [hashedPassword, correo]
        );

        return res.status(200).json({ message: 'Contraseña actualizada correctamente' });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error al actualizar la contraseña' });
    }
});

router.post('/pagesUser', async (req, res) => {
    const { cedula } = req.body;

    try {
        const [rows] = await dbRailway.query('SELECT * FROM pages_per_user where cedula = ?', [cedula]);

        // Convertir campos BIT(1) (Buffer) a "1" o "0"
        const converted = rows.map(row => {
            const result = {};
            for (const [key, value] of Object.entries(row)) {
                if (Buffer.isBuffer(value)) {
                    result[key] = value[0] === 1 ? '1' : '0';
                } else {
                    result[key] = value;
                }
            }
            return result;
        });

        res.status(200).json(converted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/pagesUser/:id', async (req, res) => {
    const { id } = req.params;
    const fields = req.body;

    try {
        const [existingRows] = await dbRailway.query(
            'SELECT * FROM pages_per_user WHERE id = ?',
            [id]
        );

        if (existingRows.length === 0) {
            return res.status(404).json({ message: 'Registro no encontrado' });
        }

        const columns = Object.keys(fields);
        const values = Object.values(fields);

        const setClause = columns.map(col => `${col} = ?`).join(', ');

        values.push(id);

        const sql = `UPDATE pages_per_user SET ${setClause} WHERE id = ?`;

        await dbRailway.query(sql, values);

        const [updatedRows] = await dbRailway.query(
            'SELECT * FROM pages_per_user WHERE id = ?',
            [id]
        );

        res.status(200).json(updatedRows[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/tokens', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM tokens');
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/validarToken', async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).send('Token requerido.');
    }

    try {
        const [rows] = await dbRailway.query(
            'SELECT * FROM tokens WHERE token = ?',
            [token]
        );

        if (rows.length === 0) {
            return res.send('Token inválido.');
        }

        const resetToken = rows[0];
        const expiracion = new Date(resetToken.expiryDate);

        if (expiracion < new Date()) {
            return res.send('Token expirado');
        }

        return res.send('Token válido');
    } catch (err) {
        return sendError(res, 500, "Error inesperado", err);
    }
});

router.post('/enviarToken', async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).send('Email requerido.');

    const token = generateToken();
    const expiryDate = calculateExpiryDate(30);

    try {
        await dbRailway.query(
            'INSERT INTO tokens (token, email, expiryDate) VALUES (?, ?, ?)',
            [token, email, expiryDate]
        );

        const resetLink = `https://sictepowergmail.github.io/ReportingCenter/#/RecuperarContrasena?token=${token}`;
        const mensaje = `Haz clic en el siguiente enlace para restablecer tu contraseña:\n${resetLink}`;

        await sendEmail(email, 'Restablecer Contraseña', mensaje);

        res.send('Correo enviado exitosamente.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al guardar el token.');
    }
});

router.get('/relacionPersonal', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM relacion_personal');

        return res.status(200).json(rows);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.get('/plantaEnLineaCedulaNombre', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT nit, nombre FROM plantaenlinea');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});





function generateToken() {
    return crypto.randomBytes(20).toString('hex');
}

function calculateExpiryDate(minutes) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    return now.toISOString();
}

router.post('/loginV2', async (req, res) => {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
        return sendError(res, 400, "Correo y contraseña son requeridos.");
    }

    try {
        const [rows] = await dbRailway.query(
            'SELECT * FROM user WHERE correo = ?',
            [correo]
        );

        if (rows.length === 0) {
            return sendError(res, 400, "Usuario no encontrado.");
        }

        const usuario = rows[0];

        if (usuario.contrasena !== contrasena) {
            return sendError(res, 400, "Contraseña incorrecta.");
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


router.get('/usersV2', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM user');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de usuarios.`,
            rows
        );

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post('/users', validarToken, async (req, res) => {
    const { nombre, correo, cedula, rol, telefono, contrasena } = req.body;

    if (!nombre || !correo || !cedula || !rol || !telefono || !contrasena) {
        return sendError(res, 400, "Faltan campos requeridos: nombre, correo, cedula, rol, telefono o contraseña.");
    }

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(contrasena, saltRounds);

        const [result] = await dbRailway.query(
            'INSERT INTO user (nombre, correo, cedula, rol, telefono, contrasena) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, correo, cedula, rol, telefono, hashedPassword]
        );

        const nuevoUsuario = {
            id: result.insertId,
            nombre,
            correo,
            cedula,
            rol,
            telefono
        };

        return sendResponse(
            res,
            201,
            'Usuario creado correctamente',
            `El nuevo usuario ${nuevoUsuario.nombre || 'usuario'} ha sido registrado con éxito.`,
            nuevoUsuario
        );

    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.get('/plantaEnLineaCedulaNombreV2', validarToken, async (req, res) => {
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
        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.get('/ubicacionUsuarios', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query("SELECT * FROM registros_ubicacion_usuarios");
        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de ubicacion de usuarios.`,
            rows
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.post('/ubicacionUsuarios', validarToken, async (req, res) => {
    const data = req.body;

    if (!data.fechaToma || !data.cedulaUsuario || !data.nombreUsuario || !data.latitud || !data.longitud || !data.origen) {
        return sendError(res, 400, "Faltan campos requeridos: fechaToma, cedulaUsuario, nombreUsuario, latitud, longitud o origen.");
    }

    try {

        if (!data || Object.keys(data).length === 0) {
            return sendError(res, 400, "Los datos del registro son requeridos.");
        }

        const keys = Object.keys(data);
        const values = Object.values(data);

        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO registros_ubicacion_usuarios (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM registros_ubicacion_usuarios WHERE id = ?', [result.insertId]);

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

module.exports = router;
