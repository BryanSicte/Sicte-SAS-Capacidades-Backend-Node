const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');
const validarToken = require('../middlewares/validarToken');
const { sendResponse, sendError } = require('../utils/responseHandler');
const { registrarHistorial, getClientIp, determinarPlataforma } = require('../utils/historial');

// Asynchronous DB initialization
async function initDatabase() {
    try {
        console.log("Inicializando base de datos para Control de Avance...");

        // 1. Proyectos
        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS control_avance_proyectos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre_proyecto VARCHAR(255) DEFAULT NULL,
                ot VARCHAR(100) NOT NULL UNIQUE,
                fecha_arranque DATE DEFAULT NULL,
                fecha_cierre_proyectada DATE DEFAULT NULL,
                estado VARCHAR(50) DEFAULT 'Creado',
                fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                usuario_creacion VARCHAR(255) NOT NULL,
                fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
                cedula_usuario_creacion VARCHAR(50) DEFAULT NULL,
                contrato VARCHAR(255) DEFAULT NULL,
                tipo_proyecto VARCHAR(100) DEFAULT NULL,
                subproyecto VARCHAR(255) DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Check and alter control_avance_proyectos columns
        const [projectCols] = await dbRailway.query('SHOW COLUMNS FROM control_avance_proyectos');
        const projectColNames = projectCols.map(col => col.Field);

        await dbRailway.query('ALTER TABLE control_avance_proyectos MODIFY nombre_proyecto VARCHAR(255) NULL');
        await dbRailway.query('ALTER TABLE control_avance_proyectos MODIFY fecha_arranque DATE NULL');
        await dbRailway.query('ALTER TABLE control_avance_proyectos MODIFY fecha_cierre_proyectada DATE NULL');

        if (!projectColNames.includes('fecha_registro')) {
            await dbRailway.query('ALTER TABLE control_avance_proyectos ADD COLUMN fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP');
        }
        if (!projectColNames.includes('cedula_usuario_creacion')) {
            await dbRailway.query('ALTER TABLE control_avance_proyectos ADD COLUMN cedula_usuario_creacion VARCHAR(50) DEFAULT NULL');
        }
        if (!projectColNames.includes('contrato')) {
            await dbRailway.query('ALTER TABLE control_avance_proyectos ADD COLUMN contrato VARCHAR(255) DEFAULT NULL');
        }
        if (!projectColNames.includes('tipo_proyecto')) {
            await dbRailway.query('ALTER TABLE control_avance_proyectos ADD COLUMN tipo_proyecto VARCHAR(100) DEFAULT NULL');
        }
        if (!projectColNames.includes('subproyecto')) {
            await dbRailway.query('ALTER TABLE control_avance_proyectos ADD COLUMN subproyecto VARCHAR(255) DEFAULT NULL');
        }

        // 2. Items del proyecto
        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS control_avance_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                proyecto_id INT NOT NULL,
                codigo VARCHAR(100) NOT NULL,
                descripcion TEXT NOT NULL,
                unidad_medida VARCHAR(50) NOT NULL,
                cantidad_presupuestada DECIMAL(12, 2) NOT NULL,
                cantidad_ejecutada DECIMAL(12, 2) DEFAULT 0.00,
                valor_unidad DECIMAL(12, 2) DEFAULT 0.00,
                valor_total DECIMAL(12, 2) DEFAULT 0.00,
                estado VARCHAR(50) DEFAULT 'Creado',
                categoria VARCHAR(100) DEFAULT NULL,
                subcategoria VARCHAR(100) DEFAULT NULL,
                FOREIGN KEY (proyecto_id) REFERENCES control_avance_proyectos(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Check and alter control_avance_items columns
        const [itemCols] = await dbRailway.query('SHOW COLUMNS FROM control_avance_items');
        const itemColNames = itemCols.map(col => col.Field);

        if (!itemColNames.includes('valor_unidad')) {
            await dbRailway.query('ALTER TABLE control_avance_items ADD COLUMN valor_unidad DECIMAL(12, 2) DEFAULT 0.00');
        }
        if (!itemColNames.includes('valor_total')) {
            await dbRailway.query('ALTER TABLE control_avance_items ADD COLUMN valor_total DECIMAL(12, 2) DEFAULT 0.00');
        }
        if (!itemColNames.includes('estado')) {
            await dbRailway.query('ALTER TABLE control_avance_items ADD COLUMN estado VARCHAR(50) DEFAULT "Creado"');
        }
        if (!itemColNames.includes('categoria')) {
            await dbRailway.query('ALTER TABLE control_avance_items ADD COLUMN categoria VARCHAR(100) DEFAULT NULL');
        }
        if (!itemColNames.includes('subcategoria')) {
            await dbRailway.query('ALTER TABLE control_avance_items ADD COLUMN subcategoria VARCHAR(100) DEFAULT NULL');
        }
        if (!itemColNames.includes('fecha_inicio')) {
            await dbRailway.query('ALTER TABLE control_avance_items ADD COLUMN fecha_inicio DATE DEFAULT NULL');
        }
        if (!itemColNames.includes('fecha_fin')) {
            await dbRailway.query('ALTER TABLE control_avance_items ADD COLUMN fecha_fin DATE DEFAULT NULL');
        }

        // 3. Histórico de estados
        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS control_avance_historico_estados (
                id INT AUTO_INCREMENT PRIMARY KEY,
                proyecto_id INT NOT NULL,
                item_id INT DEFAULT NULL,
                estado_anterior VARCHAR(50),
                estado_nuevo VARCHAR(50) NOT NULL,
                observacion TEXT,
                fecha_cambio DATETIME DEFAULT CURRENT_TIMESTAMP,
                usuario_cambio VARCHAR(255) NOT NULL,
                FOREIGN KEY (proyecto_id) REFERENCES control_avance_proyectos(id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES control_avance_items(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        const [histCols] = await dbRailway.query('SHOW COLUMNS FROM control_avance_historico_estados');
        const histColNames = histCols.map(col => col.Field);
        if (!histColNames.includes('item_id')) {
            await dbRailway.query('ALTER TABLE control_avance_historico_estados ADD COLUMN item_id INT DEFAULT NULL');
            await dbRailway.query('ALTER TABLE control_avance_historico_estados ADD CONSTRAINT fk_historico_item FOREIGN KEY (item_id) REFERENCES control_avance_items(id) ON DELETE CASCADE');
            console.log("Columna 'item_id' y constraint FK agregadas a control_avance_historico_estados.");
        }

        // 4. Avances de los técnicos
        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS control_avance_avances (
                id INT AUTO_INCREMENT PRIMARY KEY,
                proyecto_id INT NOT NULL,
                item_id INT NOT NULL,
                nombre_tecnico VARCHAR(255) NOT NULL,
                cedula_tecnico VARCHAR(50) NOT NULL,
                cantidad_avance DECIMAL(12, 2) NOT NULL,
                observacion TEXT,
                fecha_avance DATETIME DEFAULT CURRENT_TIMESTAMP,
                usuario_registro VARCHAR(255) NOT NULL,
                cedula_usuario_registro VARCHAR(50) DEFAULT NULL,
                FOREIGN KEY (item_id) REFERENCES control_avance_items(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Check and alter control_avance_avances columns
        const [avanceCols] = await dbRailway.query('SHOW COLUMNS FROM control_avance_avances');
        const avanceColNames = avanceCols.map(col => col.Field);

        if (!avanceColNames.includes('cedula_usuario_registro')) {
            await dbRailway.query('ALTER TABLE control_avance_avances ADD COLUMN cedula_usuario_registro VARCHAR(50) DEFAULT NULL');
        }

        // 6. Tabla Auxiliar para Contratos y Tipo Proyecto
        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS tabla_aux_control_avance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                contrato VARCHAR(255) NOT NULL,
                tipoProyecto VARCHAR(100) DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Seed data if empty
        const [existingAux] = await dbRailway.query('SELECT COUNT(*) as count FROM tabla_aux_control_avance');
        if (existingAux[0].count === 0) {
            await dbRailway.query(`
                INSERT INTO tabla_aux_control_avance (contrato, tipoProyecto) VALUES
                ('JA10123037 / JA10123045', 'B2B'),
                ('JA10123400', 'B2C'),
                ('JA10176840', 'B2Y'),
                ('JA10176906', NULL),
                ('JA10182234', NULL)
            `);
            console.log("Datos de prueba sembrados en tabla_aux_control_avance.");
        }

        // 8. Categorías de Control de Avance
        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS control_avance_categorias (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL UNIQUE,
                orden INT DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 9. Subcategorías de Control de Avance
        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS control_avance_subcategorias (
                id INT AUTO_INCREMENT PRIMARY KEY,
                categoria_id INT NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                FOREIGN KEY (categoria_id) REFERENCES control_avance_categorias(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 10. Materiales de bodega asignados a los ítems del proyecto
        await dbRailway.query(`
            CREATE TABLE IF NOT EXISTS control_avance_item_materiales (
                id INT AUTO_INCREMENT PRIMARY KEY,
                item_id INT NOT NULL,
                material_codigo VARCHAR(100) NOT NULL,
                descripcion_material TEXT DEFAULT NULL,
                unidad_medida VARCHAR(50) DEFAULT NULL,
                cantidad_presupuestada DECIMAL(12, 2) NOT NULL,
                cantidad_entregada DECIMAL(12, 2) DEFAULT 0.00,
                FOREIGN KEY (item_id) REFERENCES control_avance_items(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log("Base de datos para Control de Avance inicializada correctamente.");
    } catch (err) {
        console.error("Error inicializando base de datos para Control de Avance:", err);
    }
}

// Run DB init
initDatabase();

// --- ENDPOINTS ---

// 1. Obtener lista de proyectos con progreso calculado y filtros
router.get('/proyectos', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;
    try {
        const { estado, busqueda } = req.query;
        let query = `
            SELECT p.id, p.nombre_proyecto, p.ot, p.fecha_arranque, p.fecha_cierre_proyectada, p.estado,
                DATE_FORMAT(p.fecha_creacion, '%Y-%m-%d %H:%i:%s') as fecha_creacion,
                p.usuario_creacion,
                DATE_FORMAT(p.fecha_registro, '%Y-%m-%d %H:%i:%s') as fecha_registro,
                p.cedula_usuario_creacion, p.contrato, p.tipo_proyecto, p.subproyecto,
                COALESCE(
                    (SELECT SUM(cantidad_ejecutada) / NULLIF(SUM(cantidad_presupuestada), 0) * 100 
                     FROM control_avance_items 
                     WHERE proyecto_id = p.id), 
                    0
                ) as progreso
            FROM control_avance_proyectos p
        `;
        const params = [];
        const whereClauses = [];

        if (estado && estado !== 'Todos') {
            whereClauses.push('p.estado = ?');
            params.push(estado);
        }

        if (busqueda && busqueda.trim() !== '') {
            whereClauses.push('(p.nombre_proyecto LIKE ? OR p.ot LIKE ?)');
            const searchPattern = `%${busqueda}%`;
            params.push(searchPattern, searchPattern);
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        query += ' ORDER BY p.fecha_creacion DESC';

        const [rows] = await dbRailway.query(query, params);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'get',
            endPoint: 'proyectos',
            accion: 'Consulta lista de proyectos exitosa',
            detalle: `Se consultaron ${rows.length} proyectos${estado && estado !== 'Todos' ? ` con estado '${estado}'` : ''}`,
            datos: { estado, busqueda },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Proyectos obtenidos", "Se listaron los proyectos correctamente.", rows);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'get',
            endPoint: 'proyectos',
            accion: 'Error al obtener lista de proyectos',
            detalle: 'Error interno del servidor',
            datos: { error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener proyectos", err);
    }
});

// 2. Obtener un proyecto en específico con items, historial y avances
router.get('/proyectos/:id', validarToken, async (req, res) => {
    const { id } = req.params;
    const usuarioToken = req.validarToken.usuario;
    try {
        // Detalle del proyecto
        const [projects] = await dbRailway.query(`
            SELECT p.id, p.nombre_proyecto, p.ot, p.fecha_arranque, p.fecha_cierre_proyectada, p.estado,
                DATE_FORMAT(p.fecha_creacion, '%Y-%m-%d %H:%i:%s') as fecha_creacion,
                p.usuario_creacion,
                DATE_FORMAT(p.fecha_registro, '%Y-%m-%d %H:%i:%s') as fecha_registro,
                p.cedula_usuario_creacion, p.contrato, p.tipo_proyecto, p.subproyecto,
                COALESCE(
                    (SELECT SUM(cantidad_ejecutada) / NULLIF(SUM(cantidad_presupuestada), 0) * 100 
                     FROM control_avance_items 
                     WHERE proyecto_id = p.id), 
                    0
                ) as progreso
            FROM control_avance_proyectos p
            WHERE p.id = ?
        `, [id]);

        if (projects.length === 0) {
            return sendError(res, 404, "Proyecto no encontrado.");
        }

        const proyecto = projects[0];

        // Items del proyecto
        const [items] = await dbRailway.query('SELECT * FROM control_avance_items WHERE proyecto_id = ?', [id]);

        for (const item of items) {
            const [materiales] = await dbRailway.query('SELECT * FROM control_avance_item_materiales WHERE item_id = ?', [item.id]);
            item.materiales = materiales;
        }

        // Historial de estados (proyecto y sus items)
        const [historial] = await dbRailway.query(`
            SELECT h.id, h.proyecto_id, h.item_id, h.estado_anterior, h.estado_nuevo, h.observacion,
                   DATE_FORMAT(h.fecha_cambio, '%Y-%m-%d %H:%i:%s') as fecha_cambio,
                   h.usuario_cambio, i.codigo as item_codigo, i.descripcion as item_descripcion
            FROM control_avance_historico_estados h
            LEFT JOIN control_avance_items i ON h.item_id = i.id
            WHERE h.proyecto_id = ?
            ORDER BY h.fecha_cambio DESC
        `, [id]);

        // Avances de obra
        const [avances] = await dbRailway.query(`
            SELECT a.id, a.proyecto_id, a.item_id, a.nombre_tecnico, a.cedula_tecnico, a.cantidad_avance, a.observacion,
                   DATE_FORMAT(a.fecha_avance, '%Y-%m-%d %H:%i:%s') as fecha_avance,
                   a.usuario_registro, a.cedula_usuario_registro, i.codigo, i.descripcion, i.unidad_medida
            FROM control_avance_avances a
            JOIN control_avance_items i ON a.item_id = i.id
            WHERE a.proyecto_id = ?
            ORDER BY a.fecha_avance DESC
        `, [id]);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'get',
            endPoint: 'proyectos/:id',
            accion: 'Consulta detalle de proyecto exitosa',
            detalle: `Se consultó el detalle del proyecto '${proyecto.nombre_proyecto}' (OT: ${proyecto.ot})`,
            datos: { proyectoId: id },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Detalle del proyecto obtenido", "Se cargó la información del proyecto.", {
            proyecto,
            items,
            historial,
            avances
        });
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'get',
            endPoint: 'proyectos/:id',
            accion: 'Error al obtener detalle de proyecto',
            detalle: 'Error interno del servidor',
            datos: { proyectoId: id, error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener detalles del proyecto", err);
    }
});

// 3. Crear proyecto con sus items presupuestados
router.post('/crearProyecto', validarToken, async (req, res) => {
    const {
        nombre_proyecto,
        ot,
        fecha_arranque,
        fecha_cierre_proyectada,
        contrato,
        tipo_proyecto,
        subproyecto,
        fecha_registro,
        items
    } = req.body;
    const usuarioToken = req.validarToken.usuario;

    if (!ot || !contrato || !tipo_proyecto || !items || !Array.isArray(items) || items.length === 0) {
        return sendError(res, 400, "Faltan campos obligatorios (contrato, OP/OT, tipo de proyecto) o el listado de ítems está vacío.");
    }

    const connection = await dbRailway.getConnection();
    try {
        await connection.beginTransaction();

        // Verificar si la OT ya existe
        const [existing] = await connection.query('SELECT id FROM control_avance_proyectos WHERE ot = ?', [ot]);
        if (existing.length > 0) {
            await connection.rollback();
            return sendError(res, 400, "La OT ya se encuentra registrada en otro proyecto.");
        }

        // Insertar proyecto
        let fechaRegistroUTC = null;
        if (fecha_registro) {
            let dateVal = new Date(fecha_registro.replace('T', ' ').substring(0, 19) + " -05:00");
            if (!isNaN(dateVal.getTime())) {
                fechaRegistroUTC = dateVal.toISOString().replace('T', ' ').substring(0, 19);
            }
        }
        if (!fechaRegistroUTC) {
            fechaRegistroUTC = new Date().toISOString().replace('T', ' ').substring(0, 19);
        }

        const [projectResult] = await connection.query(`
            INSERT INTO control_avance_proyectos (
                nombre_proyecto, ot, fecha_arranque, fecha_cierre_proyectada, estado, 
                usuario_creacion, cedula_usuario_creacion, contrato, tipo_proyecto, subproyecto, fecha_registro
            ) VALUES (?, ?, ?, ?, 'Creado', ?, ?, ?, ?, ?, ?)
        `, [
            nombre_proyecto || contrato,
            ot,
            fecha_arranque || null,
            fecha_cierre_proyectada || null,
            usuarioToken.nombre,
            usuarioToken.cedula,
            contrato,
            tipo_proyecto,
            subproyecto || null,
            fechaRegistroUTC
        ]);

        const proyectoId = projectResult.insertId;

        // Insertar items
        for (const item of items) {
            if (!item.codigo || !item.descripcion || !item.unidad_medida || item.cantidad_presupuestada === undefined) {
                throw new Error("Ítem inválido en la lista de materiales/mano de obra.");
            }
            const valorUnidad = parseFloat(item.valor_unidad) || 0;
            const valorTotal = parseFloat(item.valor_total) || (parseFloat(item.cantidad_presupuestada) * valorUnidad);
            const itemEstado = item.estado || 'Creado';
            const itemCategoria = item.categoria || null;
            const itemSubcategoria = item.subcategoria || null;

            const [itemResult] = await connection.query(`
                INSERT INTO control_avance_items (
                    proyecto_id, codigo, descripcion, unidad_medida, 
                    cantidad_presupuestada, valor_unidad, valor_total, estado,
                    categoria, subcategoria
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                proyectoId,
                item.codigo,
                item.descripcion,
                item.unidad_medida,
                item.cantidad_presupuestada,
                valorUnidad,
                valorTotal,
                itemEstado,
                itemCategoria,
                itemSubcategoria
            ]);

            const itemId = itemResult.insertId;

            if (item.materiales && Array.isArray(item.materiales)) {
                for (const mat of item.materiales) {
                    if (!mat.material_codigo || mat.cantidad_presupuestada === undefined) {
                        throw new Error("Material de bodega inválido en el ítem del proyecto.");
                    }
                    await connection.query(`
                        INSERT INTO control_avance_item_materiales (
                            item_id, material_codigo, descripcion_material, unidad_medida, cantidad_presupuestada
                        ) VALUES (?, ?, ?, ?, ?)
                    `, [
                        itemId,
                        mat.material_codigo,
                        mat.descripcion_material || mat.descripcion || null,
                        mat.unidad_medida || mat.unimed || null,
                        parseFloat(mat.cantidad_presupuestada) || 0
                    ]);
                }
            }
        }

        // Registrar estado inicial en el histórico
        await connection.query(`
            INSERT INTO control_avance_historico_estados (proyecto_id, estado_anterior, estado_nuevo, observacion, usuario_cambio)
            VALUES (?, NULL, 'Creado', 'Registro inicial del proyecto', ?)
        `, [proyectoId, usuarioToken.nombre]);

        await connection.commit();

        // Registrar en historial general
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre,
            cedulaUsuario: usuarioToken.cedula,
            rolUsuario: usuarioToken.rol,
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'post',
            endPoint: 'crearProyecto',
            accion: 'Creación de proyecto exitosa',
            detalle: `Se creó el proyecto con OT ${ot} y contrato ${contrato}`,
            datos: { contrato, ot },
            tablasIdsAfectados: [{ tabla: 'control_avance_proyectos', id: proyectoId.toString() }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 201, "Proyecto creado", "El proyecto ha sido registrado con sus respectivos ítems.", { proyectoId });

    } catch (err) {
        await connection.rollback();
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'post',
            endPoint: 'crearProyecto',
            accion: 'Error al crear proyecto',
            detalle: 'Error interno del servidor',
            datos: { ot, contrato, error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error interno al crear el proyecto", err);
    } finally {
        connection.release();
    }
});

// 4. Cambiar de estado
router.put('/proyectos/:id/estado', validarToken, async (req, res) => {
    const { id } = req.params;
    const { estado_nuevo, observacion } = req.body;
    const usuarioToken = req.validarToken.usuario;

    if (!estado_nuevo || !observacion || observacion.trim() === '') {
        return sendError(res, 400, "El nuevo estado y la observación son campos obligatorios.");
    }

    const connection = await dbRailway.getConnection();
    try {
        await connection.beginTransaction();

        // Obtener estado anterior
        const [projects] = await connection.query('SELECT estado, nombre_proyecto FROM control_avance_proyectos WHERE id = ?', [id]);
        if (projects.length === 0) {
            await connection.rollback();
            return sendError(res, 404, "Proyecto no encontrado.");
        }

        const proyecto = projects[0];
        const estadoAnterior = proyecto.estado;

        // Actualizar estado del proyecto
        await connection.query('UPDATE control_avance_proyectos SET estado = ? WHERE id = ?', [estado_nuevo, id]);

        // Insertar en histórico
        await connection.query(`
            INSERT INTO control_avance_historico_estados (proyecto_id, estado_anterior, estado_nuevo, observacion, usuario_cambio)
            VALUES (?, ?, ?, ?, ?)
        `, [id, estadoAnterior, estado_nuevo, observacion, usuarioToken.nombre]);

        await connection.commit();

        // Registrar en historial general
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre,
            cedulaUsuario: usuarioToken.cedula,
            rolUsuario: usuarioToken.rol,
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'put',
            endPoint: 'proyectos/:id/estado',
            accion: 'Cambio de estado de proyecto exitoso',
            detalle: `Proyecto ${proyecto.nombre_proyecto} cambió de '${estadoAnterior}' a '${estado_nuevo}'`,
            datos: { id, estadoAnterior, estado_nuevo, observacion },
            tablasIdsAfectados: [{ tabla: 'control_avance_proyectos', id: id.toString() }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Estado actualizado", `El estado del proyecto cambió a '${estado_nuevo}' con éxito.`);

    } catch (err) {
        await connection.rollback();
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'put',
            endPoint: 'proyectos/:id/estado',
            accion: 'Error al cambiar estado del proyecto',
            detalle: 'Error interno del servidor',
            datos: { proyectoId: id, estado_nuevo, error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al cambiar de estado", err);
    } finally {
        connection.release();
    }
});

// Helper para calcular y actualizar automáticamente el estado del proyecto según las categorías y el estado de sus ítems
async function calcularYActualizarEstadoProyecto(proyectoId, usuarioCambio) {
    try {
        // 1. Obtener todos los ítems del proyecto
        const [items] = await dbRailway.query('SELECT * FROM control_avance_items WHERE proyecto_id = ?', [proyectoId]);
        if (items.length === 0) return;

        // 2. Obtener todas las subcategorías distintas del proyecto
        const subcategoriasUnicas = [...new Set(items.map(i => i.subcategoria).filter(Boolean))];
        if (subcategoriasUnicas.length === 0) return;

        // Verificar si todas las subcategorías tienen fecha_inicio y fecha_fin asignadas
        const todasTienenFechas = subcategoriasUnicas.every(subName => {
            const itemsSub = items.filter(i => i.subcategoria === subName);
            return itemsSub.every(i => i.fecha_inicio && i.fecha_fin);
        });

        if (!todasTienenFechas) {
            // No todas las subcategorías tienen fechas, por ende no se auto-calcula el estado
            return;
        }

        // 3. Obtener categorías ordenadas por orden ASC, nombre ASC
        const [categorias] = await dbRailway.query('SELECT * FROM control_avance_categorias ORDER BY COALESCE(orden, 999999) ASC, nombre ASC');

        // 4. Calcular el estado del proyecto
        let nuevoEstadoProyecto = null;

        for (const cat of categorias) {
            // Filtrar ítems de este proyecto que corresponden a esta categoría
            const itemsDeCat = items.filter(i => i.categoria && i.categoria.trim().toLowerCase() === cat.nombre.trim().toLowerCase());
            if (itemsDeCat.length > 0) {
                // Verificar si todos los ítems están en estado 'Realizado'
                const todosRealizados = itemsDeCat.every(i => i.estado === 'Realizado');
                if (!todosRealizados) {
                    // Esta categoría tiene algún ítem no 'Realizado', por lo tanto el estado se queda aquí
                    nuevoEstadoProyecto = cat.nombre;
                    break;
                }
            }
        }

        // Si se recorrieron todas las categorías y todos sus ítems están en 'Realizado'
        if (nuevoEstadoProyecto === null) {
            nuevoEstadoProyecto = "Finalizado / Cerrado";
        }

        // 5. Obtener el estado actual del proyecto
        const [proyectos] = await dbRailway.query('SELECT estado FROM control_avance_proyectos WHERE id = ?', [proyectoId]);
        if (proyectos.length === 0) return;

        const estadoAnteriorProyecto = proyectos[0].estado;

        // 6. Si hay cambio, actualizar y guardar histórico
        if (estadoAnteriorProyecto !== nuevoEstadoProyecto) {
            await dbRailway.query('UPDATE control_avance_proyectos SET estado = ? WHERE id = ?', [nuevoEstadoProyecto, proyectoId]);
            
            await dbRailway.query(`
                INSERT INTO control_avance_historico_estados (proyecto_id, estado_anterior, estado_nuevo, observacion, usuario_cambio)
                VALUES (?, ?, ?, ?, ?)
            `, [
                proyectoId,
                estadoAnteriorProyecto,
                nuevoEstadoProyecto,
                'Cambio automático basado en el estado de los ítems',
                usuarioCambio || 'Sistema'
            ]);
            console.log(`Proyecto ${proyectoId} actualizado automáticamente de ${estadoAnteriorProyecto} a ${nuevoEstadoProyecto}`);
        }
    } catch (error) {
        console.error("Error al calcular y actualizar el estado del proyecto:", error);
    }
}

// 4b. Asignar fechas de inicio y fin a una subcategoría
router.put('/proyectos/:id/subcategorias/fechas', validarToken, async (req, res) => {
    const { id } = req.params;
    const { subcategoria, fecha_inicio, fecha_fin } = req.body;
    const usuarioToken = req.validarToken.usuario;

    if (!subcategoria) {
        return sendError(res, 400, "El nombre de la subcategoría es obligatorio.");
    }

    try {
        // Formatear fechas para MySQL (si están vacías o null, pasamos null)
        const fInicio = fecha_inicio ? fecha_inicio.split('T')[0] : null;
        const fFin = fecha_fin ? fecha_fin.split('T')[0] : null;

        await dbRailway.query(`
            UPDATE control_avance_items 
            SET fecha_inicio = ?, fecha_fin = ? 
            WHERE proyecto_id = ? AND subcategoria = ?
        `, [fInicio, fFin, id, subcategoria]);

        // Intentar calcular y actualizar automáticamente el estado del proyecto
        await calcularYActualizarEstadoProyecto(id, usuarioToken.nombre);

        // Registrar en logs del sistema
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'put',
            endPoint: 'proyectos/:id/subcategorias/fechas',
            accion: 'Actualizar fechas de subcategoría',
            detalle: `Se actualizaron las fechas de la subcategoría '${subcategoria}' a [${fInicio} - ${fFin}]`,
            datos: { proyectoId: id, subcategoria, fInicio, fFin },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Fechas actualizadas", "Las fechas de la subcategoría han sido actualizadas con éxito.");
    } catch (err) {
        console.error("Error actualizando fechas de subcategoría:", err);
        return sendError(res, 500, "Error al actualizar fechas de subcategoría", err);
    }
});

// 4c. Cambiar estado de un ítem individual manualmente (con observación obligatoria)
router.put('/items/:id/estado', validarToken, async (req, res) => {
    const { id } = req.params;
    const { estado_nuevo, observacion } = req.body;
    const usuarioToken = req.validarToken.usuario;

    if (!estado_nuevo || !observacion || observacion.trim() === '') {
        return sendError(res, 400, "El nuevo estado del ítem y la observación son campos obligatorios.");
    }

    const connection = await dbRailway.getConnection();
    try {
        await connection.beginTransaction();

        // Obtener el ítem actual y su proyecto_id
        const [items] = await connection.query('SELECT * FROM control_avance_items WHERE id = ?', [id]);
        if (items.length === 0) {
            await connection.rollback();
            return sendError(res, 404, "Ítem no encontrado.");
        }

        const item = items[0];
        const estadoAnterior = item.estado || 'Creado';

        // Actualizar el estado del ítem y su cantidad ejecutada según corresponda
        let queryUpdate = 'UPDATE control_avance_items SET estado = ? WHERE id = ?';
        if (estado_nuevo === 'Realizado') {
            queryUpdate = 'UPDATE control_avance_items SET estado = ?, cantidad_ejecutada = cantidad_presupuestada WHERE id = ?';
        } else if (estadoAnterior === 'Realizado') {
            queryUpdate = 'UPDATE control_avance_items SET estado = ?, cantidad_ejecutada = 0.00 WHERE id = ?';
        }
        await connection.query(queryUpdate, [estado_nuevo, id]);

        // Registrar en histórico vinculando al ítem
        await connection.query(`
            INSERT INTO control_avance_historico_estados (proyecto_id, item_id, estado_anterior, estado_nuevo, observacion, usuario_cambio)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [item.proyecto_id, id, estadoAnterior, estado_nuevo, observacion, usuarioToken.nombre]);

        await connection.commit();

        // Intentar calcular y actualizar automáticamente el estado del proyecto
        await calcularYActualizarEstadoProyecto(item.proyecto_id, usuarioToken.nombre);

        // Registrar en logs del sistema
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'put',
            endPoint: 'items/:id/estado',
            accion: 'Cambiar estado de ítem presupuestado',
            detalle: `Se cambió el estado del ítem '${item.codigo}' de '${estadoAnterior}' a '${estado_nuevo}'`,
            datos: { itemId: id, proyectoId: item.proyecto_id, estadoAnterior, estado_nuevo, observacion },
            tablasIdsAfectados: [id],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Estado de ítem actualizado", `El estado del ítem cambió a '${estado_nuevo}' con éxito.`);
    } catch (err) {
        await connection.rollback();
        console.error("Error al cambiar estado de ítem:", err);
        return sendError(res, 500, "Error al cambiar estado de ítem", err);
    } finally {
        connection.release();
    }
});

// 5. Registrar avance de obra (solo cuando está en ejecución)
router.post('/proyectos/:id/avances', validarToken, async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const usuarioToken = req.validarToken.usuario;

    // Support both an array of advances and a single advance object
    const advances = Array.isArray(body) ? body : [body];

    if (advances.length === 0) {
        return sendError(res, 400, "Debe enviar al menos un avance para registrar.");
    }

    // Validate all advances in the array first
    for (const av of advances) {
        const { item_id, nombre_tecnico, cedula_tecnico, cantidad_avance } = av;
        if (!item_id || !nombre_tecnico || !cedula_tecnico || cantidad_avance === undefined) {
            return sendError(res, 400, "Faltan campos obligatorios para registrar alguno de los avances.");
        }

        const avanceNum = parseFloat(cantidad_avance);
        if (isNaN(avanceNum) || avanceNum <= 0) {
            return sendError(res, 400, "La cantidad del avance debe ser un número positivo.");
        }
    }

    const connection = await dbRailway.getConnection();
    try {
        await connection.beginTransaction();

        // Verificar que el proyecto esté "En ejecucion"
        const [projects] = await connection.query('SELECT estado FROM control_avance_proyectos WHERE id = ?', [id]);
        if (projects.length === 0) {
            await connection.rollback();
            return sendError(res, 404, "Proyecto no encontrado.");
        }

        if (projects[0].estado !== 'En ejecucion') {
            await connection.rollback();
            return sendError(res, 400, "Solo se pueden registrar avances en proyectos que se encuentren en estado 'En ejecucion'.");
        }

        for (const av of advances) {
            const { item_id, nombre_tecnico, cedula_tecnico, cantidad_avance, observacion, fecha_registro } = av;
            const avanceNum = parseFloat(cantidad_avance);

            // Verificar el item y calcular el límite
            const [items] = await connection.query('SELECT * FROM control_avance_items WHERE id = ? AND proyecto_id = ?', [item_id, id]);
            if (items.length === 0) {
                await connection.rollback();
                return sendError(res, 404, `El ítem con ID ${item_id} no pertenece a este proyecto.`);
            }

            const item = items[0];
            const nuevaCantidadEjecutada = parseFloat(item.cantidad_ejecutada) + avanceNum;

            // Actualizar la cantidad ejecutada acumulada del item
            await connection.query('UPDATE control_avance_items SET cantidad_ejecutada = ? WHERE id = ?', [nuevaCantidadEjecutada, item_id]);

            // Insertar en la tabla de avances
            let fechaAvanceUTC = null;
            if (fecha_registro) {
                let dateVal = new Date(fecha_registro.replace('T', ' ').substring(0, 19) + " -05:00");
                if (!isNaN(dateVal.getTime())) {
                    fechaAvanceUTC = dateVal.toISOString().replace('T', ' ').substring(0, 19);
                }
            }
            if (!fechaAvanceUTC) {
                fechaAvanceUTC = new Date().toISOString().replace('T', ' ').substring(0, 19);
            }

            await connection.query(`
                INSERT INTO control_avance_avances (
                    proyecto_id, item_id, nombre_tecnico, cedula_tecnico, cantidad_avance, 
                    observacion, usuario_registro, cedula_usuario_registro, fecha_avance
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id,
                item_id,
                nombre_tecnico,
                cedula_tecnico,
                avanceNum,
                observacion || '',
                usuarioToken.nombre,
                usuarioToken.cedula,
                fechaAvanceUTC
            ]);
        }

        await connection.commit();

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'post',
            endPoint: 'proyectos/:id/avances',
            accion: 'Registro de avances de obra exitoso',
            detalle: `Se registraron ${advances.length} avance(s) para el proyecto ID ${id}`,
            datos: { proyectoId: id, cantidadAvances: advances.length },
            tablasIdsAfectados: [{ tabla: 'control_avance_avances', id: id.toString() }],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 201, "Avances registrados", "Los avances se han guardado y sumado al acumulado de los ítems correspondientes.");
    } catch (err) {
        await connection.rollback();
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'post',
            endPoint: 'proyectos/:id/avances',
            accion: 'Error al registrar avances de obra',
            detalle: 'Error interno del servidor',
            datos: { proyectoId: id, error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al registrar avances", err);
    } finally {
        connection.release();
    }
});

// 6. Obtener lista de técnicos activos desde plantaenlinea
router.get('/tecnicos', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;
    try {
        const [rows] = await dbRailway.query(`
            SELECT DISTINCT nit as cedula, nombre 
            FROM plantaenlinea 
            WHERE perfil != 'RETIRADO' AND nombre IS NOT NULL AND nombre != ''
            ORDER BY nombre ASC
        `);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'get',
            endPoint: 'tecnicos',
            accion: 'Consulta lista de técnicos exitosa',
            detalle: `Se consultaron ${rows.length} técnicos activos`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Técnicos obtenidos", "Se listó el personal activo.", rows);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'get',
            endPoint: 'tecnicos',
            accion: 'Error al obtener lista de técnicos',
            detalle: 'Error interno del servidor',
            datos: { error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener técnicos", err);
    }
});

// 7. Obtener lista de contratos y tipo de proyectos desde tabla_aux_control_avance
router.get('/auxiliar', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;
    try {
        const [rows] = await dbRailway.query('SELECT * FROM tabla_aux_control_avance ORDER BY id ASC');

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'get',
            endPoint: 'auxiliar',
            accion: 'Consulta datos auxiliares exitosa',
            detalle: `Se consultaron ${rows.length} registros auxiliares (contratos/tipos de proyecto)`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Datos auxiliares obtenidos", "Se listaron los datos auxiliares correctamente.", rows);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'get',
            endPoint: 'auxiliar',
            accion: 'Error al obtener datos auxiliares',
            detalle: 'Error interno del servidor',
            datos: { error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener datos auxiliares", err);
    }
});

// 8. Obtener lista de baremos
router.get('/baremos', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;
    try {
        const [rows] = await dbRailway.query(`
            SELECT codigo, actividad, um, valor_unitario_sin_aiu 
            FROM baremos 
            ORDER BY codigo ASC
        `);

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'get',
            endPoint: 'baremos',
            accion: 'Consulta lista de baremos exitosa',
            detalle: `Se consultaron ${rows.length} baremos`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Baremos obtenidos", "Se listaron los baremos correctamente.", rows);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'get',
            endPoint: 'baremos',
            accion: 'Error al obtener baremos',
            detalle: 'Error interno del servidor',
            datos: { error: err.message },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener baremos", err);
    }
});

// 9. Obtener lista de categorías y sus subcategorías
router.get('/categorias', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;
    try {
        const [categorias] = await dbRailway.query('SELECT * FROM control_avance_categorias ORDER BY COALESCE(orden, 999999) ASC, nombre ASC');
        for (const cat of categorias) {
            const [subcategorias] = await dbRailway.query('SELECT * FROM control_avance_subcategorias WHERE categoria_id = ? ORDER BY nombre ASC', [cat.id]);
            cat.subcategorias = subcategorias;
        }

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'get',
            endPoint: 'categorias',
            accion: 'Consulta lista de categorías exitosa',
            detalle: `Se consultaron ${categorias.length} categorías`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Categorías obtenidas", "Se listaron las categorías correctamente.", categorias);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'get',
            endPoint: 'categorias',
            accion: 'Error al obtener categorías',
            detalle: 'Error interno del servidor',
            datos: { error: err.message },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener categorías", err);
    }
});

// 10. Obtener materiales de bodega filtrados por Bodega = 'KGPROD_ENEL_X'
router.get('/materialesBodega', validarToken, async (req, res) => {
    const usuarioToken = req.validarToken.usuario;
    try {
        const [rows] = await dbRailway.query(
            'SELECT codigo, descrip, unimed FROM bodega_kgprod WHERE Bodega = "KGPROD_ENEL_X" ORDER BY descrip ASC'
        );

        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'No registrado',
            cedulaUsuario: usuarioToken.cedula || 'No registrado',
            rolUsuario: usuarioToken.rol || 'No registrado',
            nivel: 'success',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'get',
            endPoint: 'materialesBodega',
            accion: 'Consulta materiales bodega exitosa',
            detalle: `Se consultaron ${rows.length} materiales de la bodega KGPROD_ENEL_X`,
            datos: {},
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });

        return sendResponse(res, 200, "Materiales obtenidos", "Se listaron los materiales de bodega correctamente.", rows);
    } catch (err) {
        await registrarHistorial({
            nombreUsuario: usuarioToken.nombre || 'Error sistema',
            cedulaUsuario: usuarioToken.cedula || 'Error sistema',
            rolUsuario: usuarioToken.rol || 'Error sistema',
            nivel: 'error',
            plataforma: determinarPlataforma(req.headers['user-agent'] || ''),
            app: 'controlAvance',
            metodo: 'get',
            endPoint: 'materialesBodega',
            accion: 'Error al obtener materiales de bodega',
            detalle: 'Error interno del servidor',
            datos: { error: err.message },
            tablasIdsAfectados: [],
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || ''
        });
        return sendError(res, 500, "Error al obtener materiales de bodega", err);
    }
});

module.exports = router;
