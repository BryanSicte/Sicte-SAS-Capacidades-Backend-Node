const express = require('express');
const router = express.Router();

const usuariosRoutes = require('./usuarios.routes');
const empleadosRoutes = require('./chatbot.routes');

router.use('/usuarios', usuariosRoutes);
router.use('/chatbot', empleadosRoutes);

module.exports = router;
