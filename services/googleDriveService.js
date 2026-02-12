require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
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

function getMimeType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
        // Archivos comprimidos
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed',

        // Documentos
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

        // Imágenes
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',

        // Texto
        'txt': 'text/plain',
        'csv': 'text/csv',
        'json': 'application/json',
        'xml': 'application/xml'
    };

    return mimeTypes[ext] || 'application/octet-stream';
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

async function uploadFileToDrive(fileBuffer, filename, folderId) {
    try {
        const bufferStream = new require('stream').PassThrough();
        bufferStream.end(fileBuffer);

        const ext = path.extname(filename).toLowerCase();
        const mimeType = getMimeType(ext) || 'application/octet-stream';

        const response = await driveService.files.create({
            requestBody: {
                name: filename,
                parents: [folderId],
                mimeType: mimeType
            },
            media: {
                mimeType: mimeType,
                body: bufferStream
            },
            fields: 'id,name,mimeType,webViewLink'
        });

        await driveService.permissions.create({
            fileId: response.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            }
        });

        const fileId = response.data.id;
        const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
        const webViewLink = response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

        return {
            id: fileId,
            name: filename,
            mimeType: response.data.mimeType,
            url: downloadUrl,
            webViewLink: webViewLink
        };

    } catch (error) {
        console.error(`Error subiendo archivo ${filename}:`, error);
        throw error;
    }
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

async function getFileFromDrive(filename, folderId) {
    try {
        const searchQuery = `name='${filename.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`;

        const searchRes = await driveService.files.list({
            q: searchQuery,
            fields: 'files(id, name, mimeType, size)',
            spaces: 'drive',
            pageSize: 1
        });

        const file = searchRes.data.files[0];
        if (!file) {
            return null;
        }

        const response = await driveService.files.get(
            {
                fileId: file.id,
                alt: 'media'
            },
            {
                responseType: 'arraybuffer',
                timeout: 30000
            }
        );

        return Buffer.from(response.data);

    } catch (error) {
        console.error(`❌ Error descargando ${filename}:`, error.message);
        throw error;
    }
}

async function getFileByNameBase64(filename, folderId) {
    try {
        const searchQuery = `name='${filename}' and '${folderId}' in parents and trashed=false`;

        const res = await driveService.files.list({
            q: searchQuery,
            fields: 'files(id, name, mimeType)',
            spaces: 'drive'
        });

        const file = res.data.files[0];
        if (!file) {
            return null;
        }

        const fileId = file.id;
        const mimeType = file.mimeType || 'image/png';

        const response = await driveService.files.get(
            { fileId, alt: 'media' },
            { responseType: 'arraybuffer' }
        );

        const buffer = Buffer.from(response.data);
        const base64Data = buffer.toString('base64');

        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        return dataUrl;

    } catch (error) {
        console.error('Error en getFileByName:', error.message);
        throw error;
    }
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

async function obtenerStreamArchivo(fileId) {
    const res = await driveService.files.get(
        { fileId, alt: "media" },
        { responseType: "stream" }
    );

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
    const folderId = '1gWDVpbQA-h1Zx7bzTC3xjbR5WpvD67WI';

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
    getMimeType,
    uploadFile,
    uploadFileToDrive,
    getFileByName,
    getFileFromDrive,
    getFileByNameBase64,
    listarArchivosEnCarpeta,
    obtenerDetallesArchivo,
    obtenerStreamArchivo,
    hacerPublico,
    compartirArchivosConUsuario
};