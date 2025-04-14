const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const multer = require('multer');
const path = require('path');
const { uploadFile } = require('../services/googleDriveService');
const { getFileByName } = require('../services/googleDriveService');
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
    const {
        alturas, 
        alturas_comentario, 
        ats, 
        ats_comentario, 
        cedula_cuadrilla, 
        cortadora, 
        empalmadora, 
        empalmes, 
        empalmes_comentario, 
        epp, 
        epp_comentario, 
        fecha, 
        foto_nombre, 
        latitud, 
        longitud,
        medidor_conductancia, 
        medidor_fugas, 
        nombre,
        nombre_cuadrilla, 
        observacion, 
        onexpert, 
        opm, 
        ot, 
        otdr, 
        pinza, 
        placa, 
        preoperacional, 
        preoperacional_comentario, 
        vehiculo, 
        vehiculo_comentario
    } = req.body;


    try {
        const [result] = await dbRailway.query(`
            INSERT INTO registros_supervision (
                alturas, 
                alturas_comentario, 
                ats, 
                ats_comentario, 
                cedula_cuadrilla, 
                cortadora, 
                empalmadora, 
                empalmes, 
                empalmes_comentario, 
                epp, 
                epp_comentario, 
                fecha, 
                foto_nombre, 
                latitud, 
                longitud,
                medidor_conductancia, 
                medidor_fugas, 
                nombre,
                nombre_cuadrilla, 
                observacion, 
                onexpert, 
                opm, 
                ot, 
                otdr, 
                pinza, 
                placa, 
                preoperacional, 
                preoperacional_comentario, 
                vehiculo, 
                vehiculo_comentario
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            alturas, 
            alturas_comentario, 
            ats, 
            ats_comentario, 
            cedula_cuadrilla, 
            cortadora, 
            empalmadora, 
            empalmes, 
            empalmes_comentario, 
            epp, 
            epp_comentario, 
            fecha, 
            foto_nombre, 
            latitud, 
            longitud,
            medidor_conductancia, 
            medidor_fugas, 
            nombre,
            nombre_cuadrilla, 
            observacion, 
            onexpert, 
            opm, 
            ot, 
            otdr, 
            pinza, 
            placa, 
            preoperacional, 
            preoperacional_comentario, 
            vehiculo, 
            vehiculo_comentario
        ]);

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

module.exports = router;
