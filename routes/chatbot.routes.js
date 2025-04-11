const express = require('express');
const router = express.Router();
const dbRailway = require('../db/db_railway');

router.get('/registros', async (req, res) => {
    try {
        const [rows] = await dbRailway.query('SELECT * FROM registros_chatbot');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/actualizarDatos', async (req, res) => {
    const {
        id,
        cargo,
        fechaHora,
        estadoFinal,
        observaciones,
        asistencia,
        seleccion,
        examenesMedicos,
        contratacion,
        estadoContratacion
    } = req.body;

    try {
        const query = `
            UPDATE registros_chatbot 
            SET 
                cargo = ?, 
                fechaHora = ?, 
                estadoFinal = ?, 
                observaciones = ?, 
                asistencia = ?, 
                seleccion = ?, 
                examenesMedicos = ?, 
                contratacion = ?, 
                estadoContratacion = ?
            WHERE id = ?
        `;

        await dbRailway.query(query, [
            cargo,
            fechaHora,
            estadoFinal,
            observaciones,
            asistencia,
            seleccion,
            examenesMedicos,
            contratacion,
            estadoContratacion,
            id
        ]);

        res.status(200).json({ message: 'Datos actualizados correctamente' });
    } catch (error) {
        console.error('❌ Error al actualizar:', error);
        res.status(500).json({ message: 'Error al actualizar el estado' });
    }
});

router.post('/registrarDatos', async (req, res) => {
    const {
        registro,
        fuente,
        stage,
        nombreApellido,
        celular,
        ciudad,
        cargo,
        fechaHora,
        fechaHoraInicial,
        estadoFinal
    } = req.body;

    try {
        const query = `
            INSERT INTO registros_chatbot 
            (registro, fuente, stage, nombreApellido, celular, ciudad, cargo, fechaHora, fechaHoraInicial, estadoFinal)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await dbRailway.query(query, [
            registro,
            fuente,
            stage,
            nombreApellido,
            celular,
            ciudad,
            cargo,
            fechaHora,
            fechaHoraInicial,
            estadoFinal
        ]);

        res.status(200).json({ message: 'Datos agregados correctamente' });
    } catch (error) {
        console.error('❌ Error al registrar:', error);
        res.status(500).json({ message: 'Error al agregar los datos' });
    }
});


module.exports = router;
