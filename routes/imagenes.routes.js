const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const path = require('path');
const { uploadFile, getFileByName, listarArchivosEnCarpeta } = require('../services/googleDriveService');
const fs = require('fs');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

router.get('/encuestas', async (req, res) => {
    try {
        const images = await cloudinary.api.resources({
            type: 'upload',
            resource_type: 'image',
            prefix: 'Encuestas/',
            max_results: 100
        });

        const videos = await cloudinary.api.resources({
            type: 'upload',
            resource_type: 'video',
            prefix: 'Encuestas/',
            max_results: 100
        });
        res.json([...images.resources, ...videos.resources]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener imágenes' });
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
