const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const multer = require('multer');
const path = require('path');
const { uploadFile } = require('../services/googleDriveService');
const { getFileByName } = require('../services/googleDriveService');
const fs = require('fs');

const folderId = '1jMD6UqxKbVqY003qb9xo9kND5gjkcmU5';

router.get('/registros', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_solicitud_materiales');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/registrosEntregados', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_solicitud_materiales_entregado');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/cargarDatos', async (req, res) => {
    const {
        fecha,
        cedula,
        nombre,
        ciudad,
        diseño,
        kmz,
        uuid,
        nombreProyecto,
        entregaProyecto,
        propiedadMaterial,
        codigoSapMaterial,
        descripcionMaterial,
        unidadMedidaMaterial,
        cantidadDisponibleMaterial,
        cantidadSolicitadaMaterial,
        cantidadRestantePorDespacho,
        aprobacionAnalista,
        fechaAnalista,
        observacionesAnalista,
        aprobacionDirector,
        fechaDirector,
        observacionesDirector,
        aprobacionDireccionOperacion,
        fechaDireccionOperacion,
        observacionesDireccionOperacion,
        entregaBodega,
        observacionesEntregaBodega,
        pdfs,
        estadoProyecto
    } = req.body;

    try {
        const [result] = await dbRailway.query(`
            INSERT INTO registros_carnetizacion (
                fecha,
                cedula,
                nombre,
                ciudad,
                diseño,
                kmz,
                uuid,
                nombreProyecto,
                entregaProyecto,
                propiedadMaterial,
                codigoSapMaterial,
                descripcionMaterial,
                unidadMedidaMaterial,
                cantidadDisponibleMaterial,
                cantidadSolicitadaMaterial,
                cantidadRestantePorDespacho,
                aprobacionAnalista,
                fechaAnalista,
                observacionesAnalista,
                aprobacionDirector,
                fechaDirector,
                observacionesDirector,
                aprobacionDireccionOperacion,
                fechaDireccionOperacion,
                observacionesDireccionOperacion,
                entregaBodega,
                observacionesEntregaBodega,
                pdfs,
                estadoProyecto
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            fecha,
            cedula,
            nombre,
            ciudad,
            diseño,
            kmz,
            uuid,
            nombreProyecto,
            entregaProyecto,
            propiedadMaterial,
            codigoSapMaterial,
            descripcionMaterial,
            unidadMedidaMaterial,
            cantidadDisponibleMaterial,
            cantidadSolicitadaMaterial,
            cantidadRestantePorDespacho,
            aprobacionAnalista,
            fechaAnalista,
            observacionesAnalista,
            aprobacionDirector,
            fechaDirector,
            observacionesDirector,
            aprobacionDireccionOperacion,
            fechaDireccionOperacion,
            observacionesDireccionOperacion,
            entregaBodega,
            observacionesEntregaBodega,
            pdfs,
            estadoProyecto
        ]);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM registros_solicitud_materiales WHERE id = ?', [result.insertId]);
        res.status(201).json(registroGuardado[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/cargarDatosEntregados', async (req, res) => {
    const {
        fechaEntrega,
        ciudad,
        documento,
        uuid,
        nombreProyecto,
        codigoSapMaterial,
        descripcionMaterial,
        unidadMedidaMaterial,
        cantidadSolicitadaMaterial,
        material
    } = req.body;

    try {
        const [result] = await dbRailway.query(`
            INSERT INTO registros_carnetizacion (
                fechaEntrega,
                ciudad,
                documento,
                uuid,
                nombreProyecto,
                codigoSapMaterial,
                descripcionMaterial,
                unidadMedidaMaterial,
                cantidadSolicitadaMaterial,
                material
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            fechaEntrega,
            ciudad,
            documento,
            uuid,
            nombreProyecto,
            codigoSapMaterial,
            descripcionMaterial,
            unidadMedidaMaterial,
            cantidadSolicitadaMaterial,
            material
        ]);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM registros_solicitud_materiales_entregado WHERE id = ?', [result.insertId]);
        res.status(201).json(registroGuardado[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
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


router.post('/actualizarEstadoCantidadDisponibleMaterial', async (req, res) => {
    const { ids, cantidades } = req.body;

    try {
        if (!Array.isArray(ids) || !Array.isArray(cantidades)) {
            return res.status(400).json({ error: 'Los datos deben ser arrays' });
        }

        if (ids.length !== cantidades.length) {
            return res.status(400).json({ error: 'La cantidad de IDs no coincide con la cantidad de cantidades' });
        }

        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const cantidad = cantidades[i];

            await db.query(
                'UPDATE registros_solicitud_materiales SET cantidadDisponibleMaterial = ? WHERE id = ?',
                [cantidad, id]
            );
        }

        res.status(200).json({ message: 'Estado y cantidades actualizados correctamente' });
    } catch (error) {
        console.error('Error al actualizar:', error);
        res.status(500).json({ error: 'Error al actualizar el estado' });
    }
});




router.post('/actualizarDatos', async (req, res) => {
    const { id, estado } = req.body;

    try {
        const query = `
            UPDATE registros_carnetizacion SET estado = ? WHERE id = ?
        `;

        await dbRailway.query(query, [estado, id]);

        res.status(200).json({ message: 'Datos actualizados correctamente' });
    } catch (error) {
        console.error('❌ Error al actualizar:', error);
        res.status(500).json({ message: 'Error al actualizar el estado' });
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

module.exports = router;
