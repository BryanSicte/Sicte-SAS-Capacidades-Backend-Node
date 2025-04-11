const express = require('express');
const router = express.Router();

const usuariosRoutes = require('./usuarios.routes');
const chatbotRoutes = require('./chatbot.routes');
const carnetizacionRoutes = require('./carnetizacion.routes');
const solicitudMaterialRoutes = require('./solicitudMaterial.routes');

router.use('/usuarios', usuariosRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/carnetizacion', carnetizacionRoutes);
router.use('/solicitudMaterial', solicitudMaterialRoutes);

module.exports = router;
