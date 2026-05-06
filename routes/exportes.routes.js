const express = require('express');
const router = express.Router();
const dbf_informes = require('../db/dbf_informes');
const dbf_bodega = require('../db/dbf_bodega');
const db_aplicativosClaro = require('../db/db_aplicativos_claro');
const dbf_wfm_operaciones = require('../db/dbf_wfm_operaciones');
const dbf_enel = require('../db/dbf_enel');
const dbRailway = require('../db/db_railway');
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
                db: db_aplicativosClaro,
                campoFecha: "Fecha"
            },
            "WFM Operaciones Norte": {
                tabla: "wfm_operaciones_norte_actividades",
                db: db_aplicativosClaro,
                campoFecha: "Fecha"
            },
            "WFM Operaciones Centro - Inventario": {
                tabla: "wfm_operaciones_centro_inventario_1",
                db: dbf_wfm_operaciones,
                campoFecha: "Fecha archivo"
            },
            "WFM Operaciones Norte - Inventario": {
                tabla: "wfm_operaciones_centro_inventario_eje",
                db: dbf_wfm_operaciones,
                campoFecha: "Fecha archivo"
            },
            "Recurso Centro": {
                tabla: "recurso_operaciones",
                db: db_aplicativosClaro,
                usarFiltroFecha: false
            },
            "Recurso Norte": {
                tabla: "recurso_operaciones_norte",
                db: db_aplicativosClaro,
                usarFiltroFecha: false
            },
            "WFM Mantenimiento Centro": {
                tabla: "wfm_mtto_centro_actividades",
                db: db_aplicativosClaro,
                campoFecha: "Fecha"
            },
            "WFM Mantenimiento Norte": {
                tabla: "wfm_mtto_norte_actividades",
                db: db_aplicativosClaro,
                campoFecha: "Fecha"
            },
            "WFM Mantenimiento Centro - Inventario": {
                tabla: "wfm_mantenimiento_centro_inventario",
                db: dbf_wfm_operaciones,
                campoFecha: "Fecha archivo"
            },
            "WFM Mantenimiento Norte - Inventario": {
                tabla: "wfm_mantenimiento_centro_inventario_eje",
                db: dbf_wfm_operaciones,
                campoFecha: "Fecha archivo"
            },
            "KGPROD - Saldo bodega": {
                tabla: "kgprod",
                db: dbf_bodega,
                usarFiltroFecha: false
            },
            "LCONSUM - Consumidores": {
                tabla: "lconsum",
                db: dbf_bodega,
                usarFiltroFecha: false
            },
            "KGCNPR - Saldo moviles": {
                tabla: "kgcnpr",
                db: dbf_bodega,
                usarFiltroFecha: false
            },
            "LPRODUC - Productos": {
                tabla: "lproduc",
                db: dbf_bodega,
                usarFiltroFecha: false
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
            },
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

            query += ` WHERE DATE(\`${campoFecha}\`) BETWEEN ? AND ?`;
            params.push(fechaInicioSolo, fechaFinSolo);
        }

        [result] = await db.query(query, params);

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

router.post('/roles', async (req, res) => {

    const usuarioToken = req.validarToken?.usuario || null;

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'exportes',
                metodo: 'post',
                endPoint: 'roles',
                accion: 'Consulta registros fallido',
                detalle: 'Los datos de usuario son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos de usuario son requeridos.");
        }

        if (!data?.cedula) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'exportes',
                metodo: 'post',
                endPoint: 'roles',
                accion: 'Consulta registros fallido',
                detalle: 'Se requiere la cedula para la consulta',
                datos: { dataProporcionado: data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Se requiere la cedula para la consulta");
        }

        const [rows] = await dbRailway.query('SELECT * FROM rol_exportes where cedula = ?', [data.cedula]);

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'exportes',
            metodo: 'post',
            endPoint: 'roles',
            accion: 'Consulta registros exitosa',
            detalle: `Se consultó ${rows.length} registros`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de roles en capacitaciones.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'exportes',
            metodo: 'post',
            endPoint: 'roles',
            accion: 'Error al obtener los registros',
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