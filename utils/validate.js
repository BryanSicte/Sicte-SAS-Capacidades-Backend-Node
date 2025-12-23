function validateRequiredFields (data, fields, res) {
    for (const [field, message] of Object.entries(fields)) {
        if (!data[field]) {
            sendError(res, 400, "Campo obligatorio", null, { [field]: message });
            return false;
        }
    }
    return true;
};

module.exports = { validateRequiredFields };
