const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

router.get('/encuestas', async (req, res) => {
    try {
        const result = await cloudinary.api.resources({
            type: 'upload',
            prefix: '',
            max_results: 100
        });
        res.json(result.resources);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener imágenes' });
    }
});

module.exports = router;
