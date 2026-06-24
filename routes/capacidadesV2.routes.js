const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
};

// 1. Obtención de capacidades (todo) - Sin filtrar por rol por ahora
router.get('/todo', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;
    try {
        const [rows] = await dbRailway.query('SELECT * FROM capacidades ORDER BY FECHA_REPORTE DESC');

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacidades',
            metodo: 'get',
            endPoint: 'todo',
            accion: 'Consulta de capacidades exitosa',
            detalle: `Se consultó ${rows.length} capacidades`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, 'Consulta exitosa', 'Se obtuvieron las capacidades registradas.', rows);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacidades',
            metodo: 'get',
            endPoint: 'todo',
            accion: 'Error al obtener capacidades',
            detalle: err.message,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, 'Error al obtener capacidades', err);
    }
});

// 2. Obtención de capacidades de backup
router.get('/todoBackup', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM capacidades_backup ORDER BY FECHA_REPORTE DESC');
        return sendResponse(res, 200, 'Consulta exitosa', 'Se obtuvieron las capacidades del backup.', rows);
    } catch (err) {
        return sendError(res, 500, 'Error al obtener backup de capacidades', err);
    }
});

// 3. Obtención de móviles
router.get('/movil', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM movil');
        return sendResponse(res, 200, 'Consulta exitosa', 'Se obtuvieron los móviles.', rows);
    } catch (err) {
        return sendError(res, 500, 'Error al obtener móviles', err);
    }
});

// 4. Obtención de planta (general)
router.get('/planta', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM planta');
        return sendResponse(res, 200, 'Consulta exitosa', 'Se obtuvo la planta.', rows);
    } catch (err) {
        return sendError(res, 500, 'Error al obtener plantas', err);
    }
});

// 5. Obtención de plantas sin capacidad
router.get('/plantaSinCapacidad', validarToken, async (req, res) => {
    try {
        const [plantas] = await dbRailway.query('SELECT * FROM planta');
        const [capacidades] = await dbRailway.query('SELECT CEDULA FROM capacidades');
        const cedulasExistentes = capacidades.map(cap => cap.CEDULA);

        const plantasSinCapacidad = plantas.filter(planta => !cedulasExistentes.includes(planta.nit));

        return sendResponse(res, 200, 'Consulta exitosa', 'Se obtuvieron las plantas sin capacidad.', plantasSinCapacidad);
    } catch (err) {
        return sendError(res, 500, 'Error al obtener plantas sin capacidad', err);
    }
});

// 6. Obtención de coordinadores
router.get('/coordinador', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM coordinador');
        return sendResponse(res, 200, 'Consulta exitosa', 'Se obtuvieron los coordinadores.', rows);
    } catch (err) {
        return sendError(res, 500, 'Error al obtener coordinadores', err);
    }
});

// 7. Eliminación de capacidad por id o cédula
router.delete('/eliminar-filas', validarToken, async (req, res) => {
    const { id, cedula } = req.body;
    const usuarioToken = req.validarToken.usuario;

    if (!id && !cedula) {
        return sendError(res, 400, 'Se requiere el id o la cédula para eliminar');
    }

    try {
        let result;
        let identificadorUsado = '';
        if (id) {
            [result] = await dbRailway.query(
                'DELETE FROM capacidades WHERE id = ?',
                [id]
            );
            identificadorUsado = `ID ${id}`;
        } else {
            [result] = await dbRailway.query(
                'DELETE FROM capacidades WHERE cedula = ?',
                [cedula]
            );
            identificadorUsado = `cédula ${cedula}`;
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacidades',
            metodo: 'delete',
            endPoint: 'eliminar-filas',
            accion: 'Eliminación de capacidad exitosa',
            detalle: `Se eliminó la capacidad asociada a ${identificadorUsado}`,
            datos: { id, cedula },
            tablasIdsAfectados: id ? [{ tabla: 'capacidades', id: id.toString() }] : [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, 'Eliminación exitosa', `Capacidad eliminada para ${identificadorUsado}`);
    } catch (error) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacidades',
            metodo: 'delete',
            endPoint: 'eliminar-filas',
            accion: 'Error al eliminar capacidad',
            detalle: error.message,
            datos: { id, cedula },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, 'Error al eliminar capacidad', error);
    }
});

let dbQueue = Promise.resolve();

// 8. Crear / Agregar personal en capacidades
router.post('/agregarPersonal', validarToken, (req, res) => {
    dbQueue = dbQueue.then(async () => {
        try {
            await handleAgregarPersonalInternal(req, res);
        } catch (err) {
            console.error('Error in serialized database queue:', err);
            if (!res.headersSent) {
                return sendError(res, 500, 'Error interno del servidor en cola de base de datos', err);
            }
        }
    });
});

async function handleAgregarPersonalInternal(req, res) {
    const personal = req.body;
    const usuarioToken = req.validarToken.usuario;

    try {
        // 1. Obtener planta por NIT (cedula) - valida que esté en planta
        const [[planta]] = await dbRailway.query(
            'SELECT * FROM planta WHERE nit = ?',
            [personal.cedula]
        );

        if (!planta) {
            return sendError(res, 404, `No se encontró el registro de planta para la cédula ${personal.cedula}`);
        }

        // 2. Evaluar que la cédula no esté ya ingresada en "capacidades"
        const [[existente]] = await dbRailway.query(
            'SELECT id FROM capacidades WHERE CEDULA = ?',
            [personal.cedula]
        );
        if (existente) {
            return sendError(res, 400, `El colaborador ${planta.nombre} con cédula ${personal.cedula} ya cuenta con una capacidad registrada.`);
        }

        // Obtener ciudad por nombre
        const [[ciudad]] = await dbRailway.query(
            'SELECT * FROM ciudad WHERE ciudad = ?',
            [planta.ciudad]
        );

        if (!ciudad) {
            return sendError(res, 404, `No se encontró la ciudad ${planta.ciudad} en la base de datos`);
        }

        // Obtener coordinador
        const [[coordinador]] = await dbRailway.query(
            'SELECT * FROM coordinador WHERE coordinador = ?',
            [personal.coordinador]
        );

        if (!coordinador) {
            return sendError(res, 404, `No se encontró el coordinador ${personal.coordinador}`);
        }

        let segmento;
        if (personal.tipoFacturacion === "ADMON") {
            segmento = 'NA';
            personal.placa = 'NA';
            personal.lider_turno = 'NA';
        } else {
            segmento = personal.segmento;
        }

        // Obtener móvil del catálogo
        const [[movil]] = await dbRailway.query(
            'SELECT * FROM movil WHERE tipo_movil = ? and segmento = ?',
            [personal.tipoMovil, segmento]
        );

        if (!movil) {
            return sendError(res, 404, `No se encontró el móvil tipo ${personal.tipoMovil} para el segmento ${segmento}`);
        }

        // 3. Evaluar placa (PLACA)
        let consecutivoMovil = '';
        if (personal.tipoFacturacion !== "ADMON" && personal.placa && personal.placa.trim() !== '' && personal.placa !== 'null' && personal.placa.toUpperCase() !== 'NA') {
            const [mismosPlaca] = await dbRailway.query(
                'SELECT * FROM capacidades WHERE PLACA = ?',
                [personal.placa]
            );

            const turnosLimit = parseInt(movil.turnos, 10) || 0;

            if (personal.lider_turno === 'SI') {
                const existingLeaders = mismosPlaca.filter(cap => (cap.LIDER_TURNO || cap.lider_turno || '').toUpperCase() === 'SI').length;
                if (existingLeaders >= turnosLimit) {
                    return sendError(res, 400, `El vehículo con placa ${personal.placa} ya cuenta con el límite máximo de líderes permitidos para este tipo de móvil (${turnosLimit} líder(es) asignado(s)).`);
                }
            }

            if (mismosPlaca.length > 0) {
                // Evaluar que coincidan los otros datos que se envían con la placa que está en base
                const primera = mismosPlaca[0];
                const matchCoordinador = (primera.COORDINADOR || '').toLowerCase() === (personal.coordinador || '').toLowerCase();
                const matchSupervisor = (primera.SUPERVISOR || '').toLowerCase() === (personal.supervisor || '').toLowerCase();
                const matchTipoMovil = (primera.TIPO_DE_MOVIL || '').toLowerCase() === (personal.tipoMovil || '').toLowerCase();
                const matchTipoFacturacion = (primera.TIPO_FACTURACION || '').toLowerCase() === (personal.tipoFacturacion || '').toLowerCase();
                const matchSegmento = (primera.SEGMENTO || '').toLowerCase() === (personal.segmento || '').toLowerCase();
                const matchArea = (primera.AREA || '').toLowerCase() === (personal.area || '').toLowerCase();

                if (!matchCoordinador || !matchSupervisor || !matchTipoMovil || !matchTipoFacturacion || !matchSegmento || !matchArea) {
                    return sendError(res, 400, `El vehículo con placa ${personal.placa} ya está registrado con otros datos (Coordinador, Supervisor, Tipo Móvil, etc.). Deben coincidir.`);
                }

                // Evaluar que el tipo de móvil aún pueda admitir más personas (turnos * personas)
                const turnosLimit = parseInt(movil.turnos, 10) || 0;
                const personasLimit = parseInt(movil.personas, 10) || 0;
                const maxAllowed = turnosLimit * personasLimit;

                if (mismosPlaca.length >= maxAllowed) {
                    return sendError(res, 400, `El vehículo con placa ${personal.placa} ya alcanzó el límite máximo de ${maxAllowed} personas permitidas.`);
                }

                // Reutilizar el consecutivo existente
                consecutivoMovil = primera.consecutivo_movil || primera.MOVIL;
            } else {
                // Asignar un consecutivo único que se incrementa con cada placa nueva
                const [[maxRow]] = await dbRailway.query(
                    'SELECT MAX(CAST(COALESCE(consecutivo_movil, MOVIL) AS UNSIGNED)) AS max_movil FROM capacidades'
                );
                const maxConsecutive = maxRow && maxRow.max_movil ? parseInt(maxRow.max_movil, 10) : 0;
                consecutivoMovil = (maxConsecutive + 1).toString();
            }
        } else {
            consecutivoMovil = 'null';
        }

        // 4. Valor Esperado: si es líder se le asigna el valor_esperado, de lo contrario cero ("0")
        let valorEsperado = '0';
        if (personal.lider_turno === 'SI') {
            valorEsperado = movil.valor_esperado;
        }

        // Obtener la última fecha de reporte en capacidades_backup para avanzar un mes
        const [[latestBackupRow]] = await dbRailway.query(
            "SELECT DATE_FORMAT(MAX(FECHA_REPORTE), '%Y-%m-%d %H:%i:%s') as max_fecha FROM capacidades_backup"
        );

        let fechaReporteStr = '';
        let mesReporte = 1;
        let anioReporte = 1970;
        let hasCustomDate = false;

        if (latestBackupRow && latestBackupRow.max_fecha) {
            const dateStr = String(latestBackupRow.max_fecha);
            const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (match) {
                let year = parseInt(match[1], 10);
                let month = parseInt(match[2], 10);
                let day = parseInt(match[3], 10);

                month++;
                if (month > 12) {
                    month = 1;
                    year++;
                }

                const mmStr = String(month).padStart(2, '0');
                const ddStr = String(day).padStart(2, '0');
                fechaReporteStr = `${year}-${mmStr}-${ddStr} 00:00:00`;
                mesReporte = month;
                anioReporte = year;
                hasCustomDate = true;
            }
        }

        if (!hasCustomDate) {
            const fechaReporte = new Date();
            fechaReporteStr = fechaReporte.toISOString().slice(0, 19).replace('T', ' ');
            mesReporte = fechaReporte.getMonth() + 1;
            anioReporte = fechaReporte.getFullYear();
        }

        // Construir centroCosto
        const cc = planta.cc || '';
        const scc = planta.scc || '';
        let numeroUnificado = '';
        if (cc.length === 2) {
            numeroUnificado = cc + String(scc).padStart(3, '0');
        } else if (cc.length === 1) {
            numeroUnificado = cc + String(scc).padStart(4, '0');
        } else {
            numeroUnificado = cc + String(scc);
        }

        // Construir objeto response
        const response = {
            cedula: personal.cedula,
            nombre: planta.nombre,
            cargo: planta.cargo,
            centroCosto: numeroUnificado,
            nomina: planta.perfil,
            regional: ciudad.regional,
            ciudad: planta.ciudad,
            red: coordinador.red,
            cliente: coordinador.cliente,
            area: personal.area,
            subarea: coordinador.subarea,
            tipoMovil: personal.tipoMovil,
            tipoFacturacion: personal.tipoFacturacion,
            movil: movil.movil, // Guardar la columna 'movil' de la tabla 'movil'
            coordinador: personal.coordinador,
            director: coordinador.director,
            valorEsperado: valorEsperado,
            placa: personal.placa,
            fechaReporte: fechaReporteStr,
            mes: mesReporte,
            anio: anioReporte,
            turnos: movil.turnos,
            personas: movil.personas,
            carpeta: personal.carpeta,
            supervisor: personal.supervisor,
            segmento: personal.segmento,
            operacion: movil.operacion,
            grupo: movil.grupo,
            consecutivo_movil: consecutivoMovil, // Guardar el consecutivo generado
        };

        const nuevaCapacidad = {
            cedula: response.cedula,
            nombre_completo: response.nombre,
            cargo: response.cargo,
            centro_costo: response.centroCosto,
            nomina: response.nomina,
            regional: response.regional,
            ciudad_trabajo: response.ciudad,
            red: response.red,
            cliente: response.cliente,
            area: response.area,
            sub_area: response.subarea && response.subarea.trim() !== '' ? response.subarea : 'null',
            tipo_de_movil: response.tipoMovil,
            tipo_facturacion: response.tipoFacturacion,
            movil: response.movil, // Columna 'movil' de la tabla 'movil' (p.ej. '0,5', '1', etc.)
            coordinador: response.coordinador,
            director: response.director,
            valor_esperado: response.valorEsperado,
            placa: response.placa && response.placa.trim() !== '' ? response.placa : 'null',
            fecha_reporte: response.fechaReporte,
            mes: response.mes.toString(),
            anio: response.anio.toString(),
            turnos: response.turnos,
            personas: response.personas,
            carpeta: response.carpeta && response.carpeta.trim() !== '' ? response.carpeta : 'null',
            supervisor: response.supervisor && response.supervisor.trim() !== '' ? response.supervisor : 'null',
            segmento: response.segmento,
            operacion: response.operacion,
            grupo: response.grupo,
            lider_turno: personal.lider_turno || 'NO',
            consecutivo_movil: response.consecutivo_movil, // Nueva columna consecutivo movil
        };

        const fields = Object.keys(nuevaCapacidad).join(', ');
        const values = Object.values(nuevaCapacidad);
        const placeholders = values.map(() => '?').join(', ');

        const [result] = await dbRailway.query(
            `INSERT INTO capacidades (${fields}) VALUES (${placeholders})`,
            values
        );

        const insertId = result.insertId;
        const capacidadGuardada = { id: insertId, ...nuevaCapacidad };

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacidades',
            metodo: 'post',
            endPoint: 'agregarPersonal',
            accion: 'Creación de capacidad exitosa',
            detalle: `Se registró la capacidad para la cédula ${personal.cedula}`,
            datos: nuevaCapacidad,
            tablasIdsAfectados: [{
                tabla: 'capacidades',
                id: insertId.toString()
            }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 201, 'Capacidad creada', 'Se registró el personal en capacidades exitosamente.', capacidadGuardada);
    } catch (error) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'capacidades',
            metodo: 'post',
            endPoint: 'agregarPersonal',
            accion: 'Error al agregar capacidad',
            detalle: error.message,
            datos: { personal },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, 'Error al agregar capacidad', error);
    }
}

// 9. Continúa en planta
router.get('/continuaEnPlanta', validarToken, async (req, res) => {
    try {
        const [plantas] = await dbRailway.query('SELECT * FROM planta');
        const [capacidades] = await dbRailway.query('SELECT * FROM capacidades');
        const [capacidadBackups] = await dbRailway.query('SELECT * FROM capacidades_backup ORDER BY fecha_reporte DESC');

        const fechas = capacidadBackups.map(r => new Date(r.FECHA_REPORTE));
        const ultimaFecha = fechas.length > 0 ? new Date(Math.max(...fechas)) : null;

        if (!ultimaFecha) {
            return sendResponse(res, 200, 'Consulta exitosa', 'No hay registros.', []);
        }

        const ultimoMes = ultimaFecha.getMonth();
        const ultimoAnio = ultimaFecha.getFullYear();

        const primerDiaUltimoMes = new Date(ultimoAnio, ultimoMes, 1);
        const primerDiaSiguienteMes = new Date(ultimoAnio, ultimoMes + 1, 1);

        const capacidadesUltimoMes = capacidadBackups.filter(capacidad => {
            const fecha = new Date(capacidad.FECHA_REPORTE);
            return fecha >= primerDiaUltimoMes && fecha < primerDiaSiguienteMes;
        });

        const capacidadPorCedula = new Map();
        capacidadesUltimoMes.forEach(capacidad => {
            capacidadPorCedula.set(capacidad.CEDULA, capacidad);
        });

        const cedulasExistentes = capacidades.map(cap => cap.CEDULA);

        let registrosCoincidentes = [];

        plantas.forEach(planta => {
            const capacidad = capacidadPorCedula.get(planta.nit);
            if (capacidad && !cedulasExistentes.includes(capacidad.CEDULA)) {
                registrosCoincidentes.push(capacidad);
            }
        });

        shuffleArray(registrosCoincidentes);

        return sendResponse(res, 200, 'Consulta exitosa', 'Se obtuvieron las capacidades que continúan en planta.', registrosCoincidentes);
    } catch (err) {
        return sendError(res, 500, 'Error al obtener continua en planta', err);
    }
});

// 10. No continúa en planta (retirados)
router.get('/noContinuaEnPlanta', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query(`
            SELECT * FROM plantaenlinea WHERE perfil = 'RETIRADO'
        `);
        return sendResponse(res, 200, 'Consulta exitosa', 'Se obtuvieron los retirados de planta.', rows);
    } catch (err) {
        return sendError(res, 500, 'Error al obtener retirados', err);
    }
});

// 11. Obtener fechas únicas registradas en capacidades_backup
router.get('/fechasBackup', validarToken, async (req, res) => {
    try {
        const [rows] = await dbRailway.query(
            'SELECT DISTINCT FECHA_REPORTE FROM capacidades_backup ORDER BY FECHA_REPORTE DESC'
        );
        const fechas = rows.map(r => r.FECHA_REPORTE).filter(Boolean);
        return sendResponse(res, 200, 'Consulta exitosa', 'Se obtuvieron las fechas de backup disponibles.', fechas);
    } catch (err) {
        return sendError(res, 500, 'Error al obtener fechas de backup', err);
    }
});

// 12. Obtener registros históricos filtrados por la fecha seleccionada
router.get('/reporteBackup', validarToken, async (req, res) => {
    const { fecha } = req.query;
    try {
        let query = '';
        let params = [];
        if (fecha) {
            query = 'SELECT * FROM capacidades_backup WHERE FECHA_REPORTE = ? ORDER BY NOMBRE_COMPLETO ASC';
            params = [fecha];
        } else {
            const [[latestRow]] = await dbRailway.query(
                'SELECT MAX(FECHA_REPORTE) as latest FROM capacidades_backup'
            );
            const latestDate = latestRow ? latestRow.latest : null;
            if (!latestDate) {
                return sendResponse(res, 200, 'Consulta exitosa', 'No hay registros de backup.', { fecha: null, data: [] });
            }
            query = 'SELECT * FROM capacidades_backup WHERE FECHA_REPORTE = ? ORDER BY NOMBRE_COMPLETO ASC';
            params = [latestDate];
        }

        const [rows] = await dbRailway.query(query, params);
        const fechaReportada = fecha || (rows.length > 0 ? rows[0].FECHA_REPORTE : null);

        return sendResponse(res, 200, 'Consulta exitosa', 'Se obtuvo el reporte de capacidades de backup.', {
            fecha: fechaReportada,
            data: rows
        });
    } catch (err) {
        return sendError(res, 500, 'Error al obtener reporte de backup', err);
    }
});

module.exports = router;

