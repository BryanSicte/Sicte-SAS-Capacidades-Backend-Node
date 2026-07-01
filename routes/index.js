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
const capacidadesV2Routes = require('./capacidadesV2.routes');
const alumbradoPublicoRoutes = require('./alumbradoPublico.routes');
const imagenesRoutes = require('./imagenes.routes');
const encuestasRoutes = require('./encuestas.routes');
const gestionOtsRoutes = require('./gestionOts.routes');
const gestionOtsV2Routes = require('./gestionOtsV2.routes');
const parqueAutomotorRoutes = require('./parqueAutomotor.routes');
const asistenciasRoutes = require('./asistencias.routes');
const inventariosRoutes = require('./inventarios.routes');
const bodegaRoutes = require('./bodega.routes');
const versionRoutes = require('./version.routes');
const gestionDeSstRoutes = require('./gestionDeSst.routes');
const liquidacionPersonalRoutes = require('./liquidacionPersonal.routes');
const cadenaSuministroRoutes = require('./cadenaSuministro.routes');
const proveedoresRoutes = require('./proveedores.routes');
const firmasRoutes = require('./firmas.routes')
const exportesRoutes = require('./exportes.routes')
const inspeccionesRoutes = require('./inspecciones.routes')
const InventariosV2Routes = require('./InventariosV2.routes')
const apoyosRoutes = require('./apoyos.routes');
const controlAvanceRoutes = require('./controlAvance.routes');


router.use('/usuarios', usuariosRoutes);
router.use('/usuariosv2', usuariosv2Routes);
router.use('/chatbot', chatbotRoutes);
router.use('/carnetizacion', carnetizacionRoutes);
router.use('/solicitudMaterial', solicitudMaterialRoutes);
router.use('/reporteFerretero', reporteFerreteroRoutes);
router.use('/supervision', supervisionRoutes);
router.use('/capacidades', capacidadesRoutes);
router.use('/capacidadesV2', capacidadesV2Routes);
router.use('/alumbradoPublico', alumbradoPublicoRoutes);
router.use('/imagenes', imagenesRoutes);
router.use('/encuestas', encuestasRoutes);
router.use('/gestionOts', gestionOtsRoutes);
router.use('/gestionOtsV2', gestionOtsV2Routes);
router.use('/parqueAutomotor', parqueAutomotorRoutes);
router.use('/inventarios', inventariosRoutes);
router.use('/bodega', bodegaRoutes);
router.use('/version', versionRoutes);
router.use('/gestionDeSst', gestionDeSstRoutes);
router.use('/asistencias', asistenciasRoutes);
router.use('/liquidacionPersonal', liquidacionPersonalRoutes);
router.use('/cadenaSuministro', cadenaSuministroRoutes);
router.use('/proveedores', proveedoresRoutes);
router.use('/firmas', firmasRoutes);
router.use('/exportes', exportesRoutes);
router.use('/inspecciones', inspeccionesRoutes);
router.use('/InventariosV2', InventariosV2Routes);
router.use('/apoyos', apoyosRoutes);
router.use('/controlAvance', controlAvanceRoutes);

module.exports = router;
