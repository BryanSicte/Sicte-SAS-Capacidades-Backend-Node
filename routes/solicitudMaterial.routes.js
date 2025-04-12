const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const multer = require('multer');
const path = require('path');
const { uploadFile } = require('../services/googleDriveService');
const { getFileByName } = require('../services/googleDriveService');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const folderId = "13wCWGhH7UkPJeFA_uciQg_-s_WjBeAnb";

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
            INSERT INTO registros_solicitud_materiales (
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
            INSERT INTO registros_solicitud_materiales (
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


router.post('/actualizarEstadoAnalista', async (req, res) => {
    try {
        const { ids, estado, observacionesTemporal, fechaRegistro } = req.body;

        if (!Array.isArray(ids)) {
            return res.status(400).json({ error: 'El campo "ids" debe ser una lista.' });
        }

        for (const id of ids) {
            await dbRailway.query(
                `UPDATE registros_solicitud_materiales SET 
                aprobacionAnalista = ?, 
                observacionesAnalista = ?, 
                fechaAnalista = ? 
                WHERE id = ?`,
                [estado, observacionesTemporal, fechaRegistro, id]
            );

            if (estado === "Rechazado") {
                await dbRailway.query(
                    `UPDATE registros_solicitud_materiales SET 
                    aprobacionDirector = ?, 
                    observacionesDirector = ?, 
                    fechaDirector = ? 
                    WHERE id = ?`,
                    [estado, null, fechaRegistro, id]
                );

                await dbRailway.query(
                    `UPDATE registros_solicitud_materiales SET 
                    aprobacionDireccionOperacion = ?, 
                    observacionesDireccionOperacion = ?, 
                    fechaDireccionOperacion = ? 
                    WHERE id = ?`,
                    [estado, null, fechaRegistro, id]
                );
            }
        }

        res.status(200).json({ message: "Estado y observaciones actualizados correctamente" });
    } catch (error) {
        console.error("Error al actualizar el estado:", error);
        res.status(500).json({ error: "Error al actualizar el estado" });
    }
});

router.post('/actualizarEstadoDirector', async (req, res) => {
    try {
        const { ids, estado, observacionesTemporal, fechaRegistro } = req.body;

        if (!Array.isArray(ids)) {
            return res.status(400).json({ error: 'El campo "ids" debe ser una lista.' });
        }

        for (const id of ids) {
            await dbRailway.query(
                `UPDATE registros_solicitud_materiales SET 
                aprobacionDirector = ?, 
                observacionesDirector = ?, 
                fechaDirector = ? 
                WHERE id = ?`,
                [estado, observacionesTemporal, fechaRegistro, id]
            );

            if (estado === "Rechazado") {
                await dbRailway.query(
                    `UPDATE registros_solicitud_materiales SET 
                    aprobacionDireccionOperacion = ?, 
                    observacionesDireccionOperacion = ?, 
                    fechaDireccionOperacion = ? 
                    WHERE id = ?`,
                    [estado, null, fechaRegistro, id]
                );
            }
        }

        res.status(200).json({ message: "Estado y observaciones actualizados correctamente" });
    } catch (error) {
        console.error("Error al actualizar el estado:", error);
        res.status(500).json({ error: "Error al actualizar el estado" });
    }
});

router.post('/actualizarEstadoDireccionOperacion', async (req, res) => {
    try {
        const { ids, estado, observacionesTemporal, fechaRegistro } = req.body;

        if (!Array.isArray(ids)) {
            return res.status(400).json({ error: 'El campo "ids" debe ser una lista.' });
        }

        for (const id of ids) {
            await dbRailway.query(
                `UPDATE registros_solicitud_materiales SET 
                aprobacionDireccionOperacion = ?, 
                observacionesDireccionOperacion = ?, 
                fechaDireccionOperacion = ? 
                WHERE id = ?`,
                [estado, observacionesTemporal, fechaRegistro, id]
            );
        }

        res.status(200).json({ message: "Estado y observaciones actualizados correctamente" });
    } catch (error) {
        console.error("Error al actualizar el estado:", error);
        res.status(500).json({ error: "Error al actualizar el estado" });
    }
});

router.post('/actualizarEstadoEntregaBodega', async (req, res) => {
    try {
        const { ids, estado, observacionesTemporal } = req.body;

        if (!Array.isArray(ids)) {
            return res.status(400).json({ error: 'El campo "ids" debe ser una lista.' });
        }

        for (const id of ids) {
            await dbRailway.query(
                `UPDATE registros_solicitud_materiales SET 
                entregaBodega = ?, 
                observacionesEntregaBodega = ?
                WHERE id = ?`,
                [estado, observacionesTemporal, id]
            );
        }

        res.status(200).json({ message: "Estado y observaciones actualizados correctamente" });
    } catch (error) {
        console.error("Error al actualizar el estado:", error);
        res.status(500).json({ error: "Error al actualizar el estado" });
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

            await dbRailway.query(
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

router.post('/actualizarEstadoCantidadRestantePorDespacho', async (req, res) => {
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

            await dbRailway.query(
                'UPDATE registros_solicitud_materiales SET cantidadRestantePorDespacho = ? WHERE id = ?',
                [cantidad, id]
            );
        }

        res.status(200).json({ message: 'Estado y cantidades actualizados correctamente' });
    } catch (error) {
        console.error('Error al actualizar:', error);
        res.status(500).json({ error: 'Error al actualizar el estado' });
    }
});

router.post('/actualizarEstadoEntregaBodegaPDFs', async (req, res) => {
    const { ids, namePdfs } = req.body;

    try {
        if (!Array.isArray(ids) || !Array.isArray(namePdfs)) {
            return res.status(400).json({ error: 'Los datos deben ser arrays' });
        }

        if (ids.length !== namePdfs.length) {
            return res.status(400).json({ error: 'La cantidad de IDs no coincide con la cantidad de nombres' });
        }

        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const namePdf = namePdfs[i];

            await dbRailway.query(
                'UPDATE registros_solicitud_materiales SET pdfs = ? WHERE id = ?',
                [namePdf, id]
            );
        }

        res.status(200).json({ message: 'Estado y cantidades actualizados correctamente' });
    } catch (error) {
        console.error('Error al actualizar:', error);
        res.status(500).json({ error: 'Error al actualizar el estado' });
    }
});

router.post('/actualizarEstadoCierreProyecto', async (req, res) => {
    const { ids, estadoProyecto } = req.body;

    try {
        if (!Array.isArray(ids)) {
            return res.status(400).json({ error: 'Los datos deben ser arrays' });
        }

        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];

            await dbRailway.query(
                'UPDATE registros_solicitud_materiales SET estadoProyecto = ? WHERE id = ?',
                [estadoProyecto, id]
            );
        }

        res.status(200).json({ message: 'Estado y cantidades actualizados correctamente' });
    } catch (error) {
        console.error('Error al actualizar:', error);
        res.status(500).json({ error: 'Error al actualizar el estado' });
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

router.post('/cargarKmz', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).send("No se ha seleccionado ningún archivo");

    try {
        const { filename } = req.body;
        const newFileName = filename.endsWith('.kmz') ? filename : `${filename}.kmz`;

        const fileId = await uploadFile(req.file.path, newFileName, folderId);
        res.send(`Archivo subido con éxito. ID: ${fileId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al subir el archivo");
    }
});

router.post('/cargarDiseno', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).send("No se ha seleccionado ningún archivo");

    try {
        const { filename } = req.body;
        const ext = path.extname(filename);
        const isCompressed = ['.zip', '.rar', '.7z'].includes(ext);
        const newFileName = isCompressed ? filename : `${filename}.zip`;

        const fileId = await uploadFile(req.file.path, newFileName, folderId);
        res.send(`Archivo subido con éxito. ID: ${fileId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al subir el archivo");
    }
});

router.post('/cargarPDF', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).send("No se ha seleccionado ningún archivo");

    try {
        const { filename } = req.body;
        const newFileName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

        const fileId = await uploadFile(req.file.path, newFileName, folderId);
        res.send(`Archivo subido con éxito. ID: ${fileId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al subir el archivo");
    }
});

router.get('/obtenerKmz', async (req, res) => {
    const { fileName } = req.query;

    try {
        const imageData = await getFileByName(fileName, folderId);

        if (!imageData) {
            return res.status(404).send("Archivo no encontrado");
        }

        const contentType = fileName.endsWith('.kmz') ? 'mapa/kmz' : 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.send(imageData);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al obtener el archivo");
    }
});

router.get('/obtenerDiseno', async (req, res) => {
    const { fileName } = req.query;

    try {
        const imageData = await getFileByName(fileName, folderId);

        if (!imageData) {
            return res.status(404).send("Archivo no encontrado");
        }

        let contentType = 'application/octet-stream';
        if (fileName.endsWith('.zip')) contentType = 'disenos/zip';
        else if (fileName.endsWith('.rar')) contentType = 'disenos/rar';
        else if (fileName.endsWith('.7z')) contentType = 'disenos/7z';

        res.setHeader('Content-Type', contentType);
        res.send(imageData);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al obtener el archivo");
    }
});

router.get('/obtenerPDF', async (req, res) => {
    const { fileName } = req.query;

    try {
        const imageData = await getFileByName(fileName, folderId);

        if (!imageData) {
            return res.status(404).send("Archivo no encontrado");
        }

        const contentType = fileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.send(imageData);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al obtener el archivo");
    }
});

router.post('/leerPDF', async (req, res) => {
    const nombrePDF = req.body.rutaPdf;
    const filePath = path.join(__dirname, '..', 'temp', nombrePDF);

    try {
        // 1. Verifica si el archivo ya existe localmente
        if (!fs.existsSync(filePath)) {
            // Si no existe, descárgalo desde Google Drive
            const pdfData = await getFileByName(nombrePDF, folderId);  // Función para obtener el archivo desde Google Drive

            if (!pdfData) {
                return res.status(404).json({ error: 'No se encontró el PDF en Google Drive' });
            }

            // Guarda el archivo en la carpeta temporal
            fs.writeFileSync(filePath, pdfData);
        }

        // 2. Prepara el archivo para enviarlo al microservicio
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath), nombrePDF);

        // 3. Envía el archivo al microservicio de Python
        const response = await axios.post(
            'https://sicte-sas-leer-pdfs-production.up.railway.app/leer-pdf',
            form,
            { headers: form.getHeaders() }
        );

        // 4. Devuelve la respuesta del microservicio
        res.json(response.data);

    } catch (err) {
        console.error('Error al procesar el PDF:', err.message);
        res.status(500).json({ error: 'Error al procesar el PDF', detalle: err.message });
    }
});

module.exports = router;
