const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB1_HOST,
      port: parseInt(process.env.DB1_PORT, 10),
      user: process.env.DB1_USER,
      password: process.env.DB1_PASSWORD,
      database: process.env.DB1_DATABASE,
    });

    console.log('✅ Conexión exitosa');
    const [rows] = await connection.execute('SHOW TABLES;');
    console.log('📋 Tablas:', rows);
    await connection.end();
  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
  }
}

testConnection();
