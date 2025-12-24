const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { validateRequiredFields } = require('../utils/validate');

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

        const resultados = [];

        for (const datai of data) {

            const requiredFields = {
                fechaRegistro: "No se pudo obtener la fecha del registro.",
                cedulaUsuario: "No se pudo identificar la cédula del usuario.",
                nombreUsuario: "No se pudo identificar el nombre del usuario.",
                fecha: "Ingrese una fecha.",
                sst: "Ingrese un SST.",
                noDistrito: "Ingrese el número de distrito.",
                distrito: "Ingrese el distrito.",
                capataz: "Ingrese el capataz.",
                tipoDeCuadrilla: "Ingrese el tipo de cuadrilla.",
                numeroDePersonas: "Ingrese el número de personas.",
                coordinadorDeObra: "Ingrese el coordinador de obra.",
                partida: "Ingrese la partida.",
                descripcion: "Ingrese la descripción.",
                um: "Ingrese la unidad de medida.",
                cantidad: "Ingrese la cantidad.",
                valorMo: "Ingrese el valor MO.",
                valorTotalMo: "Ingrese el valor total MO.",
            };

            if (!validateRequiredFields(datai, requiredFields, res)) return;

            const { partida, descripcion } = datai;

            if (partida) {
                const [userRows] = await dbRailway.query(`SELECT partidas FROM partidas WHERE partidas = ? LIMIT 1`, [partida]);

                if (userRows.length === 0) {
                    return sendError(res, 400, "Registro no permitido: Partida", null, { "partida": `La partida ${partida} no se encuentra registrada en el sistema.` });
                }
            }

            if (descripcion) {
                const [userRows] = await dbRailway.query(`SELECT partidas FROM partidas WHERE descripcion = ? LIMIT 1`, [descripcion]);

                if (userRows.length === 0) {
                    return sendError(res, 400, "Registro no permitido: Descripción", null, { "descripcion": `La descripción ${descripcion} no se encuentra registrada en el sistema.` });
                }
            }

            const keys = Object.keys(datai);
            const values = Object.values(datai);
            const placeholders = keys.map(() => '?').join(', ');
            const campos = keys.join(', ');

            const query = `
                INSERT INTO registros_gestion_de_sst (${campos})
                VALUES (${placeholders})
            `;

            const [result] = await dbRailway.query(query, values);

            const [registroGuardado] = await dbRailway.query('SELECT * FROM registros_gestion_de_sst WHERE id = ?', [result.insertId]);

            resultados.push({
                datos: registroGuardado[0]
            });
        }

        return sendResponse(
            res,
            201,
            `Registro creado correctamente`,
            `Se ha guardado ${resultados.length} registros.`,
            resultados
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