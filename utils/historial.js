const dbRailway = require('../db/db_railway');

async function registrarHistorial({
    nombreUsuario,
    cedulaUsuario,
    rolUsuario,
    nivel,
    plataforma,
    app,
    metodo,
    endPoint,
    accion,
    detalle,
    datos = null,
    tablasIdsAfectados = [],
    ipAddress,
    userAgent
}) {
    try {
        await dbRailway.query(
            `INSERT INTO historial (
                nombreUsuario, cedulaUsuario, rolUsuario, nivel, plataforma,
                app, metodo, endPoint, accion, detalle, datos,
                tablasIdsAfectados, ipAddress, userAgent, fechaUTC
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                nombreUsuario,
                cedulaUsuario,
                rolUsuario,
                nivel,
                plataforma,
                app,
                metodo,
                endPoint,
                accion,
                detalle,
                datos ? JSON.stringify(datos) : null,
                JSON.stringify(tablasIdsAfectados),
                ipAddress,
                userAgent
            ]
        );
    } catch (error) {
        console.error('Error registrando historial.', error);
    }
}

function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
        req.headers['x-real-ip'] ||
        req.connection.remoteAddress ||
        req.ip ||
        '0.0.0.0';
}

function determinarPlataforma(userAgent) {
    if (!userAgent) return 'desconocida';
    
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('mobile')) return 'movil';
    if (ua.includes('android')) return 'android';
    if (ua.includes('ios') || ua.includes('iphone')) return 'ios';
    if (ua.includes('postman')) return 'postman';
    if (ua.includes('insomnia')) return 'insomnia';
    if (ua.includes('curl')) return 'curl';
    
    return 'web';
}

module.exports = { registrarHistorial, getClientIp, determinarPlataforma };