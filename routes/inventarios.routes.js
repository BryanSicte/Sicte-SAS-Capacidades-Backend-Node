const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { guardarImagenBase64, obtenerImagenPorNombreYCarpeta } = require('./imagenes.routes');

const folderId = '15zXoJk48Di04KOA1Maa0u2ULBFEovHUV';

router.get('/registros', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_inventarios');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} registros de inventarios.`,
            rows
        );
    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.get('/registrosCedulasTecnico', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT DISTINCT inventario, cedulaTecnico FROM registros_inventarios');

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron ${rows.length} cedulas de inventarios.`,
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

        const fecha = Date.now();
        const nombreFirmaMateriales = `${fecha}_fm_${data.cedulaTecnico}`;
        const nombreFirmaTecnico = `${fecha}_ft_${data.cedulaTecnico}`
        // const nombreFirmaEquipos = `${fecha}_fe_${data.cedulaTecnico}`

        const firmaMaterialesId = await guardarImagenBase64(data.firmaMateriales, nombreFirmaMateriales, folderId);
        const firmaTecnicoId = await guardarImagenBase64(data.firmaTecnico, nombreFirmaTecnico, folderId);
        // const firmaEquiposId = await guardarImagenBase64(data.firmaEquipos, nombreFirmaEquipos, folderId);

        const insertIds = [];

        for (const material of data.materiales) {
            const registro = {
                fecha: data.fecha,
                cedulaUsuario: data.cedulaUsuario,
                nombreUsuario: data.nombreusuario,
                cedulaTecnico: data.cedulaTecnico,
                nombreTecnico: data.nombreTecnico,
                inventario: data.inventario,
                codigo: material.codigo,
                descripcion: material.descripcion,
                cantidad: material.cantidad,
                unidadMedida: material.unidadMedida,
                firmaMateriales: nombreFirmaMateriales,
                firmaTecnico: nombreFirmaTecnico,
                // firmaEquipos: nombreFirmaEquipos,
            };

            const keys = Object.keys(registro);
            const values = Object.values(registro);

            const placeholders = keys.map(() => '?').join(', ');
            const campos = keys.join(', ');

            const query = `
                INSERT INTO registros_inventarios (${campos})
                VALUES (${placeholders})
            `;

            const [result] = await dbRailway.query(query, values);
            insertIds.push(result.insertId);
        }

        return sendResponse(
            res,
            200,
            `Registro creado correctamente`,
            `Se han insertado ${insertIds.length} materiales.`,
            { insertIds }
        );

    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});


router.get("/descargarImagen", validarToken, async (req, res) => {
    try {
        const { filename } = req.query;

        if (!filename) {
            return res.status(400).json({ error: "Se requiere filename" });
        }

        const imagen = await obtenerImagenPorNombreYCarpeta(filename, folderId);

        if (!imagen) {
            return sendError(res, 404, "No se encontró la imagen.", "Archivo no encontrado en Google Drive.");
        }

        return sendResponse(
            res,
            200,
            "Imagen obtenida correctamente.",
            `Se descargó exitosamente la imagen '${filename}' desde Google Drive.`,
            imagen
        );
    } catch (error) {
        return sendError(res, 500, "Error inesperado.", error);
    }
});

module.exports = router;