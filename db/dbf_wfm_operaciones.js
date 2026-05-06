const mysql = require('mysql2/promise');
require('dotenv').config();

const railway = mysql.createPool({
  host: process.env.DBF4_HOST,
  port: process.env.DBF4_PORT,
  user: process.env.DBF4_USER,
  password: process.env.DBF4_PASSWORD,
  database: process.env.DBF4_DATABASE
});

module.exports = railway;
