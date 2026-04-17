const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const dbAplicativosClaro = require('../db/db_aplicativos_claro');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { validateRequiredFields } = require('../utils/validate');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');


router.post('/', validarToken, async (req, res) => {

    const usuarioToken = req.validarToken.usuario

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'exportes',
                metodo: 'post',
                endPoint: '/',
                accion: 'Exportar datos fallido',
                detalle: 'Los datos para exportar son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del registro son requeridos.");
        }

        const requiredFields = {
            baseDatos: "No se pudo obtener la base de datos.",
            fechaInicio: "No se pudo obtener la fecha de inicio.",
            fechaFin: "No se pudo obtener la fecha de fin."
        };

        if (!validateRequiredFields(data, requiredFields, res)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'exportes',
                metodo: 'post',
                endPoint: '/',
                accion: 'Exportar datos fallido',
                detalle: 'Falta campos obligatorios por diligenciar.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return;
        }

        const { baseDatos, fechaInicio, fechaFin } = data;

        let result;
        if (baseDatos === 'WFM Operaciones Centro') {
            const fechaInicioSolo = fechaInicio.split(' ')[0];
            const fechaFinSolo = fechaFin.split(' ')[0];

            const query = `
                SELECT * FROM wfm_operaciones_centro_actividades 
                WHERE DATE(Fecha) BETWEEN ? AND ?
            `;
            [result] = await dbAplicativosClaro.query(query, [fechaInicioSolo, fechaFinSolo]);

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'exportes',
                metodo: 'post',
                endPoint: 'exportarDatos',
                accion: 'Exportar datos exitoso',
                detalle: 'Datos exportados con exito',
                datos: { data },
                tablasIdsAfectados: [],
                tablasIdsAfectados: [{
                    tabla: 'wfm_operaciones_centro_actividades',
                    id: result.insertId?.toString()
                }],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });
        } else {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'error',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'exportes',
                metodo: 'post',
                endPoint: 'exportarDatos',
                accion: 'Exportar datos fallido',
                detalle: 'Base de datos no encontrada.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Base de datos no encontrada.");
        }

        return sendResponse(
            res,
            200,
            `Datos exportados correctamente`,
            `Se han exportado los datos correctamente.`,
            result
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'parqueAutomotor',
            metodo: 'post',
            endPoint: 'crearRegistro',
            accion: 'Error al crear registro',
            detalle: 'Error interno del servidor',
            datos: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error inesperado.", err);
    }
});

module.exports = router;