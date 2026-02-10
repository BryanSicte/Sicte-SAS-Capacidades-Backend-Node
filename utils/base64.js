const fs = require('fs');
const path = require('path');
const { uploadFile } = require('../services/googleDriveService');

const projectRoot = path.resolve(__dirname, '..', '..');
const TEMP_DIR = path.join(projectRoot, 'temp');

async function saveBase64AsTempFile(base64String, baseFilename) {
    try {
        if (!base64String || typeof base64String !== 'string') {
            throw new Error('Base64 inválido o vacío');
        }
        
        let pureBase64;
        let mimeType = 'image/png';
        
        if (base64String.includes('base64,')) {
            const matches = base64String.match(/^data:(.+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                throw new Error('Formato Base64 inválido');
            }
            mimeType = matches[1];
            pureBase64 = matches[2];
        } else {
            pureBase64 = base64String;
        }
        
        const ext = mimeType.split('/')[1] || 'png';
        
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const safeFilename = `${baseFilename}_${timestamp}_${random}.${ext}`;
        
        const tempDir = TEMP_DIR;
        
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFilePath = path.join(tempDir, safeFilename);
        
        fs.writeFileSync(tempFilePath, pureBase64, 'base64');
        
        return {
            path: tempFilePath,
            filename: safeFilename,
            mimeType: mimeType
        };
        
    } catch (error) {
        console.log("Error base64: ", error);
        throw error;
    }
}

async function handleFirmaUpload(base64String, cedula, folderId) {
    let tempFileInfo = null;
    
    try {
        if (!base64String) {
            return null;
        }

        tempFileInfo = await saveBase64AsTempFile(base64String, `firma_${cedula}`);

        if (!fs.existsSync(tempFileInfo.path)) {
            throw new Error(`Archivo temporal no encontrado: ${tempFileInfo.path}`);
        }

        const fileId = await uploadFile(
            tempFileInfo.path, 
            tempFileInfo.filename, 
            folderId
        );
        
        return {
            nameFile: tempFileInfo.filename,
            fileId: fileId,
            url: `https://drive.google.com/file/d/${fileId}/view`,
            mimeType: tempFileInfo.mimeType
        };
        
    } catch (error) {
        console.log("Error base64 drive: ", error);
        
        if (tempFileInfo && fs.existsSync(tempFileInfo.path)) {
            try {
                fs.unlinkSync(tempFileInfo.path);
                console.log(`Archivo temporal limpiado: ${tempFileInfo.path}`);
            } catch (cleanupError) {
                console.error('Error limpiando archivo temporal:', cleanupError);
            }
        }
        
        return null;
    } finally {
        if (tempFileInfo && fs.existsSync(tempFileInfo.path)) {
            try {
                fs.unlinkSync(tempFileInfo.path);
                console.log(`Archivo temporal eliminado finalmente: ${tempFileInfo.path}`);
            } catch (cleanupError) {
                console.error('Error final limpiando archivo temporal:', cleanupError);
            }
        }
    }
}

module.exports = { handleFirmaUpload };