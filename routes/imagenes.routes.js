const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const path = require('path');
const { getDriveClient, uploadFile, getFileByName, listarArchivosEnCarpeta, obtenerDetallesArchivo, hacerPublico } = require('../services/googleDriveService');
const fs = require('fs');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

router.get('/ccot', async (req, res) => {

    try {
        const folderId = '1gWDVpbQA-h1Zx7bzTC3xjbR5WpvD67WI';
        const archivos = await listarArchivosEnCarpeta(folderId);

        const detalles = await Promise.all(
            archivos.map(async (f) => {
                const file = await obtenerDetallesArchivo(f.id);
                const fileId = file.id;
                const linkImagen = `https://drive.google.com/uc?export=view&id=${fileId}`;
                const linkDescarga = `https://drive.google.com/uc?id=${fileId}&export=download`;
                return {
                    id: fileId,
                    nombre: file.name,
                    tipo: file.mimeType,
                    link: linkImagen,
                    descarga: linkDescarga,
                    tamaño: file.size,
                    creado: file.createdTime,
                    modificado: file.modifiedTime,
                };
            })
        );

        await Promise.all(detalles.map(d => hacerPublico(d.id).catch(e => { /* ignorar */ })));

        res.json({ success: true, archivos: detalles });
    } catch (error) {
        console.error('❌ Error al listar encuestas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/inicio', async (req, res) => {

    try {
        const folderId = '1CuZhG1A4dwIngQoC1ONH6xJPYNKoK7W-';
        const archivos = await listarArchivosEnCarpeta(folderId);

        const detalles = await Promise.all(
            archivos.map(async (f) => {
                const file = await obtenerDetallesArchivo(f.id);
                const fileId = file.id;
                const linkImagen = `https://drive.google.com/uc?export=view&id=${fileId}`;
                const linkDescarga = `https://drive.google.com/uc?id=${fileId}&export=download`;
                return {
                    id: fileId,
                    nombre: file.name,
                    tipo: file.mimeType,
                    link: linkImagen,
                    descarga: linkDescarga,
                    tamaño: file.size,
                    creado: file.createdTime,
                    modificado: file.modifiedTime,
                };
            })
        );

        await Promise.all(detalles.map(d => hacerPublico(d.id).catch(e => { /* ignorar */ })));

        res.json({ success: true, archivos: detalles });
    } catch (error) {
        console.error('❌ Error al listar encuestas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/encuestas', async (req, res) => {

    try {
        const folderId = '1YP6fMEroaBnR-KLndDKzWjy1g8uNxZaN';
        const archivos = await listarArchivosEnCarpeta(folderId);

        const detalles = await Promise.all(
            archivos.map(async (f) => {
                const file = await obtenerDetallesArchivo(f.id);
                const fileId = file.id;
                const linkDirecto = `https://drive.google.com/file/d/${fileId}/view`;
                const linkDescarga = `https://drive.google.com/uc?id=${fileId}&export=download`;
                return {
                    id: fileId,
                    nombre: file.name,
                    tipo: file.mimeType,
                    link: linkDirecto,
                    descarga: linkDescarga,
                    tamaño: file.size,
                    creado: file.createdTime,
                    modificado: file.modifiedTime,
                };
            })
        );

        await Promise.all(detalles.map(d => hacerPublico(d.id).catch(e => { /* ignorar */ })));

        res.json({ success: true, archivos: detalles });
    } catch (error) {
        console.error('❌ Error al listar encuestas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/file/:id', async (req, res) => {
    const fileId = req.params.id;
    const drive = getDriveClient();

    try {
        const meta = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, size',
            supportsAllDrives: true,
        });

        res.setHeader('Content-Type', meta.data.mimeType);
        const response = await drive.files.get(
            { fileId, alt: 'media', supportsAllDrives: true },
            { responseType: 'stream' }
        );

        response.data.pipe(res);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


async function guardarImagenBase64(base64Data, filename, folderId) {
    try {
        if (!base64Data.startsWith('data:image')) {
            throw new Error('Formato de imagen no válido');
        }

        const matches = base64Data.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!matches) throw new Error('Formato Base64 inválido');

        const ext = matches[1].split('/')[1];
        const buffer = Buffer.from(matches[2], 'base64');

        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const tempFilePath = path.join(tempDir, `${filename}.${ext}`);
        fs.writeFileSync(tempFilePath, buffer);

        let fileId;
        try {
            fileId = await uploadFile(tempFilePath, `${filename}.${ext}`, folderId);
        } finally {
            if (fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (err) {
                    console.warn('Error:', err.message);
                }
            }
        }
        return fileId;
    } catch (error) {
        throw error;
    }
}

function getContentType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

async function obtenerImagenPorNombreYCarpeta(filename, folderId) {
    try {
        const posiblesNombres = [
            filename,
            `${filename}.jpg`,
            `${filename}.jpeg`,
            `${filename}.png`
        ];

        let imageData = null;
        let nombreEncontrado = null;

        for (const nombre of posiblesNombres) {
            imageData = await getFileByName(nombre, folderId);
            if (imageData) {
                nombreEncontrado = nombre;
                break;
            }
        }

        if (!imageData) {
            return null;
        }

        const mimeType = getContentType(filename);
        const base64Data = `data:${mimeType};base64,${imageData.toString("base64")}`;
        return { mimeType, nombre: nombreEncontrado, base64: base64Data };

    } catch (error) {
        throw error;
    }
}

module.exports = router;

module.exports.guardarImagenBase64 = guardarImagenBase64;
module.exports.obtenerImagenPorNombreYCarpeta = obtenerImagenPorNombreYCarpeta;
