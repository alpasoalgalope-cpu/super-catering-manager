import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return new Response(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h2 style="color:#e11d48;">Error al conectar con Google</h2>
        <p>${error}</p>
        <a href="/" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#0f172a;color:white;border-radius:10px;text-decoration:none;">Volver al Tablero</a>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  if (!code) {
    return new Response(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h2 style="color:#e11d48;">Código de autorización no encontrado</h2>
        <a href="/" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#0f172a;color:white;border-radius:10px;text-decoration:none;">Volver al Tablero</a>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/google'

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  try {
    const { tokens } = await oauth2Client.getToken(code)
    
    if (tokens.refresh_token) {
      // Guardar refresh_token en .env.local
      const envPath = path.join(process.cwd(), '.env.local')
      let envContent = fs.readFileSync(envPath, 'utf8')
      
      if (envContent.includes('GOOGLE_DRIVE_REFRESH_TOKEN=')) {
        envContent = envContent.replace(/GOOGLE_DRIVE_REFRESH_TOKEN=[^\r\n]+/, `GOOGLE_DRIVE_REFRESH_TOKEN="${tokens.refresh_token}"`)
      } else {
        envContent += `\nGOOGLE_DRIVE_REFRESH_TOKEN="${tokens.refresh_token}"\n`
      }
      
      fs.writeFileSync(envPath, envContent, 'utf8')
      process.env.GOOGLE_DRIVE_REFRESH_TOKEN = tokens.refresh_token
    }

    return new Response(
      `<html>
        <head><title>Google Drive Conectado</title></head>
        <body style="font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;">
          <div style="background:white;padding:40px;border-radius:24px;box-shadow:0 20px 25px -5px rgb(0 0 0 / 0.1);max-width:480px;width:100%;text-align:center;border:1px solid #e2e8f0;">
            <div style="width:64px;height:64px;background:#ecfdf5;color:#059669;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:32px;">✓</div>
            <h2 style="color:#0f172a;font-weight:900;text-transform:uppercase;letter-spacing:-0.05em;margin:0 0 8px;">¡Google Drive Conectado!</h2>
            <p style="color:#64748b;font-size:14px;margin:0 0 24px;line-height:1.5;">La vinculación con tu cuenta de Google Drive se completó con éxito. Los recibos de sueldo, certificados y facturas se guardarán en tu carpeta compartida.</p>
            <a href="/rrhh" style="display:inline-block;width:100%;box-sizing:border-box;padding:14px 20px;background:#4f46e5;color:white;font-weight:900;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;border-radius:12px;text-decoration:none;">Ir al Panel de RRHH</a>
          </div>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  } catch (tokenErr: any) {
    console.error('Error al canjear token de Google:', tokenErr)
    return new Response(
      `<html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h2 style="color:#e11d48;">Error al vincular con Google</h2>
        <p>${tokenErr.message || 'Error desconocido'}</p>
        <a href="/" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#0f172a;color:white;border-radius:10px;text-decoration:none;">Volver</a>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }
}
