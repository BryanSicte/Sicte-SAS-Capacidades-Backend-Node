const express = require('express');
const router = express.Router();

const usuariosRoutes = require('./usuarios.routes');
const usuariosv2Routes = require('./usuariosv2.routes');
const chatbotRoutes = require('./chatbot.routes');
const carnetizacionRoutes = require('./carnetizacion.routes');
const solicitudMaterialRoutes = require('./solicitudMaterial.routes');
const reporteFerreteroRoutes = require('./reporteFerretero.routes');
const supervisionRoutes = require('./supervision.routes');
const capacidadesRoutes = require('./capacidades.routes');
const alumbradoPublicoRoutes = require('./alumbradoPublico.routes');
const imagenesRoutes = require('./imagenes.routes');
const encuestasRoutes = require('./encuestas.routes');
const gestionOtsRoutes = require('./gestionOts.routes');
const parqueAutomotorRoutes = require('./parqueAutomotor.routes');
const inventariosRoutes = require('./inventarios.routes');
const bodegaRoutes = require('./bodega.routes');
const versionRoutes = require('./version.routes');

router.use('/usuarios', usuariosRoutes);
router.use('/usuariosv2', usuariosv2Routes);
router.use('/chatbot', chatbotRoutes);
router.use('/carnetizacion', carnetizacionRoutes);
router.use('/solicitudMaterial', solicitudMaterialRoutes);
router.use('/reporteFerretero', reporteFerreteroRoutes);
router.use('/supervision', supervisionRoutes);
router.use('/capacidades', capacidadesRoutes);
router.use('/alumbradoPublico', alumbradoPublicoRoutes);
router.use('/imagenes', imagenesRoutes);
router.use('/encuestas', encuestasRoutes);
router.use('/gestionOts', gestionOtsRoutes);
router.use('/parqueAutomotor', parqueAutomotorRoutes);
router.use('/inventarios', inventariosRoutes);
router.use('/bodega', bodegaRoutes);
router.use('/version', versionRoutes);

module.exports = router;

