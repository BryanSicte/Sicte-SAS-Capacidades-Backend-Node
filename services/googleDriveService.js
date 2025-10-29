require('dotenv').config();

const fs = require('fs');
const { google } = require('googleapis');
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file']
});
const driveService = google.drive({ version: 'v3', auth });

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

    console.log("📂 Archivos actuales en la carpeta:");
    res.data.files.forEach(f => console.log(`   🧾 ${f.name}`));

    return res.data.files;
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

module.exports = {
    uploadFile,
    getFileByName,
    listarArchivosEnCarpeta,
    compartirArchivosConUsuario
};