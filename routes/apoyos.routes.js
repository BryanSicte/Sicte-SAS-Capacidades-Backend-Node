const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { validateRequiredFields } = require('../utils/validate');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');

/**
 * @route POST /api/apoyos/crearSolicitud
 * @desc Crea una nueva solicitud de apoyo
 * @access Private
 */
router.post('/crearSolicitud', async (req, res) => {
    const data = req.body;

    try {

        if (!data || Object.keys(data).length === 0) {
            return sendError(res, 400, "Los datos de la solicitud son requeridos.");
        }

        const requiredFields = {
            tipo_apoyo: "El tipo de apoyo es requerido.",
            cuenta: "La cuenta es requerida.",
            nro_orden: "El número de orden es requerido.",

            nombre_tecnico: "El nombre del técnico es requerido.",
            cedula_tecnico: "La cédula del técnico es requerida.",

            nombre_supervisor: "El nombre del supervisor es requerido.",
            cedula_supervisor: "La cédula del supervisor es requerida.",

            ubicacion: "La ubicación es requerida."
        };

        if (!validateRequiredFields(data, requiredFields, res)) {
            return; // validateRequiredFields ya envía la respuesta de error
        }

        // Mapeo de campos del frontend a la base de datos
        const datosParaBD = {
            tipo_apoyo: data.tipo_apoyo,
            cuenta: data.cuenta,
            nro_orden: data.nro_orden,

            nombre_tecnico: data.nombre_tecnico,
            cedula_tecnico: data.cedula_tecnico,
            nro_telefonico_tecnico: data.nro_telefonico_tecnico,

            nombre_supervisor: data.nombre_supervisor,
            cedula_supervisor: data.cedula_supervisor,
            nro_telefonico_supervisor: data.nro_telefonico_supervisor,

            ubicacion: data.ubicacion,

            observaciones: data.observaciones,

            fecha_creacion: new Date(),

            estado: data.estado || "Pendiente"
        };

        const keys = Object.keys(datosParaBD);
        const values = Object.values(datosParaBD);
        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO registros_solicitud_apoyos (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        await registrarHistorial({
            nombreUsuario: data.nombre_tecnico,
            cedulaUsuario: data.cedula_tecnico,
            rolUsuario: 'Tecnico',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'apoyos',
            metodo: 'post',
            endPoint: 'crearSolicitud',
            accion: 'Crear solicitud exitosa',
            detalle: `Se creó la solicitud con ID ${result.insertId}`,
            datos: { data },
            tablasIdsAfectados: [{
                tabla: 'registros_solicitud_apoyos',
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
            nombreUsuario: data?.nombre_tecnico || 'Error sistema',
            cedulaUsuario: data?.cedula_tecnico || 'Error sistema',
            rolUsuario: 'Tecnico',
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