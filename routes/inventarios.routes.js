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
            };

            const keys = Object.keys(registro);
            const values = Object.values(registro);

            const placeholders = keys.map(() => '?').join(', ');
            const campos = keys.join(', ');

            const query = `INSERT INTO registros_inventarios (${campos}) VALUES (${placeholders})`;

            const [result] = await dbRailway.query(query, values);
            insertIds.push(result.insertId);
        }

        return sendResponse(
            res,
            200,
            `Registro creado correctamente`,
            `El inventario de ${data.nombreTecnico} fue creado.`,
            { insertIds }
        );

    } catch (err) {
        return sendError(res, 500, "Error inesperado.", err);
    }
});

router.put('/actualizarRegistros', validarToken, async (req, res) => {

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            return sendError(res, 400, "Los datos del registro son requeridos.");
        }

        const [existentes] = await dbRailway.query(`SELECT codigo, cantidad FROM registros_inventarios WHERE cedulaTecnico = ? AND inventario = ?`, [data.cedulaTecnico, data.inventario]);

        const mapExistentes = new Map(existentes.map(m => [m.codigo, m.cantidad]));

        for (const mat of data.materiales) {
            const cantidadNueva = parseFloat(mat.cantidad);
            const cantidadExistente = parseFloat(mapExistentes.get(mat.codigo));

            if (mapExistentes.has(mat.codigo)) {
                if (cantidadNueva !== cantidadExistente) {
                    await dbRailway.query(`
                        UPDATE registros_inventarios
                        SET cantidad = ?, cedulaUsuario = ?, nombreusuario = ?
                        WHERE codigo = ? AND cedulaTecnico = ? AND inventario = ?
                    `, [mat.cantidad, data.cedulaUsuario, data.nombreusuario, mat.codigo, data.cedulaTecnico, data.inventario]);
                }
                mapExistentes.delete(mat.codigo);
            } else {
                const registro = {
                    fecha: data.fecha,
                    cedulaUsuario: data.cedulaUsuario,
                    nombreUsuario: data.nombreusuario,
                    cedulaTecnico: data.cedulaTecnico,
                    nombreTecnico: data.nombreTecnico,
                    inventario: data.inventario,
                    codigo: mat.codigo,
                    descripcion: mat.descripcion,
                    cantidad: mat.cantidad,
                    unidadMedida: mat.unidadMedida,
                };

                const keys = Object.keys(registro);
                const values = Object.values(registro);

                const placeholders = keys.map(() => '?').join(', ');
                const campos = keys.join(', ');

                const query = `INSERT INTO registros_inventarios (${campos}) VALUES (${placeholders})`;

                await dbRailway.query(query, values);
                mapExistentes.delete(mat.codigo);
            }
        }

        for (const [codigo] of mapExistentes) {
            await dbRailway.query(`
                DELETE FROM registros_inventarios
                WHERE codigo = ? AND cedulaTecnico = ? AND inventario = ?
            `, [codigo, data.cedulaTecnico, data.inventario]);
        }

        const fecha = Date.now();
        if (data.firmaMateriales !== null && data.firmaMateriales.startsWith('data:image')) {
            const nombreFirmaMateriales = `${fecha}_fm_${data.cedulaTecnico}`;
            const firmaMaterialesId = await guardarImagenBase64(data.firmaMateriales, nombreFirmaMateriales, folderId);
            const query = `
                UPDATE registros_inventarios
                SET firmaMateriales = ?
                WHERE cedulaTecnico = ? AND inventario = ? AND fecha = ?
            `;
            const values = [nombreFirmaMateriales, data.cedulaTecnico, data.inventario, data.fecha];

            await dbRailway.query(query, values);
        }
        if (data.firmaTecnico !== null && data.firmaTecnico.startsWith('data:image')) {
            const nombreFirmaTecnico = `${fecha}_ft_${data.cedulaTecnico}`;
            const firmaTecnicoId = await guardarImagenBase64(data.firmaTecnico, nombreFirmaTecnico, folderId);
            const query = `
                UPDATE registros_inventarios
                SET firmaTecnico = ?
                WHERE cedulaTecnico = ? AND inventario = ? AND fecha = ?
            `;
            const values = [nombreFirmaTecnico, data.cedulaTecnico, data.inventario, data.fecha];
            await dbRailway.query(query, values);
        }
        if (data.firmaEquipos !== null && data.firmaEquipos.startsWith('data:image')) {
            const nombreFirmaEquipos = `${fecha}_fe_${data.cedulaTecnico}`
            const firmaEquiposId = await guardarImagenBase64(data.firmaEquipos, nombreFirmaEquipos, folderId);
            const query = `
                UPDATE registros_inventarios
                SET firmaEquipos = ?
                WHERE cedulaTecnico = ? AND inventario = ? AND fecha = ?
            `;
            const values = [nombreFirmaEquipos, data.cedulaTecnico, data.inventario, data.fecha];
            await dbRailway.query(query, values);
        }

        return sendResponse(
            res,
            200,
            `Registro actualizado correctamente`,
            `El inventario de ${data.nombreTecnico} fue actualizado.`,
            { totalMateriales: data.materiales.length }
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