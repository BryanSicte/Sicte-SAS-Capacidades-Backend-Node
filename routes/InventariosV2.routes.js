const express = require('express');
const router = express.Router();
const dbAplicativosClaro = require('../db/db_aplicativos_claro');
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// --- Database Initialization ---
async function initDatabase() {
    try {
        console.log("Inicializando base de datos para Inventarios V2...");

        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS inventarios_registros (
                id INT AUTO_INCREMENT PRIMARY KEY,
                fechaRegistro DATETIME DEFAULT CURRENT_TIMESTAMP,
                fechaInicio DATETIME DEFAULT NULL,
                fechaFinal DATETIME DEFAULT NULL,
                tipoInventario VARCHAR(100) DEFAULT NULL,
                bodega VARCHAR(150) DEFAULT NULL,
                nombreInventario VARCHAR(200) DEFAULT NULL,
                tipoConteo VARCHAR(100) DEFAULT NULL,
                modoConteo VARCHAR(100) DEFAULT NULL,
                cantidadItems INT DEFAULT NULL,
                estado VARCHAR(100) DEFAULT 'Pendiente',
                creadoPor_nombre VARCHAR(200) DEFAULT NULL,
                creadoPor_cedula VARCHAR(100) DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
        `);

        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS inventarios_detalle (
                id INT AUTO_INCREMENT PRIMARY KEY,
                inventario_id INT NOT NULL,
                codigo VARCHAR(100) NOT NULL,
                descripcion TEXT DEFAULT NULL,
                cantidad_esperada INT DEFAULT 0,
                cantidad_contada INT DEFAULT 0,
                diferencia INT DEFAULT 0,
                estado VARCHAR(100) DEFAULT 'Pendiente',
                FOREIGN KEY (inventario_id) REFERENCES inventarios_registros(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
        `);

        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS inventarios_consecutivos_kgprod (
                id INT AUTO_INCREMENT PRIMARY KEY,
                bodega VARCHAR(150) NOT NULL,
                codigo VARCHAR(100) NOT NULL,
                consecutivo INT DEFAULT 0,
                UNIQUE KEY unique_bodega_codigo (bodega, codigo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
        `);

        console.log("Bases de datos para Inventarios V2 inicializadas correctamente.");
    } catch (err) {
        console.error("Error inicializando base de datos para Inventarios V2:", err);
    }
}

// Ejecutar inicialización de DB
initDatabase();

// Endpoint de prueba para obtener registros
router.get('/registros', (req, res) => {
    // Como aún no tenemos la estructura exacta, devolvemos un array vacío por ahora
    res.json({ data: [] });
});

router.get('/auxiliar', async (req, res) => {
    const usuarioToken = req.validarToken?.usuario || null;

    try {
        const [rows] = await dbRailway.query('SELECT * FROM tabla_aux_inventarios');

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inventarios',
            metodo: 'get',
            endPoint: 'auxiliar',
            accion: 'Consulta base exitosa',
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
            `Se obtuvieron ${rows.length} registros de la tabla auxiliar de inventarios.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inventarios',
            metodo: 'get',
            endPoint: 'auxiliar',
            accion: 'Error al obtener la base',
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
    const usuarioToken = req.validarToken?.usuario || null;
    const formData = req.body;

    try {
        if (formData.fechaInicio && formData.fechaFinal) {
            const start = new Date(formData.fechaInicio);
            const end = new Date(formData.fechaFinal);
            if (end < start) {
                return res.status(400).json({
                    messages: {
                        message1: "Error de validación",
                        message2: "La fecha final no puede ser menor a la fecha inicial."
                    }
                });
            }
        }

        // 1. Validar ítems de bodega antes de crear el encabezado (si es Aleatorio)
        let itemsForRandom = [];
        let bodegaFiltro = formData.bodega;
        if (formData.bodega === 'Bogota Enel AP') bodegaFiltro = 'KGPROD_ENEL_AP';

        const isAleatorio = formData.tipoInventario === 'Bodega' && formData.tipoConteo === 'Cíclico' && formData.modoConteo === 'Aleatorio' && formData.bodega;
        const cantidadRequerida = parseInt(formData.cantidadItems) || 0;

        if (isAleatorio && cantidadRequerida > 0) {
            const [items] = await dbRailway.query(`
                SELECT b.codigo, b.descrip as descripcion, IFNULL(c.consecutivo, 0) as consecutivo
                FROM bodega_kgprod b
                LEFT JOIN inventarios_consecutivos_kgprod c ON b.Bodega = c.bodega AND b.codigo = c.codigo
                WHERE b.Bodega = ?
            `, [bodegaFiltro]);

            if (items.length === 0) {
                return res.status(400).json({
                    messages: {
                        message1: "Error de inventario",
                        message2: "No hay ítems registrados en la bodega seleccionada para generar el conteo."
                    }
                });
            }
            itemsForRandom = items;
        }

        // 2. Insertar el encabezado en inventarios_registros
        const [resultHeader] = await dbRailway.query(`
            INSERT INTO inventarios_registros 
            (fechaRegistro, fechaInicio, fechaFinal, tipoInventario, bodega, nombreInventario, tipoConteo, modoConteo, cantidadItems, creadoPor_nombre, creadoPor_cedula)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            formData.fechaRegistro ? new Date(formData.fechaRegistro) : new Date(),
            formData.fechaInicio ? new Date(formData.fechaInicio) : null,
            formData.fechaFinal ? new Date(formData.fechaFinal) : null,
            formData.tipoInventario || null,
            formData.bodega || null,
            formData.nombreInventario || null,
            formData.tipoConteo || null,
            formData.modoConteo || null,
            formData.cantidadItems ? parseInt(formData.cantidadItems) : null,
            usuarioToken?.nombre || 'No registrado',
            usuarioToken?.cedula || 'No registrado'
        ]);

        const inventarioId = resultHeader.insertId;
        let selectedItems = [];

        // 3. Selección de ítems aleatorios para "Bodega" y conteo "Cíclico" / "Aleatorio"
        if (isAleatorio && cantidadRequerida > 0 && itemsForRandom.length > 0) {
            // Agrupar ítems por consecutivo
            const groupedItems = itemsForRandom.reduce((acc, item) => {
                const cons = item.consecutivo;
                if (!acc[cons]) acc[cons] = [];
                acc[cons].push(item);
                return acc;
            }, {});

            // Ordenar las llaves (consecutivos) de menor a mayor
            const sortedConsecutivos = Object.keys(groupedItems).map(Number).sort((a, b) => a - b);

            let countToTake = cantidadRequerida;

            for (const cons of sortedConsecutivos) {
                if (countToTake <= 0) break;

                let availableItems = groupedItems[cons];
                // Desordenar (shuffle) aleatoriamente el array de ítems disponibles en este consecutivo
                availableItems = availableItems.sort(() => Math.random() - 0.5);

                const itemsToTake = availableItems.slice(0, countToTake);
                selectedItems = selectedItems.concat(itemsToTake);
                countToTake -= itemsToTake.length;
            }

            // Guardar los ítems seleccionados en inventarios_detalle
            if (selectedItems.length > 0) {
                const detalleValues = selectedItems.map(item => [
                    inventarioId,
                    item.codigo || 'Sin código',
                    item.descripcion || 'Sin descripción',
                    0 // cantidad_esperada (se puede actualizar después con query a stock si es necesario)
                ]);

                await dbRailway.query(`
                            INSERT INTO inventarios_detalle (inventario_id, codigo, descripcion, cantidad_esperada)
                            VALUES ?
                        `, [detalleValues]);

                // Actualizar inventarios_consecutivos_kgprod incrementando en 1 el consecutivo
                for (const item of selectedItems) {
                    const nextConsecutivo = item.consecutivo + 1;
                    await dbRailway.query(`
                                INSERT INTO inventarios_consecutivos_kgprod (bodega, codigo, consecutivo)
                                VALUES (?, ?, ?)
                                ON DUPLICATE KEY UPDATE consecutivo = VALUES(consecutivo)
                            `, [bodegaFiltro, item.codigo, nextConsecutivo]);
                }
            }
        }
        // Registrar en historial
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inventarios',
            metodo: 'post',
            endPoint: 'crearRegistro',
            accion: 'Creación de inventario',
            detalle: `Se creó el inventario ID ${inventarioId} con ${selectedItems.length} ítems aleatorios`,
            datos: formData,
            tablasIdsAfectados: [`inventarios_registros:${inventarioId}`],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            201,
            `Inventario creado exitosamente`,
            `Se generó el registro con ${selectedItems.length} ítems listos para contar.`,
            { inventarioId, itemsGenerados: selectedItems.length }
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'inventarios',
            metodo: 'post',
            endPoint: 'crearRegistro',
            accion: 'Error al crear inventario',
            detalle: 'Error interno del servidor',
            datos: { error: err.message },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendError(res, 500, "Error al crear el inventario", err);
    }
});

module.exports = router;
