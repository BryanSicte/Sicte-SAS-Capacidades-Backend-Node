const mysql = require('mysql2/promise');
require('dotenv').config();

const railway = mysql.createPool({
  host: process.env.DBF1_HOST,
  port: process.env.DBF1_PORT,
  user: process.env.DBF1_USER,
  password: process.env.DBF1_PASSWORD,
  database: process.env.DBF1_DATABASE,
  waitForConnections: true,
  connectionLimit: 3,
  maxIdle: 3,
  idleTimeout: 30000,
  queueLimit: 0
});

module.exports = railway;
