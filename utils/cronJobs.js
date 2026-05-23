const cron = require('node-cron');
const { syncAllUsers } = require('../services/usuarioSyncService');

/**
 * Inicializa las tareas programadas (cron jobs) de la aplicación.
 */
function initCronJobs() {
    // Tarea programada: Todos los días a las 6:00 AM (Hora de Colombia)
    // Expresión: 0 (minuto) 6 (hora) * (día del mes) * (mes) * (día de la semana)
    cron.schedule('0 6 * * *', async () => {
        console.log('[CRON] Iniciando sincronización diaria de usuarios habilitados (6:00 AM Colombia)...');
        try {
            const result = await syncAllUsers();
            console.log(`[CRON] Sincronización diaria completada. Filas afectadas: ${result.affectedRows}`);
        } catch (error) {
            console.error('[CRON] Error al ejecutar la sincronización de usuarios:', error);
        }
    }, {
        scheduled: true,
        timezone: "America/Bogota"
    });

    console.log('Planificador de tareas (Cron) inicializado correctamente. Sincronización diaria programada para las 6:00 AM Colombia.');
}

module.exports = {
    initCronJobs
};
