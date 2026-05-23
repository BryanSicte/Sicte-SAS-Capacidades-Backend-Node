const dbRailway = require('../db/db_railway');
const excepciones = require('../config/excepcionesHabilitados');
const bcrypt = require('bcrypt');

/**
 * Sincroniza el estado de habilitación de todos los usuarios.
 */
async function syncAllUsers() {
    let query = `
        UPDATE user u
        SET u.habilitado = CASE 
    `;
    const params = [];
    if (Array.isArray(excepciones) && excepciones.length > 0) {
        query += `            WHEN u.cedula IN (?) THEN 1\n`;
        params.push(excepciones);
    }
    query += `            WHEN EXISTS (
                SELECT 1 FROM plantaenlinea p 
                WHERE p.nit = u.cedula AND p.perfil <> 'RETIRADO'
            ) THEN 1 
            ELSE 0 
        END
    `;
    const [result] = await dbRailway.query(query, params);
    return result;
}

/**
 * Sincroniza el estado de habilitación de un usuario específico por su cédula.
 * @param {string} cedula 
 */
async function syncSingleUser(cedula) {
    if (!cedula) return null;
    
    let query = `
        UPDATE user u
        SET u.habilitado = CASE 
    `;
    const params = [];
    
    if (Array.isArray(excepciones) && excepciones.includes(cedula)) {
        query += `            WHEN u.cedula = ? THEN 1\n`;
        params.push(cedula);
    } else {
        query += `            WHEN EXISTS (
                SELECT 1 FROM plantaenlinea p 
                WHERE p.nit = ? AND p.perfil <> 'RETIRADO'
            ) THEN 1 
            ELSE 0 
        `;
        params.push(cedula);
    }
    
    query += `        END
        WHERE u.cedula = ?
    `;
    params.push(cedula);
    
    const [result] = await dbRailway.query(query, params);
    return result;
}
module.exports = {
    syncAllUsers,
    syncSingleUser
};
