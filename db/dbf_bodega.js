const mysql = require('mysql2/promise');
require('dotenv').config();

const railway = mysql.createPool({
  host: process.env.DBF2_HOST,
  port: process.env.DBF2_PORT,
  user: process.env.DBF2_USER,
  password: process.env.DBF2_PASSWORD,
  database: process.env.DBF2_DATABASE
});

module.exports = railway;
