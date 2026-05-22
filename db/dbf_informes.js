const mysql = require('mysql2/promise');
require('dotenv').config();

const railway = mysql.createPool({
  host: process.env.DBF3_HOST,
  port: process.env.DBF3_PORT,
  user: process.env.DBF3_USER,
  password: process.env.DBF3_PASSWORD,
  database: process.env.DBF3_DATABASE,
  waitForConnections: true,
  connectionLimit: 3,
  maxIdle: 3,
  idleTimeout: 30000,
  queueLimit: 0
});

module.exports = railway;
