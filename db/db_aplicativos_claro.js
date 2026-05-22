const mysql = require('mysql2/promise');
require('dotenv').config();

const aplicativos_claro = mysql.createPool({
  host: process.env.DB2_HOST,
  port: process.env.DB2_PORT,
  user: process.env.DB2_USER,
  password: process.env.DB2_PASSWORD,
  database: process.env.DB2_DATABASE,
  waitForConnections: true,
  connectionLimit: 3,
  maxIdle: 3,
  idleTimeout: 30000,
  queueLimit: 0
});

module.exports = aplicativos_claro;
