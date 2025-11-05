require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file']
});
const driveService = google.drive({ version: 'v3', auth });

function getDriveClient() {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return google.drive({ version: 'v3', auth });
}

async function uploadFile(filePath, filename, folderId) {
    const fileMetadata = {
        name: filename,
        parents: [folderId]
    };

    const media = {
        mimeType: 'image/jpeg',
        body: fs.createReadStream(filePath)
    };

    const response = await driveService.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
    });

    fs.unlinkSync(filePath);

    return response.data.id;
}

async function getFileByName(filename, folderId) {
    const searchQuery = `name='${filename}' and '${folderId}' in parents and trashed=false`;

    const res = await driveService.files.list({
        q: searchQuery,
        fields: 'files(id, name)',
        spaces: 'drive'
    });

    const file = res.data.files[0];
    if (!file) {
        return null;
    }

    const fileId = file.id;
    const response = await driveService.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });

    return Buffer.from(response.data);
}

async function listarArchivosEnCarpeta(folderId) {
    const res = await driveService.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive'
    });

    // res.data.files.forEach(f => console.log(`   🧾 ${f.name}`));
    return res.data.files;
}

async function obtenerDetallesArchivo(fileId) {
    const res = await driveService.files.get({
        fileId,
        fields: 'id, name, mimeType, webViewLink, webContentLink, parents, size, createdTime, modifiedTime'
    });

    return res.data;
}

async function hacerPublico(fileId) {
    try {
        await driveService.permissions.create({
            fileId,
            requestBody: {
                type: 'anyone',
                role: 'reader'
            },
            supportsAllDrives: true
        });
        return true;
    } catch (err) {
        console.error('Error haciendo público:', err.message || err);
        throw err;
    }
}

async function compartirArchivosConUsuario(folderId, emailDestino) {
    const res = await driveService.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive'
    });

    const archivos = res.data.files;
    const resultados = [];

    for (const file of archivos) {
        try {
            await driveService.permissions.create({
                fileId: file.id,
                requestBody: {
                    type: 'user',
                    role: 'reader',
                    emailAddress: emailDestino
                }
            });
            resultados.push({ nombre: file.name, id: file.id, status: 'compartido' });
        } catch (err) {
            resultados.push({ nombre: file.name, id: file.id, status: 'error', error: err.message });
        }
    }

    return resultados;
}

async function subirArchivosDeTemp() {
    const folderId = '1YP6fMEroaBnR-KLndDKzWjy1g8uNxZaN';

    const tempDir = path.resolve(__dirname, '../temp');

    const archivos = fs.readdirSync(tempDir);

    if (archivos.length === 0) {
        console.log('⚠️ No hay archivos en la carpeta temp.');
        return;
    }

    console.log(`📂 Subiendo ${archivos.length} archivo(s) desde temp/...\n`);

    for (const archivo of archivos) {
        const filePath = path.join(tempDir, archivo);
        const extension = path.extname(archivo).toLowerCase();

        let mimeType = 'application/octet-stream';
        if (['.jpg', '.jpeg', '.png'].includes(extension)) mimeType = 'image/jpeg';
        if (extension === '.mp4') mimeType = 'video/mp4';
        if (extension === '.pdf') mimeType = 'application/pdf';

        const fileMetadata = { name: archivo, parents: [folderId] };
        const media = { mimeType, body: fs.createReadStream(filePath) };

        try {
            const res = await driveService.files.create({
                resource: fileMetadata,
                media,
                fields: 'id, name',
            });

            console.log(`✅ Subido: ${archivo} (ID: ${res.data.id})`);
        } catch (err) {
            console.error(`❌ Error subiendo ${archivo}:`, err.message);
        }
    }

    console.log('\n🎉 Todos los archivos de temp fueron subidos correctamente.');
}

// subirArchivosDeTemp();

module.exports = {
    getDriveClient,
    uploadFile,
    getFileByName,
    listarArchivosEnCarpeta,
    obtenerDetallesArchivo,
    hacerPublico,
    compartirArchivosConUsuario
};