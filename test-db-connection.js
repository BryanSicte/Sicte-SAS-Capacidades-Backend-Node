const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB1_HOST,
      port: process.env.DB1_PORT,
      user: process.env.DB1_USER,
      password: process.env.DB1_PASSWORD,
      database: process.env.DB1_DATABASE,
    });

    console.log('✅ ¡Conexión a la base de datos exitosa!');
    await connection.end();
  } catch (error) {
    console.error('❌ Error al conectar a la base de datos:');
    console.error(error);
  }
})();
