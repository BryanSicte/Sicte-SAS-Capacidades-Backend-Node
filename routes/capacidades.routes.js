const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');

router.get('/todoBackup', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM capacidades_backup ORDER BY FECHA_REPORTE DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/todo', async (req, res) => {
    try {
        const { role } = req.body;

        // Obtener todos los registros ordenados por fecha_reporte DESC
        const [capacidades] = await dbRailway.query('SELECT * FROM capacidades ORDER BY FECHA_REPORTE DESC');

        let resultadoFiltrado;

        if (role.toLowerCase() === 'admin') {
            resultadoFiltrado = capacidades;
        } else {
            resultadoFiltrado = capacidades.filter(capacidad => capacidad.DIRECTOR === role);
        }

        res.status(200).json(resultadoFiltrado);
    } catch (error) {
        console.error('Error obteniendo capacidades:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

router.get('/movil', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM movil');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/planta', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM planta');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/coordinador', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM coordinador');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/eliminar-filas', async (req, res) => {
    const { cedula } = req.body;

    if (!cedula) {
        return res.status(400).json({ error: 'Se requiere el campo cedula' });
    }

    try {
        const [result] = await dbRailway.query(
            'DELETE FROM capacidades WHERE cedula = ?',
            [cedula]
        );

        res.status(200).json({ message: 'Filas eliminadas correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar filas: ' + error.message });
    }
});

router.post('/ContinuaEnPlantaSinCapacidad', async (req, res) => {
    const { role } = req.body;

    try {
        // Obtener todas las plantas
        const [plantas] = await dbRailway.query('SELECT * FROM planta');

        // Obtener todas las capacidades
        const [capacidades] = await dbRailway.query('SELECT * FROM capacidades');

        // Crear lista de cédulas existentes
        const cedulasExistentes = capacidades.map(capacidad => capacidad.cedula);

        // Filtrar las plantas sin capacidad
        let plantasSinCapacidad = plantas.filter(planta => !cedulasExistentes.includes(planta.nit));

        // Aplicar filtro por rol si no es admin
        if (role.toLowerCase() !== 'admin') {
            const rolNormalizado = role.toUpperCase() === 'JOHANA CARVAJAL' ? 'JOHANNA CARVAJAL' : role;

            plantasSinCapacidad = plantasSinCapacidad.filter(planta => planta.director?.toUpperCase() === rolNormalizado.toUpperCase());
        }

        // Mezclar aleatoriamente (como Collections.shuffle en Java)
        plantasSinCapacidad.sort(() => Math.random() - 0.5);

        res.status(200).json(plantasSinCapacidad);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener datos: ' + error.message });
    }
});

router.post('/agregarPersonal', async (req, res) => {
    const agregarPersonal = req.body;

    try {
        // Dentro del endpoint, justo al empezar:
        const personal = req.body;

        // Obtener planta por NIT (cedula)
        const [[planta]] = await dbRailway.query(
            'SELECT * FROM planta WHERE nit = ?',
            [personal.cedula]
        );

        // Obtener ciudad por nombre
        const [[ciudad]] = await dbRailway.query(
            'SELECT * FROM ciudad WHERE ciudad = ?',
            [planta.ciudad]
        );

        // Obtener coordinador
        const [[coordinador]] = await dbRailway.query(
            'SELECT * FROM coordinador WHERE coordinador = ?',
            [personal.coordinador]
        );

        // Obtener móvil
        const [[movil]] = await dbRailway.query(
            'SELECT * FROM movil WHERE tipo_movil = ?',
            [personal.tipoMovil]
        );

        // Fecha actual como la del método obtenerFechaReporteAgregar()
        const fechaReporte = new Date();
        const fechaReporteStr = fechaReporte.toISOString().slice(0, 19).replace('T', ' ');

        // Construir centroCosto
        const cc = planta.cc;
        const scc = planta.scc;
        let numeroUnificado = '';
        if (cc.length === 2) {
            numeroUnificado = cc + String(scc).padStart(3, '0');
        } else if (cc.length === 1) {
            numeroUnificado = cc + String(scc).padStart(4, '0');
        }

        // Construir objeto response (antes llamado desde la función)
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
            area: coordinador.area,
            subarea: coordinador.subarea,
            tipoMovil: personal.tipoMovil,
            tipoFacturacion: personal.tipoFacturacion,
            movil: movil.movil,
            coordinador: personal.coordinador,
            director: coordinador.director,
            valorEsperado: movil.valor_esperado,
            placa: personal.placa,
            fechaReporte: fechaReporteStr,
            mes: fechaReporte.getMonth() + 1,
            año: fechaReporte.getFullYear(),
            turnos: movil.turnos,
            personas: movil.personas,
            carpeta: personal.carpeta
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
            movil: response.movil,
            coordinador: response.coordinador,
            director: response.director,
            valor_esperado: response.valorEsperado,
            placa: response.placa && response.placa.trim() !== '' ? response.placa : 'null',
            fecha_reporte: response.fechaReporte,
            mes: response.mes.toString(),
            año: response.año.toString(),
            turnos: response.turnos,
            personas: response.personas,
            carpeta: response.carpeta && response.carpeta.trim() !== '' ? response.carpeta : 'null'
        };


        const fields = Object.keys(capacidad).join(', ');
        const values = Object.values(capacidad);
        const placeholders = values.map(() => '?').join(', ');

        const [result] = await dbRailway.query(
            `INSERT INTO capacidades (${fields}) VALUES (${placeholders})`,
            values
        );

        const capacidadGuardada = { id: result.insertId, ...nuevaCapacidad };

        console.log('Guardado:', capacidadGuardada);
        res.status(201).json(capacidadGuardada);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al guardar capacidad: ' + error.message });
    }
});

router.get('/noContinuaEnPlanta', async (req, res) => {
    try {
        const [rows] = await dbRailway.query(`
            SELECT * FROM plantaenlinea WHERE perfil = 'RETIRADO'
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error obteniendo planta retirados:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/agregarPersonalValidarPersonal', async (req, res) => {
    const personal = req.body;

    try {
        // Buscar info relacionada al personal
        const [[planta]] = await dbRailway.query('SELECT * FROM planta WHERE nit = ?', [personal.cedula]);
        const [[ciudad]] = await dbRailway.query('SELECT * FROM ciudad WHERE ciudad = ?', [planta.ciudad]);
        const [[coordinador]] = await dbRailway.query('SELECT * FROM coordinador WHERE coordinador = ?', [personal.coordinador]);
        const [[movil]] = await dbRailway.query('SELECT * FROM movil WHERE tipo_movil = ?', [personal.tipoMovil]);

        // Fecha de reporte
        const fecha = new Date();
        const fechaReporteStr = fecha.toISOString().slice(0, 19).replace('T', ' ');

        // Calcular centroCosto
        const cc = planta.cc;
        const scc = planta.scc;
        let centroCosto = '';
        if (cc.length === 2) {
            centroCosto = cc + String(scc).padStart(3, '0');
        } else if (cc.length === 1) {
            centroCosto = cc + String(scc).padStart(4, '0');
        }

        const nuevaCapacidad = {
            cedula: personal.cedula,
            nombre_completo: planta.nombre,
            cargo: planta.cargo,
            centro_costo: centroCosto,
            nomina: planta.perfil,
            regional: ciudad.regional,
            ciudad_trabajo: planta.ciudad,
            red: coordinador.red,
            cliente: coordinador.cliente,
            area: coordinador.area,
            sub_area: coordinador.subarea && coordinador.subarea !== '' ? coordinador.subarea : 'null',
            tipo_de_movil: personal.tipoMovil,
            tipo_facturacion: personal.tipoFacturacion,
            movil: movil.movil,
            coordinador: personal.coordinador,
            director: coordinador.director,
            valor_esperado: movil.valor_esperado,
            placa: personal.placa && personal.placa !== '' ? personal.placa : 'null',
            fecha_reporte: fechaReporteStr,
            mes: fecha.getMonth() + 1,
            año: fecha.getFullYear(),
            turnos: movil.turnos,
            personas: movil.personas,
            carpeta: personal.carpeta && personal.carpeta !== '' ? personal.carpeta : 'null'
        };

        // Guardar en la base de datos
        const fields = Object.keys(nuevaCapacidad).join(', ');
        const values = Object.values(nuevaCapacidad);
        const placeholders = values.map(() => '?').join(', ');

        const [result] = await dbRailway.query(
            `INSERT INTO capacidades (${fields}) VALUES (${placeholders})`,
            values
        );

        const capacidadGuardada = { id: result.insertId, ...nuevaCapacidad };
        console.log(capacidadGuardada);
        res.status(201).json(capacidadGuardada);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;
