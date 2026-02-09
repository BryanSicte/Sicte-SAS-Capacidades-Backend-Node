const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');

router.get('/registrosKgprod', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM bodega_kgprod');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros del parque automotor.`,
            rows
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.get('/registrosKgprodOperacionesCodigoDescripUnimed', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT codigo, descrip, unimed FROM bodega_kgprod where `Bodega` = "KGPROD_BOG"');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de material en bodega.`,
            rows
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});







router.post('/registrosKgprodBasico', validarToken, async (req, res) => {
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
                app: 'bodega',
                metodo: 'post',
                endPoint: 'registrosKgprodBasico',
                accion: 'Consulta tabla kgprod fallido',
                detalle: 'Los datos son requeridos para la consulta.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos son requeridos para la consulta.");
        }

        const { ciudad, area } = data;

        if (ciudad) {
            const [dataRows] = await dbRailway.query(`SELECT ciudades FROM tabla_aux_cadena_de_suministro WHERE ciudades = ? LIMIT 1`, [ciudad]);

            if (dataRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'bodega',
                    metodo: 'post',
                    endPoint: 'registrosKgprodBasico',
                    accion: 'Consulta tabla kgprod fallido',
                    detalle: 'Registro no permitido: Ciudad',
                    datos: { ciudadProporcionado: ciudad },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Ciudad", null, { "ciudad": `La ciudad ${ciudad} no se encuentra registrada en el sistema.` });
            }
        }

        if (area) {
            const [dataRows] = await dbRailway.query(`SELECT areas FROM tabla_aux_cadena_de_suministro WHERE areas = ? LIMIT 1`, [area]);

            if (dataRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'bodega',
                    metodo: 'post',
                    endPoint: 'registrosKgprodBasico',
                    accion: 'Consulta tabla kgprod fallido',
                    detalle: 'Registro no permitido: Area',
                    datos: { ciudadProporcionado: area },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Area", null, { "area": `El area ${area} no se encuentra registrada en el sistema.` });
            }
        }

        let ciudadBase;
        if (ciudad === 'Bogota') {
            ciudadBase = ['KGPROD_CORP_BOG', 'KGPROD_RED_BOG']
        } else if (ciudad === 'Armenia') {
            ciudadBase = ['KGPROD_ARM']
        } else if (ciudad === 'Pereira') {
            ciudadBase = ['KGPROD_PER_FO-HFC']
        } else if (ciudad === 'Manizales') {
            ciudadBase = ['KGPROD_MZL']
        }

        const placeholders = ciudadBase.map(() => '?').join(', ');
        const [rows] = await dbRailway.query(
            `SELECT codigo, descrip, unimed FROM bodega_kgprod WHERE Bodega IN (${placeholders}) and ind_comprado_2 = 'S'`,
            ciudadBase
        );

        if (rows.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'bodega',
                metodo: 'post',
                endPoint: 'registrosKgprodBasico',
                accion: 'Consulta tabla kgprod fallido',
                detalle: 'Registro no permitido: Bodega no encontrada',
                datos: { ciudadProporcionado: ciudad, areaProporcionado: area, bodegaCalculada: ciudadBase },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Area", null, { "area": `El area ${area} no se encuentra registrada en el sistema.` });
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'bodega',
            metodo: 'post',
            endPoint: 'registrosKgprodBasico',
            accion: 'Consulta tabla kgprod exitosa',
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
            `Se obtuvieron ${rows.length} registros de bodega.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'bodega',
            metodo: 'post',
            endPoint: 'registrosKgprodBasico',
            accion: 'Error al obtener la tabla kgprod',
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