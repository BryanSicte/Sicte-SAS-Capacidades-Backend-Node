const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const sendEmail = require('../utils/mailer');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

router.get('/users', async (req, res) => {
    try {
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

router.post('/users', async (req, res) => {
    const { nombre, correo, cedula, rol, telefono, contrasena } = req.body;

    if (!nombre || !correo || !cedula || !rol || !telefono || !contrasena) {
        return res.status(400).json({ message: 'Faltan campos requeridos: nombre, correo, cedula, rol, telefono o contraseña' });
    }

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(contrasena, saltRounds);

        const [result] = await dbRailway.query(
            'INSERT INTO user (nombre, correo, cedula, rol, telefono, contrasena) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [nombre, correo, cedula, rol, telefono, hashedPassword]
        );

        const nuevoUsuario = {
            id,
            nombre,
            correo,
            cedula,
            rol,
            telefono
        };

        return res.status(201).json(nuevoUsuario);

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
        const [rows] = await dbRailway.query(
            'SELECT * FROM user WHERE correo = ?',
            [correo]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const usuario = rows[0];

        if (usuario.contrasena !== contrasena) {
            return res.status(401).json({ message: 'Contraseña incorrecta' });
        }

        return res.status(200).json(usuario);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});


router.post('/loginV2', async (req, res) => {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
        return res.status(400).json({ message: 'Correo y contraseña son requeridos' });
    }

    try {
        const [rows] = await dbRailway.query(
            'SELECT * FROM user WHERE correo = ?',
            [correo]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const usuario = rows[0];

        if (usuario.contrasena !== contrasena) {
            return res.status(401).json({ message: 'Contraseña incorrecta' });
        }

        const [pages] = await dbRailway.query(
            'SELECT * FROM pages_per_user WHERE cedula = ?',
            [usuario.cedula]
        );

        const page = pages[0];

        const token = generateToken();
        const expiryDate = calculateExpiryDate(1440);

        await dbRailway.query(
            `INSERT INTO tokens (cedula, email, token, expiryDate)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                email = VALUES(email),
                token = VALUES(token),
                expiryDate = VALUES(expiryDate)`,
            [usuario.cedula, usuario.email, token, expiryDate]
        );

        const [tokenUserDB] = await dbRailway.query(
            'SELECT * FROM tokens WHERE token = ?',
            [token]
        );

        const tokenUser = tokenUserDB[0];

        return res.status(200).json({
            usuario,
            page,
            tokenUser
        });

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

        await dbRailway.query(
            'UPDATE user SET nombre = ?, correo = ?, contrasena = ?, cedula = ?, rol = ?, telefono = ? WHERE id = ?',
            [nombre, correo, contrasena, cedula, rol, telefono, id]
        );

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

        // Actualizamos la contraseña
        await dbRailway.query(
            'UPDATE user SET contrasena = ? WHERE correo = ?',
            [contrasena, correo]
        );

        return res.status(200).json({ message: 'Contraseña actualizada correctamente' });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error al actualizar la contraseña' });
    }
});

router.get('/pagesUser', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM pages_per_user');
        res.status(200).json(rows);
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
        console.error(err);
        res.status(500).send('Error validando el token');
    }
});

function generateToken() {
    return crypto.randomBytes(20).toString('hex');
}

function calculateExpiryDate(minutes) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    return now;
}

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

module.exports = router;
