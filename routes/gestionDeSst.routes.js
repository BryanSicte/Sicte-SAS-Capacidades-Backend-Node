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
            `Se obtuvieron ${rows.length} registros del reporte de rendimiento operativo.`,
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

            const { partida, descripcion, noDistrito, distrito, capataz, tipoDeCuadrilla, coordinadorDeObra } = datai;

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

            if (noDistrito) {
                const [userRows] = await dbRailway.query(`SELECT noDistrito FROM tabla_aux_gestion_de_sst WHERE noDistrito = ? LIMIT 1`, [noDistrito]);

                if (userRows.length === 0) {
                    return sendError(res, 400, "Registro no permitido: No. Distrito", null, { "noDistrito": `El número de distrito ${noDistrito} no se encuentra registrado en el sistema.` });
                }
            }

            if (distrito) {
                const [userRows] = await dbRailway.query(`SELECT distrito FROM tabla_aux_gestion_de_sst WHERE distrito = ? LIMIT 1`, [distrito]);

                if (userRows.length === 0) {
                    return sendError(res, 400, "Registro no permitido: Distrito", null, { "distrito": `El distrito ${distrito} no se encuentra registrado en el sistema.` });
                }
            }

            if (capataz) {
                const [userRows] = await dbRailway.query(`SELECT capataz FROM tabla_aux_gestion_de_sst WHERE capataz = ? LIMIT 1`, [capataz]);

                if (userRows.length === 0) {
                    return sendError(res, 400, "Registro no permitido: Capataz", null, { "capataz": `El capataz ${capataz} no se encuentra registrado en el sistema.` });
                }
            }

            if (tipoDeCuadrilla) {
                const [userRows] = await dbRailway.query(`SELECT tipoDeCuadrilla FROM tabla_aux_gestion_de_sst WHERE tipoDeCuadrilla = ? LIMIT 1`, [tipoDeCuadrilla]);

                if (userRows.length === 0) {
                    return sendError(res, 400, "Registro no permitido: Tipo de Cuadrilla", null, { "tipoDeCuadrilla": `El tipo de cuadrilla ${tipoDeCuadrilla} no se encuentra registrado en el sistema.` });
                }
            }

            if (coordinadorDeObra) {
                const [userRows] = await dbRailway.query(`SELECT coordinadorDeObra FROM tabla_aux_gestion_de_sst WHERE coordinadorDeObra = ? LIMIT 1`, [coordinadorDeObra]);

                if (userRows.length === 0) {
                    return sendError(res, 400, "Registro no permitido: Coordinador de Obra", null, { "coordinadorDeObra": `El coordinador de obra ${coordinadorDeObra} no se encuentra registrado en el sistema.` });
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

router.get('/tablaAuxiliar', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM tabla_aux_gestion_de_sst');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de la tabla auxiliar.`,
            rows
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

module.exports = router;