import { google } from 'googleapis'
import { Readable } from 'stream'

function getDriveClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/google'

  // Si tenemos OAuth2 con Refresh Token, autenticar como el usuario personal
  if (clientId && clientSecret && refreshToken) {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    })
    return google.drive({ version: 'v3', auth: oauth2Client })
  }

  // Fallback: Service Account (Robot)
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!email || !privateKey) {
    throw new Error('No hay credenciales válidas de Google Drive (OAuth2 o Service Account) en .env.local')
  }

  // Corregir escapes de saltos de línea si vienen con comillas
  privateKey = privateKey.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1')

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ]
  })

  return google.drive({ version: 'v3', auth })
}

/**
 * Busca una carpeta por nombre dentro de un padre o la crea si no existe.
 */
export async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const drive = getDriveClient()

  let q = `mimeType = 'application/vnd.google-apps.folder' and name = '${name.replace(/'/g, "\\'")}' and trashed = false`
  if (parentId) {
    q += ` and '${parentId}' in parents`
  }

  const res = await drive.files.list({
    q,
    fields: 'files(id, name)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  })

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!
  }

  // Crear la carpeta
  const folderMetadata: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder'
  }
  if (parentId) {
    folderMetadata.parents = [parentId]
  }

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id, name',
    supportsAllDrives: true
  })

  return folder.data.id!
}

/**
 * Resuelve una ruta jerárquica de carpetas (ej: ['RRHH', 'Jonatan Acevedo', '01_Recibos_Sueldo'])
 */
export async function resolveFolderPath(pathSegments: string[], rootParentId?: string): Promise<string> {
  let currentParentId = rootParentId

  for (const segment of pathSegments) {
    if (!segment) continue
    currentParentId = await findOrCreateFolder(segment, currentParentId)
  }

  return currentParentId || ''
}

export interface UploadResult {
  fileId: string
  fileName: string
  webViewLink: string
  webContentLink?: string
}

/**
 * Sube un archivo a Google Drive dentro de una jerarquía de carpetas
 */
export async function uploadFileToGoogleDrive({
  buffer,
  fileName,
  mimeType,
  pathSegments
}: {
  buffer: Buffer
  fileName: string
  mimeType: string
  pathSegments: string[]
}): Promise<UploadResult> {
  const drive = getDriveClient()

  // 1. Obtener o crear la carpeta destino
  let rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  if (!rootId) {
    const rootName = process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME || 'Super Catering - Documentos'
    rootId = await findOrCreateFolder(rootName)
  }
  const targetFolderId = await resolveFolderPath(pathSegments, rootId)

  // 2. Subir el archivo
  const fileStream = Readable.from(buffer)

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [targetFolderId]
    },
    media: {
      mimeType,
      body: fileStream
    },
    fields: 'id, name, webViewLink, webContentLink',
    supportsAllDrives: true
  })

  const fileId = res.data.id!

  // 3. Dar permisos públicos de lectura para que se pueda visualizar con el link sin login forzado
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      },
      supportsAllDrives: true
    })
  } catch (permErr) {
    console.warn('Advertencia al configurar permisos de archivo en Drive:', permErr)
  }

  return {
    fileId,
    fileName: res.data.name || fileName,
    webViewLink: res.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    webContentLink: res.data.webContentLink || undefined
  }
}
