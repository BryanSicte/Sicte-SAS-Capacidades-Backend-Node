const express = require('express');
const router = express.Router();

const usuariosRoutes = require('./usuarios.routes');
const chatbotRoutes = require('./chatbot.routes');
const carnetizacionRoutes = require('./carnetizacion.routes');
const solicitudMaterialRoutes = require('./solicitudMaterial.routes');
const reporteFerreteroRoutes = require('./reporteFerretero.routes');
const supervisionRoutes = require('./supervision.routes');
const capacidadesRoutes = require('./capacidades.routes');

router.use('/usuarios', usuariosRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/carnetizacion', carnetizacionRoutes);
router.use('/solicitudMaterial', solicitudMaterialRoutes);
router.use('/reporteFerretero', reporteFerreteroRoutes);
router.use('/supervision', supervisionRoutes);
router.use('/capacidades', capacidadesRoutes);

module.exports = router;
