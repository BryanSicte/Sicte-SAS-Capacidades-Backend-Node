const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { validateRequiredFields } = require('../utils/validate');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');

router.get('/registros', validarToken, async (req, res) => {

    const usuarioToken = req.validarToken.usuario

    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_parque_automotor');

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'parqueAutomotor',
            metodo: 'get',
            endPoint: 'registros',
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
            `Se obtuvieron ${rows.length} registros del parque automotor.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'parqueAutomotor',
            metodo: 'get',
            endPoint: 'registros',
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

router.post('/crearRegistro', validarToken, async (req, res) => {

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
                app: 'parqueAutomotor',
                metodo: 'post',
                endPoint: 'crearRegistro',
                accion: 'Crear registro fallido',
                detalle: 'Los datos del registro son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del registro son requeridos.");
        }

        const requiredFields = {
            fecha: "No se pudo obtener la fecha del registro.",
            cedulaUsuario: "No se pudo identificar la cédula del usuario.",
            usuario: "No se pudo identificar el nombre del usuario.",
            sede: "Ingrese y seleccione una sede.",
            placa: "Ingrese y seleccione una placa.",
            cedula: "Ingrese y seleccione la cédula del conductor.",
            nombre: "Ingrese y seleccione un nombre del conductor.",
            estado: "Ingrese y seleccione un estado.",
        };

        if (!validateRequiredFields(data, requiredFields, res)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'parqueAutomotor',
                metodo: 'post',
                endPoint: 'crearRegistro',
                accion: 'Crear registro fallido',
                detalle: 'Falta campos obligatorios por diligenciar.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return;
        }

        const { fecha, cedulaUsuario, usuario, sede, placa, cedula, nombre, estado, observaciones } = data;

        if (cedulaUsuario) {
            const [userRows] = await dbRailway.query(`SELECT cedula FROM user WHERE cedula = ? LIMIT 1`, [cedulaUsuario]);

            if (userRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'parqueAutomotor',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Cédula de usuario',
                    datos: { cedulaUsuarioProporcionado: cedulaUsuario },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Cédula de usuario", null, { "cedulaUsuario": `La cédula ${cedulaUsuario} no se encuentra registrada en el sistema.` });
            }
        }

        if (sede) {
            const [sedeRows] = await dbRailway.query(`SELECT sedes FROM tabla_aux_parque_automotor WHERE sedes = ? LIMIT 1`, [sede]);

            if (sedeRows.length === 0) {

                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'parqueAutomotor',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Sede',
                    datos: { sedeProporcionado: sede },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Sede", null, { "sede": `La sede ingresada y/o seleccionada no es válida.` });
            }
        }

        if (placa) {
            const [placaBaseRows] = await dbRailway.query(`SELECT CENTRO FROM parque_automotor WHERE CENTRO = ?`, [placa]);

            if (placaBaseRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'parqueAutomotor',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Placa',
                    datos: { placaProporcionado: placa },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Placa", null, { "placa": `La placa ${placa} no se encuentra registrada en la base de datos.` });
            }
        }

        if (cedula) {
            const [plantaRows] = await dbRailway.query(`SELECT nit FROM plantaenlinea WHERE nit = ? and perfil <> 'RETIRADO' LIMIT 1`, [cedula]);

            if (plantaRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'parqueAutomotor',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Cédula de conductor',
                    datos: { cedulaProporcionado: cedula },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Cédula de conductor", null, { "cedulaConductor": `La cédula ${cedula} no se encuentra registrada en la nomina.` });
            }
        }

        if (estado) {
            const [estadosRows] = await dbRailway.query(`SELECT estados FROM tabla_aux_parque_automotor WHERE estados = ? LIMIT 1`, [estado]);

            if (estadosRows.length === 0) {

                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'parqueAutomotor',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Estado',
                    datos: { estadoProporcionado: estado },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Estado", null, { "estado": `El estado ingresado y/o seleccionado no es válido.` });
            }
        }

        if (estado === 'Salida de vehiculo de la sede') {
            const [cedulaRows] = await dbRailway.query(`SELECT estado FROM registros_parque_automotor WHERE cedula = ? ORDER BY fecha DESC LIMIT 1`, [cedula]);

            if (cedulaRows.length > 0 && cedulaRows[0].estado?.includes('Salida de vehiculo de la sede')) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'parqueAutomotor',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Cédula de conductor en campo',
                    datos: { cedulaProporcionado: cedula },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Cédula de conductor", null, { "cedulaConductor": `La cédula ${cedula} ya se encuentra en campo y no tiene un registro de ingreso.` });
            }

            const [placaRows] = await dbRailway.query(`SELECT estado FROM registros_parque_automotor WHERE placa = ? ORDER BY fecha DESC LIMIT 1`, [placa]);

            if (placaRows.length > 0 && placaRows[0].estado?.includes('Salida de vehiculo de la sede')) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'parqueAutomotor',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Placa ya salio de la sede',
                    datos: { placaProporcionado: placa },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Placa", null, { "placa": `El vehículo con placa ${placa} ya salió de la sede y aún no ha registrado su ingreso.` });
            }
        } else if (estado === 'Entrada de vehiculo a la sede') {
            const [cedulaRows] = await dbRailway.query(`SELECT cedula, estado FROM registros_parque_automotor WHERE placa = ? ORDER BY fecha DESC LIMIT 1`, [placa]);

            if (cedulaRows.length > 0 && cedulaRows[0].estado?.includes('Salida de vehiculo de la sede') && cedulaRows[0].cedula !== cedula) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'parqueAutomotor',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Placa esta asignado a un usuario diferente',
                    datos: { placaProporcionado: placa },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Placa", null, { "placa": `La placa ${placa} esta asignada al usuario ${cedulaRows[0].cedula}, no la cedula ingresada.` });
            }

            if (cedulaRows.length > 0 && cedulaRows[0].estado?.includes('No usado')) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'parqueAutomotor',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: `Registro no permitido: Estado no se puede marca como "Entrada de vehiculo a la sede"`,
                    datos: { estadoProporcionado: estado },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Estado", null, { "estado": `No puede marcar como "Entrada de vehiculo a la sede" un vehiculo que su ultimo estado fue "No Usado", debe existir una salida a terreno o en taller.` });
            }

            const [placaRows] = await dbRailway.query(`SELECT placa, estado FROM registros_parque_automotor WHERE cedula = ? ORDER BY fecha DESC LIMIT 1`, [cedula]);

            if (placaRows.length > 0 && placaRows[0].estado?.includes('Salida de vehiculo de la sede') && placaRows[0].placa !== placa) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'parqueAutomotor',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Cédula de conductor ya tiene asignado un vehiculo diferente',
                    datos: { cedulaProporcionado: cedula },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Cédula de conductor", null, { "cedulaConductor": `La cedula ${cedula} tiene asignado el vehiculo ${placaRows[0].placa}, no la placa ingresada.` });
            }
        } else if (estado === 'No usado') {
            const [cedulaRows] = await dbRailway.query(`SELECT nombre, estado FROM registros_parque_automotor WHERE placa = ? ORDER BY fecha DESC LIMIT 1`, [placa]);

            if (cedulaRows.length > 0 && cedulaRows[0].estado?.includes('Salida de vehiculo de la sede')) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'parqueAutomotor',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: `Registro no permitido: Estado no se puede marca como "No usado"`,
                    datos: { estadoProporcionado: estado },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Estado", null, { "estado": `No puede marcar como "No usado" el vehículo ${placa} que tiene como ultimo estado una salida a ${cedulaRows[0].nombre}, se debe tener la entrada del vehiculo.` });
            }
        }

        const keys = Object.keys(data);
        const values = Object.values(data);

        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO registros_parque_automotor (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM registros_parque_automotor WHERE id = ?', [result.insertId]);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'parqueAutomotor',
            metodo: 'post',
            endPoint: 'crearRegistro',
            accion: 'Crear registro exitoso',
            detalle: 'Registro creado con exito',
            datos: { data },
            tablasIdsAfectados: [],
            tablasIdsAfectados: [{
                tabla: 'registros_parque_automotor',
                id: result.insertId?.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Registro creado correctamente`,
            `Se ha guardado el registro con ID ${result.insertId}.`,
            registroGuardado[0]
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

router.get('/auxiliar', validarToken, async (req, res) => {

    const usuarioToken = req.validarToken.usuario

    try {
        const [rows] = await dbRailway.query('SELECT * FROM tabla_aux_cadena_de_suministro');

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'get',
            endPoint: 'auxiliar',
            accion: 'Consulta tabla auxiliar exitosa',
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
            `Se obtuvieron registros de la data auxiliar de cadena de suministro.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'get',
            endPoint: 'auxiliar',
            accion: 'Error al obtener la tabla auxiliar',
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