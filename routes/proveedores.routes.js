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
        const [rows] = await dbRailway.query('SELECT * FROM proveedores where estado = true');

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'proveedores',
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
            `Se obtuvieron ${rows.length} registros de proveedores.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'proveedores',
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
                app: 'proveedores',
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
            nombreUsuario: "No se pudo identificar el nombre del usuario.",
            nit: "Ingrese el nit.",
            nombreProveedor: "Ingrese un nombre del proveedor.",
            nombreContacto: "Ingrese un nombre de contacto.",
            direccion: "Ingrese la direccion.",
            telefono: "Ingrese el telefono.",
            correo: "Ingrese el correo.",
            paginaWeb: "Ingrese la pagina web.",
        };

        if (!validateRequiredFields(data, requiredFields, res)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
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

        const { cedulaUsuario, nit } = data;

        if (cedulaUsuario) {
            const [userRows] = await dbRailway.query(`SELECT cedula FROM user WHERE cedula = ? LIMIT 1`, [cedulaUsuario]);

            if (userRows.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'proveedores',
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

        if (nit) {
            const [dataRows] = await dbRailway.query(`SELECT nit FROM proveedores WHERE nit = ?`, [nit]);

            if (dataRows.length !== 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'proveedores',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Proveedor ya existente',
                    datos: { nitProporcionado: nit },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Proveedor", null, { "nit": `NIT ${nit} ya encuentra registrado en la tabla de proveedores.` });
            }
        }

        const keys = Object.keys(data);
        const values = Object.values(data);

        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO proveedores (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM proveedores WHERE id = ?', [result.insertId]);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'proveedores',
            metodo: 'post',
            endPoint: 'crearRegistro',
            accion: 'Crear registro exitoso',
            detalle: 'Registro creado con exito',
            datos: { data },
            tablasIdsAfectados: [],
            tablasIdsAfectados: [{
                tabla: 'proveedores',
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
            app: 'proveedores',
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

router.put('/editarRegistro/:id', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;
    const { id } = req.params;

    try {
        const data = req.body;

        if (!id || isNaN(id)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
                metodo: 'put',
                endPoint: 'editarRegistro',
                accion: 'Editar registro fallido',
                detalle: 'ID de registro inválido o no proporcionado',
                datos: { idProporcionado: id, data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "ID de registro inválido o no proporcionado.");
        }

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
                metodo: 'put',
                endPoint: 'editarRegistro',
                accion: 'Editar registro fallido',
                detalle: 'No hay datos para actualizar',
                datos: { id, data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "No hay datos para actualizar.");
        }

        const requiredFields = {
            fecha: "No se pudo obtener la fecha del registro.",
            cedulaUsuario: "No se pudo identificar la cédula del usuario.",
            nombreUsuario: "No se pudo identificar el nombre del usuario.",
            nit: "Ingrese el nit.",
            nombreProveedor: "Ingrese un nombre del proveedor.",
            nombreContacto: "Ingrese un nombre de contacto.",
            direccion: "Ingrese la direccion.",
            telefono: "Ingrese el telefono.",
            correo: "Ingrese el correo.",
            paginaWeb: "Ingrese la pagina web.",
        };

        if (!validateRequiredFields(data, requiredFields, res)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
                metodo: 'put',
                endPoint: 'crearRegistro',
                accion: 'Editar registro fallido',
                detalle: 'Falta campos obligatorios por diligenciar.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return;
        }

        const [registroExistente] = await dbRailway.query(
            'SELECT * FROM proveedores WHERE id = ? LIMIT 1',
            [id]
        );

        if (registroExistente.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
                metodo: 'put',
                endPoint: 'editarRegistro',
                accion: 'Editar registro fallido',
                detalle: 'Registro no encontrado',
                datos: { id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 404, `Registro con ID ${id} no encontrado.`);
        }

        const camposNoEditables = ['id', 'fecha', 'cedulaUsuario', 'nombreUsuario'];
        for (const campo of camposNoEditables) {
            if (data[campo] !== undefined) {
                delete data[campo];
            }
        }

        if (data.nit && data.nit !== registroExistente[0].nit) {
            if (nitExistente.length > 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'proveedores',
                    metodo: 'put',
                    endPoint: 'editarRegistro',
                    accion: 'Editar registro fallido',
                    detalle: 'NIT ya está en uso por otro proveedor',
                    datos: { nitProporcionado: data.nit },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: NIT", null, { "nit": `NIT ${data.nit} ya está en uso por otro proveedor.` });
            }
        }

        const keys = Object.keys(data);
        if (keys.length === 0) {
            return sendError(res, 400, "No hay campos válidos para actualizar.");
        }

        const setClause = keys.map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(data), id];

        const query = `
            UPDATE proveedores 
            SET ${setClause}
            WHERE id = ?
        `;

        const [result] = await dbRailway.query(query, values);

        if (result.affectedRows === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
                metodo: 'put',
                endPoint: 'editarRegistro',
                accion: 'Editar registro fallido',
                detalle: 'No se pudo actualizar el registro',
                datos: { id, data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 500, "No se pudo actualizar el registro.");
        }

        const [registroActualizado] = await dbRailway.query(
            'SELECT * FROM proveedores WHERE id = ?',
            [id]
        );

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'proveedores',
            metodo: 'put',
            endPoint: 'editarRegistro',
            accion: 'Editar registro exitoso',
            detalle: 'Registro actualizado con éxito',
            datos: {
                id,
                cambios: data,
                registroAnterior: registroExistente[0]
            },
            tablasIdsAfectados: [{
                tabla: 'proveedores',
                id: id.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Registro actualizado correctamente`,
            `Se ha actualizado el registro con ID ${id}.`,
            registroActualizado[0]
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'proveedores',
            metodo: 'put',
            endPoint: 'editarRegistro',
            accion: 'Error al editar registro',
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

router.put('/deshabilitarProveedor/:id', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;
    const { id } = req.params;

    try {
        if (!id || isNaN(id)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
                metodo: 'put',
                endPoint: 'deshabilitarProveedor',
                accion: 'Deshabilitar proveedor fallido',
                detalle: 'ID de proveedor inválido o no proporcionado',
                datos: { idProporcionado: id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "ID de proveedor inválido o no proporcionado.");
        }

        const [proveedorExistente] = await dbRailway.query(
            'SELECT * FROM proveedores WHERE id = ? LIMIT 1',
            [id]
        );

        if (proveedorExistente.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
                metodo: 'put',
                endPoint: 'deshabilitarProveedor',
                accion: 'Deshabilitar proveedor fallido',
                detalle: 'Proveedor no encontrado',
                datos: { id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 404, `Proveedor con ID ${id} no encontrado.`);
        }

        if (proveedorExistente[0].estado === false) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
                metodo: 'put',
                endPoint: 'deshabilitarProveedor',
                accion: 'Deshabilitar proveedor fallido',
                detalle: 'El proveedor ya está deshabilitado',
                datos: {
                    id,
                    estadoActual: proveedorExistente[0].estado
                },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, `El proveedor con ID ${id} ya está deshabilitado.`);
        }

        const [result] = await dbRailway.query(
            'UPDATE proveedores SET estado = ? WHERE id = ?',
            [false, id]
        );

        if (result.affectedRows === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'proveedores',
                metodo: 'put',
                endPoint: 'deshabilitarProveedor',
                accion: 'Deshabilitar proveedor fallido',
                detalle: 'No se pudo deshabilitar el proveedor',
                datos: { id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 500, "No se pudo deshabilitar el proveedor.");
        }

        const [proveedorActualizado] = await dbRailway.query(
            'SELECT * FROM proveedores WHERE id = ?',
            [id]
        );

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'proveedores',
            metodo: 'put',
            endPoint: 'deshabilitarProveedor',
            accion: 'Deshabilitar proveedor exitoso',
            detalle: 'Proveedor deshabilitado correctamente',
            datos: {
                id,
                proveedorAnterior: proveedorExistente[0],
                proveedorActual: proveedorActualizado[0]
            },
            tablasIdsAfectados: [{
                tabla: 'proveedores',
                id: id.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Proveedor deshabilitado correctamente`,
            `El proveedor "${proveedorExistente[0].nombreProveedor}" ha sido deshabilitado.`,
            proveedorActualizado[0]
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'proveedores',
            metodo: 'put',
            endPoint: 'deshabilitarProveedor',
            accion: 'Error al deshabilitar proveedor',
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