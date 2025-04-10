const mysql = require('mysql2/promise');
require('dotenv').config();

const dbGestionHumana = mysql.createPool({
    host: process.env.DB2_HOST,
    port: process.env.DB1_PORT,
    user: process.env.DB2_USER,
    password: process.env.DB2_PASSWORD,
    database: process.env.DB2_DATABASE
});

module.exports = dbGestionHumana;
