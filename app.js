const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const routes = require('./routes');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api', routes);

const PORT = process.env.PORT || 3030;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
