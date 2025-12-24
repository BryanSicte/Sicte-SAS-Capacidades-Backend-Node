const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { validateRequiredFields } = require('../utils/validate');

const optionsSede = ["Armenia", "Bogotá Enel", "Bogotá Ferias", "Bogotá San Cipriano", "Manizales", "Pereira", "Zipaquira"];
const optionsEstado = ["Entrada de vehiculo a la sede", "Salida de vehiculo de la sede", "En taller", "No usado"];

router.get('/registros', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_gestion_de_sst');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de la gestión de SST.`,
            rows
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.post('/crearRegistro', validarToken, async (req, res) => {

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
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

        if (!validateRequiredFields(data, requiredFields, res)) return;

        const { fecha, cedulaUsuario, usuario, sede, placa, cedula, nombre, estado, observaciones } = data;

        if (cedulaUsuario) {
            const [userRows] = await dbRailway.query(`SELECT cedula FROM user WHERE cedula = ? LIMIT 1`, [cedulaUsuario]);

            if (userRows.length === 0) {
                return sendError(res, 400, "Registro no permitido", null, { "cedulaUsuario": `La cédula ${cedulaUsuario} no se encuentra registrada en el sistema.` });
            }
        }

        if (!optionsSede.includes(sede)) {
            return sendError(res, 400, "Registro no permitido", null, { "sede": `La sede ingresada y/o seleccionada no es válida.` });
        }

        if (placa) {
            const [placaBaseRows] = await dbRailway.query(`SELECT CENTRO FROM parque_automotor WHERE CENTRO = ?`, [placa]);

            if (placaBaseRows.length === 0) {
                return sendError(res, 400, "Registro no permitido", null, { "placa": `La placa ${placa} no se encuentra registrada en la base de datos.` });
            }
        }

        if (cedula) {
            const [plantaRows] = await dbRailway.query(`SELECT nit FROM plantaenlinea WHERE nit = ? and perfil <> 'RETIRADO' LIMIT 1`, [cedula]);

            if (plantaRows.length === 0) {
                return sendError(res, 400, "Registro no permitido", null, { "cedulaConductor": `La cédula ${cedula} no se encuentra registrada en la nomina.` });
            }
        }

        if (!optionsEstado.includes(estado)) {
            return sendError(res, 400, "Registro no permitido", null, { "estado": `El estado ingresado y/o seleccionado no es válido.` });
        }

        if (estado === 'Salida de vehiculo de la sede') {
            const [cedulaRows] = await dbRailway.query(`SELECT estado FROM registros_parque_automotor WHERE cedula = ? ORDER BY fecha DESC LIMIT 1`, [cedula]);

            if (cedulaRows.length > 0 && cedulaRows[0].estado?.includes('Salida de vehiculo de la sede')) {
                return sendError(res, 400, "Registro no permitido", null, { "cedulaConductor": `La cédula ${cedula} ya se encuentra en campo y no tiene un registro de ingreso.` });
            }

            const [placaRows] = await dbRailway.query(`SELECT estado FROM registros_parque_automotor WHERE placa = ? ORDER BY fecha DESC LIMIT 1`, [placa]);

            if (placaRows.length > 0 && placaRows[0].estado?.includes('Salida de vehiculo de la sede')) {
                return sendError(res, 400, "Registro no permitido", null, { "placa": `El vehículo con placa ${placa} ya salió de la sede y aún no ha registrado su ingreso.` });
            }
        } else if (estado === 'Entrada de vehiculo a la sede') {
            const [cedulaRows] = await dbRailway.query(`SELECT cedula, estado FROM registros_parque_automotor WHERE placa = ? ORDER BY fecha DESC LIMIT 1`, [placa]);

            if (cedulaRows.length > 0 && cedulaRows[0].estado?.includes('Salida de vehiculo de la sede') && cedulaRows[0].cedula !== cedula) {
                return sendError(res, 400, "Registro no permitido", null, { "placa": `La placa ${placa} esta asignada al usuario ${cedulaRows[0].cedula}, no la cedula ingresada.` });
            }

            if (cedulaRows.length > 0 && cedulaRows[0].estado?.includes('No usado')) {
                return sendError(res, 400, "Registro no permitido", null, { "estado": `No puede marcar como "Entrada de vehiculo a la sede" un vehiculo que su ultimo estado fue "No Usado", debe existir una salida a terreno o en taller.` });
            }

            const [placaRows] = await dbRailway.query(`SELECT placa, estado FROM registros_parque_automotor WHERE cedula = ? ORDER BY fecha DESC LIMIT 1`, [cedula]);

            if (placaRows.length > 0 && placaRows[0].estado?.includes('Salida de vehiculo de la sede') && placaRows[0].placa !== placa) {
                return sendError(res, 400, "Registro no permitido", null, { "cedulaConductor": `La cedula ${cedula} tiene asignado el vehiculo ${placaRows[0].placa}, no la placa ingresada.` });
            }
        } else if (estado === 'No usado') {
            const [cedulaRows] = await dbRailway.query(`SELECT nombre, estado FROM registros_parque_automotor WHERE placa = ? ORDER BY fecha DESC LIMIT 1`, [placa]);

            if (cedulaRows.length > 0 && cedulaRows[0].estado?.includes('Salida de vehiculo de la sede')) {
                return sendError(res, 400, "Registro no permitido", null, { "estado": `No puede marcar como "No usado" el vehículo ${placa} que tiene como ultimo estado una salida a ${cedulaRows[0].nombre}, se debe tener la entrada del vehiculo.` });
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

        return sendResponse(
            res,
            200,
            `Registro creado correctamente`,
            `Se ha guardado el registro con ID ${result.insertId}.`,
            registroGuardado[0]
        );

    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.get('/partidas', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM partidas');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de la base de partidas.`,
            rows
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

module.exports = router;