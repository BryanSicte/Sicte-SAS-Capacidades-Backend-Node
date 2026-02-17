const getFechaHoraColombia = () => {
    const fecha = new Date();
    const options = {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    
    const formatter = new Intl.DateTimeFormat('es-CO', options);
    const parts = formatter.formatToParts(fecha);
    
    const fechaParts = {};
    parts.forEach(part => {
        fechaParts[part.type] = part.value;
    });
    
    return `${fechaParts.year}-${fechaParts.month}-${fechaParts.day} ${fechaParts.hour}:${fechaParts.minute}:${fechaParts.second}`;
};

module.exports = { getFechaHoraColombia };