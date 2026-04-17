const express = require('express');
const router = express.Router();
const dbf_informes = require('../db/db_railway');
const dbAplicativosClaro = require('../db/db_aplicativos_claro');
const dbf_enel = require('../db/dbf_enel');
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

        const fuentes = {
            "WFM Operaciones Centro": {
                tabla: "wfm_operaciones_centro_actividades",
                db: dbAplicativosClaro,
                campoFecha: "Fecha"
            },
            "WFM Mantenimiento Centro": {
                tabla: "wfm_mtto_centro_actividades",
                db: dbAplicativosClaro,
                campoFecha: "Fecha"
            },
            "WFM Operaciones Norte": {
                tabla: "wfm_operaciones_norte_actividades",
                db: dbAplicativosClaro,
                campoFecha: "Fecha"
            },
            "WFM Mantenimiento Norte": {
                tabla: "wfm_mtto_norte_actividades",
                db: dbAplicativosClaro,
                campoFecha: "Fecha"
            },

            "Enel ingresos": {
                tabla: "ingresos",
                db: dbf_enel,
                campoFecha: "Fecha Ingreso"
            },
            "Enel atendidas": {
                tabla: "atendidas",
                db: dbf_enel,
                campoFecha: "INICIO ACTIVIDAD"
            },
            "Saldos Proyectos R4": {
                tabla: "proyectos_r4",
                db: dbf_informes,
                usarFiltroFecha: false
            },
            "Saldos Proyectos R4 HFC": {
                tabla: "proyectos_r4_hfc",
                db: dbf_informes,
                usarFiltroFecha: false
            }
        };
        const fuente = fuentes[baseDatos];

        if (!fuente) {
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

        const { tabla, db, campoFecha, usarFiltroFecha = true } = fuente;
        let query = `SELECT * FROM ${tabla}`;
        let params = [];

        if (usarFiltroFecha && fechaInicio && fechaFin) {
            const fechaInicioSolo = fechaInicio.split(' ')[0];
            const fechaFinSolo = fechaFin.split(' ')[0];

            console.log("BASE:", baseDatos);
            console.log("TABLA:", tabla);
            console.log("QUERY:", query);
            console.log("PARAMS:", params);

            query += ` WHERE DATE(\`${campoFecha}\`) BETWEEN ? AND ?`;
            params.push(fechaInicioSolo, fechaFinSolo);
        }

        [result] = await db.query(query, params);

        console.log("RESULT:", result);

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
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

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
            app: 'exportes',
            metodo: 'post',
            endPoint: 'exportarDatos',
            accion: 'Error al exportar datos',
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