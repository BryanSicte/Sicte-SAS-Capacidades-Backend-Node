const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const routes = require('./routes');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

morgan.token('date', () => new Date().toISOString());
morgan.token('body', (req) => JSON.stringify(req.body));
morgan.token('query', (req) => JSON.stringify(req.query));
morgan.token('ip', (req) => req.ip);
morgan.token('host', (req) => req.hostname);
morgan.token('protocol', (req) => req.protocol);
morgan.token('origin', (req) => req.headers.origin || '-');
morgan.token('res-length', (req, res) => res.getHeader('content-length') || '-');
app.use(
    morgan(
        '[Fecha: :date ] | Metodo: :method | Endpoint: :url | Estado HTTP: :status | Tamaño de respuesta HTTP: :res-length | Tiempo de Respuesta: :response-time ms | Encabezado de respuesta: :res[header] | Encabezado de peticion: :req[header] | Direccion IP remota: :remote-addr | Usuario remoto: :remote-user | Version de HTTP: :http-version | URL referencia: :referrer | Tiempo Total: :total-time | IP: :ip | Host: :host | Origin: :origin | Protocolo: :protocol | Body: :body | Query: :query | Navegador: :user-agent\n'
    )
);
app.use('/api', routes);

const PORT = process.env.PORT || 3030;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
