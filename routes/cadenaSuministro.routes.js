const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { validateRequiredFields } = require('../utils/validate');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');
const { uploadFileToDrive, getMimeType, getFileFromDrive } = require('../services/googleDriveService')
const { getFechaHoraColombia } = require('../utils/formatdate');
const multer = require('multer');
const upload = multer();
const path = require('path');
const bcrypt = require('bcrypt');

const folderId = '1dJdsXK_WxtvoLmn0Dgcm5uvRA1YYnbuE';

// Asynchronous DB initialization
async function initDatabase() {
    try {
        console.log("Inicializando base de datos para Cadena de Suministro...");

        // 1. Tabla de cabecera de la solicitud
        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS cadena_suministro_solicitud (
              id INT AUTO_INCREMENT PRIMARY KEY,
              solicitud INT UNIQUE NOT NULL,
              fecha VARCHAR(50) NOT NULL,
              cedulaUsuario VARCHAR(50) NOT NULL,
              nombreUsuario VARCHAR(100) NOT NULL,
              tipoSolicitud VARCHAR(50) NOT NULL,
              ciudad VARCHAR(50) NOT NULL,
              area VARCHAR(50) NOT NULL,
              centro_costos VARCHAR(45) NOT NULL,
              nombre_centro_costos VARCHAR(100) NOT NULL,
              implementacion VARCHAR(45) NOT NULL,
              contratista VARCHAR(45) NOT NULL,
              bodega VARCHAR(45) NOT NULL,
              uuidOt VARCHAR(50) NULL,
              nombreProyecto VARCHAR(100) NULL,
              fechaEntregaProyectada VARCHAR(50) NULL,
              diseno JSON NULL,
              facturacionEsperada JSON NULL,
              observaciones TEXT NOT NULL,
              estadoSolicitud VARCHAR(50) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 2. Tabla de items solicitados
        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS cadena_suministro_item (
              id INT AUTO_INCREMENT PRIMARY KEY,
              solicitud_id INT NOT NULL,
              solicitudItem VARCHAR(45) NOT NULL,
              codigo VARCHAR(50) NOT NULL,
              descripcion VARCHAR(200) NOT NULL,
              um VARCHAR(50) NOT NULL,
              cantidad VARCHAR(50) NOT NULL,
              FOREIGN KEY (solicitud_id) REFERENCES cadena_suministro_solicitud(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 3. Tabla de aprobacion del director (Aprobacion 1)
        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS cadena_suministro_aprobacion_director (
              id INT AUTO_INCREMENT PRIMARY KEY,
              item_id INT NOT NULL UNIQUE,
              fechaAprobacion1 VARCHAR(30) NULL,
              cedulaUsuarioAprobacion1 VARCHAR(30) NULL,
              nombreUsuarioAprobacion1 VARCHAR(100) NULL,
              observacionAprobacion1 TEXT NULL,
              firmaAprobacion1 TEXT NULL,
              estadoAprobacion1 VARCHAR(30) NULL,
              FOREIGN KEY (item_id) REFERENCES cadena_suministro_item(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 4. Tabla de logistica, bodega, traslados y despacho
        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS cadena_suministro_logistica_despacho (
              id INT AUTO_INCREMENT PRIMARY KEY,
              item_id INT NOT NULL UNIQUE,
              fechaLogistica VARCHAR(30) NULL,
              cedulaUsuarioLogistica VARCHAR(30) NULL,
              nombreUsuarioLogistica VARCHAR(100) NULL,
              disponibilidadLogistica VARCHAR(30) NULL,
              cantidadRestanteLogistica VARCHAR(30) NULL,
              bodegaConfirmacionLogistica VARCHAR(30) NULL,
              estadoLogistica VARCHAR(30) NULL,
              consecutivoTrasladoLogistica VARCHAR(30) NULL,
              fechaTrasladoSalidaLogistica VARCHAR(30) NULL,
              cedulaUsuarioTrasladoSalidaLogistica VARCHAR(30) NULL,
              nombreUsuarioTrasladoSalidaLogistica VARCHAR(100) NULL,
              cantidadTrasladoSalidaLogistica VARCHAR(30) NULL,
              pdfsTrasladoSalidaLogistica JSON NULL,
              observacionTrasladoSalidaLogistica TEXT NULL,
              fechaTrasladoEntradaLogistica VARCHAR(30) NULL,
              cedulaUsuarioTrasladoEntradaLogistica VARCHAR(30) NULL,
              nombreUsuarioTrasladoEntradaLogistica VARCHAR(100) NULL,
              cantidadTrasladoEntradaLogistica VARCHAR(30) NULL,
              pdfsTrasladoEntradaLogistica JSON NULL,
              observacionTrasladoEntradaLogistica TEXT NULL,
              estadoTrasladoLogistica VARCHAR(30) NULL,
              fechaDespachoMaterial VARCHAR(30) NULL,
              cedulaUsuarioDespachoMaterial VARCHAR(30) NULL,
              nombreUsuarioDespachoMaterial VARCHAR(100) NULL,
              cantidadDespachadaMaterial VARCHAR(30) NULL,
              pdfsDespachoMaterial JSON NULL,
              observacionDespachoMaterial TEXT NULL,
              estadoDespachoMaterial VARCHAR(30) NULL,
              FOREIGN KEY (item_id) REFERENCES cadena_suministro_item(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 5. Tabla de compras, OC, aprobaciones de OC y entregas de proveedor
        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS cadena_suministro_compras (
              id INT AUTO_INCREMENT PRIMARY KEY,
              item_id INT NOT NULL UNIQUE,
              fechaCompra VARCHAR(30) NULL,
              cedulaUsuarioCompras VARCHAR(30) NULL,
              nombreUsuarioCompras VARCHAR(100) NULL,
              nitProveedor VARCHAR(30) NULL,
              proveedor VARCHAR(100) NULL,
              descripcionProveedor TEXT NULL,
              umProveedor VARCHAR(30) NULL,
              cantidadProveedor VARCHAR(30) NULL,
              formaPago VARCHAR(30) NULL,
              plazoPagoDias VARCHAR(30) NULL,
              tipoMoneda VARCHAR(30) NULL,
              precioAnticipo VARCHAR(30) NULL,
              precioUnitario VARCHAR(30) NULL,
              precioTotalSinIva VARCHAR(30) NULL,
              iva VARCHAR(30) NULL,
              precioTotalConIva VARCHAR(30) NULL,
              plazoEntrega VARCHAR(30) NULL,
              observacionCompra TEXT NULL,
              fechaOrdenCompra VARCHAR(30) NULL,
              cedulaUsuarioElaboraCompra VARCHAR(30) NULL,
              nombreUsuarioElaboraCompra VARCHAR(100) NULL,
              ordenCompra VARCHAR(30) NULL,
              totalGeneralSinIva VARCHAR(30) NULL,
              totalIva VARCHAR(30) NULL,
              totalOrdenCompra VARCHAR(30) NULL,
              firmaCompra TEXT NULL,
              estadoCompra VARCHAR(30) NULL,
              fechaAprobacion2 VARCHAR(30) NULL,
              cedulaUsuarioAprobacion2 VARCHAR(30) NULL,
              nombreUsuarioAprobacion2 VARCHAR(100) NULL,
              observacionAprobacion2 TEXT NULL,
              firmaAprobacion2 TEXT NULL,
              estadoAprobacion2 VARCHAR(30) NULL,
              fechaAprobacion3 VARCHAR(30) NULL,
              cedulaUsuarioAprobacion3 VARCHAR(30) NULL,
              nombreUsuarioAprobacion3 VARCHAR(100) NULL,
              observacionAprobacion3 TEXT NULL,
              firmaAprobacion3 TEXT NULL,
              estadoAprobacion3 VARCHAR(30) NULL,
              fechaAprobacion4 VARCHAR(30) NULL,
              cedulaUsuarioAprobacion4 VARCHAR(30) NULL,
              nombreUsuarioAprobacion4 VARCHAR(100) NULL,
              observacionAprobacion4 TEXT NULL,
              firmaAprobacion4 TEXT NULL,
              estadoAprobacion4 VARCHAR(30) NULL,
              fechaEnvioOrdenCompra VARCHAR(30) NULL,
              cedulaUsuarioEnvioOrdenCompra VARCHAR(30) NULL,
              nombreUsuarioEnvioOrdenCompra VARCHAR(100) NULL,
              envioDeCorreoEnvioOrdenCompra VARCHAR(30) NULL,
              estadoEnvioOrdenCompra VARCHAR(30) NULL,
              fechaEntregaProveedor VARCHAR(30) NULL,
              cedulaUsuarioEntregaProveedor VARCHAR(30) NULL,
              nombreUsuarioEntregaProveedor VARCHAR(100) NULL,
              cantidadEntregaProveedor VARCHAR(30) NULL,
              pdfsEntregaProveedor JSON NULL,
              observacionEntregaProveedor TEXT NULL,
              estadoEntregaProveedor VARCHAR(30) NULL,
              FOREIGN KEY (item_id) REFERENCES cadena_suministro_item(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 6. Tabla de finanzas y facturación
        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS cadena_suministro_finanzas_facturacion (
              id INT AUTO_INCREMENT PRIMARY KEY,
              item_id INT NOT NULL UNIQUE,
              fechaContabilidad VARCHAR(30) NULL,
              cedulaUsuarioContabilidad VARCHAR(30) NULL,
              nombreUsuarioContabilidad VARCHAR(100) NULL,
              rtFteContabilidad VARCHAR(30) NULL,
              rtIvaContabilidad VARCHAR(30) NULL,
              rtIcaContabilidad VARCHAR(30) NULL,
              totalPagarContabilidad VARCHAR(30) NULL,
              observacionContabilidad TEXT NULL,
              estadoContabilidad VARCHAR(30) NULL,
              fechaAprobacionAnticipo3 VARCHAR(30) NULL,
              cedulaUsuarioAprobacionAnticipo3 VARCHAR(30) NULL,
              nombreUsuarioAprobacionAnticipo3 VARCHAR(100) NULL,
              observacionAprobacionAnticipo3 TEXT NULL,
              firmaAprobacionAnticipo3 TEXT NULL,
              estadoAprobacionAnticipo3 VARCHAR(30) NULL,
              fechaAprobacionAnticipo4 VARCHAR(30) NULL,
              cedulaUsuarioAprobacionAnticipo4 VARCHAR(30) NULL,
              nombreUsuarioAprobacionAnticipo4 VARCHAR(100) NULL,
              observacionAprobacionAnticipo4 TEXT NULL,
              firmaAprobacionAnticipo4 TEXT NULL,
              estadoAprobacionAnticipo4 VARCHAR(30) NULL,
              fechaAnticipoTesoreria VARCHAR(30) NULL,
              cedulaUsuarioAnticipoTesoreria VARCHAR(30) NULL,
              nombreUsuarioAnticipoTesoreria VARCHAR(100) NULL,
              observacionAnticipoTesoreria TEXT NULL,
              firmaAnticipoTesoreria TEXT NULL,
              pdfsAnticipoTesoreria JSON NULL,
              estadoAnticipoTesoreria VARCHAR(30) NULL,
              fechaTesoreria VARCHAR(30) NULL,
              cedulaUsuarioTesoreria VARCHAR(30) NULL,
              nombreUsuarioTesoreria VARCHAR(100) NULL,
              observacionTesoreria TEXT NULL,
              firmaTesoreria TEXT NULL,
              pdfsTesoreria JSON NULL,
              estadoFacturasTesoreria VARCHAR(30) NULL,
              estadoTesoreria VARCHAR(30) NULL,
              fechaAsociacionFactura VARCHAR(30) NULL,
              cedulaUsuarioAsociacionFactura VARCHAR(30) NULL,
              nombreUsuarioAsociacionFactura VARCHAR(100) NULL,
              consecutivoAsociacionFactura VARCHAR(30) NULL,
              fechaRevisionFactura VARCHAR(30) NULL,
              cedulaUsuarioRevisionFactura VARCHAR(30) NULL,
              nombreUsuarioRevisionFactura VARCHAR(100) NULL,
              pdfsRevisionFactura JSON NULL,
              observacionRevisionFactura TEXT NULL,
              estadoAsociacionFactura VARCHAR(30) NULL,
              FOREIGN KEY (item_id) REFERENCES cadena_suministro_item(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log("Base de datos para Cadena de Suministro inicializada correctamente.");
    } catch (err) {
        console.error("Error inicializando base de datos para Cadena de Suministro:", err);
    }
}

// Run DB init
initDatabase();

// Funciones de utilidad para recalcular el estado de la solicitud en base al estado de sus ítems
async function recalcularYActualizarEstadoSolicitud(solicitudId, connectionOrDb) {
    const db = connectionOrDb || dbRailway;
    const [items] = await db.query(`
        SELECT 
          ad.estadoAprobacion1,
          ld.estadoLogistica,
          ld.estadoTrasladoLogistica,
          ld.estadoDespachoMaterial,
          c.estadoCompra,
          c.estadoAprobacion2,
          c.estadoAprobacion3,
          c.estadoAprobacion4,
          c.estadoEnvioOrdenCompra,
          c.estadoEntregaProveedor,
          ff.estadoContabilidad,
          ff.estadoAprobacionAnticipo3,
          ff.estadoAprobacionAnticipo4,
          ff.estadoAnticipoTesoreria,
          ff.estadoTesoreria,
          ff.estadoAsociacionFactura
        FROM cadena_suministro_item i
        LEFT JOIN cadena_suministro_aprobacion_director ad ON i.id = ad.item_id
        LEFT JOIN cadena_suministro_logistica_despacho ld ON i.id = ld.item_id
        LEFT JOIN cadena_suministro_compras c ON i.id = c.item_id
        LEFT JOIN cadena_suministro_finanzas_facturacion ff ON i.id = ff.item_id
        WHERE i.solicitud_id = ?
    `, [solicitudId]);

    if (!items || items.length === 0) return;

    const prioridadEstados = {
        'Pendiente Aprobacion 1': 1,
        'Pendiente Logistica': 2,
        'Pendiente Compras': 3,
        'Pendiente Aprobacion 2': 4,
        'Pendiente Aprobacion 3': 5,
        'Pendiente Aprobacion 4': 6,
        'Pendiente Contabilidad': 7,
        'Pendiente Aprobacion 3 Anticipo': 8,
        'Pendiente Aprobacion 4 Anticipo': 9,
        'Pendiente Tesoreria': 10,
        'Pendiente Envio Orden de Compra': 11,
        'Pendiente Entrega Proveedor': 12,
        'Pendiente Traslado Entre Bodegas': 13,
        'Pendiente Despacho Bodega': 14,
        'Rechazado': 15
    };

    let activeStates = new Set();

    for (const item of items) {
        if (item.estadoAprobacion1 === 'Pendiente') {
            activeStates.add('Pendiente Aprobacion 1');
        }
        if (item.estadoLogistica === 'Pendiente') {
            activeStates.add('Pendiente Logistica');
        }
        if (item.estadoCompra === 'Pendiente' || item.estadoCompra === 'En Proceso') {
            activeStates.add('Pendiente Compras');
        }
        if (item.estadoAprobacion2 === 'Pendiente') {
            activeStates.add('Pendiente Aprobacion 2');
        }
        if (item.estadoAprobacion3 === 'Pendiente') {
            activeStates.add('Pendiente Aprobacion 3');
        }
        if (item.estadoAprobacion4 === 'Pendiente') {
            activeStates.add('Pendiente Aprobacion 4');
        }
        if (item.estadoContabilidad === 'Pendiente') {
            activeStates.add('Pendiente Contabilidad');
        }
        if (item.estadoAprobacionAnticipo3 === 'Pendiente') {
            activeStates.add('Pendiente Aprobacion 3 Anticipo');
        }
        if (item.estadoAprobacionAnticipo4 === 'Pendiente') {
            activeStates.add('Pendiente Aprobacion 4 Anticipo');
        }
        if (item.estadoAnticipoTesoreria === 'Pendiente' || item.estadoTesoreria === 'Pendiente') {
            activeStates.add('Pendiente Tesoreria');
        }
        if (item.estadoEnvioOrdenCompra === 'Pendiente') {
            activeStates.add('Pendiente Envio Orden de Compra');
        }
        if (item.estadoEntregaProveedor === 'Pendiente' || item.estadoEntregaProveedor === 'Parcial') {
            activeStates.add('Pendiente Entrega Proveedor');
        }
        if (item.estadoTrasladoLogistica === 'Pendiente' || item.estadoTrasladoLogistica === 'En Transito') {
            activeStates.add('Pendiente Traslado Entre Bodegas');
        }
        if (item.estadoDespachoMaterial === 'Pendiente' || item.estadoDespachoMaterial === 'Parcial') {
            activeStates.add('Pendiente Despacho Bodega');
        }

        if (
            item.estadoAprobacion1 === 'Rechazado' ||
            item.estadoLogistica === 'Rechazado' ||
            item.estadoCompra === 'Rechazado' ||
            item.estadoAprobacion2 === 'Rechazado' ||
            item.estadoAprobacion3 === 'Rechazado' ||
            item.estadoAprobacion4 === 'Rechazado' ||
            item.estadoContabilidad === 'Rechazado' ||
            item.estadoAprobacionAnticipo3 === 'Rechazado' ||
            item.estadoAprobacionAnticipo4 === 'Rechazado' ||
            item.estadoAnticipoTesoreria === 'Rechazado' ||
            item.estadoTesoreria === 'Rechazado' ||
            item.estadoEnvioOrdenCompra === 'Rechazado' ||
            item.estadoEntregaProveedor === 'Rechazado' ||
            item.estadoTrasladoLogistica === 'Rechazado' ||
            item.estadoDespachoMaterial === 'Rechazado' ||
            item.estadoAsociacionFactura === 'Rechazado'
        ) {
            activeStates.add('Rechazado');
        }
    }

    let finalState = 'Realizado';
    if (activeStates.size > 0) {
        let minPriority = Infinity;
        for (const state of activeStates) {
            const priority = prioridadEstados[state];
            if (priority !== undefined && priority < minPriority) {
                minPriority = priority;
                finalState = state;
            }
        }
    }

    await db.query(
        `UPDATE cadena_suministro_solicitud SET estadoSolicitud = ? WHERE id = ?`,
        [finalState, solicitudId]
    );
}

async function recalcularYActualizarEstadoSolicitudPorItems(itemIds, connectionOrDb) {
    const db = connectionOrDb || dbRailway;
    const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
        `SELECT DISTINCT solicitud_id FROM cadena_suministro_item WHERE id IN (${placeholders})`,
        ids
    );

    for (const row of rows) {
        await recalcularYActualizarEstadoSolicitud(row.solicitud_id, db);
    }
}

async function recalcularYActualizarEstadoSolicitudPorSolicitudNumero(solicitudNumero, connectionOrDb) {
    const db = connectionOrDb || dbRailway;
    const [rows] = await db.query(
        `SELECT id FROM cadena_suministro_solicitud WHERE solicitud = ?`,
        [solicitudNumero]
    );
    if (rows.length > 0) {
        await recalcularYActualizarEstadoSolicitud(rows[0].id, db);
    }
}

async function getRegistrosCompletos(whereClause, params) {
    const query = `
        SELECT 
          s.id as solicitud_id_db,
          i.id as id,
          s.solicitud as solicitud,
          s.fecha as fecha,
          s.cedulaUsuario as cedulaUsuario,
          s.nombreUsuario as nombreUsuario,
          s.tipoSolicitud as tipoSolicitud,
          s.ciudad as ciudad,
          s.area as area,
          s.centro_costos as centro_costos,
          s.nombre_centro_costos as nombre_centro_costos,
          s.implementacion as implementacion,
          s.contratista as contratista,
          s.bodega as bodega,
          s.uuidOt as uuidOt,
          s.nombreProyecto as nombreProyecto,
          s.fechaEntregaProyectada as fechaEntregaProyectada,
          s.diseno as diseno,
          s.facturacionEsperada as facturacionEsperada,
          s.observaciones as observaciones,
          s.estadoSolicitud as estadoSolicitud,
          
          i.solicitudItem as solicitudItem,
          i.codigo as codigo,
          i.descripcion as descripcion,
          i.um as um,
          i.cantidad as cantidad,
          
          ad.fechaAprobacion1 as fechaAprobacion1,
          ad.cedulaUsuarioAprobacion1 as cedulaUsuarioAprobacion1,
          ad.nombreUsuarioAprobacion1 as nombreUsuarioAprobacion1,
          ad.observacionAprobacion1 as observacionAprobacion1,
          ad.firmaAprobacion1 as firmaAprobacion1,
          ad.estadoAprobacion1 as estadoAprobacion1,
          
          ld.fechaLogistica as fechaLogistica,
          ld.cedulaUsuarioLogistica as cedulaUsuarioLogistica,
          ld.nombreUsuarioLogistica as nombreUsuarioLogistica,
          ld.disponibilidadLogistica as disponibilidadLogistica,
          ld.cantidadRestanteLogistica as cantidadRestanteLogistica,
          ld.bodegaConfirmacionLogistica as bodegaConfirmacionLogistica,
          ld.estadoLogistica as estadoLogistica,
          ld.consecutivoTrasladoLogistica as consecutivoTrasladoLogistica,
          ld.fechaTrasladoSalidaLogistica as fechaTrasladoSalidaLogistica,
          ld.cedulaUsuarioTrasladoSalidaLogistica as cedulaUsuarioTrasladoSalidaLogistica,
          ld.nombreUsuarioTrasladoSalidaLogistica as nombreUsuarioTrasladoSalidaLogistica,
          ld.cantidadTrasladoSalidaLogistica as cantidadTrasladoSalidaLogistica,
          ld.pdfsTrasladoSalidaLogistica as pdfsTrasladoSalidaLogistica,
          ld.observacionTrasladoSalidaLogistica as observacionTrasladoSalidaLogistica,
          ld.fechaTrasladoEntradaLogistica as fechaTrasladoEntradaLogistica,
          ld.cedulaUsuarioTrasladoEntradaLogistica as cedulaUsuarioTrasladoEntradaLogistica,
          ld.nombreUsuarioTrasladoEntradaLogistica as nombreUsuarioTrasladoEntradaLogistica,
          ld.cantidadTrasladoEntradaLogistica as cantidadTrasladoEntradaLogistica,
          ld.pdfsTrasladoEntradaLogistica as pdfsTrasladoEntradaLogistica,
          ld.observacionTrasladoEntradaLogistica as observacionTrasladoEntradaLogistica,
          ld.estadoTrasladoLogistica as estadoTrasladoLogistica,
          ld.fechaDespachoMaterial as fechaDespachoMaterial,
          ld.cedulaUsuarioDespachoMaterial as cedulaUsuarioDespachoMaterial,
          ld.nombreUsuarioDespachoMaterial as nombreUsuarioDespachoMaterial,
          ld.cantidadDespachadaMaterial as cantidadDespachadaMaterial,
          ld.pdfsDespachoMaterial as pdfsDespachoMaterial,
          ld.observacionDespachoMaterial as observacionDespachoMaterial,
          ld.estadoDespachoMaterial as estadoDespachoMaterial,
          
          c.fechaCompra as fechaCompra,
          c.cedulaUsuarioCompras as cedulaUsuarioCompras,
          c.nombreUsuarioCompras as nombreUsuarioCompras,
          c.nitProveedor as nitProveedor,
          c.proveedor as proveedor,
          c.descripcionProveedor as descripcionProveedor,
          c.umProveedor as umProveedor,
          c.cantidadProveedor as cantidadProveedor,
          c.formaPago as formaPago,
          c.plazoPagoDias as plazoPagoDias,
          c.tipoMoneda as tipoMoneda,
          c.precioAnticipo as precioAnticipo,
          c.precioUnitario as precioUnitario,
          c.precioTotalSinIva as precioTotalSinIva,
          c.iva as iva,
          c.precioTotalConIva as precioTotalConIva,
          c.plazoEntrega as plazoEntrega,
          c.observacionCompra as observacionCompra,
          c.fechaOrdenCompra as fechaOrdenCompra,
          c.cedulaUsuarioElaboraCompra as cedulaUsuarioElaboraCompra,
          c.nombreUsuarioElaboraCompra as nombreUsuarioElaboraCompra,
          c.ordenCompra as ordenCompra,
          c.totalGeneralSinIva as totalGeneralSinIva,
          c.totalIva as totalIva,
          c.totalOrdenCompra as totalOrdenCompra,
          c.firmaCompra as firmaCompra,
          c.estadoCompra as estadoCompra,
          c.fechaAprobacion2 as fechaAprobacion2,
          c.cedulaUsuarioAprobacion2 as cedulaUsuarioAprobacion2,
          c.nombreUsuarioAprobacion2 as nombreUsuarioAprobacion2,
          c.observacionAprobacion2 as observacionAprobacion2,
          c.firmaAprobacion2 as firmaAprobacion2,
          c.estadoAprobacion2 as estadoAprobacion2,
          c.fechaAprobacion3 as fechaAprobacion3,
          c.cedulaUsuarioAprobacion3 as cedulaUsuarioAprobacion3,
          c.nombreUsuarioAprobacion3 as nombreUsuarioAprobacion3,
          c.observacionAprobacion3 as observacionAprobacion3,
          c.firmaAprobacion3 as firmaAprobacion3,
          c.estadoAprobacion3 as estadoAprobacion3,
          c.fechaAprobacion4 as fechaAprobacion4,
          c.cedulaUsuarioAprobacion4 as cedulaUsuarioAprobacion4,
          c.nombreUsuarioAprobacion4 as nombreUsuarioAprobacion4,
          c.observacionAprobacion4 as observacionAprobacion4,
          c.firmaAprobacion4 as firmaAprobacion4,
          c.estadoAprobacion4 as estadoAprobacion4,
          c.fechaEnvioOrdenCompra as fechaEnvioOrdenCompra,
          c.cedulaUsuarioEnvioOrdenCompra as cedulaUsuarioEnvioOrdenCompra,
          c.nombreUsuarioEnvioOrdenCompra as nombreUsuarioEnvioOrdenCompra,
          c.envioDeCorreoEnvioOrdenCompra as envioDeCorreoEnvioOrdenCompra,
          c.estadoEnvioOrdenCompra as estadoEnvioOrdenCompra,
          c.fechaEntregaProveedor as fechaEntregaProveedor,
          c.cedulaUsuarioEntregaProveedor as cedulaUsuarioEntregaProveedor,
          c.nombreUsuarioEntregaProveedor as nombreUsuarioEntregaProveedor,
          c.cantidadEntregaProveedor as cantidadEntregaProveedor,
          c.pdfsEntregaProveedor as pdfsEntregaProveedor,
          c.observacionEntregaProveedor as observacionEntregaProveedor,
          c.estadoEntregaProveedor as estadoEntregaProveedor,
          
          ff.fechaContabilidad as fechaContabilidad,
          ff.cedulaUsuarioContabilidad as cedulaUsuarioContabilidad,
          ff.nombreUsuarioContabilidad as nombreUsuarioContabilidad,
          ff.rtFteContabilidad as rtFteContabilidad,
          ff.rtIvaContabilidad as rtIvaContabilidad,
          ff.rtIcaContabilidad as rtIcaContabilidad,
          ff.totalPagarContabilidad as totalPagarContabilidad,
          ff.observacionContabilidad as observacionContabilidad,
          ff.estadoContabilidad as estadoContabilidad,
          ff.fechaAprobacionAnticipo3 as fechaAprobacionAnticipo3,
          ff.cedulaUsuarioAprobacionAnticipo3 as cedulaUsuarioAprobacionAnticipo3,
          ff.nombreUsuarioAprobacionAnticipo3 as nombreUsuarioAprobacionAnticipo3,
          ff.observacionAprobacionAnticipo3 as observacionAprobacionAnticipo3,
          ff.firmaAprobacionAnticipo3 as firmaAprobacionAnticipo3,
          ff.estadoAprobacionAnticipo3 as estadoAprobacionAnticipo3,
          ff.fechaAprobacionAnticipo4 as fechaAprobacionAnticipo4,
          ff.cedulaUsuarioAprobacionAnticipo4 as cedulaUsuarioAprobacionAnticipo4,
          ff.nombreUsuarioAprobacionAnticipo4 as nombreUsuarioAprobacionAnticipo4,
          ff.observacionAprobacionAnticipo4 as observacionAprobacionAnticipo4,
          ff.firmaAprobacionAnticipo4 as firmaAprobacionAnticipo4,
          ff.estadoAprobacionAnticipo4 as estadoAprobacionAnticipo4,
          ff.fechaAnticipoTesoreria as fechaAnticipoTesoreria,
          ff.cedulaUsuarioAnticipoTesoreria as cedulaUsuarioAnticipoTesoreria,
          ff.nombreUsuarioAnticipoTesoreria as nombreUsuarioAnticipoTesoreria,
          ff.observacionAnticipoTesoreria as observacionAnticipoTesoreria,
          ff.firmaAnticipoTesoreria as firmaAnticipoTesoreria,
          ff.pdfsAnticipoTesoreria as pdfsAnticipoTesoreria,
          ff.estadoAnticipoTesoreria as estadoAnticipoTesoreria,
          ff.fechaTesoreria as fechaTesoreria,
          ff.cedulaUsuarioTesoreria as cedulaUsuarioTesoreria,
          ff.nombreUsuarioTesoreria as nombreUsuarioTesoreria,
          ff.observacionTesoreria as observacionTesoreria,
          ff.firmaTesoreria as firmaTesoreria,
          ff.pdfsTesoreria as pdfsTesoreria,
          ff.estadoFacturasTesoreria as estadoFacturasTesoreria,
          ff.estadoTesoreria as estadoTesoreria,
          ff.fechaAsociacionFactura as fechaAsociacionFactura,
          ff.cedulaUsuarioAsociacionFactura as cedulaUsuarioAsociacionFactura,
          ff.nombreUsuarioAsociacionFactura as nombreUsuarioAsociacionFactura,
          ff.consecutivoAsociacionFactura as consecutivoAsociacionFactura,
          ff.fechaRevisionFactura as fechaRevisionFactura,
          ff.cedulaUsuarioRevisionFactura as cedulaUsuarioRevisionFactura,
          ff.nombreUsuarioRevisionFactura as nombreUsuarioRevisionFactura,
          ff.pdfsRevisionFactura as pdfsRevisionFactura,
          ff.observacionRevisionFactura as observacionRevisionFactura,
          ff.estadoAsociacionFactura as estadoAsociacionFactura
        FROM cadena_suministro_item i
        JOIN cadena_suministro_solicitud s ON i.solicitud_id = s.id
        LEFT JOIN cadena_suministro_aprobacion_director ad ON i.id = ad.item_id
        LEFT JOIN cadena_suministro_logistica_despacho ld ON i.id = ld.item_id
        LEFT JOIN cadena_suministro_compras c ON i.id = c.item_id
        LEFT JOIN cadena_suministro_finanzas_facturacion ff ON i.id = ff.item_id
        WHERE ${whereClause}
    `;
    const [rows] = await dbRailway.query(query, params);
    return rows;
}

router.get('/registros', validarToken, async (req, res) => {

    const usuarioToken = req.validarToken.usuario

    try {
        const rows = await getRegistrosCompletos('1=1', []);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
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
            `Se obtuvieron ${rows.length} registros de las solicitudes de cadena de suministro.`,
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

router.post('/crearRegistro',
    validarToken,
    upload.fields([
        { name: 'diseno', maxCount: 1 },
        { name: 'facturacionEsperada', maxCount: 1 }
    ]),
    async (req, res) => {

        const usuarioToken = req.validarToken.usuario

        try {
            const data = req.body;
            const archivos = req.files;

            if (!data || Object.keys(data).length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
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

            let requiredFields;
            if (data.tipoSolicitud === 'Por proyecto') {
                requiredFields = {
                    fecha: "No se pudo obtener la fecha del registro.",
                    cedulaUsuario: "No se pudo identificar la cedula del usuario.",
                    nombreUsuario: "No se pudo identificar el nombre del usuario.",
                    tipoSolicitud: "Ingrese y seleccione un tipo de solicitud.",
                    ciudad: "Ingrese y seleccione una ciudad.",
                    area: "Ingrese y seleccione un area.",
                    centro_costos: "Ingrese y seleccione un centro de costos.",
                    nombre_centro_costos: "Ingrese y seleccione un nombre de centro de costos.",
                    implementacion: "Ingrese y seleccione una implementacion.",
                    contratista: "Ingrese y seleccione un contratista.",
                    bodega: "Ingrese y seleccione una bodega.",
                    uuidOt: "Ingrese un UUID o OT.",
                    nombreProyecto: "Ingrese un nombre del proyecto.",
                    fechaEntregaProyectada: "Ingrese una fecha proyectada.",
                };
            } else {
                requiredFields = {
                    fecha: "No se pudo obtener la fecha del registro.",
                    cedulaUsuario: "No se pudo identificar la cedula del usuario.",
                    nombreUsuario: "No se pudo identificar el nombre del usuario.",
                    tipoSolicitud: "Ingrese y seleccione un tipo de solicitud.",
                    ciudad: "Ingrese y seleccione una ciudad.",
                    area: "Ingrese y seleccione un area.",
                    centro_costos: "Ingrese y seleccione un centro de costos.",
                    nombre_centro_costos: "Ingrese y seleccione un nombre de centro de costos.",
                    implementacion: "Ingrese y seleccione una implementacion.",
                    contratista: "Ingrese y seleccione un contratista.",
                    bodega: "Ingrese y seleccione una bodega.",
                };
            }

            if (!validateRequiredFields(data, requiredFields, res)) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
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

            const items = JSON.parse(data.items);

            if (items.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'post',
                    endPoint: 'crearRegistro',
                    accion: 'Crear registro fallido',
                    detalle: 'Registro no permitido: Items',
                    datos: { itemsProporcionado: items },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Items", null, { "items": `Por favor ingrese al menos un material` });
            }

            const driveResults = [];
            const fechaColombia = getFechaHoraColombia()

            if (data.tipoSolicitud === 'Por proyecto') {
                if (!archivos?.diseno) {
                    await registrarHistorial({
                        nombreUsuario: usuarioToken.nombre || 'No registrado',
                        cedulaUsuario: usuarioToken.cedula || 'No registrado',
                        rolUsuario: usuarioToken.rol || 'No registrado',
                        nivel: 'log',
                        plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                        app: 'cadenaSuministro',
                        metodo: 'post',
                        endPoint: 'crearRegistro',
                        accion: 'Crear registro fallido',
                        detalle: 'Registro no permitido: Diseño',
                        datos: { ArchivoProporcionado: archivos },
                        tablasIdsAfectados: [],
                        ipAddress: getClientIp(req),
                        userAgent: req.headers['user-agent'] || ''
                    });

                    return sendError(res, 400, "Registro no permitido: Diseño", null, { "diseno": `Ingrese un archivo .zip para el diseño.` });
                }

                if (!archivos?.facturacionEsperada) {
                    await registrarHistorial({
                        nombreUsuario: usuarioToken.nombre || 'No registrado',
                        cedulaUsuario: usuarioToken.cedula || 'No registrado',
                        rolUsuario: usuarioToken.rol || 'No registrado',
                        nivel: 'log',
                        plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                        app: 'cadenaSuministro',
                        metodo: 'post',
                        endPoint: 'crearRegistro',
                        accion: 'Crear registro fallido',
                        detalle: 'Registro no permitido: Facturacion esperada',
                        datos: { ArchivoProporcionado: archivos },
                        tablasIdsAfectados: [],
                        ipAddress: getClientIp(req),
                        userAgent: req.headers['user-agent'] || ''
                    });

                    return sendError(res, 400, "Registro no permitido: Facturación esperada", null, { "facturacionEsperada": `Ingrese un archivo PDF para la facturación.` });
                }

                if (archivos?.diseno?.[0]) {
                    const disenoFile = archivos.diseno[0];

                    const disenoExt = path.extname(disenoFile.originalname);
                    const disenoFileName = `${data.uuidOt}_diseno_${fechaColombia}${disenoExt}`;

                    const fileId = await uploadFileToDrive(
                        disenoFile.buffer,
                        disenoFileName,
                        folderId
                    );

                    const result = {
                        tipo: 'diseno',
                        nombre: disenoFileName,
                        id: fileId.id,
                        url: fileId.url,
                        webViewLink: fileId.webViewLink
                    }

                    driveResults.push(result);

                    await registrarHistorial({
                        nombreUsuario: usuarioToken.nombre || 'No registrado',
                        cedulaUsuario: usuarioToken.cedula || 'No registrado',
                        rolUsuario: usuarioToken.rol || 'No registrado',
                        nivel: 'success',
                        plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                        app: 'cadenaSuministro',
                        metodo: 'post',
                        endPoint: 'crearRegistro',
                        accion: 'Cargar diseño exitoso',
                        detalle: 'Registro creado con exito',
                        datos: { result },
                        tablasIdsAfectados: [],
                        tablasIdsAfectados: [],
                        ipAddress: getClientIp(req),
                        userAgent: req.headers['user-agent'] || ''
                    });
                }

                if (archivos?.facturacionEsperada?.[0]) {
                    const facturacionFile = archivos.facturacionEsperada[0];

                    const factExt = path.extname(facturacionFile.originalname);
                    const factFileName = `${data.uuidOt}_facturacion_${fechaColombia}${factExt}`;

                    const fileId = await uploadFileToDrive(
                        facturacionFile.buffer,
                        factFileName,
                        folderId
                    );

                    const result = {
                        tipo: 'facturacion',
                        nombre: factFileName,
                        id: fileId.id,
                        url: fileId.url,
                        webViewLink: fileId.webViewLink
                    }

                    driveResults.push(result);

                    await registrarHistorial({
                        nombreUsuario: usuarioToken.nombre || 'No registrado',
                        cedulaUsuario: usuarioToken.cedula || 'No registrado',
                        rolUsuario: usuarioToken.rol || 'No registrado',
                        nivel: 'success',
                        plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                        app: 'cadenaSuministro',
                        metodo: 'post',
                        endPoint: 'crearRegistro',
                        accion: 'Cargar facturacion exitoso',
                        detalle: 'Registro creado con exito',
                        datos: { result },
                        tablasIdsAfectados: [],
                        tablasIdsAfectados: [],
                        ipAddress: getClientIp(req),
                        userAgent: req.headers['user-agent'] || ''
                    });
                }
            }

            const disenoResult = driveResults.find(f => f.tipo === 'diseno') || null;
            const facturacionResult = driveResults.find(f => f.tipo === 'facturacion') || null;
            const disenoJSON = disenoResult ? JSON.stringify(disenoResult) : null;
            const facturacionJSON = facturacionResult ? JSON.stringify(facturacionResult) : null;

            const resultados = [];

            let nuevoNumeroSolicitud = 1;
            const [maxRows] = await dbRailway.query('SELECT MAX(solicitud) as maxSolicitud FROM cadena_suministro_solicitud');
            const maxSolicitud = maxRows[0].maxSolicitud || 0;
            nuevoNumeroSolicitud = maxSolicitud + 1;

            const [solicitudResult] = await dbRailway.query(
                `INSERT INTO cadena_suministro_solicitud (
                    solicitud,
                    fecha,
                    cedulaUsuario,
                    nombreUsuario,
                    tipoSolicitud,
                    ciudad,
                    area,
                    centro_costos,
                    nombre_centro_costos,
                    implementacion,
                    contratista,
                    bodega,
                    uuidOt,
                    nombreProyecto,
                    fechaEntregaProyectada,
                    diseno,
                    facturacionEsperada,
                    observaciones,
                    estadoSolicitud
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    nuevoNumeroSolicitud,
                    data.fecha,
                    data.cedulaUsuario,
                    data.nombreUsuario,
                    data.tipoSolicitud,
                    data.ciudad,
                    data.area,
                    data.centro_costos,
                    data.nombre_centro_costos,
                    data.implementacion,
                    data.contratista,
                    data.bodega,
                    data.uuidOt || null,
                    data.nombreProyecto || null,
                    data.fechaEntregaProyectada || null,
                    disenoJSON,
                    facturacionJSON,
                    data.observaciones,
                    "Pendiente Aprobacion 1"
                ]
            );
            const solicitudIdDb = solicitudResult.insertId;

            for (const [index, item] of items.entries()) {
                const [itemResult] = await dbRailway.query(
                    `INSERT INTO cadena_suministro_item (
                        solicitud_id,
                        solicitudItem,
                        codigo,
                        descripcion,
                        um,
                        cantidad
                    ) VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        solicitudIdDb,
                        item.solicitudItem,
                        item.codigo,
                        item.descripcion,
                        item.um,
                        item.cantidad
                    ]
                );
                const itemId = itemResult.insertId;

                // Inicializar tablas de seguimiento hijas
                await dbRailway.query(
                    `INSERT INTO cadena_suministro_aprobacion_director (item_id, estadoAprobacion1) VALUES (?, ?)`,
                    [itemId, 'Pendiente']
                );
                await dbRailway.query(
                    `INSERT INTO cadena_suministro_logistica_despacho (item_id) VALUES (?)`,
                    [itemId]
                );
                await dbRailway.query(
                    `INSERT INTO cadena_suministro_compras (item_id) VALUES (?)`,
                    [itemId]
                );
                await dbRailway.query(
                    `INSERT INTO cadena_suministro_finanzas_facturacion (item_id) VALUES (?)`,
                    [itemId]
                );

                resultados.push({
                    item: item.codigo,
                    descripcion: item.descripcion,
                    cantidad: item.cantidad,
                    insertId: itemId,
                    solicitud: nuevoNumeroSolicitud,
                    affectedRows: itemResult.affectedRows
                });
            }

            const idsAfectados = resultados.map(r => ({
                tabla: 'cadena_suministro_item',
                id: r.insertId.toString()
            }));

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'post',
                endPoint: 'crearRegistro',
                accion: 'Crear registro exitoso',
                detalle: 'Registro creado con exito',
                datos: {
                    uuidOt: req.body.uuidOt,
                    solicitud: resultados[0].solicitud,
                    totalItems: resultados.length,
                    items: resultados.map(r => ({
                        codigo: r.item,
                        cantidad: r.cantidad,
                        insertId: r.insertId
                    })),
                    archivos: {
                        diseno: disenoJSON ? JSON.parse(disenoJSON) : null,
                        facturacion: facturacionJSON ? JSON.parse(facturacionJSON) : null
                    }
                },
                tablasIdsAfectados: idsAfectados,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                `Registro creado correctamente`,
                `Se ha guardado el registro con numero de solicitud ${resultados[0].solicitud}.`,
                resultados
            );

        } catch (err) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'Error sistema',
                cedulaUsuario: usuarioToken.cedula || 'Error sistema',
                rolUsuario: usuarioToken.rol || 'Error sistema',
                nivel: 'error',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
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

router.get('/centroCostos', validarToken, async (req, res) => {

    const usuarioToken = req.validarToken.usuario

    try {
        const [rows] = await dbRailway.query('SELECT centro_costos_completo, nombre_completo FROM centro_costos');

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'get',
            endPoint: 'centroCostos',
            accion: 'Consulta centro de costos exitosa',
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
            `Se obtuvieron registros de los centros de costos.`,
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
            endPoint: 'centroCostos',
            accion: 'Error al obtener los centros de costos',
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

router.post('/obtenerArchivos', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario
    const { nameDiseno, nameFacturacion } = req.body;

    try {
        const resultados = {};

        if (!nameDiseno) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'post',
                endPoint: 'obtenerArchivos',
                accion: 'Consulta archivos fallido',
                detalle: 'Registro no permitido: Nombre Diseño',
                datos: { nombreDiseñoProporcionado: nameDiseno },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Diseño", null, { "nameDiseno": `Ingrese el nombre del diseño.` });
        }

        if (nameDiseno) {
            const disenoBuffer = await getFileFromDrive(nameDiseno, folderId);
            if (disenoBuffer) {
                resultados.diseno = {
                    nombre: nameDiseno,
                    data: disenoBuffer.toString('base64'),
                    contentType: getMimeType(nameDiseno)
                };
            }
        }

        if (!nameFacturacion) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'post',
                endPoint: 'obtenerArchivos',
                accion: 'Consulta archivos fallido',
                detalle: 'Registro no permitido: Nombre Facturacion',
                datos: { nombreFacturacionProporcionado: nameFacturacion },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Facturacion", null, { "nameFacturacion": `Ingrese el nombre del diseño.` });
        }

        if (nameFacturacion) {
            const factBuffer = await getFileFromDrive(nameFacturacion, folderId);
            if (factBuffer) {
                resultados.facturacion = {
                    nombre: nameFacturacion,
                    data: factBuffer.toString('base64'),
                    contentType: getMimeType(nameFacturacion)
                };
            }
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'post',
            endPoint: 'obtenerArchivos',
            accion: 'Consulta archivos exitosa',
            detalle: `Se consultó ${resultados.length} registros`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron los archivos correctamente.`,
            resultados
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'post',
            endPoint: 'obtenerArchivos',
            accion: 'Error al obtener los archivos',
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

router.put('/logisticaActualizarCantidades/:id', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;

    try {
        const { id } = req.params;
        const data = req.body;

        if (!id || isNaN(id)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'logisticaActualizarCantidades',
                accion: 'Actualizar cantidades fallido',
                datos: { idProporcionado: id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "ID de solicitud inválido o no proporcionado.");
        }

        const solicitudesExistentes = await getRegistrosCompletos('s.solicitud = ?', [id]);

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'logisticaActualizarCantidades',
                accion: 'Actualizar cantidades fallido',
                detalle: 'Los datos del formulario son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del formulario son requeridos.");
        }

        const fechaColombia = getFechaHoraColombia()
        const { cantidadesEditadas, bodegasEditadas } = data;
        const idsActualizados = [];

        const cantidadesExistentesMap = {};
        solicitudesExistentes.forEach(solicitud => {
            cantidadesExistentesMap[solicitud.id] = solicitud.cantidad;
        });

        const BodegasExistentesMap = {};
        solicitudesExistentes.forEach(solicitud => {
            BodegasExistentesMap[solicitud.id] = solicitud.bodega;
        });

        const connection = await dbRailway.getConnection();
        try {
            await connection.beginTransaction();

            for (const [id, cantidadEditada] of Object.entries(cantidadesEditadas)) {

                const cantidadExistente = cantidadesExistentesMap[id];
                let estadoSolicitudRegistro = 'Validar';
                let estadoCompra = 'Validar';
                let estadoAprobacion2 = 'Validar';
                let cantidadRestanteLogistica = 0;

                if (parseFloat(cantidadExistente) === parseFloat(cantidadEditada)) {
                    estadoSolicitudRegistro = 'Pendiente Despacho Bodega';
                    estadoCompra = 'No aplica';
                    estadoAprobacion2 = 'No aplica';
                } else if (parseFloat(cantidadEditada) < parseFloat(cantidadExistente)) {
                    estadoSolicitudRegistro = 'Pendiente Compras';
                    estadoCompra = 'Pendiente';
                    estadoAprobacion2 = null;
                } else if (parseFloat(cantidadEditada) > parseFloat(cantidadExistente)) {
                    await registrarHistorial({
                        nombreUsuario: usuarioToken.nombre || 'No registrado',
                        cedulaUsuario: usuarioToken.cedula || 'No registrado',
                        rolUsuario: usuarioToken.rol || 'No registrado',
                        nivel: 'log',
                        plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                        app: 'cadenaSuministro',
                        metodo: 'put',
                        endPoint: 'logisticaActualizarCantidades',
                        accion: 'Actualizar cantidades fallido',
                        detalle: 'La cantidad disponible no puede ser mayor a la cantidad requerida.',
                        datos: { data },
                        tablasIdsAfectados: [],
                        ipAddress: getClientIp(req),
                        userAgent: req.headers['user-agent'] || ''
                    });

                    await connection.rollback();
                    return sendError(res, 400, "La cantidad disponible no puede ser mayor a la cantidad requerida.");
                } else {
                    estadoSolicitudRegistro = 'Pendiente logistica';
                    estadoCompra = null;
                    estadoAprobacion2 = null;
                }

                cantidadRestanteLogistica = parseFloat(cantidadExistente) - parseFloat(cantidadEditada);
                let estadoTrasladoLogistica = bodegasEditadas[id] !== BodegasExistentesMap[id] && parseFloat(cantidadEditada) !== 0 ? 'Pendiente' : 'No aplica';
                estadoSolicitudRegistro = estadoSolicitudRegistro === 'Pendiente Despacho Bodega' && estadoTrasladoLogistica === 'Pendiente' ? 'Pendiente Traslado Entre Bodegas' : estadoSolicitudRegistro;

                // 1. Actualizar logística
                await connection.query(
                    `UPDATE cadena_suministro_logistica_despacho SET 
                        fechaLogistica = ?, 
                        cedulaUsuarioLogistica = ?, 
                        nombreUsuarioLogistica = ?, 
                        disponibilidadLogistica = ?, 
                        cantidadRestanteLogistica = ?,
                        bodegaConfirmacionLogistica = ?, 
                        estadoLogistica = ?, 
                        estadoTrasladoLogistica = ?
                    WHERE item_id = ? LIMIT 1`,
                    [
                        fechaColombia,
                        usuarioToken.cedula,
                        usuarioToken.nombre,
                        cantidadEditada,
                        cantidadRestanteLogistica,
                        bodegasEditadas[id] || null,
                        'Realizado',
                        estadoTrasladoLogistica,
                        id
                    ]
                );

                // 2. Actualizar compras
                await connection.query(
                    `UPDATE cadena_suministro_compras SET 
                        estadoCompra = ?,
                        estadoAprobacion2 = ?,
                        estadoAprobacion3 = ?,
                        estadoAprobacion4 = ?,
                        estadoEnvioOrdenCompra = ?,
                        estadoEntregaProveedor = ?
                    WHERE item_id = ? LIMIT 1`,
                    [
                        estadoCompra,
                        estadoAprobacion2,
                        estadoAprobacion2,
                        estadoAprobacion2,
                        estadoAprobacion2,
                        estadoAprobacion2,
                        id
                    ]
                );

                // 3. Actualizar finanzas y facturación
                await connection.query(
                    `UPDATE cadena_suministro_finanzas_facturacion SET 
                        estadoContabilidad = ?,
                        estadoAprobacionAnticipo3 = ?,
                        estadoAprobacionAnticipo4 = ?,
                        estadoAnticipoTesoreria = ?,
                        estadoTesoreria = ?,
                        estadoAsociacionFactura = ?
                    WHERE item_id = ? LIMIT 1`,
                    [
                        estadoAprobacion2,
                        estadoAprobacion2,
                        estadoAprobacion2,
                        estadoAprobacion2,
                        estadoAprobacion2,
                        estadoAprobacion2,
                        id
                    ]
                );

                // 4. Actualizar estado general en cabecera
                await recalcularYActualizarEstadoSolicitudPorItems(id, connection);

                idsActualizados.push(id);
            }

            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        const registrosActualizados = [];
        for (const id of idsActualizados) {
            const registro = await getRegistrosCompletos('i.id = ?', [id]);
            if (registro.length > 0) {
                registrosActualizados.push(registro[0]);
            }
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'logisticaActualizarCantidades',
            accion: 'Actualizar cantidades exitoso',
            detalle: 'Cantidades actualizadas correctamente',
            datos: {
                solicitud: id,
                cantidadesEditadas: cantidadesEditadas,
                bodegasEditadas: bodegasEditadas,
                solicitudExistente: solicitudesExistentes,
                solicitudActual: registrosActualizados
            },
            tablasIdsAfectados: [{
                tabla: 'cadena_suministro_solicitud',
                solicitud: id.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Cantidades de materiales actualizadas correctamente`,
            `Se actualizaron ${idsActualizados.length} registro(s) de cantidades.`,
            registrosActualizados
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'logisticaActualizarCantidades',
            accion: 'Error al actualizar cantidades',
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

router.put('/comprasActualizarCampos/:id', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;

    try {
        const { id } = req.params;
        const data = req.body;

        if (!id || isNaN(id)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasActualizarCampos',
                accion: 'Actualizar campos de compra fallido',
                detalle: 'ID de solicitud inválido o no proporcionado',
                datos: { idProporcionado: id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "ID de solicitud inválido o no proporcionado.");
        }

        const solicitudesExistentes = await getRegistrosCompletos('s.solicitud = ?', [id]);

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasActualizarCampos',
                accion: 'Actualizar campos de compra fallido',
                detalle: 'Los datos del formulario son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del formulario son requeridos.");
        }

        const fechaColombia = getFechaHoraColombia()
        const { editadosCompras } = data;
        const idsActualizados = [];

        for (const [key, value] of Object.entries(editadosCompras)) {
            const {
                id,
                nitProveedor,
                proveedor,
                descripcionProveedor,
                umProveedor,
                cantidadProveedor,
                precioUnitario,
                precioTotalSinIva,
                iva,
                precioTotalConIva,
                formaPago,
                plazoPagoDias,
                tipoMoneda,
                precioAnticipo,
                plazoEntrega,
                observacionCompra
            } = value;

            const camposRequeridos = [
                { nombre: 'id', valor: id },
                { nombre: 'nitProveedor', valor: nitProveedor },
                { nombre: 'proveedor', valor: proveedor },
                { nombre: 'descripcionProveedor', valor: descripcionProveedor },
                { nombre: 'umProveedor', valor: umProveedor },
                { nombre: 'cantidadProveedor', valor: cantidadProveedor },
                { nombre: 'precioUnitario', valor: precioUnitario },
                { nombre: 'precioTotalSinIva', valor: precioTotalSinIva },
                { nombre: 'iva', valor: iva },
                { nombre: 'precioTotalConIva', valor: precioTotalConIva },
                { nombre: 'formaPago', valor: formaPago },
                { nombre: 'plazoPagoDias', valor: plazoPagoDias },
                { nombre: 'tipoMoneda', valor: tipoMoneda },
                { nombre: 'precioAnticipo', valor: precioAnticipo },
                { nombre: 'plazoEntrega', valor: plazoEntrega }
            ];

            const campoVacio = camposRequeridos.find(campo => (campo.valor === undefined || campo.valor === null || campo.valor === '') || campo.valor === 'No se encontraron registros');

            if (campoVacio) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'comprasActualizarCampos',
                    accion: 'Actualizar campos de compra fallido',
                    detalle: `El campo '${campoVacio.nombre}' no fue proporcionado.`,
                    datos: { data },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, `El campo '${campoVacio.nombre}' es requerido y no fue proporcionado.`);
            }

            await dbRailway.query(
                `UPDATE cadena_suministro_compras SET 
                fechaCompra = ?, 
                cedulaUsuarioCompras = ?, 
                nombreUsuarioCompras = ?, 
                nitProveedor = ?,
                proveedor = ?, 
                descripcionProveedor = ?, 
                umProveedor = ?,
                cantidadProveedor = ?,
                formaPago = ?, 
                plazoPagoDias = ?, 
                tipoMoneda = ?,
                precioAnticipo = ?,
                precioUnitario = ?,
                precioTotalSinIva = ?,
                iva = ?,
                precioTotalConIva = ?,
                plazoEntrega = ?,
                observacionCompra = ?,
                estadoCompra = ?
                WHERE item_id = ? LIMIT 1`,
                [
                    fechaColombia,
                    usuarioToken.cedula,
                    usuarioToken.nombre,
                    nitProveedor,
                    proveedor,
                    descripcionProveedor,
                    umProveedor,
                    cantidadProveedor,
                    formaPago,
                    plazoPagoDias,
                    tipoMoneda,
                    precioAnticipo,
                    precioUnitario,
                    precioTotalSinIva,
                    iva,
                    precioTotalConIva,
                    plazoEntrega,
                    observacionCompra,
                    'En Proceso',
                    id
                ]
            );
            idsActualizados.push(id);
        }

        const registrosActualizados = [];
        for (const id of idsActualizados) {
            const registro = await getRegistrosCompletos('i.id = ?', [id]);
            if (registro.length > 0) {
                registrosActualizados.push(registro[0]);
            }
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'comprasActualizarCampos',
            accion: 'Actualizar campos de compra exitoso',
            detalle: 'Campos de compra actualizados correctamente',
            datos: {
                solicitud: id,
                solicitudExistente: solicitudesExistentes,
                solicitudActual: registrosActualizados
            },
            tablasIdsAfectados: [{
                tabla: 'cadena_suministro_solicitud',
                solicitud: id.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Campos de compra actualizados correctamente`,
            `Se actualizaron ${idsActualizados.length} registro(s) de campos de compra.`,
            registrosActualizados
        );

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'comprasActualizarCampos',
            accion: 'Error al actualizar campos de compra',
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

router.put('/comprasGenerarOC', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasGenerarOC',
                accion: 'Generar orden de compra fallido',
                detalle: 'Los datos del formulario son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del formulario son requeridos.");
        }

        const { contrasena, fechaOrdenCompra, totalGeneralSinIva, totalIva, totalOrdenCompra, ids } = data;

        if (
            !contrasena ||
            !fechaOrdenCompra ||
            totalGeneralSinIva === undefined || totalGeneralSinIva === null ||
            totalIva === undefined || totalIva === null ||
            totalOrdenCompra === undefined || totalOrdenCompra === null ||
            !ids || !Array.isArray(ids) || ids.length === 0
        ) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasGenerarOC',
                accion: 'Generar orden de compra fallido',
                detalle: 'Fecha, total y array de IDs son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Contraseña, fecha, total y array de IDs son requeridos");
        }

        const [firma] = await dbRailway.query(
            `SELECT * FROM firmas WHERE cedulaUsuario = ?`,
            [usuarioToken.cedula]
        );

        if (firma.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasGenerarOC',
                accion: 'Generar orden de compra fallido',
                detalle: 'Registro no permitido: Cédula de usuario no tiene firma registrada.',
                datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Cédula de usuario no tiene firma registrada.");
        }

        if (!await bcrypt.compare(contrasena, firma[0].contrasena)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasGenerarOC',
                accion: 'Generar orden de compra fallido',
                detalle: 'Registro no permitido: Contraseña actual incorrecta.',
                datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Contraseña actual incorrecta.", null, { "contrasena": `La contraseña actual proporcionada no coincide con la registrada.` });
        }

        const [registrosExistentes] = await dbRailway.query(
            `SELECT id FROM cadena_suministro_item WHERE id IN (?)`,
            [ids]
        );

        const idsExistentes = registrosExistentes.map(r => r.id);
        const idsNoExistentes = ids.filter(id => !idsExistentes.includes(id));

        if (idsNoExistentes.length > 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasGenerarOC',
                accion: 'Generar orden de compra fallido',
                detalle: `IDs no encontrados: ${idsNoExistentes.join(', ')}`,
                datos: { idsEnviados: ids, idsEncontrados: idsExistentes },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 404, `Los siguientes IDs no existen: ${idsNoExistentes.join(', ')}`);
        }

        const fechaColombia = getFechaHoraColombia()
        const añoActual = parseInt(fechaColombia.split('-')[0]);

        const [ultimaOrden] = await dbRailway.query(`
            SELECT ordenCompra 
            FROM cadena_suministro_compras 
            WHERE ordenCompra IS NOT NULL 
            AND ordenCompra != '' 
            AND ordenCompra LIKE ?
            ORDER BY ordenCompra DESC 
            LIMIT 1
        `, [`OC - ${añoActual} - %`]);

        let nuevoConsecutivo = 1;

        if (ultimaOrden && ultimaOrden.length > 0) {
            const ultimoNumero = ultimaOrden[0].ordenCompra.split(' - ')[2];
            if (ultimoNumero) {
                nuevoConsecutivo = parseInt(ultimoNumero) + 1;
            }
        }

        const consecutivoFormateado = nuevoConsecutivo.toString().padStart(5, '0');
        const nuevaOrdenCompra = `OC - ${añoActual} - ${consecutivoFormateado}`;

        const connection = await dbRailway.getConnection();
        await connection.beginTransaction();

        try {
            const placeholders = ids.map(() => '?').join(',');

            // 1. Actualizar compras
            await connection.query(
                `
                UPDATE cadena_suministro_compras 
                SET 
                    fechaOrdenCompra = ?,
                    cedulaUsuarioElaboraCompra = ?,
                    nombreUsuarioElaboraCompra = ?,
                    ordenCompra = ?,
                    totalGeneralSinIva = ?,
                    totalIva = ?,
                    totalOrdenCompra = ?,
                    firmaCompra = ?,
                    estadoCompra = ?,
                    estadoAprobacion2 = ?
                WHERE item_id IN (${placeholders})
                `,
                [
                    fechaOrdenCompra,
                    usuarioToken.cedula,
                    usuarioToken.nombre,
                    nuevaOrdenCompra,
                    totalGeneralSinIva,
                    totalIva,
                    totalOrdenCompra,
                    firma[0].firma,
                    'Realizado',
                    'Pendiente',
                    ...ids
                ]
            );

            // 2. Actualizar finanzas y facturación
            await connection.query(
                `
                UPDATE cadena_suministro_finanzas_facturacion 
                SET estadoFacturasTesoreria = ?
                WHERE item_id IN (${placeholders})
                `,
                [
                    'Pendiente',
                    ...ids
                ]
            );

            // 3. Actualizar estado general en cabecera
            await recalcularYActualizarEstadoSolicitudPorItems(ids, connection);

            await connection.commit();

            const registrosActualizados = await getRegistrosCompletos('i.id IN (?)', [ids]);

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasGenerarOC',
                accion: 'Generar orden de compra exitoso',
                detalle: `Orden de compra ${nuevaOrdenCompra} generada para ${ids.length} registro(s)`,
                datos: {
                    ordenCompra: nuevaOrdenCompra,
                    fechaOrdenCompra,
                    totalGeneralSinIva,
                    totalIva,
                    totalOrdenCompra,
                    idsActualizados: ids,
                    registrosAfectados: ids.length
                },
                tablasIdsAfectados: ids.map(id => ({
                    tabla: 'cadena_suministro_solicitud',
                    id: id.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                `Orden de compra generada correctamente`,
                `Se generó la orden ${nuevaOrdenCompra} para ${ids.length} registro(s).`,
                {
                    ordenCompra: nuevaOrdenCompra,
                    registrosActualizados: registrosActualizados,
                    idsActualizados: ids
                }
            );

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'comprasGenerarOC',
            accion: 'Error al generar la orden de compra',
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

router.put('/comprasAprobacion1/:id', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;

    try {
        const { id } = req.params;
        const data = req.body;

        if (!id || isNaN(id)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Actualizar aprobacion 1 fallido',
                detalle: 'ID de solicitud inválido o no proporcionado',
                datos: { idProporcionado: id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "ID de solicitud inválido o no proporcionado.");
        }

        const [solicitudExistente] = await dbRailway.query(
            'SELECT * FROM cadena_suministro_solicitud WHERE solicitud = ?',
            [id]
        );

        if (solicitudExistente.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Generar orden de compra fallido',
                detalle: `Solicitud no encontrada en base de datos.`,
                datos: { solicitudEnviado: id },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 404, `Solicitud no encontrada en base de datos`);
        }

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Actualizar aprobacion 1 fallido',
                detalle: 'Los datos del formulario son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del formulario son requeridos.");
        }

        const { contrasena, observaciones, estado } = data;

        if (!estado) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Actualizar aprobacion 1 fallido',
                detalle: 'Estado es requerido.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "El estado es obligatorio");
        }

        if (!contrasena) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Actualizar aprobacion 1 fallido',
                detalle: 'Contraseña es requerida.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Campo Obligatorio", null, { "contrasena": `La contraseña es requerida.` });
        }

        if (estado === 'Rechazado' && (!observaciones || !observaciones.trim())) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Actualizar aprobacion 1 fallido',
                detalle: 'La observación es obligatoria para rechazar la solicitud.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Campo Obligatorio", null, { "observaciones": `La observación es obligatoria para rechazar la solicitud.` });
        }

        const [firma] = await dbRailway.query(
            `SELECT * FROM firmas WHERE cedulaUsuario = ?`,
            [usuarioToken.cedula]
        );

        if (firma.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Actualizar aprobacion 1 fallido',
                detalle: 'Registro no permitido: Cédula de usuario no tiene firma registrada.',
                datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Cédula de usuario no tiene firma registrada.");
        }

        if (!await bcrypt.compare(contrasena, firma[0].contrasena)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Actualizar aprobacion 1 fallido',
                detalle: 'Registro no permitido: Contraseña actual incorrecta.',
                datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Contraseña actual incorrecta.", null, { "contrasena": `La contraseña actual proporcionada no coincide con la registrada.` });
        }

        const fechaColombia = getFechaHoraColombia();
        const estadoSolicitud = estado === 'Aprobado' ? 'Pendiente Logistica' : estado;

        const connection = await dbRailway.getConnection();
        await connection.beginTransaction();

        try {
            let affectedRows = 0;

            // 1. Actualizar aprobación del director (aprobacion 1)
            const [aprobacionResult] = await connection.query(
                `
                UPDATE cadena_suministro_aprobacion_director ad
                JOIN cadena_suministro_item i ON ad.item_id = i.id
                JOIN cadena_suministro_solicitud s ON i.solicitud_id = s.id
                SET 
                    ad.fechaAprobacion1 = ?,
                    ad.cedulaUsuarioAprobacion1 = ?,
                    ad.nombreUsuarioAprobacion1 = ?,
                    ad.observacionAprobacion1 = ?,
                    ad.firmaAprobacion1 = ?,
                    ad.estadoAprobacion1 = ?
                WHERE s.solicitud = ?
                `,
                [
                    fechaColombia,
                    usuarioToken.cedula,
                    usuarioToken.nombre,
                    observaciones || null,
                    firma[0].firma,
                    estado,
                    id
                ]
            );
            affectedRows = aprobacionResult.affectedRows;

            // 2. Si se aprueba, colocar estadoLogistica = 'Pendiente'
            if (estado === 'Aprobado') {
                await connection.query(
                    `
                    UPDATE cadena_suministro_logistica_despacho ld
                    JOIN cadena_suministro_item i ON ld.item_id = i.id
                    JOIN cadena_suministro_solicitud s ON i.solicitud_id = s.id
                    SET ld.estadoLogistica = 'Pendiente'
                    WHERE s.solicitud = ?
                    `,
                    [id]
                );
            }

            // 3. Actualizar estado general en la cabecera
            await recalcularYActualizarEstadoSolicitudPorSolicitudNumero(id, connection);

            await connection.commit();

            const registrosActualizados = await getRegistrosCompletos('s.solicitud = ?', [id]);

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion1',
                accion: 'Actualizar aprobación 1 exitoso',
                detalle: `Aprobación 1 actualizada para la solicitud ${id}`,
                datos: {
                    solicitud: id,
                    fechaAprobacion: fechaColombia,
                    estado: estado,
                    totalRegistros: registrosActualizados.length,
                },
                tablasIdsAfectados: registrosActualizados.map(registro => ({
                    tabla: 'cadena_suministro_solicitud',
                    id: registro.id.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                `Aprobación 1 actualizada correctamente`,
                `Se actualizó la aprobación 1 para la solicitud ${id}.`,
                {
                    registrosActualizados: registrosActualizados,
                    solicitud: id,
                    totalRegistrosAfectados: affectedRows
                }
            );

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'comprasAprobacion1',
            accion: 'Error al actualizar aprobación 1',
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

router.put('/comprasAprobacion', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion',
                accion: 'Actualizar aprobacion fallido',
                detalle: 'Los datos del formulario son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del formulario son requeridos.");
        }

        const { estado, contrasena, observaciones, ids, aprobacion } = data;

        if (!estado || !contrasena || !ids || !Array.isArray(ids) || ids.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion',
                accion: `Actualizar aprobacion ${aprobacion} fallido`,
                detalle: 'Estado, contrasena y array de IDs son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Estado, contrasena y array de IDs son requeridos");
        }

        const [firma] = await dbRailway.query(
            `SELECT * FROM firmas WHERE cedulaUsuario = ?`,
            [usuarioToken.cedula]
        );

        if (firma.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion',
                accion: `Actualizar aprobacion ${aprobacion} fallido`,
                detalle: 'Registro no permitido: Cédula de usuario no tiene firma registrada.',
                datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Cédula de usuario no tiene firma registrada.");
        }

        if (!await bcrypt.compare(contrasena, firma[0].contrasena)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion',
                accion: `Actualizar aprobacion ${aprobacion} fallido`,
                detalle: 'Registro no permitido: Contraseña actual incorrecta.',
                datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Contraseña actual incorrecta.", null, { "contrasena": `La contraseña actual proporcionada no coincide con la registrada.` });
        }

        const [registrosExistentes] = await dbRailway.query(
            `SELECT item_id as id, formaPago, totalOrdenCompra FROM cadena_suministro_compras WHERE item_id IN (?)`,
            [ids]
        );

        const idsExistentes = registrosExistentes.map(r => r.id);
        const idsNoExistentes = ids.filter(id => !idsExistentes.includes(id));

        if (idsNoExistentes.length > 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion',
                accion: `Actualizar aprobacion ${aprobacion} fallido`,
                detalle: `IDs no encontrados: ${idsNoExistentes.join(', ')}`,
                datos: { idsEnviados: ids, idsEncontrados: idsExistentes },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 404, `Los siguientes IDs no existen: ${idsNoExistentes.join(', ')}`);
        }

        let aplicaAprobacion4 = false;

        if (registrosExistentes &&
            registrosExistentes.length > 0 &&
            registrosExistentes[0].totalOrdenCompra !== undefined &&
            registrosExistentes[0].totalOrdenCompra !== null &&
            registrosExistentes[0].totalOrdenCompra !== '') {

            let totalOrdenCompraNum;

            if (typeof registrosExistentes[0].totalOrdenCompra === 'string') {
                const cleanedValue = registrosExistentes[0].totalOrdenCompra
                    .replace(/[$]/g, '')
                    .replace(/[€]/g, '')
                    .replace(/[¥]/g, '')
                    .replace(/,/g, '')
                    .replace(/\s/g, '')
                    .trim();

                totalOrdenCompraNum = parseFloat(cleanedValue);
            } else {
                totalOrdenCompraNum = parseFloat(registrosExistentes[0].totalOrdenCompra);
            }

            if (!isNaN(totalOrdenCompraNum) && isFinite(totalOrdenCompraNum)) {
                aplicaAprobacion4 = totalOrdenCompraNum >= 5000000;
            } else {
                aplicaAprobacion4 = false;
            }
        } else {
            console.warn('No hay datos válidos en registrosExistentes[0].totalOrdenCompra');
        }

        const fechaColombia = getFechaHoraColombia();
        const estadoAprobacion3 = aprobacion === '2' ? (estado === 'Aprobado' ? 'Pendiente' : null) : estado;
        const estadoAprobacion4 = aplicaAprobacion4 ?
            (aprobacion === '3' ?
                (estado === 'Aprobado' ?
                    'Pendiente' :
                    null)
                : estado)
            : 'No aplica';
        const estadoContabilidad = (!aplicaAprobacion4 && aprobacion === '3') || (aplicaAprobacion4 && aprobacion === '4') ?
            (estado === 'Aprobado' ?
                (registrosExistentes[0].formaPago === 'Anticipo' ?
                    'Pendiente' :
                    'No aplica')
                : null)
            : null;
        const estadoAprobacionAnticipo3 = (!aplicaAprobacion4 && aprobacion === '3') || (aplicaAprobacion4 && aprobacion === '4') ?
            (estado === 'Aprobado' ?
                (registrosExistentes[0].formaPago === 'Anticipo' ?
                    null :
                    'No aplica')
                : null)
            : null;
        const estadoFacturasTesoreria = (!aplicaAprobacion4 && aprobacion === '3') || (aplicaAprobacion4 && aprobacion === '4') ?
            (estado === 'Rechazado' ? null : 'Pendiente')
            : null;
        const estadoEnvioOrdenCompra = (!aplicaAprobacion4 && aprobacion === '3') || (aplicaAprobacion4 && aprobacion === '4') ?
            (estado === 'Aprobado' ?
                (registrosExistentes[0].formaPago === 'Anticipo' ?
                    null :
                    'Pendiente')
                : null)
            : null;
        const estadoSolicitud = aprobacion === '2' ?
            (estado === 'Aprobado' ?
                'Pendiente Aprobacion 3' :
                estado)
            : (aprobacion === '3' && !aplicaAprobacion4) || (aprobacion === '4' && aplicaAprobacion4) ?
                (estado === 'Aprobado' ?
                    (registrosExistentes[0].formaPago === 'Anticipo' ?
                        'Pendiente Contabilidad' :
                        'Pendiente Envio Orden de Compra')
                    : estado)
                : aprobacion === '3' && aplicaAprobacion4 ?
                    (estado === 'Aprobado' ?
                        'Pendiente Aprobacion 4' :
                        estado)
                    : null;

        const connection = await dbRailway.getConnection();
        await connection.beginTransaction();

        try {
            const placeholders = ids.map(() => '?').join(',');
            let result;

            if (aprobacion === '2') {
                [result] = await connection.query(
                    `
                        UPDATE cadena_suministro_compras 
                        SET 
                            fechaAprobacion2 = ?,
                            cedulaUsuarioAprobacion2 = ?,
                            nombreUsuarioAprobacion2 = ?,
                            observacionAprobacion2 = ?,
                            firmaAprobacion2 = ?,
                            estadoAprobacion2 = ?,
                            estadoAprobacion3 = ?
                        WHERE item_id IN (${placeholders})
                    `,
                    [
                        fechaColombia,
                        usuarioToken.cedula,
                        usuarioToken.nombre,
                        observaciones,
                        firma[0].firma,
                        estado,
                        estadoAprobacion3,
                        ...ids
                    ]
                );

                await recalcularYActualizarEstadoSolicitudPorItems(ids, connection);
            } else if (aprobacion === '3') {
                [result] = await connection.query(
                    `
                    UPDATE cadena_suministro_compras 
                    SET 
                        fechaAprobacion3 = ?,
                        cedulaUsuarioAprobacion3 = ?,
                        nombreUsuarioAprobacion3 = ?,
                        observacionAprobacion3 = ?,
                        firmaAprobacion3 = ?,
                        estadoAprobacion3 = ?,
                        estadoAprobacion4 = ?,
                        estadoEnvioOrdenCompra = ?
                    WHERE item_id IN (${placeholders})
                `,
                    [
                        fechaColombia,
                        usuarioToken.cedula,
                        usuarioToken.nombre,
                        observaciones,
                        firma[0].firma,
                        estadoAprobacion3,
                        estadoAprobacion4,
                        estadoEnvioOrdenCompra,
                        ...ids
                    ]
                );

                await connection.query(
                    `
                    UPDATE cadena_suministro_finanzas_facturacion 
                    SET 
                        estadoContabilidad = ?,
                        estadoAprobacionAnticipo3 = ?,
                        estadoAprobacionAnticipo4 = ?,
                        estadoAnticipoTesoreria = ?,
                        estadoTesoreria = ?,
                        estadoFacturasTesoreria = ?
                    WHERE item_id IN (${placeholders})
                `,
                    [
                        estadoContabilidad,
                        estadoAprobacionAnticipo3,
                        estadoAprobacionAnticipo3,
                        estadoAprobacionAnticipo3,
                        estadoAprobacionAnticipo3,
                        estadoFacturasTesoreria,
                        ...ids
                    ]
                );

                await recalcularYActualizarEstadoSolicitudPorItems(ids, connection);
            } else if (aprobacion === '4') {
                [result] = await connection.query(
                    `
                    UPDATE cadena_suministro_compras 
                    SET 
                        fechaAprobacion4 = ?,
                        cedulaUsuarioAprobacion4 = ?,
                        nombreUsuarioAprobacion4 = ?,
                        observacionAprobacion4 = ?,
                        firmaAprobacion4 = ?,
                        estadoAprobacion4 = ?,
                        estadoEnvioOrdenCompra = ?
                    WHERE item_id IN (${placeholders})
                `,
                    [
                        fechaColombia,
                        usuarioToken.cedula,
                        usuarioToken.nombre,
                        observaciones,
                        firma[0].firma,
                        estadoAprobacion4,
                        estadoEnvioOrdenCompra,
                        ...ids
                    ]
                );

                await connection.query(
                    `
                    UPDATE cadena_suministro_finanzas_facturacion 
                    SET 
                        estadoContabilidad = ?,
                        estadoAprobacionAnticipo3 = ?,
                        estadoAprobacionAnticipo4 = ?,
                        estadoAnticipoTesoreria = ?,
                        estadoTesoreria = ?,
                        estadoFacturasTesoreria = ?
                    WHERE item_id IN (${placeholders})
                `,
                    [
                        estadoContabilidad,
                        estadoAprobacionAnticipo3,
                        estadoAprobacionAnticipo3,
                        estadoAprobacionAnticipo3,
                        estadoAprobacionAnticipo3,
                        estadoFacturasTesoreria,
                        ...ids
                    ]
                );

                await recalcularYActualizarEstadoSolicitudPorItems(ids, connection);
            }

            await connection.commit();

            const registrosActualizados = await getRegistrosCompletos('i.id IN (?)', [ids]);

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'comprasAprobacion',
                accion: `Actualizar aprobacion ${aprobacion} exitoso`,
                detalle: `Aprobación ${aprobacion} actualizada para ${ids.length} registro(s)`,
                datos: {
                    idsActualizados: ids,
                    registrosAfectados: result.affectedRows
                },
                tablasIdsAfectados: ids.map(id => ({
                    tabla: 'cadena_suministro_solicitud',
                    id: id.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                `Aprobación ${aprobacion} actualizada correctamente`,
                `Se actualizó la aprobación ${aprobacion} para ${ids.length} registro(s)`,
                {
                    registrosActualizados: registrosActualizados,
                    idsActualizados: ids
                }
            );

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'comprasAprobacion',
            accion: 'Error al actualizar aprobación',
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

router.put('/despachoMaterial',
    validarToken,
    upload.fields([
        { name: 'pdfs' },
    ]),
    async (req, res) => {

        const usuarioToken = req.validarToken.usuario

        try {
            const dataString = req.body.data;
            const editadosDespachoMaterial = JSON.parse(dataString);
            const archivos = req.files;

            if (!editadosDespachoMaterial || Object.keys(editadosDespachoMaterial).length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'despachoMaterial',
                    accion: 'Actualizar despacho material fallido',
                    detalle: 'Los datos del registro son requeridos.',
                    datos: { dataString },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Los datos del registro son requeridos.");
            }

            if (!archivos?.pdfs || Object.keys(archivos).length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'despachoMaterial',
                    accion: 'Actualizar despacho material fallido',
                    detalle: 'Los soportes son necesario: PDFs',
                    datos: { ArchivoProporcionado: archivos },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Los soportes son necesario: PDFs", null, { "pdfs": `Ingrese un archivo .pdf con la salida.` });
            }

            const idsProyectos = Object.keys(editadosDespachoMaterial).filter(key => key !== 'observaciones');

            if (idsProyectos.length === 0) {
                return sendError(res, 400, "No hay IDs de proyectos para consultar");
            }

            const placeholders = idsProyectos.map(() => '?').join(',');

            const solicitudesExistentes = await getRegistrosCompletos(`i.id IN (${placeholders})`, idsProyectos);

            const fechaColombia = getFechaHoraColombia()
            const driveResults = [];

            if (archivos?.pdfs && Array.isArray(archivos.pdfs) && archivos.pdfs.length > 0) {
                for (let i = 0; i < archivos.pdfs.length; i++) {
                    const pdfFile = archivos.pdfs[i];
                    try {

                        const pdfExt = path.extname(pdfFile.originalname);
                        const pdfFileName = `${`${solicitudesExistentes[0].solicitud}_${solicitudesExistentes[0].centro_costos}_${solicitudesExistentes[0].cedulaUsuario}`}_pdf_despacho_material_${i + 1}_${fechaColombia}${pdfExt}`;

                        const fileId = await uploadFileToDrive(
                            pdfFile.buffer,
                            pdfFileName,
                            folderId
                        );

                        const result = {
                            tipo: 'pdf',
                            nombre: pdfFileName,
                            id: fileId.id,
                            url: fileId.url,
                            webViewLink: fileId.webViewLink,
                            indice: i,
                            size: pdfFile.size
                        }

                        driveResults.push(result);

                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'success',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'cadenaSuministro',
                            metodo: 'put',
                            endPoint: 'despachoMaterial',
                            accion: 'Cargar PDF exitoso',
                            detalle: `PDF ${i + 1} de ${archivos.pdfs.length} cargado exitosamente`,
                            datos: {
                                pdf: result,
                                totalPDFs: archivos.pdfs.length,
                                indice: i + 1
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    } catch (error) {
                        console.error(`Error procesando PDF ${i + 1}:`, error);

                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'error',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'cadenaSuministro',
                            metodo: 'put',
                            endPoint: 'despachoMaterial',
                            accion: 'Cargar PDF fallido',
                            detalle: `Error al cargar PDF ${i + 1}: ${error.message}`,
                            datos: {
                                nombreOriginal: pdfFile.originalname,
                                error: error.message
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    }
                }
            }

            const solicitudesMap = {};
            const nuevosNombres = driveResults.map(pdf => pdf.nombre);
            solicitudesExistentes.forEach(solicitud => {
                solicitudesMap[solicitud.id] = solicitud;
            });

            const connection = await dbRailway.getConnection();
            await connection.beginTransaction();

            const idsActualizados = [];

            for (id of idsProyectos) {
                const solicitud = solicitudesMap[id];

                const cantidadSolicitada = parseFloat(solicitud.cantidad);
                const cantidadDespachadaMaterial = parseFloat(solicitud.cantidadDespachadaMaterial || '0');
                const cantidadPendienteDespacho = cantidadSolicitada - cantidadDespachadaMaterial;
                const cantidadEditada = parseFloat(editadosDespachoMaterial[id] || '0')

                if (cantidadEditada === 0) {
                    continue;
                }

                if (cantidadPendienteDespacho < cantidadEditada) {
                    await registrarHistorial({
                        nombreUsuario: usuarioToken.nombre || 'No registrado',
                        cedulaUsuario: usuarioToken.cedula || 'No registrado',
                        rolUsuario: usuarioToken.rol || 'No registrado',
                        nivel: 'log',
                        plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                        app: 'cadenaSuministro',
                        metodo: 'put',
                        endPoint: 'despachoMaterial',
                        accion: 'Actualizar despacho material fallido',
                        detalle: 'La cantidad ingresada es mayor a la restante por despacho.',
                        datos: { ArchivoProporcionado: archivos },
                        tablasIdsAfectados: [],
                        ipAddress: getClientIp(req),
                        userAgent: req.headers['user-agent'] || ''
                    });

                    return sendError(res, 400, "La cantidad ingresada es mayor a la restante por despacho.");
                }

                const cantidadDespachadaNueva = cantidadDespachadaMaterial + cantidadEditada
                const cantidadRestanteLogistica = cantidadPendienteDespacho - cantidadEditada;
                const pdfsExistentes = solicitud.pdfsDespachoMaterial;
                let pdfsExistentesArray = [];

                if (pdfsExistentes) {
                    try {
                        if (typeof pdfsExistentes === 'string') {
                            pdfsExistentesArray = JSON.parse(pdfsExistentes);
                        }
                        else if (Array.isArray(pdfsExistentes)) {
                            pdfsExistentesArray = pdfsExistentes;
                        }
                    } catch (error) {
                        console.error('Error parseando pdfsExistentes:', error);
                        pdfsExistentesArray = [];
                    }
                }

                const pdfsCombinados = [...pdfsExistentesArray, ...nuevosNombres];
                const pdfsJsonParaBD = JSON.stringify(pdfsCombinados);
                const estadoDespachoMaterial = cantidadRestanteLogistica === 0 ? 'Realizado' : 'Parcial';
                const estadoSolicitud = cantidadRestanteLogistica === 0 ? 'Material Despachado' : 'Pendiente Despacho Bodega';

                await connection.query(
                    `
                        UPDATE cadena_suministro_logistica_despacho 
                        SET 
                            fechaDespachoMaterial = ?,
                            cedulaUsuarioDespachoMaterial = ?,
                            nombreUsuarioDespachoMaterial = ?,
                            cantidadDespachadaMaterial = ?,
                            pdfsDespachoMaterial = ?,
                            observacionDespachoMaterial = ?,
                            estadoDespachoMaterial = ?
                        WHERE item_id = ?
                    `,
                    [
                        fechaColombia,
                        usuarioToken.cedula,
                        usuarioToken.nombre,
                        cantidadDespachadaNueva.toString(),
                        pdfsJsonParaBD,
                        editadosDespachoMaterial['observaciones'],
                        estadoDespachoMaterial,
                        id
                    ]
                );

                await recalcularYActualizarEstadoSolicitudPorItems(id, connection);

                idsActualizados.push(id);
            }

            await connection.commit();
            connection.release();

            const registrosActualizados = await getRegistrosCompletos('i.id IN (?)', [idsProyectos]);

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'despachoMaterial',
                accion: 'Actualizar despacho material exitoso',
                detalle: `Despacho de material actualizado para ${idsActualizados.length} registro(s)`,
                datos: {
                    idsActualizados: idsActualizados,
                    registrosAfectados: idsActualizados.length
                },
                tablasIdsAfectados: idsActualizados.map(id => ({
                    tabla: 'cadena_suministro_solicitud',
                    id: id.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                "Despacho de material actualizado correctamente",
                `Se actualizó el despacho de material para ${idsActualizados.length} registro(s)`,
                {
                    registrosActualizados: registrosActualizados,
                    idsActualizados: idsActualizados,
                    pdfsSubidos: driveResults
                }
            );

        } catch (err) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'Error sistema',
                cedulaUsuario: usuarioToken.cedula || 'Error sistema',
                rolUsuario: usuarioToken.rol || 'Error sistema',
                nivel: 'error',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'despachoMaterial',
                accion: 'Actualizar despacho material fallido',
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

router.post('/obtenerArchivoPDF', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario
    const { namePDF } = req.body;

    try {
        const resultados = {};

        if (!namePDF) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'post',
                endPoint: 'obtenerArchivoPDF',
                accion: 'Consulta archivos fallido',
                detalle: 'Registro no permitido: Nombre PDF',
                datos: { nombrePDFProporcionado: namePDF },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: PDF", null, { "namePDF": `Ingrese el nombre del pdf.` });
        }

        if (namePDF) {
            const factBuffer = await getFileFromDrive(namePDF, folderId);
            if (factBuffer) {
                resultados.pdf = {
                    nombre: namePDF,
                    data: factBuffer.toString('base64'),
                    contentType: getMimeType(namePDF)
                };
            }
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'post',
            endPoint: 'obtenerArchivoPDF',
            accion: 'Consulta archivos exitosa',
            detalle: `Se consultó ${resultados.length} registros`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron los archivos correctamente.`,
            resultados
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'post',
            endPoint: 'obtenerArchivoPDF',
            accion: 'Error al obtener los archivos',
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

router.put('/tesoreria', validarToken,
    upload.fields([
        { name: 'pdfsTesoreria' },
    ]),
    async (req, res) => {
        const usuarioToken = req.validarToken.usuario;

        try {
            const dataString = req.body.data;
            const data = JSON.parse(dataString);
            const archivos = req.files;

            if (!data || Object.keys(data).length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'tesoreria',
                    accion: 'Actualizar tesoreria fallido',
                    detalle: 'Los datos del formulario son requeridos.',
                    datos: { data },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Los datos del formulario son requeridos.");
            }

            if (!archivos?.pdfsTesoreria || Object.keys(archivos).length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'tesoreria',
                    accion: 'Actualizar tesoreria fallido',
                    detalle: 'Los soportes son necesario: PDFs',
                    datos: { ArchivoProporcionado: archivos },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Los soportes son necesario: PDFs", null, { "pdfsTesoreria": `Ingrese un archivo .pdf con la factura.` });
            }

            const { accion, contrasena, observaciones, ids } = data;

            if (!contrasena || !ids || !Array.isArray(ids) || ids.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'tesoreria',
                    accion: `Actualizar tesoreria fallido`,
                    detalle: 'Contrasena y array de IDs son requeridos.',
                    datos: { data },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Contrasena y array de IDs son requeridos");
            }

            const [firma] = await dbRailway.query(
                `SELECT * FROM firmas WHERE cedulaUsuario = ?`,
                [usuarioToken.cedula]
            );

            if (firma.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'tesoreria',
                    accion: `Actualizar tesoreria fallido`,
                    detalle: 'Registro no permitido: Cédula de usuario no tiene firma registrada.',
                    datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Cédula de usuario no tiene firma registrada.");
            }

            if (!await bcrypt.compare(contrasena, firma[0].contrasena)) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'tesoreria',
                    accion: `Actualizar tesoreria fallido`,
                    detalle: 'Registro no permitido: Contraseña actual incorrecta.',
                    datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Registro no permitido: Contraseña actual incorrecta.", null, { "contrasena": `La contraseña actual proporcionada no coincide con la registrada.` });
            }

            const registrosExistentes = await getRegistrosCompletos('i.id IN (?)', [ids]);

            const idsExistentes = registrosExistentes.map(r => r.id);
            const idsNoExistentes = ids.filter(id => !idsExistentes.includes(id));

            if (idsNoExistentes.length > 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'tesoreria',
                    accion: `Actualizar tesoreria fallido`,
                    detalle: `IDs no encontrados: ${idsNoExistentes.join(', ')}`,
                    datos: { idsEnviados: ids, idsEncontrados: idsExistentes },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 404, `Los siguientes IDs no existen: ${idsNoExistentes.join(', ')}`);
            }

            const fechaColombia = getFechaHoraColombia();
            const driveResults = [];

            if (archivos?.pdfsTesoreria && Array.isArray(archivos.pdfsTesoreria) && archivos.pdfsTesoreria.length > 0) {
                for (let i = 0; i < archivos.pdfsTesoreria.length; i++) {
                    const pdfFile = archivos.pdfsTesoreria[i];
                    try {

                        const pdfExt = path.extname(pdfFile.originalname);
                        const pdfFileName = `${registrosExistentes[0].ordenCompra}_${accion}_pdf_${i + 1}_${fechaColombia}${pdfExt}`;

                        const fileId = await uploadFileToDrive(
                            pdfFile.buffer,
                            pdfFileName,
                            folderId
                        );

                        const result = {
                            tipo: 'pdf',
                            nombre: pdfFileName,
                            id: fileId.id,
                            url: fileId.url,
                            webViewLink: fileId.webViewLink,
                            indice: i,
                            size: pdfFile.size
                        }

                        driveResults.push(result);

                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'success',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'cadenaSuministro',
                            metodo: 'put',
                            endPoint: 'tesoreria',
                            accion: 'Cargar PDF exitoso',
                            detalle: `PDF ${i + 1} de ${archivos.pdfsTesoreria.length} cargado exitosamente`,
                            datos: {
                                pdf: result,
                                totalPDFs: archivos.pdfsTesoreria.length,
                                indice: i + 1
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    } catch (error) {
                        console.error(`Error procesando PDF ${i + 1}:`, error);

                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'error',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'cadenaSuministro',
                            metodo: 'put',
                            endPoint: 'tesoreria',
                            accion: 'Cargar PDF fallido',
                            detalle: `Error al cargar PDF ${i + 1}: ${error.message}`,
                            datos: {
                                nombreOriginal: pdfFile.originalname,
                                error: error.message
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    }
                }
            }

            const nuevosNombres = driveResults.map(pdf => pdf.nombre);
            const nuevosNombresJsonParaBD = JSON.stringify(nuevosNombres);

            const connection = await dbRailway.getConnection();
            await connection.beginTransaction();

            try {
                const placeholders = ids.map(() => '?').join(',');
                let result;

                if (accion === 'factura') {
                    [result] = await connection.query(
                        `
                            UPDATE cadena_suministro_finanzas_facturacion 
                            SET 
                                fechaTesoreria = ?,
                                cedulaUsuarioTesoreria = ?,
                                nombreUsuarioTesoreria = ?,
                                observacionTesoreria = ?,
                                firmaTesoreria = ?,
                                pdfsTesoreria = ?,
                                estadoFacturasTesoreria = 'Realizado'
                            WHERE item_id IN (${placeholders})
                        `,
                        [
                            fechaColombia,
                            usuarioToken.cedula,
                            usuarioToken.nombre,
                            observaciones,
                            firma[0].firma,
                            nuevosNombresJsonParaBD,
                            ...ids
                        ]
                    );
                } else if (accion === 'anticipo') {
                    [result] = await connection.query(
                        `
                            UPDATE cadena_suministro_finanzas_facturacion 
                            SET 
                                fechaAnticipoTesoreria = ?,
                                cedulaUsuarioAnticipoTesoreria = ?,
                                nombreUsuarioAnticipoTesoreria = ?,
                                observacionAnticipoTesoreria = ?,
                                firmaAnticipoTesoreria = ?,
                                pdfsAnticipoTesoreria = ?,
                                estadoAnticipoTesoreria = 'Realizado',
                                estadoTesoreria = 'Realizado'
                            WHERE item_id IN (${placeholders})
                        `,
                        [
                            fechaColombia,
                            usuarioToken.cedula,
                            usuarioToken.nombre,
                            observaciones,
                            firma[0].firma,
                            nuevosNombresJsonParaBD,
                            ...ids
                        ]
                    );

                    await connection.query(
                        `
                            UPDATE cadena_suministro_compras 
                            SET 
                                estadoEnvioOrdenCompra = 'Pendiente'
                            WHERE item_id IN (${placeholders})
                        `,
                        ids
                    );

                    await recalcularYActualizarEstadoSolicitudPorItems(ids, connection);
                }

                await connection.commit();

                const registrosActualizados = await getRegistrosCompletos('i.id IN (?)', [ids]);

                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'success',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'tesoreria',
                    accion: `Actualizar tesoreria exitoso`,
                    detalle: `Se actualizo tesoreria para ${ids.length} registro(s)`,
                    datos: {
                        idsActualizados: ids,
                        registrosAfectados: result.affectedRows
                    },
                    tablasIdsAfectados: ids.map(id => ({
                        tabla: 'cadena_suministro_solicitud',
                        id: id.toString()
                    })),
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendResponse(
                    res,
                    200,
                    `Tesoreria actualizo correctamente`,
                    `Se actualizó tesoreria para ${ids.length} registro(s)`,
                    {
                        registrosActualizados: registrosActualizados,
                        idsActualizados: ids,
                        pdfsSubidos: driveResults
                    }
                );

            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }

        } catch (err) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'Error sistema',
                cedulaUsuario: usuarioToken.cedula || 'Error sistema',
                rolUsuario: usuarioToken.rol || 'Error sistema',
                nivel: 'error',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'tesoreria',
                accion: 'Error al actualizar tesoreria',
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

router.put('/entregaProveedor',
    validarToken,
    upload.fields([
        { name: 'pdfs' },
    ]),
    async (req, res) => {

        const usuarioToken = req.validarToken.usuario

        try {
            const dataString = req.body.data;
            const editadosEntregaProveedor = JSON.parse(dataString);
            const archivos = req.files;

            if (!editadosEntregaProveedor || Object.keys(editadosEntregaProveedor).length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'entregaProveedor',
                    accion: 'Actualizar entrega material por proveedor fallido',
                    detalle: 'Los datos del registro son requeridos.',
                    datos: { dataString },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Los datos del registro son requeridos.");
            }

            if (!archivos?.pdfs || Object.keys(archivos).length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'entregaProveedor',
                    accion: 'Actualizar entrega material por proveedor fallido',
                    detalle: 'Los soportes son necesario: PDFs',
                    datos: { ArchivoProporcionado: archivos },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Los soportes son necesario: PDFs", null, { "pdfs": `Ingrese un archivo .pdf con la salida.` });
            }

            const idsProyectos = Object.keys(editadosEntregaProveedor).filter(key => key !== 'observaciones');

            if (idsProyectos.length === 0) {
                return sendError(res, 400, "No hay IDs de proyectos para consultar");
            }

            const placeholders = idsProyectos.map(() => '?').join(',');

            const solicitudesExistentes = await getRegistrosCompletos(`i.id IN (${placeholders})`, idsProyectos);

            const fechaColombia = getFechaHoraColombia()
            const driveResults = [];

            if (archivos?.pdfs && Array.isArray(archivos.pdfs) && archivos.pdfs.length > 0) {
                for (let i = 0; i < archivos.pdfs.length; i++) {
                    const pdfFile = archivos.pdfs[i];
                    try {

                        const pdfExt = path.extname(pdfFile.originalname);
                        const pdfFileName = `${`${solicitudesExistentes[0].solicitud}_${solicitudesExistentes[0].centro_costos}_${solicitudesExistentes[0].cedulaUsuario}`}_pdf_entraga_bodega_${i + 1}_${fechaColombia}${pdfExt}`;

                        const fileId = await uploadFileToDrive(
                            pdfFile.buffer,
                            pdfFileName,
                            folderId
                        );

                        const result = {
                            tipo: 'pdf',
                            nombre: pdfFileName,
                            id: fileId.id,
                            url: fileId.url,
                            webViewLink: fileId.webViewLink,
                            indice: i,
                            size: pdfFile.size
                        }

                        driveResults.push(result);

                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'success',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'cadenaSuministro',
                            metodo: 'put',
                            endPoint: 'entregaProveedor',
                            accion: 'Cargar PDF exitoso',
                            detalle: `PDF ${i + 1} de ${archivos.pdfs.length} cargado exitosamente`,
                            datos: {
                                pdf: result,
                                totalPDFs: archivos.pdfs.length,
                                indice: i + 1
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    } catch (error) {
                        console.error(`Error procesando PDF ${i + 1}:`, error);

                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'error',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'cadenaSuministro',
                            metodo: 'put',
                            endPoint: 'entregaProveedor',
                            accion: 'Cargar PDF fallido',
                            detalle: `Error al cargar PDF ${i + 1}: ${error.message}`,
                            datos: {
                                nombreOriginal: pdfFile.originalname,
                                error: error.message
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    }
                }
            }

            const solicitudesMap = {};
            const nuevosNombres = driveResults.map(pdf => pdf.nombre);
            solicitudesExistentes.forEach(solicitud => {
                solicitudesMap[solicitud.id] = solicitud;
            });

            const connection = await dbRailway.getConnection();
            await connection.beginTransaction();

            const idsActualizados = [];

            for (id of idsProyectos) {
                const solicitud = solicitudesMap[id];

                const cantidadSolicitada = parseFloat(solicitud.cantidadProveedor);
                const cantidadEntregaProveedor = parseFloat(solicitud.cantidadEntregaProveedor || '0');
                const cantidadPendienteEntrega = cantidadSolicitada - cantidadEntregaProveedor;
                const cantidadEditada = parseFloat(editadosEntregaProveedor[id] || '0')

                if (cantidadEditada === 0) {
                    continue;
                }

                const cantidadEntregaProveedorNueva = cantidadEntregaProveedor + cantidadEditada
                const cantidadRestanteLogistica = cantidadPendienteEntrega - cantidadEditada;
                const pdfsExistentes = solicitud.pdfsEntregaProveedor;
                let pdfsExistentesArray = [];

                if (pdfsExistentes) {
                    try {
                        if (typeof pdfsExistentes === 'string') {
                            pdfsExistentesArray = JSON.parse(pdfsExistentes);
                        }
                        else if (Array.isArray(pdfsExistentes)) {
                            pdfsExistentesArray = pdfsExistentes;
                        }
                    } catch (error) {
                        console.error('Error parseando pdfsExistentes:', error);
                        pdfsExistentesArray = [];
                    }
                }

                const pdfsCombinados = [...pdfsExistentesArray, ...nuevosNombres];
                const pdfsJsonParaBD = JSON.stringify(pdfsCombinados);
                const estadoEntregaProveedor = cantidadRestanteLogistica === 0 || cantidadRestanteLogistica < 0 ? 'Realizado' : 'Parcial';
                const estadoDespachoMaterial = cantidadRestanteLogistica === 0 || cantidadRestanteLogistica < 0 ? 'Pendiente' : null;
                const estadoSolicitud = cantidadRestanteLogistica === 0 || cantidadRestanteLogistica < 0 ? (solicitud.estadoTrasladoLogistica === 'Pendiente' || solicitud.estadoTrasladoLogistica === 'En Transito' ? 'Pendiente Traslado Entre Bodegas' : 'Pendiente Despacho Bodega') : 'Pendiente Entrega Proveedor';
                const estadoAsociacionFactura = estadoEntregaProveedor === 'Realizado' ? 'Pendiente' : null;

                await connection.query(
                    `
                        UPDATE cadena_suministro_compras 
                        SET 
                            fechaEntregaProveedor = ?,
                            cedulaUsuarioEntregaProveedor = ?,
                            nombreUsuarioEntregaProveedor = ?,
                            cantidadEntregaProveedor = ?,
                            pdfsEntregaProveedor = ?,
                            observacionEntregaProveedor = ?,
                            estadoEntregaProveedor = ?
                        WHERE item_id = ?
                    `,
                    [
                        fechaColombia,
                        usuarioToken.cedula,
                        usuarioToken.nombre,
                        cantidadEntregaProveedorNueva.toString(),
                        pdfsJsonParaBD,
                        editadosEntregaProveedor['observaciones'],
                        estadoEntregaProveedor,
                        id
                    ]
                );

                await connection.query(
                    `
                        UPDATE cadena_suministro_logistica_despacho 
                        SET 
                            estadoDespachoMaterial = ?
                        WHERE item_id = ?
                    `,
                    [
                        estadoDespachoMaterial,
                        id
                    ]
                );

                await connection.query(
                    `
                        UPDATE cadena_suministro_finanzas_facturacion 
                        SET 
                            estadoAsociacionFactura = ?
                        WHERE item_id = ?
                    `,
                    [
                        estadoAsociacionFactura,
                        id
                    ]
                );

                await recalcularYActualizarEstadoSolicitudPorItems(id, connection);

                idsActualizados.push(id);
            }

            await connection.commit();
            connection.release();

            const registrosActualizados = await getRegistrosCompletos('i.id IN (?)', [idsProyectos]);

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'entregaProveedor',
                accion: 'Actualizar entrega material por proveedor exitoso',
                detalle: `Entrega de material por proveedor actualizado para ${idsActualizados.length} registro(s)`,
                datos: {
                    idsActualizados: idsActualizados,
                    registrosAfectados: idsActualizados.length
                },
                tablasIdsAfectados: idsActualizados.map(id => ({
                    tabla: 'cadena_suministro_solicitud',
                    id: id.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                "Entrega de material por proveedor actualizado correctamente",
                `Se actualizó la entraga de material por proveedor para ${idsActualizados.length} registro(s)`,
                {
                    registrosActualizados: registrosActualizados,
                    idsActualizados: idsActualizados,
                    pdfsSubidos: driveResults
                }
            );

        } catch (err) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'Error sistema',
                cedulaUsuario: usuarioToken.cedula || 'Error sistema',
                rolUsuario: usuarioToken.rol || 'Error sistema',
                nivel: 'error',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'entregaProveedor',
                accion: 'Actualizar entrega material por proveedor fallido',
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

router.put('/enviarAProveedor', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'enviarAProveedor',
                accion: 'Actualizar envio de orden a proveedor fallido',
                detalle: 'Los datos del formulario son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del formulario son requeridos.");
        }

        const { ids } = data;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'enviarAProveedor',
                accion: `Actualizar envio de orden a proveedor fallido`,
                detalle: 'Array de IDs son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Array de IDs son requeridos");
        }

        const registrosExistentes = await getRegistrosCompletos('i.id IN (?)', [ids]);

        const idsExistentes = registrosExistentes.map(r => r.id);
        const idsNoExistentes = ids.filter(id => !idsExistentes.includes(id));

        if (idsNoExistentes.length > 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'enviarAProveedor',
                accion: `Actualizar envio de orden a proveedor fallido`,
                detalle: `IDs no encontrados: ${idsNoExistentes.join(', ')}`,
                datos: { idsEnviados: ids, idsEncontrados: idsExistentes },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 404, `Los siguientes IDs no existen: ${idsNoExistentes.join(', ')}`);
        }

        const fechaColombia = getFechaHoraColombia();

        const connection = await dbRailway.getConnection();
        await connection.beginTransaction();

        try {
            const placeholders = ids.map(() => '?').join(',');
            let result;

            [result] = await connection.query(
                `
                    UPDATE cadena_suministro_compras 
                    SET 
                        fechaEnvioOrdenCompra = ?,
                        cedulaUsuarioEnvioOrdenCompra = ?,
                        nombreUsuarioEnvioOrdenCompra = ?,
                        envioDeCorreoEnvioOrdenCompra = 'Pendiente',
                        estadoEnvioOrdenCompra = 'Realizado',
                        estadoEntregaProveedor = 'Pendiente'
                    WHERE item_id IN (${placeholders})
                `,
                [
                    fechaColombia,
                    usuarioToken.cedula,
                    usuarioToken.nombre,
                    ...ids
                ]
            );

            await connection.query(
                `
                    UPDATE cadena_suministro_solicitud s
                    JOIN cadena_suministro_item i ON i.solicitud_id = s.id
                    SET s.estadoSolicitud = 'Pendiente Entrega Proveedor'
                    WHERE i.id IN (${placeholders})
                `,
                ids
            );

            await connection.commit();

            const registrosActualizados = await getRegistrosCompletos('i.id IN (?)', [ids]);

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'enviarAProveedor',
                accion: `Actualizar envio de orden a proveedor exitoso`,
                detalle: `Envio de orden a proveedor actualizada para ${ids.length} registro(s)`,
                datos: {
                    idsActualizados: ids,
                    registrosAfectados: result.affectedRows
                },
                tablasIdsAfectados: ids.map(id => ({
                    tabla: 'cadena_suministro_solicitud',
                    id: id.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                `Envio de orden a proveedor actualizada correctamente`,
                `Se actualizó el envio de orden a proveedor para ${ids.length} registro(s)`,
                {
                    registrosActualizados: registrosActualizados,
                    idsActualizados: ids
                }
            );

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'enviarAProveedor',
            accion: 'Error al actualizar envio de orden a proveedor',
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

router.put('/contabilidad', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'contabilidad',
                accion: 'Actualizar retenciones fallido',
                detalle: 'Los datos del formulario son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del formulario son requeridos.");
        }

        const { ids, rtFteContabilidad, rtIcaContabilidad, rtIvaContabilidad, totalPagarContabilidad, observacionContabilidad } = data;

        if (!ids || !rtFteContabilidad || !rtIcaContabilidad || !rtIvaContabilidad || !totalPagarContabilidad || !Array.isArray(ids) || ids.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'contabilidad',
                accion: `Actualizar retenciones fallido`,
                detalle: 'Los datos de retenciones son necesarios.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos de retenciones son necesarios.");
        }

        const registrosExistentes = await getRegistrosCompletos('i.id IN (?)', [ids]);

        const idsExistentes = registrosExistentes.map(r => r.id);
        const idsNoExistentes = ids.filter(id => !idsExistentes.includes(id));

        if (idsNoExistentes.length > 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'contabilidad',
                accion: `Actualizar retenciones fallido`,
                detalle: `IDs no encontrados: ${idsNoExistentes.join(', ')}`,
                datos: { idsEnviados: ids, idsEncontrados: idsExistentes },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 404, `Los siguientes IDs no existen: ${idsNoExistentes.join(', ')}`);
        }

        const fechaColombia = getFechaHoraColombia();

        const connection = await dbRailway.getConnection();
        await connection.beginTransaction();

        try {
            const placeholders = ids.map(() => '?').join(',');
            let result;

            [result] = await connection.query(
                `
                    UPDATE cadena_suministro_finanzas_facturacion 
                    SET 
                        fechaContabilidad = ?,
                        cedulaUsuarioContabilidad = ?,
                        nombreUsuarioContabilidad = ?,
                        rtFteContabilidad = ?,
                        rtIvaContabilidad = ?,
                        rtIcaContabilidad = ?,
                        totalPagarContabilidad = ?,
                        observacionContabilidad = ?,
                        estadoContabilidad = 'Realizado',
                        estadoAprobacionAnticipo3 = 'Pendiente'
                    WHERE item_id IN (${placeholders})
                `,
                [
                    fechaColombia,
                    usuarioToken.cedula,
                    usuarioToken.nombre,
                    rtFteContabilidad,
                    rtIvaContabilidad,
                    rtIcaContabilidad,
                    totalPagarContabilidad,
                    observacionContabilidad,
                    ...ids
                ]
            );

            await recalcularYActualizarEstadoSolicitudPorItems(ids, connection);

            await connection.commit();

            const registrosActualizados = await getRegistrosCompletos('i.id IN (?)', [ids]);

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'contabilidad',
                accion: `Actualizar retenciones exitoso`,
                detalle: `Retenciones actualizadas para ${ids.length} registro(s)`,
                datos: {
                    idsActualizados: ids,
                    registrosAfectados: result.affectedRows
                },
                tablasIdsAfectados: ids.map(id => ({
                    tabla: 'cadena_suministro_solicitud',
                    id: id.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                `Retenciones actualizadas correctamente`,
                `Se actualizó las retenciones para ${ids.length} registro(s)`,
                {
                    registrosActualizados: registrosActualizados,
                    idsActualizados: ids
                }
            );

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'contabilidad',
            accion: 'Error al actualizar retenciones',
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

router.put('/contabilidadAprobacion', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'contabilidadAprobacion',
                accion: 'Actualizar aprobacion fallido',
                detalle: 'Los datos de aprobacion son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos del formulario son requeridos.");
        }

        const { ids, contrasenaAprobacion, observacionesAprobacion, estado, nivel } = data;

        if (!ids || !contrasenaAprobacion || !estado || !nivel || !Array.isArray(ids) || ids.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'contabilidadAprobacion',
                accion: `Actualizar aprobacion ${nivel} fallido`,
                detalle: 'Los datos de aprobacion son necesarios.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos de retenciones son necesarios.");
        }

        const [firma] = await dbRailway.query(
            `SELECT * FROM firmas WHERE cedulaUsuario = ?`,
            [usuarioToken.cedula]
        );

        if (firma.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'contabilidadAprobacion',
                accion: `Actualizar aprobacion ${nivel} fallido`,
                detalle: 'Registro no permitido: Cédula de usuario no tiene firma registrada.',
                datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Cédula de usuario no tiene firma registrada.");
        }

        if (!await bcrypt.compare(contrasenaAprobacion, firma[0].contrasena)) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'contabilidadAprobacion',
                accion: `Actualizar aprobacion ${nivel} fallido`,
                detalle: 'Registro no permitido: Contraseña actual incorrecta.',
                datos: { cedulaUsuarioProporcionado: usuarioToken.cedula },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Registro no permitido: Contraseña actual incorrecta.", null, { "contrasenaAprobacion": `La contraseña actual proporcionada no coincide con la registrada.` });
        }

        const [registrosExistentes] = await dbRailway.query(
            `SELECT item_id as id, totalOrdenCompra FROM cadena_suministro_compras WHERE item_id IN (?)`,
            [ids]
        );

        const idsExistentes = registrosExistentes.map(r => r.id);
        const idsNoExistentes = ids.filter(id => !idsExistentes.includes(id));

        if (idsNoExistentes.length > 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'contabilidadAprobacion',
                accion: `Actualizar aprobacion ${nivel} fallido`,
                detalle: `IDs no encontrados: ${idsNoExistentes.join(', ')}`,
                datos: { idsEnviados: ids, idsEncontrados: idsExistentes },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 404, `Los siguientes IDs no existen: ${idsNoExistentes.join(', ')}`);
        }

        let aplicaAprobacion4 = false;

        if (registrosExistentes &&
            registrosExistentes.length > 0 &&
            registrosExistentes[0].totalOrdenCompra !== undefined &&
            registrosExistentes[0].totalOrdenCompra !== null &&
            registrosExistentes[0].totalOrdenCompra !== '') {

            let totalOrdenCompraNum;

            if (typeof registrosExistentes[0].totalOrdenCompra === 'string') {
                const cleanedValue = registrosExistentes[0].totalOrdenCompra
                    .replace(/[$]/g, '')
                    .replace(/[€]/g, '')
                    .replace(/[¥]/g, '')
                    .replace(/,/g, '')
                    .replace(/\s/g, '')
                    .trim();

                totalOrdenCompraNum = parseFloat(cleanedValue);
            } else {
                totalOrdenCompraNum = parseFloat(registrosExistentes[0].totalOrdenCompra);
            }

            if (!isNaN(totalOrdenCompraNum) && isFinite(totalOrdenCompraNum)) {
                aplicaAprobacion4 = totalOrdenCompraNum >= 5000000;
            } else {
                aplicaAprobacion4 = false;
            }
        } else {
            console.warn('No hay datos válidos en registrosExistentes[0].totalOrdenCompra');
        }

        const fechaColombia = getFechaHoraColombia();
        const estadoAprobacionAnticipo3Temp = nivel === '3' ? estado : null;
        const estadoAprobacionAnticipo4Temp =
            nivel === '4' && aplicaAprobacion4 ?
                estado
                : (nivel === '3' && aplicaAprobacion4 ?
                    (estado === 'Aprobado' ? 'Pendiente' : null)
                    : nivel === '3' && !aplicaAprobacion4 ?
                        (estado === 'Aprobado' ? 'No aplica' : null)
                        : null);
        const estadoTesoreriaTemp =
            nivel === '3' && aplicaAprobacion4 ?
                null
                : nivel === '3' && !aplicaAprobacion4 ?
                    (estado === 'Aprobado' ? 'Pendiente' : null)
                    : nivel === '4' && aplicaAprobacion4 ?
                        (estado === 'Aprobado' ? 'Pendiente' : null)
                        : null;
        const estadoSolicitud =
            nivel === '3' && aplicaAprobacion4 ?
                (estado === 'Aprobado' ? 'Pendiente Aprobacion 4 Anticipo' : 'Rechazado')
                : nivel === '3' && !aplicaAprobacion4 ?
                    (estado === 'Aprobado' ? 'Pendiente Tesoreria' : 'Rechazado')
                    : nivel === '4' && aplicaAprobacion4 ?
                        (estado === 'Aprobado' ? 'Pendiente Tesoreria' : 'Rechazado')
                        : null;

        const connection = await dbRailway.getConnection();
        await connection.beginTransaction();

        try {
            const placeholders = ids.map(() => '?').join(',');
            let result;

            if (nivel === '3') {
                [result] = await connection.query(
                    `
                        UPDATE cadena_suministro_finanzas_facturacion 
                        SET 
                            fechaAprobacionAnticipo3 = ?,
                            cedulaUsuarioAprobacionAnticipo3 = ?,
                            nombreUsuarioAprobacionAnticipo3 = ?,
                            observacionAprobacionAnticipo3 = ?,
                            firmaAprobacionAnticipo3 = ?,
                            estadoAprobacionAnticipo3 = ?,
                            estadoAprobacionAnticipo4 = ?,
                            estadoTesoreria = ?
                        WHERE item_id IN (${placeholders})
                    `,
                    [
                        fechaColombia,
                        usuarioToken.cedula,
                        usuarioToken.nombre,
                        observacionesAprobacion,
                        firma[0].firma,
                        estadoAprobacionAnticipo3Temp,
                        estadoAprobacionAnticipo4Temp,
                        estadoTesoreriaTemp,
                        ...ids
                    ]
                );

                await recalcularYActualizarEstadoSolicitudPorItems(ids, connection);
            } else if (nivel === '4') {
                [result] = await connection.query(
                    `
                    UPDATE cadena_suministro_finanzas_facturacion 
                    SET 
                        fechaAprobacionAnticipo4 = ?,
                        cedulaUsuarioAprobacionAnticipo4 = ?,
                        nombreUsuarioAprobacionAnticipo4 = ?,
                        observacionAprobacionAnticipo4 = ?,
                        firmaAprobacionAnticipo4 = ?,
                        estadoAprobacionAnticipo4 = ?,
                        estadoTesoreria = ?
                    WHERE item_id IN (${placeholders})
                `,
                    [
                        fechaColombia,
                        usuarioToken.cedula,
                        usuarioToken.nombre,
                        observacionesAprobacion,
                        firma[0].firma,
                        estadoAprobacionAnticipo4Temp,
                        estadoTesoreriaTemp,
                        ...ids
                    ]
                );

                await recalcularYActualizarEstadoSolicitudPorItems(ids, connection);
            }

            await connection.commit();

            const registrosActualizados = await getRegistrosCompletos('i.id IN (?)', [ids]);

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'contabilidadAprobacion',
                accion: `Actualizar aprobacion ${nivel} exitoso`,
                detalle: `Aprobacion actualizada para ${ids.length} registro(s)`,
                datos: {
                    idsActualizados: ids,
                    registrosAfectados: result.affectedRows
                },
                tablasIdsAfectados: ids.map(id => ({
                    tabla: 'cadena_suministro_solicitud',
                    id: id.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                `Aprobacion ${nivel} correctamente`,
                `Se actualizó la aprobacion ${nivel} para ${ids.length} registro(s)`,
                {
                    registrosActualizados: registrosActualizados,
                    idsActualizados: ids
                }
            );

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'contabilidadAprobacion',
            accion: 'Error al actualizar aprobacion',
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

router.get('/registrosFacturas', validarToken, async (req, res) => {

    const usuarioToken = req.validarToken.usuario

    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_facturas');

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'get',
            endPoint: 'registrosFacturas',
            accion: 'Consulta registros facturas exitosa',
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
            `Se obtuvieron ${rows.length} registros de las facturas.`,
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
            endPoint: 'registrosFacturas',
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

router.post('/cargarFactura',
    validarToken,
    upload.fields([
        { name: 'pdfsFacturas' },
    ]),
    async (req, res) => {

        const usuarioToken = req.validarToken.usuario

        try {
            const dataString = req.body.data;
            const data = JSON.parse(dataString);
            const archivos = req.files;

            if (!data || Object.keys(data).length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'post',
                    endPoint: 'cargarFactura',
                    accion: 'Cargar factura fallido',
                    detalle: 'Los datos del registro son requeridos.',
                    datos: { dataString },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Los datos del registro son requeridos.");
            }

            if (!archivos?.pdfsFacturas || Object.keys(archivos).length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'post',
                    endPoint: 'cargarFactura',
                    accion: 'Cargar factura fallido',
                    detalle: 'Los soportes son necesario: PDFs',
                    datos: { ArchivoProporcionado: archivos },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Los soportes son necesario: PDFs", null, { "pdfsFacturas": `Ingrese un archivo .pdf con la salida.` });
            }

            const { consecutivoFacturas } = data;

            if (!consecutivoFacturas) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'post',
                    endPoint: 'cargarFactura',
                    accion: 'Cargar factura fallido',
                    detalle: 'El consecutivo de la factura es necesario.',
                    datos: { data },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "El consecutivo de la factura es necesario.");
            }

            const [consecutivoExistente] = await dbRailway.query(
                `SELECT * FROM registros_facturas WHERE consecutivoFacturas = ?`,
                [consecutivoFacturas]
            );

            if (consecutivoExistente.length > 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'post',
                    endPoint: 'cargarFactura',
                    accion: 'Cargar factura fallido',
                    detalle: `El consecutivo ${consecutivoFacturas} ya existe.`,
                    datos: { data },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, `El consecutivo ${consecutivoFacturas} ya se encuentra registrado.`);
            }

            const fechaColombia = getFechaHoraColombia()
            const driveResults = [];

            if (archivos?.pdfsFacturas && Array.isArray(archivos.pdfsFacturas) && archivos.pdfsFacturas.length > 0) {
                for (let i = 0; i < archivos.pdfsFacturas.length; i++) {
                    const pdfFile = archivos.pdfsFacturas[i];
                    try {

                        const pdfExt = path.extname(pdfFile.originalname);
                        const pdfFileName = `${consecutivoFacturas}_pdf_factura_${i + 1}_${fechaColombia}${pdfExt}`;

                        const fileId = await uploadFileToDrive(
                            pdfFile.buffer,
                            pdfFileName,
                            folderId
                        );

                        const result = {
                            tipo: 'pdf',
                            nombre: pdfFileName,
                            id: fileId.id,
                            url: fileId.url,
                            webViewLink: fileId.webViewLink,
                            indice: i,
                            size: pdfFile.size
                        }

                        driveResults.push(result);

                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'success',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'cadenaSuministro',
                            metodo: 'post',
                            endPoint: 'cargarFactura',
                            accion: 'Cargar PDF exitoso',
                            detalle: `PDF ${i + 1} de ${archivos.pdfsFacturas.length} cargado exitosamente`,
                            datos: {
                                pdf: result,
                                totalPDFs: archivos.pdfsFacturas.length,
                                indice: i + 1
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    } catch (error) {
                        console.error(`Error procesando PDF ${i + 1}:`, error);

                        await registrarHistorial({
                            nombreUsuario: usuarioToken.nombre || 'No registrado',
                            cedulaUsuario: usuarioToken.cedula || 'No registrado',
                            rolUsuario: usuarioToken.rol || 'No registrado',
                            nivel: 'error',
                            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                            app: 'cadenaSuministro',
                            metodo: 'post',
                            endPoint: 'cargarFactura',
                            accion: 'Cargar PDF fallido',
                            detalle: `Error al cargar PDF ${i + 1}: ${error.message}`,
                            datos: {
                                nombreOriginal: pdfFile.originalname,
                                error: error.message
                            },
                            tablasIdsAfectados: [],
                            ipAddress: getClientIp(req),
                            userAgent: req.headers['user-agent'] || ''
                        });
                    }
                }
            }

            const nuevosNombres = driveResults.map(pdf => pdf.nombre);

            const connection = await dbRailway.getConnection();
            await connection.beginTransaction();

            const [result] = await connection.query(
                `
                    INSERT INTO registros_facturas 
                    SET 
                        fechaFacturas = ?,
                        cedulaUsuarioFacturas = ?,
                        nombreUsuarioFacturas = ?,
                        consecutivoFacturas = ?,
                        pdfsFacturas = ?
                `,
                [
                    fechaColombia,
                    usuarioToken.cedula,
                    usuarioToken.nombre,
                    consecutivoFacturas,
                    JSON.stringify(nuevosNombres),
                ]
            );

            await connection.commit();
            connection.release();

            const [registrosActualizados] = await dbRailway.query(
                `SELECT * FROM registros_facturas WHERE id = ?`,
                [result.insertId]
            );

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'post',
                endPoint: 'cargarFactura',
                accion: 'Cargar factura exitoso',
                detalle: `Factura cargada exitosamente con el consecutivo ${consecutivoFacturas}.`,
                datos: {
                    registrosAfectados: registrosActualizados[0].id
                },
                tablasIdsAfectados: [{
                    tabla: 'registros_facturas',
                    ids: registrosActualizados[0].id.toString()
                }],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                "Factura cargada exitosamente",
                `Se cargó la factura con el consecutivo ${consecutivoFacturas}.`,
                {
                    registrosActualizados: registrosActualizados,
                    pdfsSubidos: driveResults
                }
            );

        } catch (err) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'Error sistema',
                cedulaUsuario: usuarioToken.cedula || 'Error sistema',
                rolUsuario: usuarioToken.rol || 'Error sistema',
                nivel: 'error',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'post',
                endPoint: 'cargarFactura',
                accion: 'Cargar factura fallido',
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

router.post('/obtenerArchivosFacturas', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario
    const { pdfsFacturas } = req.body;

    try {

        if (!pdfsFacturas || !Array.isArray(pdfsFacturas) || pdfsFacturas.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'post',
                endPoint: 'obtenerArchivosFacturas',
                accion: 'Obtener archivos fallido',
                detalle: 'Los datos de los archivos son requeridos.',
                datos: { pdfsFacturas },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                400,
                "Solicitud inválida",
                "Se requiere un array de nombres de PDFs en el campo 'pdfsFacturas'",
                null
            );
        }

        const resultados = {
            facturas: [],
            errores: []
        };

        for (const nombrePDF of pdfsFacturas) {
            try {
                const buffer = await getFileFromDrive(nombrePDF, folderId);
                if (buffer) {
                    resultados.facturas.push({
                        nombre: nombrePDF,
                        data: buffer.toString('base64'),
                        contentType: getMimeType(nombrePDF)
                    });
                } else {
                    resultados.errores.push({
                        nombre: nombrePDF,
                        error: "No se pudo obtener el archivo de Drive"
                    });
                }
            } catch (error) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'Error sistema',
                    cedulaUsuario: usuarioToken.cedula || 'Error sistema',
                    rolUsuario: usuarioToken.rol || 'Error sistema',
                    nivel: 'error',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'post',
                    endPoint: 'obtenerArchivosFacturas',
                    accion: 'Obtener archivos fallido',
                    detalle: 'Error interno del servidor',
                    datos: {
                        error: error.message,
                        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                    },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                resultados.errores.push({
                    nombre: nombrePDF,
                    error: error.message || "Error desconocido al obtener el archivo"
                });
            }
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'post',
            endPoint: 'obtenerArchivosFacturas',
            accion: 'Consulta archivos exitosa',
            detalle: `Se consultó ${resultados.length} registros`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron los archivos correctamente.`,
            resultados
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'post',
            endPoint: 'obtenerArchivosFacturas',
            accion: 'Error al obtener los archivos',
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

router.put('/asociarFactura', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario
    const { ordenCompra, consecutivoFacturas } = req.body;

    try {
        if (!ordenCompra || typeof ordenCompra !== 'string' || ordenCompra.trim() === '') {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'asociarFactura',
                accion: 'Asociar factura fallido',
                detalle: 'Los datos de la orden de compra es requerida.',
                datos: { ordenCompra },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                400,
                "Solicitud inválida",
                "Se requiere la orden de compra",
                null
            );
        }

        if (!consecutivoFacturas || typeof consecutivoFacturas !== 'string' || consecutivoFacturas.trim() === '') {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'asociarFactura',
                accion: 'Asociar factura fallido',
                detalle: 'El consecutivo de la factura es requerido.',
                datos: { ordenCompra, consecutivoFacturas },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                400,
                "Solicitud inválida",
                "Se requiere un consecutivo de factura en el campo 'consecutivoFacturas'",
                null
            );
        }

        const fechaColombia = getFechaHoraColombia();
        const consecutivoFacturasFormateado = consecutivoFacturas.trim();

        const [consecutivoAsociado] = await dbRailway.query(
            `SELECT id FROM cadena_suministro_finanzas_facturacion WHERE consecutivoAsociacionFactura = ? LIMIT 1`,
            [consecutivoFacturasFormateado]
        );

        if (consecutivoAsociado.length > 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'asociarFactura',
                accion: 'Asociar factura fallido',
                detalle: `El consecutivo ${consecutivoFacturasFormateado} ya se encuentra asociado en otros registros.`,
                datos: { ordenCompra, consecutivoFacturas: consecutivoFacturasFormateado },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Consecutivo ya asociado: consecutivoFacturas", null, { "consecutivoFacturas": `El consecutivo ${consecutivoFacturasFormateado} ya se encuentra asociado a otros registros en la base de datos.` });
        }

        const [ordenCompraAsociado] = await dbRailway.query(
            `SELECT item_id as id FROM cadena_suministro_compras WHERE ordenCompra = ?`,
            [ordenCompra]
        );

        if (ordenCompraAsociado.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'asociarFactura',
                accion: 'Asociar factura fallido',
                detalle: `La orden de compra ${ordenCompra} no se encuentra asociada a ningun registro en la base de datos.`,
                datos: { ordenCompra },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Orden de compra no encontrada: ordenCompra", null, { "ordenCompra": `La orden de compra ${ordenCompra} no se encuentra asociada a ningun registro en la base de datos.` });
        }

        const ids = ordenCompraAsociado.map(row => row.id);
        const placeholders = ids.map(() => '?').join(',');

        const connection = await dbRailway.getConnection();
        await connection.beginTransaction();

        try {
            const [result] = await connection.query(
                `
                    UPDATE cadena_suministro_finanzas_facturacion 
                    SET 
                        fechaAsociacionFactura = ?,
                        cedulaUsuarioAsociacionFactura = ?,
                        nombreUsuarioAsociacionFactura = ?,
                        consecutivoAsociacionFactura = ?,
                        estadoAsociacionFactura = 'En Revision'
                    WHERE item_id IN (${placeholders})
                `,
                [
                    fechaColombia,
                    usuarioToken.cedula,
                    usuarioToken.nombre,
                    consecutivoFacturasFormateado,
                    ...ids
                ]
            );

            await recalcularYActualizarEstadoSolicitudPorItems(ids, connection);

            await connection.commit();

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'asociarFactura',
                accion: 'Asociar factura exitosa',
                detalle: `Se asoció la factura con el consecutivo ${consecutivoFacturasFormateado} a ${result.affectedRows} registros.`,
                datos: {
                    ids: ids,
                    consecutivoFacturas: consecutivoFacturasFormateado
                },
                tablasIdsAfectados: ids.map(id => ({
                    tabla: 'cadena_suministro_solicitud',
                    id: id.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                "Factura asociada exitosamente",
                `Se asoció la factura con el consecutivo ${consecutivoFacturasFormateado} a ${result.affectedRows} registros.`,
                {
                    registrosActualizados: result.affectedRows,
                    ids: ids,
                    consecutivoFacturas: consecutivoFacturasFormateado
                }
            );
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'put',
            endPoint: 'asociarFactura',
            accion: 'Asociar factura fallido',
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

router.put('/revisionManual',
    validarToken,
    upload.single('pdfRevisionManual'),
    async (req, res) => {
        const usuarioToken = req.validarToken.usuario;

        try {
            const { ids, observaciones } = req.body;
            const pdfRevisionManual = req.file;

            if (!ids) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'revisionManual',
                    accion: 'Revisión manual fallida',
                    detalle: 'Los IDs son requeridos.',
                    datos: { ids },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Los IDs son requeridos.");
            }

            if (!pdfRevisionManual) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'revisionManual',
                    accion: 'Revisión manual fallida',
                    detalle: 'El PDF de revisión es requerido.',
                    datos: { ids },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "El PDF de revisión es requerido.");
            }

            const parsedIds = JSON.parse(ids);
            if (!Array.isArray(parsedIds) || parsedIds.length === 0) {
                return sendError(res, 400, "Formato de IDs inválido.");
            }

            const registrosBase = await getRegistrosCompletos('i.id = ?', [parsedIds[0]]);

            if (registrosBase.length === 0) {
                return sendError(res, 404, "No se encontró el registro base para procesar la revisión.");
            }

            const { consecutivoAsociacionFactura, ordenCompra } = registrosBase[0];
            const fechaColombia = getFechaHoraColombia();

            // Subir archivo a Google Drive
            const pdfExt = path.extname(pdfRevisionManual.originalname);
            const pdfFileName = `Revision_Factura_${consecutivoAsociacionFactura || 'SIN_CONSECUTIVO'}_${ordenCompra || 'SIN_OC'}_${fechaColombia}${pdfExt}`;


            const fileId = await uploadFileToDrive(
                pdfRevisionManual.buffer,
                pdfFileName,
                folderId
            );

            const driveResult = {
                tipo: 'pdf',
                nombre: pdfFileName,
                id: fileId.id,
                url: fileId.url,
                webViewLink: fileId.webViewLink,
                size: pdfRevisionManual.size
            };

            const driveResultsJSON = JSON.stringify([driveResult]);

            const connection = await dbRailway.getConnection();
            await connection.beginTransaction();

            try {
                const placeholders = parsedIds.map(() => '?').join(',');

                const [result] = await connection.query(
                    `UPDATE cadena_suministro_finanzas_facturacion 
                     SET 
                        fechaRevisionFactura = ?,
                        cedulaUsuarioRevisionFactura = ?,
                        nombreUsuarioRevisionFactura = ?,
                        pdfsRevisionFactura = ?,
                        observacionRevisionFactura = ?,
                        estadoAsociacionFactura = 'Realizado'
                     WHERE item_id IN (${placeholders})`,
                    [
                        fechaColombia,
                        usuarioToken.cedula,
                        usuarioToken.nombre,
                        driveResultsJSON,
                        observaciones || null,
                        ...parsedIds
                    ]
                );

                await recalcularYActualizarEstadoSolicitudPorItems(parsedIds, connection);

                await connection.commit();

                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'success',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'revisionManual',
                    accion: 'Revisión manual exitosa',
                    detalle: `Se procesó la revisión manual para ${result.affectedRows} registros.`,
                    datos: {
                        ids: parsedIds,
                        archivo: driveResult
                    },
                    tablasIdsAfectados: parsedIds.map(id => ({
                        tabla: 'cadena_suministro_solicitud',
                        id: id.toString()
                    })),
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendResponse(
                    res,
                    200,
                    "Revisión guardada exitosamente",
                    `Se ha procesado la revisión para ${result.affectedRows} registro(s).`,
                    {
                        idsActualizados: parsedIds,
                        archivo: driveResult
                    }
                );

            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }

        } catch (err) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'Error sistema',
                cedulaUsuario: usuarioToken.cedula || 'Error sistema',
                rolUsuario: usuarioToken.rol || 'Error sistema',
                nivel: 'error',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'revisionManual',
                accion: 'Error en revisión manual',
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
    }
);


router.post('/obtenerArchivosAnticiposTesoreria', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario
    const { pdfsAnticipoTesoreria } = req.body;

    try {

        if (!pdfsAnticipoTesoreria || !Array.isArray(pdfsAnticipoTesoreria) || pdfsAnticipoTesoreria.length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'post',
                endPoint: 'obtenerArchivosAnticiposTesoreria',
                accion: 'Obtener archivos fallido',
                detalle: 'Los datos de los archivos son requeridos.',
                datos: { pdfsAnticipoTesoreria },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                400,
                "Solicitud inválida",
                "Se requiere un array de nombres de PDFs en el campo 'pdfsAnticipoTesoreria'",
                null
            );
        }

        const resultados = {
            anticiposTesoreria: [],
            errores: []
        };

        for (const nombrePDF of pdfsAnticipoTesoreria) {
            try {
                const buffer = await getFileFromDrive(nombrePDF, folderId);
                if (buffer) {
                    resultados.anticiposTesoreria.push({
                        nombre: nombrePDF,
                        data: buffer.toString('base64'),
                        contentType: getMimeType(nombrePDF)
                    });
                } else {
                    resultados.errores.push({
                        nombre: nombrePDF,
                        error: "No se pudo obtener el archivo de Drive"
                    });
                }
            } catch (error) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'Error sistema',
                    cedulaUsuario: usuarioToken.cedula || 'Error sistema',
                    rolUsuario: usuarioToken.rol || 'Error sistema',
                    nivel: 'error',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'post',
                    endPoint: 'obtenerArchivosAnticiposTesoreria',
                    accion: 'Obtener archivos fallido',
                    detalle: 'Error interno del servidor',
                    datos: {
                        error: error.message,
                        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                    },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                resultados.errores.push({
                    nombre: nombrePDF,
                    error: error.message || "Error desconocido al obtener el archivo"
                });
            }
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'post',
            endPoint: 'obtenerArchivosAnticiposTesoreria',
            accion: 'Consulta archivos exitosa',
            detalle: `Se consultó ${resultados.anticiposTesoreria.length} registros`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(
            res,
            200,
            `Consulta exitosa`,
            `Se obtuvieron los archivos correctamente.`,
            resultados
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'post',
            endPoint: 'obtenerArchivosAnticiposTesoreria',
            accion: 'Error al obtener los archivos',
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

router.put('/trasladoPendiente',
    validarToken,
    upload.array('pdfs'),
    async (req, res) => {
        const usuarioToken = req.validarToken.usuario;

        try {
            const dataString = req.body.data;
            const archivos = req.files;

            if (!dataString) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'trasladoPendiente',
                    accion: 'Actualizar traslado pendiente fallido',
                    detalle: 'Los datos del traslado son requeridos.',
                    datos: { dataString },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Los datos del traslado son requeridos.");
            }

            const editadosTraslado = JSON.parse(dataString);
            const { observaciones, solicitudesAfectadas } = editadosTraslado;

            if (!archivos || archivos.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'trasladoPendiente',
                    accion: 'Actualizar traslado pendiente fallido',
                    detalle: 'Soporte requerido: PDFs',
                    datos: { archivosProporcionados: archivos },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Soporte requerido: Debe adjuntar al menos un archivo PDF de soporte.", null, { "pdfs": `Ingrese al menos un archivo .pdf de soporte.` });
            }

            if (!solicitudesAfectadas || !Array.isArray(solicitudesAfectadas) || solicitudesAfectadas.length === 0) {
                return sendError(res, 400, "No se proporcionaron solicitudes afectadas.");
            }

            const [solicitudesExistentes] = await dbRailway.query(
                `SELECT 
                    i.id as id, 
                    i.codigo as codigo, 
                    i.descripcion as descripcion, 
                    ld.disponibilidadLogistica as disponibilidadLogistica, 
                    s.solicitud as solicitud 
                 FROM cadena_suministro_item i
                 JOIN cadena_suministro_solicitud s ON i.solicitud_id = s.id
                 JOIN cadena_suministro_logistica_despacho ld ON i.id = ld.item_id
                 WHERE s.solicitud IN (?) AND ld.estadoTrasladoLogistica = 'Pendiente'`,
                [solicitudesAfectadas]
            );

            // Agrupar por llave (codigo|||descripcion) y sumar disponibilidadLogistica
            const resumenDB = {};
            solicitudesExistentes.forEach(sol => {
                const llave = `${sol.codigo}|||${sol.descripcion}`;
                if (!resumenDB[llave]) {
                    resumenDB[llave] = {
                        sumaConfirmada: 0,
                        ids: [],
                        codigo: sol.codigo,
                        descripcion: sol.descripcion
                    };
                }
                resumenDB[llave].sumaConfirmada += parseFloat(sol.disponibilidadLogistica || '0');
                resumenDB[llave].ids.push(sol.id);
            });

            // Validar cantidades enviadas contra la suma en DB
            for (const [llave, cantidadEnviadaStr] of Object.entries(editadosTraslado)) {
                if (llave === 'observaciones' || llave === 'solicitudesAfectadas' || llave === 'bodegas') continue;

                const cantidadEnviada = parseFloat(cantidadEnviadaStr);
                const infoDB = resumenDB[llave];

                if (!infoDB) continue;

                const sumaConfirmada = infoDB.sumaConfirmada;

                if (isNaN(cantidadEnviada) || cantidadEnviada < sumaConfirmada) {
                    await registrarHistorial({
                        nombreUsuario: usuarioToken.nombre || 'No registrado',
                        cedulaUsuario: usuarioToken.cedula || 'No registrado',
                        rolUsuario: usuarioToken.rol || 'No registrado',
                        nivel: 'log',
                        plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                        app: 'cadenaSuministro',
                        metodo: 'put',
                        endPoint: 'trasladoPendiente',
                        accion: 'Actualizar traslado pendiente fallido',
                        detalle: `Cantidad insuficiente para el ítem ${infoDB.codigo}`,
                        datos: { llave, cantidadEnviada, sumaConfirmada },
                        tablasIdsAfectados: [],
                        ipAddress: getClientIp(req),
                        userAgent: req.headers['user-agent'] || ''
                    });

                    return sendError(res, 400, `El ítem ${infoDB.codigo} requiere una cantidad mayor o igual a ${sumaConfirmada}.`);
                }
            }

            const fechaColombia = getFechaHoraColombia();
            const driveResults = [];

            // Subir archivos a Google Drive
            for (let i = 0; i < archivos.length; i++) {
                const pdfFile = archivos[i];
                try {
                    const pdfExt = path.extname(pdfFile.originalname);
                    const pdfFileName = `Traslado_${editadosTraslado.solicitudesAfectadas}_${editadosTraslado.bodegas}_${i + 1}_${fechaColombia}${pdfExt}`;

                    const fileId = await uploadFileToDrive(
                        pdfFile.buffer,
                        pdfFileName,
                        folderId
                    );

                    driveResults.push({
                        tipo: 'pdf',
                        nombre: pdfFileName,
                        id: fileId.id,
                        url: fileId.url,
                        webViewLink: fileId.webViewLink,
                        indice: i + 1,
                        size: pdfFile.size
                    });
                } catch (error) {
                    console.error(`Error procesando PDF ${i + 1}:`, error);
                }
            }

            const driveResultsJSON = JSON.stringify(driveResults);
            const connection = await dbRailway.getConnection();
            await connection.beginTransaction();

            const idsAActualizar = [];
            for (const [llave, cantidadEnviadaStr] of Object.entries(editadosTraslado)) {
                if (llave === 'observaciones' || llave === 'solicitudesAfectadas' || llave === 'bodegas') continue;
                if (resumenDB[llave]) {
                    idsAActualizar.push(...resumenDB[llave].ids);
                }
            }

            if (idsAActualizar.length === 0) {
                return sendError(res, 400, "No hay ítems válidos para actualizar.");
            }

            try {
                const [maxConsecutivoRows] = await connection.query(
                    'SELECT MAX(CAST(consecutivoTrasladoLogistica AS UNSIGNED)) as maxConsecutivo FROM cadena_suministro_logistica_despacho'
                );
                const nuevoConsecutivo = Number(maxConsecutivoRows[0].maxConsecutivo || 0) + 1;

                for (const id of idsAActualizar) {
                    await connection.query(
                        `UPDATE cadena_suministro_logistica_despacho 
                         SET 
                            consecutivoTrasladoLogistica = ?,
                            fechaTrasladoSalidaLogistica = ?,
                            cedulaUsuarioTrasladoSalidaLogistica = ?,
                            nombreUsuarioTrasladoSalidaLogistica = ?,
                            cantidadTrasladoSalidaLogistica = ?,
                            pdfsTrasladoSalidaLogistica = ?,
                            observacionTrasladoSalidaLogistica = ?,
                            estadoTrasladoLogistica = 'En Transito'
                         WHERE item_id = ?`,
                        [
                            nuevoConsecutivo,
                            fechaColombia,
                            usuarioToken.cedula,
                            usuarioToken.nombre,
                            solicitudesExistentes.find((solicitud) => solicitud.id === id).disponibilidadLogistica,
                            driveResultsJSON,
                            observaciones || null,
                            id
                        ]
                    );
                }

                await connection.commit();
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'trasladoPendiente',
                accion: 'Actualizar traslado pendiente exitoso',
                detalle: `Traslado pendiente actualizado para ${solicitudesAfectadas.length} registro(s)`,
                datos: {
                    idsActualizados: solicitudesAfectadas,
                    totalPDFs: driveResults.length
                },
                tablasIdsAfectados: solicitudesAfectadas.map(id => ({
                    tabla: 'cadena_suministro_solicitud',
                    id: id.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                "Traslado actualizado correctamente",
                `Se ha procesado el traslado para ${solicitudesAfectadas.length} registro(s).`,
                {
                    idsActualizados: solicitudesAfectadas,
                    archivos: driveResults
                }
            );

        } catch (err) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'Error sistema',
                cedulaUsuario: usuarioToken.cedula || 'Error sistema',
                rolUsuario: usuarioToken.rol || 'Error sistema',
                nivel: 'error',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'trasladoPendiente',
                accion: 'Error al actualizar traslado pendiente',
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

router.put('/trasladoEnTransito',
    validarToken,
    upload.array('pdfsEntrada'),
    async (req, res) => {
        const usuarioToken = req.validarToken.usuario;

        try {
            const dataString = req.body.data;
            const archivos = req.files;

            if (!dataString) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'trasladoEnTransito',
                    accion: 'Actualizar traslado en tránsito fallido',
                    detalle: 'Los datos del traslado son requeridos.',
                    datos: { dataString },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Los datos del traslado son requeridos.");
            }

            const editadosTraslado = JSON.parse(dataString);
            const { observaciones, solicitudesAfectadas } = editadosTraslado;

            if (!archivos || archivos.length === 0) {
                await registrarHistorial({
                    nombreUsuario: usuarioToken.nombre || 'No registrado',
                    cedulaUsuario: usuarioToken.cedula || 'No registrado',
                    rolUsuario: usuarioToken.rol || 'No registrado',
                    nivel: 'log',
                    plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                    app: 'cadenaSuministro',
                    metodo: 'put',
                    endPoint: 'trasladoEnTransito',
                    accion: 'Actualizar traslado en tránsito fallido',
                    detalle: 'Soporte requerido: PDFs Entrada',
                    datos: { archivosProporcionados: archivos },
                    tablasIdsAfectados: [],
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || ''
                });

                return sendError(res, 400, "Soporte requerido: Debe adjuntar al menos un archivo PDF de recepción.", null, { "pdfsEntrada": `Ingrese al menos un archivo .pdf de recepción.` });
            }

            if (!solicitudesAfectadas || !Array.isArray(solicitudesAfectadas) || solicitudesAfectadas.length === 0) {
                return sendError(res, 400, "No se proporcionaron solicitudes afectadas.");
            }

            const [solicitudesExistentes] = await dbRailway.query(
                `SELECT 
                    i.id as id, 
                    i.codigo as codigo, 
                    i.descripcion as descripcion, 
                    ld.cantidadTrasladoSalidaLogistica as cantidadTrasladoSalidaLogistica, 
                    s.solicitud as solicitud, 
                    s.estadoSolicitud as estadoSolicitud 
                 FROM cadena_suministro_item i
                 JOIN cadena_suministro_solicitud s ON i.solicitud_id = s.id
                 JOIN cadena_suministro_logistica_despacho ld ON i.id = ld.item_id
                 WHERE s.solicitud IN (?) AND ld.estadoTrasladoLogistica = 'En Transito'`,
                [solicitudesAfectadas]
            );

            // Agrupar por llave (codigo|||descripcion) y sumar cantidadTrasladoSalidaLogistica
            const resumenDB = {};
            solicitudesExistentes.forEach(sol => {
                const llave = `${sol.codigo}|||${sol.descripcion}`;
                if (!resumenDB[llave]) {
                    resumenDB[llave] = {
                        sumaEnviada: 0,
                        ids: [],
                        codigo: sol.codigo,
                        descripcion: sol.descripcion
                    };
                }
                resumenDB[llave].sumaEnviada += parseFloat(sol.cantidadTrasladoSalidaLogistica || '0');
                resumenDB[llave].ids.push(sol.id);
            });

            // Validar cantidades recibidas contra la suma enviada en DB
            for (const [llave, cantidadRecibidaStr] of Object.entries(editadosTraslado)) {
                if (llave === 'observaciones' || llave === 'solicitudesAfectadas' || llave === 'bodegas') continue;

                const cantidadRecibida = parseFloat(cantidadRecibidaStr);
                const infoDB = resumenDB[llave];

                if (!infoDB) continue;

                const sumaEnviada = infoDB.sumaEnviada;

                if (isNaN(cantidadRecibida) || cantidadRecibida < sumaEnviada) {
                    await registrarHistorial({
                        nombreUsuario: usuarioToken.nombre || 'No registrado',
                        cedulaUsuario: usuarioToken.cedula || 'No registrado',
                        rolUsuario: usuarioToken.rol || 'No registrado',
                        nivel: 'log',
                        plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                        app: 'cadenaSuministro',
                        metodo: 'put',
                        endPoint: 'trasladoEnTransito',
                        accion: 'Actualizar traslado en tránsito fallido',
                        detalle: `Cantidad insuficiente para el ítem ${infoDB.codigo}`,
                        datos: { llave, cantidadRecibida, sumaEnviada },
                        tablasIdsAfectados: [],
                        ipAddress: getClientIp(req),
                        userAgent: req.headers['user-agent'] || ''
                    });

                    return sendError(res, 400, `El ítem ${infoDB.codigo} requiere una cantidad mayor o igual a ${sumaEnviada}.`);
                }
            }

            const fechaColombia = getFechaHoraColombia();
            const driveResults = [];

            // Subir archivos a Google Drive
            for (let i = 0; i < archivos.length; i++) {
                const pdfFile = archivos[i];
                try {
                    const pdfExt = path.extname(pdfFile.originalname);
                    const pdfFileName = `Recepcion_Traslado_${editadosTraslado.solicitudesAfectadas}_${editadosTraslado.bodegas}_${i + 1}_${fechaColombia}${pdfExt}`;

                    const fileId = await uploadFileToDrive(
                        pdfFile.buffer,
                        pdfFileName,
                        folderId
                    );

                    driveResults.push({
                        tipo: 'pdf',
                        nombre: pdfFileName,
                        id: fileId.id,
                        url: fileId.url,
                        webViewLink: fileId.webViewLink,
                        indice: i + 1,
                        size: pdfFile.size
                    });
                } catch (error) {
                    console.error(`Error procesando PDF ${i + 1}:`, error);
                }
            }

            const driveResultsJSON = JSON.stringify(driveResults);
            const connection = await dbRailway.getConnection();
            await connection.beginTransaction();

            const idsAActualizar = [];
            for (const [llave, cantidadRecibidaStr] of Object.entries(editadosTraslado)) {
                if (llave === 'observaciones' || llave === 'solicitudesAfectadas' || llave === 'bodegas') continue;
                if (resumenDB[llave]) {
                    idsAActualizar.push(...resumenDB[llave].ids);
                }
            }

            if (idsAActualizar.length === 0) {
                return sendError(res, 400, "No hay ítems válidos para actualizar.");
            }

            try {
                for (const id of idsAActualizar) {
                    const solicitudData = solicitudesExistentes.find((sol) => sol.id === id);
                    await connection.query(
                        `UPDATE cadena_suministro_logistica_despacho 
                         SET 
                            fechaTrasladoEntradaLogistica = ?,
                            cedulaUsuarioTrasladoEntradaLogistica = ?,
                            nombreUsuarioTrasladoEntradaLogistica = ?,
                            cantidadTrasladoEntradaLogistica = ?,
                            pdfsTrasladoEntradaLogistica = ?,
                            observacionTrasladoEntradaLogistica = ?,
                            estadoTrasladoLogistica = 'Realizado'
                         WHERE item_id = ?`,
                        [
                            fechaColombia,
                            usuarioToken.cedula,
                            usuarioToken.nombre,
                            solicitudData.cantidadTrasladoSalidaLogistica,
                            driveResultsJSON,
                            observaciones || null,
                            id
                        ]
                    );

                    // Check if there are other items in the same request that are still in transit or pending transit
                    const [transitCheck] = await connection.query(
                        `SELECT COUNT(*) as count 
                         FROM cadena_suministro_item i
                         JOIN cadena_suministro_logistica_despacho ld ON i.id = ld.item_id
                         WHERE i.solicitud_id = (SELECT solicitud_id FROM cadena_suministro_item WHERE id = ? LIMIT 1)
                           AND ld.estadoTrasladoLogistica IN ('En Transito', 'Pendiente')`,
                        [id]
                    );
                    const pendingCount = transitCheck[0]?.count || 0;

                    if (pendingCount === 0) {
                        const [[reqStatus]] = await connection.query(
                            `SELECT s.estadoSolicitud 
                             FROM cadena_suministro_solicitud s
                             JOIN cadena_suministro_item i ON i.solicitud_id = s.id
                             WHERE i.id = ? LIMIT 1`,
                            [id]
                        );
                        
                            await recalcularYActualizarEstadoSolicitudPorItems(id, connection);
                    }
                }

                await connection.commit();
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }

            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'success',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'trasladoEnTransito',
                accion: 'Actualizar traslado en tránsito exitoso',
                detalle: `Traslado en tránsito actualizado para ${solicitudesAfectadas.length} registro(s)`,
                datos: {
                    idsActualizados: solicitudesAfectadas,
                    totalPDFs: driveResults.length
                },
                tablasIdsAfectados: solicitudesAfectadas.map(id => ({
                    tabla: 'cadena_suministro_solicitud',
                    id: id.toString()
                })),
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendResponse(
                res,
                200,
                "Traslado recibido correctamente",
                `Se ha procesado la recepción para ${solicitudesAfectadas.length} registro(s).`,
                {
                    idsActualizados: solicitudesAfectadas,
                    archivos: driveResults
                }
            );

        } catch (err) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'Error sistema',
                cedulaUsuario: usuarioToken.cedula || 'Error sistema',
                rolUsuario: usuarioToken.rol || 'Error sistema',
                nivel: 'error',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'put',
                endPoint: 'trasladoEnTransito',
                accion: 'Error al actualizar traslado en tránsito',
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

router.post('/roles', validarToken, async (req, res) => {

    const usuarioToken = req.validarToken?.usuario || null;

    try {
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            await registrarHistorial({
                nombreUsuario: usuarioToken?.nombre || 'No registrado',
                cedulaUsuario: usuarioToken?.cedula || 'No registrado',
                rolUsuario: usuarioToken?.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'post',
                endPoint: 'roles',
                accion: 'Consulta registros fallido',
                detalle: 'Los datos de usuario son requeridos.',
                datos: { data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Los datos de usuario son requeridos.");
        }

        if (!data?.cedula) {
            await registrarHistorial({
                nombreUsuario: usuarioToken.nombre || 'No registrado',
                cedulaUsuario: usuarioToken.cedula || 'No registrado',
                rolUsuario: usuarioToken.rol || 'No registrado',
                nivel: 'log',
                plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
                app: 'cadenaSuministro',
                metodo: 'post',
                endPoint: 'roles',
                accion: 'Consulta archivos fallido',
                detalle: 'Se requiere la cedula para la consulta',
                datos: { dataProporcionado: data },
                tablasIdsAfectados: [],
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || ''
            });

            return sendError(res, 400, "Se requiere la cedula para la consulta");
        }

        const [rows] = await dbRailway.query('SELECT * FROM rol_cadena_de_suministro where cedula = ?', [data.cedula]);

        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'No registrado',
            cedulaUsuario: usuarioToken?.cedula || 'No registrado',
            rolUsuario: usuarioToken?.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'post',
            endPoint: 'roles',
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
            `Se obtuvieron ${rows.length} registros de roles en cadena de suministro.`,
            rows
        );
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken?.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken?.cedula || 'Error sistema',
            rolUsuario: usuarioToken?.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'cadenaSuministro',
            metodo: 'post',
            endPoint: 'roles',
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


module.exports = router;
