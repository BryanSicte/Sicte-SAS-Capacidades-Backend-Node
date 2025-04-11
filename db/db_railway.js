const mysql = require('mysql2/promise');
require('dotenv').config();

const railway = mysql.createPool({
  host: process.env.DB1_HOST,
  port: process.env.DB1_PORT,
  user: process.env.DB1_USER,
  password: process.env.DB1_PASSWORD,
  database: process.env.DB1_DATABASE
});

module.exports = railway;
