const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const multer = require('multer');
const path = require('path');
const { uploadFile, getFileByName } = require('../services/googleDriveService');
const fs = require('fs');

const folderId = '1514Cz3GVufGhvpKo7pWiPXCPAzmJCC9p';

router.get('/registros', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_supervision');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/registrosFechaPlaca', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT placa, fecha FROM registros_supervision');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/crearRegistro', async (req, res) => {

    try {
        const data = req.body;

        const keys = Object.keys(data);
        const values = Object.values(data);

        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO registros_supervision (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM registros_supervision WHERE id = ?', [result.insertId]);
        res.status(201).json(registroGuardado[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const uploadDir = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

router.post('/cargarImagen', upload.single('file'), async (req, res) => {
    const file = req.file;
    const { filename } = req.body;

    if (!file) {
        return res.status(400).json({ error: 'No se ha seleccionado ningún archivo' });
    }

    try {
        const fileId = await uploadFile(file.path, filename, folderId);
        res.status(200).json({ message: 'Archivo subido con éxito', fileId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al subir el archivo' });
    }
});

function getContentType(fileName) {
    if (fileName.endsWith('.png')) return 'image/png';
    if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
    return 'application/octet-stream';
}

router.get('/obtenerImagen', async (req, res) => {
    const { imageName } = req.query;

    if (!imageName) {
        return res.status(400).json({ error: 'Debe proporcionar imageName' });
    }

    try {
        const imageData = await getFileByName(imageName, folderId);

        if (!imageData) {
            return res.status(404).send('Imagen no encontrada');
        }

        const contentType = getContentType(imageName);
        res.set('Content-Type', contentType);
        res.send(imageData);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al obtener la imagen');
    }
});

router.get('/kgprod', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM bodega_kgprod');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/lconsum', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM bodega_lconsum');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/plantaEnLineaCedulaNombre', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT nit, nombre, cargo FROM plantaenlinea');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/ciudades', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM ciudad');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/registrosEnelInspeccionIntegralHse', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_enel_inspeccion_integral_hse');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/crearRegistroEnelInspeccionIntegralHse', async (req, res) => {

    try {
        const data = req.body;

        const keys = Object.keys(data);
        const values = Object.values(data);

        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO registros_enel_inspeccion_integral_hse (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM registros_enel_inspeccion_integral_hse WHERE id = ?', [result.insertId]);
        res.status(201).json(registroGuardado[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/solucionRegistroEnelInspeccionIntegralHse', async (req, res) => {
    try {
        const { id, solucion, inspeccionFinal } = req.body;

        const solucionJSON = JSON.stringify(solucion);

        const query = `
            UPDATE registros_enel_inspeccion_integral_hse SET solucion = ?, inspeccionFinal = ? WHERE id = ?
        `;

        const [result] = await dbRailway.query(query, [solucionJSON, inspeccionFinal, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        const [registroActualizado] = await dbRailway.query(
            'SELECT * FROM registros_enel_inspeccion_integral_hse WHERE id = ?',
            [id]
        );

        res.status(200).json(registroActualizado[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/registrosEnelInspeccionAmbiental', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_enel_inspeccion_ambiental');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/crearRegistrosEnelInspeccionAmbiental', async (req, res) => {

    try {
        const data = req.body;

        const keys = Object.keys(data);
        const values = Object.values(data);

        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO registros_enel_inspeccion_ambiental (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM registros_enel_inspeccion_ambiental WHERE id = ?', [result.insertId]);
        res.status(201).json(registroGuardado[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/solucionRegistroEnelInspeccionAmbiental', async (req, res) => {
    try {
        const { id, solucion, inspeccionFinal } = req.body;

        const solucionJSON = JSON.stringify(solucion);

        const query = `
            UPDATE registros_enel_inspeccion_ambiental SET solucion = ?, inspeccionFinal = ? WHERE id = ?
        `;

        const [result] = await dbRailway.query(query, [solucionJSON, inspeccionFinal, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        const [registroActualizado] = await dbRailway.query(
            'SELECT * FROM registros_enel_inspeccion_ambiental WHERE id = ?',
            [id]
        );

        res.status(200).json(registroActualizado[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/registrosEnelInspeccionBotiquin', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_enel_inspeccion_botiquin');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/crearRegistrosEnelInspeccionBotiquin', async (req, res) => {

    try {
        const data = req.body;

        const keys = Object.keys(data);
        const values = Object.values(data);

        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO registros_enel_inspeccion_botiquin (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM registros_enel_inspeccion_botiquin WHERE id = ?', [result.insertId]);
        res.status(201).json(registroGuardado[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/registrosEnelInspeccionElementosEmergencia', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_enel_inspeccion_elementos_emergencia');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/crearRegistrosEnelInspeccionElementosEmergencia', async (req, res) => {

    try {
        const data = req.body;

        const keys = Object.keys(data);
        const values = Object.values(data);

        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO registros_enel_inspeccion_elementos_emergencia (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM registros_enel_inspeccion_elementos_emergencia WHERE id = ?', [result.insertId]);
        res.status(201).json(registroGuardado[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
