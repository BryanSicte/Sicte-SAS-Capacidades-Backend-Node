const express = require('express');
require('dotenv').config();

const app = express();
const routes = require('./routes');

app.use(express.json());
app.use('/api', routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
