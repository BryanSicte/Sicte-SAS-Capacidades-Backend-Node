const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { validateRequiredFields } = require('../utils/validate');

router.get('/registros', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_liquidacion_personal');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de la liquidacion de personal.`,
            rows
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.post('/crearRegistro', validarToken, async (req, res) => {

    try {
        const data = req.body;

        const insertData = { ...data };

        if (insertData.matrizHE && typeof insertData.matrizHE === 'object') {
            insertData.matrizHE = JSON.stringify(insertData.matrizHE);
        }

        const requiredFields = {
            fechaRegistro: "No se pudo obtener la fecha del registro.",
            cedulaUsuario: "No se pudo identificar la cédula del usuario.",
            nombreUsuario: "No se pudo identificar el nombre del usuario.",
            dni: "Ingrese un dni.",
            nombresApellidos: "Ingrese un nombre y apellido.",
            areaSubArea: "Ingrese un area sub-area.",
            cargo: "Ingrese un cargo.",
            condicion: "Ingrese una condición.",
            fechaIngreso: "Ingrese una fecha de ingreso.",
            fechaCese: "Ingrese una fecha de cese.",
            tiempo: "Ingrese el tiempo.",
            motivoCese: "Ingrese el motivo de cese.",
            regimenLaboralTipo: "Ingrese el tipo de régimen laboral.",
            regimenLaboral: "Ingrese el régimen laboral.",
            sueldo: "Ingrese el sueldo.",
            salarioMinimo: "Ingrese el salario mínimo.",
            asignacionFamiliarAplica: "Ingrese si aplica asignación familiar.",
            asignacionFamiliarValor: "Ingrese el valor de la asignación familiar.",
            totalPromedioHorasExtras: "Ingrese el total promedio de horas extras.",
            ultimaGratificacion: "Ingrese la última gratificación.",
            resultadoGratificacion: "Ingrese el resultado de gratificación.",
            remuneracionAsegurable: "Ingrese la remuneración asegurable.",
            remuneracionComputable: "Ingrese la remuneración computable.",
            compensacionTiemposServicios: "Ingrese la compensación por tiempos de servicios.",
            diasPendientesVacaciones: "Ingrese los días pendientes de vacaciones.",
            valorVacacionesTruncas: "Ingrese el valor de las vacaciones truncas.",
            fondoDePensiones: "Ingrese el fondo de pensiones.",
            cotizacionPensiones: "Ingrese la cotización de pensiones.",
            totalVacacionesTruncas: "Ingrese el total de vacaciones truncas.",
            essalud: "Ingrese el essalud.",
            valorGratificacionesTruncas: "Ingrese el valor de gratificaciones truncas.",
            bonificacionExtraordinaria: "Ingrese la bonificación extraordinaria.",
            gratificacionesTruncas: "Ingrese las gratificaciones truncas.",
            totalAPagar: "Ingrese el total a pagar.",
        };

        if (!validateRequiredFields(insertData, requiredFields, res)) return;

        const { cedulaUsuario, dni, fechaIngreso, fechaCese } = insertData;

        if (cedulaUsuario) {
            const [dataRows] = await dbRailway.query(`SELECT cedula FROM user WHERE cedula = ? LIMIT 1`, [cedulaUsuario]);

            if (dataRows.length === 0) {
                return sendError(res, 400, "Registro no permitido: Cédula de usuario", null, { "cedulaUsuario": `La cédula ${cedulaUsuario} no se encuentra registrada en el sistema.` });
            }
        }

        if (dni) {
            const [dataRows] = await dbRailway.query(
                "SELECT `n documento` FROM planta_activa_gya WHERE `n documento` = ? LIMIT 1",
                [dni]
            );

            if (dataRows.length === 0) {
                return sendError(res, 400, "Registro no permitido: DNI", null, { "dni": `El DNI ${dni} no se encuentra registrada en el sistema.` });
            }
        }

        const fechaIngresoDate = new Date(fechaIngreso);
        const fechaCeseDate = new Date(fechaCese);

        if (fechaCeseDate <= fechaIngresoDate) {
            return sendError(res, 400, "Registro no permitido: Fecha de cese", null, { "fechaCese": `La fecha de cese debe ser posterior a la fecha de ingreso.` });
        }

        const keys = Object.keys(insertData);
        const values = Object.values(insertData);

        const placeholders = keys.map(() => '?').join(', ');
        const campos = keys.join(', ');

        const query = `
            INSERT INTO registros_liquidacion_personal (${campos})
            VALUES (${placeholders})
        `;

        const [result] = await dbRailway.query(query, values);

        const [registroGuardado] = await dbRailway.query('SELECT * FROM registros_liquidacion_personal WHERE id = ?', [result.insertId]);

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

router.get('/tablaAuxiliar', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM tabla_aux_liquidacion_personal');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de la tabla auxiliar de liquidación personal.`,
            rows
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.get('/plantaActivaGyA', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM planta_activa_gya');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de la planta activa gya.`,
            rows
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

module.exports = router;