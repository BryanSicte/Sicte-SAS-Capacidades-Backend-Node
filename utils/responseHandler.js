function sendResponse(res, status, message1, message2 = null, data = null) {
    const success = status >= 200 && status < 300;

    return res.status(status).json({
        success,
        messages: {
            message1,
            message2
        },
        data
    });
}

function sendError(res, status, message2 = null, error = null) {
    return res.status(status).json({
        success: false,
        messages: {
            message1: 'Ocurrió un error',
            message2,
            message3: error ? (error.message || error) : null
        },
        data: null
    });
}

module.exports = { sendResponse, sendError };
