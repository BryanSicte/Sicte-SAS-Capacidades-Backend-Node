const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { validateRequiredFields } = require('../utils/validate');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');

/**
 * @route POST /api/apoyos/crearSolicitud
 * @desc Crea una nueva solicitud de apoyo
 * @access Private
 */
router.post('/crearSolicitud', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken?.usuario || null;

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            return sendError(res, 400, "Los datos de la solicitud son requeridos.");
        }

        const requiredFields = {
            tipoApoyo: "El tipo de apoyo es requerido.",
            cuenta: "La cuenta es requerida.",
            nroOrden: "El número de orden es requerido.",
            nombreTecnico: "El nombre del técnico es requerido.",
            cedulaTecnico: "La cédula del técnico es requerida.",
            nombreSupervisor: "El nombre del supervisor es requerido.",
            cedulaSupervisor: "La cédula del supervisor es requerida.",
            ubicacion: "La ubicación es requerida."
        };

        if (!validateRequiredFields(data, requiredFields, res)) {
            return; // validateRequiredFields ya envía la respuesta de error
        }

        // Mapeo de campos del frontend a la base de datos
        const datosParaBD = {
            tipo_apoyo: data.tipoApoyo,
            cuenta: data.cuenta,
            nro_orden: data.nroOrden,
            nombre_tecnico: data.nombreTecnico,
            cedula_tecnico: data.cedulaTecnico,
            nro_telefonico_tecnico: data.nroTelefonico,
            nombre_supervisor: data.nombreSupervisor,
            cedula_supervisor: data.cedulaSupervisor,
            nro_telefonico_supervisor: data.nroTelefonicoSupervisor,
            ubicacion: data.ubicacion,
            usuario_creacion: usuarioToken ? `${usuarioToken.nombre} (${usuarioToken.cedula})` : 'Sistema',
            fecha_creacion: new Date()
        };

        const keys = Object.keys(datosParaBD);
        const values = Object.values(datosParaBD);
        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO solicitudes_apoyo (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'apoyos',
            metodo: 'post',
            endPoint: 'crearSolicitud',
            accion: 'Crear solicitud exitosa',
            detalle: `Se creó la solicitud con ID ${result.insertId}`,
            datos: { data },
            tablasIdsAfectados: [{
                tabla: 'solicitudes_apoyo',
                id: result.insertId.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            201,
            "Solicitud creada correctamente",
            `Se ha generado la solicitud de apoyo con ID ${result.insertId}.`,
            { id: result.insertId }
        );

    } catch (err) {
        console.error("ERROR EN crearSolicitud:", err);

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'apoyos',
            metodo: 'post',
            endPoint: 'crearSolicitud',
            accion: 'Error al crear solicitud',
            detalle: err.message,
            datos: { error: err.message },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error al procesar la solicitud.", err);
    }
});

module.exports = router;