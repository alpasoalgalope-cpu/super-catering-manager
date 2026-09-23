import { createClient } from "@/lib/supabase/server"
import nodemailer from "nodemailer"

interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
  from?: string
  cc?: string[]
  bcc?: string[]
}

export async function sendEmail({ to, subject, html, replyTo, from, cc, bcc }: SendEmailParams) {
  const fromEmail = from || process.env.EMAIL_FROM || "Super Catering <fschottenfeld@gmail.com>"
  const replyToEmail = replyTo || process.env.SUPPORT_EMAIL || process.env.EMAIL_REPLY_TO || "alpaso.algalope@gmail.com"
  const adminNotify = process.env.ADMIN_NOTIFY_EMAIL || "alpaso.algalope@gmail.com"
  const toList = Array.isArray(to) ? to : [to]
  const notifyBcc = bcc || (adminNotify && !toList.includes(adminNotify) ? [adminNotify] : [])
  const resendApiKey = process.env.RESEND_API_KEY
  const sendgridApiKey = process.env.SENDGRID_API_KEY

  // 1. PRIORIDAD MÁXIMA: GMAIL (Google App Password) - Sin límites de sandbox ni necesidad de dominio
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || "vvqm evkp axrh zbjp").replace(/\s+/g, "")
  const gmailUser = process.env.GMAIL_USER || "fschottenfeld@gmail.com"

  if (gmailPass && gmailUser) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass
        }
      })

      const mailOptions: any = {
        from: `Super Catering <${gmailUser}>`,
        to: toList,
        subject,
        html,
        replyTo: replyToEmail
      }

      if (cc && cc.length > 0) {
        mailOptions.cc = cc
      }
      if (notifyBcc && notifyBcc.length > 0) {
        mailOptions.bcc = notifyBcc
      }

      const info = await transporter.sendMail(mailOptions)
      console.log(`[Gmail Success] Email enviado a ${toList.join(', ')} (ID: ${info.messageId})`)
      return { success: true, provider: "gmail", id: info.messageId }
    } catch (gmailErr: any) {
      console.error("[Gmail Error]", gmailErr)
      // Si falla Gmail por algún motivo, continúa como fallback a Resend
    }
  }

  // 2. RESPALDO: RESEND (REST API)
  if (resendApiKey) {
    try {
      const payload: any = {
        from: fromEmail,
        to: toList,
        reply_to: replyToEmail,
        subject,
        html
      }
      if (cc && cc.length > 0) {
        payload.cc = cc
      }
      if (notifyBcc.length > 0) {
        payload.bcc = notifyBcc
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      if (!response.ok) {
        console.error("[Resend Error]", data)

        // Fallback automático si Resend está en Sandbox (sin dominio verificado)
        const isSandboxRestricted = typeof data.message === "string" && 
          data.message.includes("You can only send testing emails to your own email address")
        
        const isAlreadyOnlyOwner = toList.length === 1 && 
          toList[0].toLowerCase() === "fschottenfeld@gmail.com" && 
          (!cc || cc.length === 0) && 
          (!notifyBcc || notifyBcc.length === 0)

        if (isSandboxRestricted && !isAlreadyOnlyOwner) {
          console.warn("[Resend Fallback] Sandbox mode detectado. Reintentando exclusivamente a fschottenfeld@gmail.com")
          const fallbackPayload: any = {
            from: fromEmail,
            to: ["fschottenfeld@gmail.com"],
            reply_to: replyToEmail,
            subject: `[MODO PRUEBA RESEND] ${subject}`,
            html: `<div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 14px; border-radius: 8px; margin-bottom: 20px; font-family: sans-serif; font-size: 13px; color: #92400e;">
              <strong>⚠️ AVISO DE MODO PRUEBA (RESEND):</strong><br>
              Este correo iba dirigido originalmente a: <strong>${toList.join(', ')}</strong>${cc && cc.length > 0 ? ` (CC: ${cc.join(', ')})` : ''}.<br>
              Como tu cuenta de Resend todavía está en modo prueba (sandbox con remitente de prueba), Resend únicamente permite enviar correos a tu dirección registrada (<strong>fschottenfeld@gmail.com</strong>).<br>
              Para que los correos le lleguen directo a Graciela y clientes, recuerda verificar tu dominio en <a href="https://resend.com/domains" target="_blank" style="color: #b45309; text-decoration: underline;">resend.com/domains</a>.
            </div>` + html
          }

          const fallbackRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(fallbackPayload)
          })

          const fallbackData = await fallbackRes.json()
          if (fallbackRes.ok) {
            console.log(`[Resend Fallback Success] Email enviado a fschottenfeld@gmail.com (ID: ${fallbackData.id})`)
            return { 
              success: true, 
              provider: "resend-sandbox-fallback", 
              id: fallbackData.id,
              warning: "Enviado a fschottenfeld@gmail.com debido a restricciones de Sandbox de Resend" 
            }
          }
        }

        return { success: false, error: data.message || "Error al enviar con Resend" }
      }

      console.log(`[Resend Success] Email enviado a ${to} (Copia a: ${notifyBcc.join(', ')}) (ID: ${data.id})`)
      return { success: true, provider: "resend", id: data.id }
    } catch (err: any) {
      console.error("[Resend Exception]", err)
      return { success: false, error: err.message }
    }
  }

  // 2. FALLBACK: SENDGRID (REST API)
  if (sendgridApiKey) {
    try {
      const personalization: any = { to: toList.map(e => ({ email: e })) }
      if (cc && cc.length > 0) {
        personalization.cc = cc.map(e => ({ email: e }))
      }
      if (notifyBcc.length > 0) {
        personalization.bcc = notifyBcc.map(e => ({ email: e }))
      }

      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sendgridApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          personalizations: [personalization],
          from: { email: fromEmail.includes("<") ? fromEmail.match(/<([^>]+)>/)?.[1] || fromEmail : fromEmail },
          reply_to: { email: replyToEmail },
          subject,
          content: [{ type: "text/html", value: html }]
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error("[SendGrid Error]", errText)
        return { success: false, error: errText }
      }

      console.log(`[SendGrid Success] Email enviado a ${to}`)
      return { success: true, provider: "sendgrid" }
    } catch (err: any) {
      console.error("[SendGrid Exception]", err)
      return { success: false, error: err.message }
    }
  }

  // 3. FALLBACK DEV / LOGS (Simulación si no hay API Key configurada todavía)
  console.log("==========================================================")
  console.log("📧 [SIMULACIÓN DE CORREO TRANSACCIONAL]")
  console.log(`Para: ${to}`)
  console.log(`Reply-To: ${replyToEmail}`)
  console.log(`De: ${fromEmail}`)
  console.log(`Asunto: ${subject}`)
  console.log("==========================================================")

  return { success: true, provider: "simulated", message: "Email simulado en consola (configure RESEND_API_KEY para envíos reales)" }
}

export function generateOrderConfirmationHtml(order: {
  id: string
  customer_name: string
  event_title: string
  travel_date: string
  bus_identifier?: string | null
  total_amount: number
  combos: { name: string; qty: number; unit_price: number; subtotal: number }[]
}) {
  const shortId = order.id.slice(0, 8).toUpperCase()
  const formattedTotal = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(order.total_amount)
  const formattedDate = order.travel_date ? new Date(order.travel_date + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "Fecha a confirmar"
  const busName = order.bus_identifier?.trim() || "Sin especificar / A coordinar"

  const combosRows = order.combos
    .filter(c => c.qty > 0)
    .map(c => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; font-weight: 600;">
          ${c.qty}x ${c.name}
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #475569; text-align: right; font-weight: 700;">
          ${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(c.subtotal)}
        </td>
      </tr>
    `).join("")

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de Pedido #${shortId}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 36px 32px; text-align: center;">
              <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); color: #ffffff; font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; padding: 6px 14px; border-radius: 9999px; margin-bottom: 12px;">
                SUPER CATERING
              </span>
              <h1 style="color: #ffffff; font-size: 26px; font-weight: 900; font-style: italic; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: -0.5px;">
                ¡Tu Pedido está Confirmado!
              </h1>
              <p style="color: #c7d2fe; font-size: 14px; margin: 0; font-weight: 500;">
                Orden #${shortId} • Pago Acreditado
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 16px; color: #334155; margin: 0 0 24px 0; line-height: 1.5;">
                Hola <strong style="color: #0f172a;">${order.customer_name}</strong>, recibimos tu pago correctamente. Acá tenés todos los detalles de tu compra:
              </p>

              <!-- Event & Travel Info Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; margin-bottom: 24px; padding: 16px;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 4px;">
                          Evento / Show
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size: 16px; color: #0f172a; font-weight: 900; text-transform: uppercase; padding-bottom: 12px;">
                          ${order.event_title}
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 4px;">
                          Fecha de Viaje
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; color: #334155; font-weight: 700; text-transform: capitalize;">
                          ${formattedDate}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- HIGHLIGHTED MICRO / COORDINADOR BOX -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border: 2px solid #818cf8; border-radius: 18px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <span style="font-size: 11px; color: #4338ca; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">
                      🚌 UNIDAD / COORDINADOR ASIGNADO
                    </span>
                    <span style="font-size: 22px; color: #1e1b4b; font-weight: 900; text-transform: uppercase; display: block; letter-spacing: -0.5px;">
                      ${busName}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Combos Breakdown -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; margin-bottom: 24px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f1f5f9;">
                    <th align="left" style="padding: 12px 16px; font-size: 11px; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 1px;">
                      Detalle del Combo
                    </th>
                    <th align="right" style="padding: 12px 16px; font-size: 11px; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 1px;">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${combosRows}
                  <tr style="background-color: #f8fafc;">
                    <td style="padding: 16px; font-size: 15px; font-weight: 900; color: #0f172a; text-transform: uppercase;">
                      TOTAL ABONADO
                    </td>
                    <td style="padding: 16px; font-size: 18px; font-weight: 900; color: #059669; text-align: right;">
                      ${formattedTotal}
                    </td>
                  </tr>
                </tbody>
              </table>

              <!-- MANDATORY CORRECTION NOTICE -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #92400e; font-weight: 600;">
                      ⚠️ <strong>Aviso importante:</strong> Si hay un error en la unidad seleccionada, tenés tiempo de corregirlo hasta las 23:00 hs del día previo al evento escribiendo a <a href="mailto:alpaso.algalope@gmail.com" style="color: #92400e; font-weight: 800; text-decoration: underline;">alpaso.algalope@gmail.com</a> o respondiendo a este correo.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 8px 0; text-align: center;">
                ¡Gracias por confiar en nosotros y que disfrutes el viaje!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0 0 6px 0; font-weight: 600;">
                Super Catering Manager • Logística Gastronómica de Eventos
              </p>
              <p style="font-size: 10px; color: #cbd5e1; margin: 0;">
                Este es un comprobante de compra generado automáticamente. Para consultas o modificaciones, escribinos a <a href="mailto:alpaso.algalope@gmail.com" style="color: #64748b; font-weight: 700; text-decoration: underline;">alpaso.algalope@gmail.com</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

export async function sendOrderConfirmationEmail(orderId: string, options?: { force?: boolean }) {
  try {
    const supabase = await createClient()

    // 1. Fetch order details with customer and store
    const { data: order, error } = await supabase
      .from("online_orders")
      .select(`
        *,
        online_customers (
          id,
          full_name,
          email,
          phone
        ),
        online_store_events (
          id,
          title,
          slug,
          events_master (
            show_name,
            event_date
          )
        )
      `)
      .eq("id", orderId)
      .single()

    if (error || !order) {
      console.error("[Email Dispatcher] Order not found:", orderId, error)
      return { success: false, error: "Pedido no encontrado" }
    }

    const customerEmail = order.online_customers?.email
    if (!customerEmail) {
      console.warn("[Email Dispatcher] No email for customer in order:", orderId)
      return { success: false, error: "El cliente no posee email registrado" }
    }

    // 2. Anti-duplicate check
    // Check if email was already sent (unless force is set)
    const isAlreadySent = order.confirmation_email_sent === true || 
                          (order.mp_detail && order.mp_detail.includes("email_sent"))

    if (isAlreadySent && !options?.force) {
      console.log(`[Email Dispatcher] Email already sent for order ${orderId}. Skipping.`)
      return { success: true, skipped: true, message: "Correo ya enviado previamente" }
    }

    // 3. Prepare combo items
    const combos = [
      { name: "Combo Tradicional", qty: Number(order.qty_tradicional) || 0, unit_price: Number(order.price_trad_unit) || 0, subtotal: (Number(order.qty_tradicional) || 0) * (Number(order.price_trad_unit) || 0) },
      { name: "Combo Vegetariano", qty: Number(order.qty_vegetariano) || 0, unit_price: Number(order.price_veg_unit) || 0, subtotal: (Number(order.qty_vegetariano) || 0) * (Number(order.price_veg_unit) || 0) },
      { name: "Combo Sin TACC", qty: Number(order.qty_sintacc) || 0, unit_price: Number(order.price_sintacc_unit) || 0, subtotal: (Number(order.qty_sintacc) || 0) * (Number(order.price_sintacc_unit) || 0) },
      { name: "Combo Vegano", qty: Number(order.qty_vegano) || 0, unit_price: Number(order.price_vegan_unit) || 0, subtotal: (Number(order.qty_vegano) || 0) * (Number(order.price_vegan_unit) || 0) },
    ]

    const eventTitle = order.online_store_events?.events_master?.show_name || order.online_store_events?.title || "Evento / Viaje"
    const travelDate = order.travel_date || order.online_store_events?.events_master?.event_date || ""

    const html = generateOrderConfirmationHtml({
      id: order.id,
      customer_name: order.online_customers?.full_name || "Pasajero",
      event_title: eventTitle,
      travel_date: travelDate,
      bus_identifier: order.bus_identifier,
      total_amount: Number(order.total_amount) || 0,
      combos
    })

    const shortId = order.id.slice(0, 8).toUpperCase()
    const subject = `Confirmación de Pedido #${shortId} — ${eventTitle}`

    // 4. Send email
    const sendResult = await sendEmail({
      to: customerEmail,
      subject,
      html,
      replyTo: process.env.SUPPORT_EMAIL || process.env.EMAIL_REPLY_TO || "alpaso.algalope@gmail.com"
    })

    // 5. Mark as sent in database
    const timestamp = new Date().toISOString()
    const prevDetail = order.mp_detail || ""
    const newDetail = prevDetail ? `${prevDetail} | email_sent:${timestamp}` : `email_sent:${timestamp}`

    await supabase
      .from("online_orders")
      .update({
        mp_detail: newDetail,
        updated_at: timestamp
      })
      .eq("id", orderId)

    return sendResult
  } catch (err: any) {
    console.error("[Email Dispatcher Exception]", err)
    return { success: false, error: err.message }
  }
}

export function generateOrderPendingHtml(order: {
  id: string
  customer_name: string
  event_title: string
  travel_date: string
  bus_identifier?: string | null
  total_amount: number
  combos: { name: string; qty: number; unit_price: number; subtotal: number }[]
}) {
  const shortId = order.id.slice(0, 8).toUpperCase()
  const formattedTotal = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(order.total_amount)
  const formattedDate = order.travel_date ? new Date(order.travel_date + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "Fecha a confirmar"
  const busName = order.bus_identifier?.trim() || "Sin especificar / A coordinar"

  const combosRows = order.combos
    .filter(c => c.qty > 0)
    .map(c => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; font-weight: 600;">
          ${c.qty}x ${c.name}
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #475569; text-align: right; font-weight: 700;">
          ${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(c.subtotal)}
        </td>
      </tr>
    `).join("")

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pago en Proceso #${shortId}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner (Amber/Gold for Pending) -->
          <tr>
            <td style="background: linear-gradient(135deg, #78350f 0%, #b45309 100%); padding: 36px 32px; text-align: center;">
              <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; padding: 6px 14px; border-radius: 9999px; margin-bottom: 12px;">
                SUPER CATERING
              </span>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; font-style: italic; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: -0.5px;">
                Tu Pago está en Proceso
              </h1>
              <p style="color: #fde68a; font-size: 14px; margin: 0; font-weight: 600;">
                Orden #${shortId} • Aguardando Acreditación
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 16px; color: #334155; margin: 0 0 20px 0; line-height: 1.5;">
                Hola <strong style="color: #0f172a;">${order.customer_name}</strong>, registramos tu pedido y tu pago se encuentra en proceso de verificación por parte de Mercado Pago.
              </p>

              <!-- Anti-duplicate Warning Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #991b1b; font-weight: 700;">
                      🛑 <strong>IMPORTANTE:</strong> Si ya viste el consumo en tu tarjeta o billetera virtual, <u>NO vuelvas a intentar la compra</u> para evitar pagos duplicados.
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 13px; line-height: 1.5; color: #7f1d1d;">
                      Tu orden ya está registrada con el identificador <strong>#${shortId}</strong>. En cuanto Mercado Pago nos confirme la acreditación, recibirás automáticamente tu correo de confirmación final con tu comprobante.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Event & Travel Info Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; margin-bottom: 24px; padding: 16px;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 4px;">
                          Evento / Show
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size: 16px; color: #0f172a; font-weight: 900; text-transform: uppercase; padding-bottom: 12px;">
                          ${order.event_title}
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 4px;">
                          Fecha de Viaje
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size: 14px; color: #334155; font-weight: 700; text-transform: capitalize;">
                          ${formattedDate}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Micro Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 16px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px; text-align: center;">
                    <span style="font-size: 11px; color: #475569; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">
                      🚌 UNIDAD / COORDINADOR SELECCIONADO
                    </span>
                    <span style="font-size: 18px; color: #1e293b; font-weight: 900; text-transform: uppercase; display: block;">
                      ${busName}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Combos Breakdown -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; margin-bottom: 24px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f1f5f9;">
                    <th align="left" style="padding: 12px 16px; font-size: 11px; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 1px;">
                      Detalle de Viandas
                    </th>
                    <th align="right" style="padding: 12px 16px; font-size: 11px; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 1px;">
                      Importe
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${combosRows}
                  <tr style="background-color: #f8fafc;">
                    <td style="padding: 16px; font-size: 15px; font-weight: 900; color: #0f172a; text-transform: uppercase;">
                      MONTO A ACREDITAR
                    </td>
                    <td style="padding: 16px; font-size: 18px; font-weight: 900; color: #d97706; text-align: right;">
                      ${formattedTotal}
                    </td>
                  </tr>
                </tbody>
              </table>

              <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 8px 0; text-align: center;">
                Si tu pago fue rechazado por el banco o tenés el comprobante y querés agilizar la verificación, <strong>respondé directamente a este correo</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0 0 6px 0; font-weight: 600;">
                Super Catering Manager • Logística Gastronómica de Eventos
              </p>
              <p style="font-size: 10px; color: #cbd5e1; margin: 0;">
                Para cualquier consulta sobre este pedido #${shortId}, respondé a este mensaje.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

export async function sendOrderPendingEmail(orderId: string) {
  try {
    const supabase = await createClient()

    const { data: order, error } = await supabase
      .from("online_orders")
      .select(`
        *,
        online_customers (
          id,
          full_name,
          email,
          phone
        ),
        online_store_events (
          id,
          title,
          slug,
          events_master (
            show_name,
            event_date
          )
        )
      `)
      .eq("id", orderId)
      .single()

    if (error || !order) return { success: false, error: "Pedido no encontrado" }

    const customerEmail = order.online_customers?.email
    if (!customerEmail) return { success: false, error: "Sin email" }

    // Check if already paid or notified
    if (order.status === "paid" || (order.mp_detail && order.mp_detail.includes("pending_email_sent"))) {
      return { success: true, skipped: true }
    }

    const combos = [
      { name: "Combo Tradicional", qty: Number(order.qty_tradicional) || 0, unit_price: Number(order.price_trad_unit) || 0, subtotal: (Number(order.qty_tradicional) || 0) * (Number(order.price_trad_unit) || 0) },
      { name: "Combo Vegetariano", qty: Number(order.qty_vegetariano) || 0, unit_price: Number(order.price_veg_unit) || 0, subtotal: (Number(order.qty_vegetariano) || 0) * (Number(order.price_veg_unit) || 0) },
      { name: "Combo Sin TACC", qty: Number(order.qty_sintacc) || 0, unit_price: Number(order.price_sintacc_unit) || 0, subtotal: (Number(order.qty_sintacc) || 0) * (Number(order.price_sintacc_unit) || 0) },
      { name: "Combo Vegano", qty: Number(order.qty_vegano) || 0, unit_price: Number(order.price_vegan_unit) || 0, subtotal: (Number(order.qty_vegano) || 0) * (Number(order.price_vegan_unit) || 0) },
    ]

    const eventTitle = order.online_store_events?.events_master?.show_name || order.online_store_events?.title || "Evento / Viaje"
    const travelDate = order.travel_date || order.online_store_events?.events_master?.event_date || ""

    const html = generateOrderPendingHtml({
      id: order.id,
      customer_name: order.online_customers?.full_name || "Pasajero",
      event_title: eventTitle,
      travel_date: travelDate,
      bus_identifier: order.bus_identifier,
      total_amount: Number(order.total_amount) || 0,
      combos
    })

    const shortId = order.id.slice(0, 8).toUpperCase()
    const subject = `Pago en Proceso: Pedido #${shortId} — ${eventTitle}`

    const sendResult = await sendEmail({
      to: customerEmail,
      subject,
      html,
      replyTo: process.env.SUPPORT_EMAIL || process.env.EMAIL_REPLY_TO || "alpaso.algalope@gmail.com"
    })

    const timestamp = new Date().toISOString()
    const prevDetail = order.mp_detail || ""
    const newDetail = prevDetail ? `${prevDetail} | pending_email_sent:${timestamp}` : `pending_email_sent:${timestamp}`

    await supabase
      .from("online_orders")
      .update({
        mp_detail: newDetail,
        updated_at: timestamp
      })
      .eq("id", orderId)

    return sendResult
  } catch (err: any) {
    console.error("[Pending Email Exception]", err)
    return { success: false, error: err.message }
  }
}

// ============================================================
// PRIMER CORTE PARA PRODUCCIÓN (COCINA TERCERIZADA)
// ============================================================

export interface FirstCutItemSummary {
  showName: string
  venueName: string
  eventDate: string
  eventDateFormatted: string

  // Sandwiches vendidos (confirmados)
  soldTotal: number
  soldTrad: number
  soldVeg: number
  soldSintacc: number
  soldVegan: number
  soldWater: number
  soldSources: { name: string; qty: number; trad: number; veg: number; sintacc: number; vegan: number; water: number }[]

  // Sandwiches proyectados (estadística)
  projTotal: number
  projTrad: number
  projVeg: number
  projSintacc: number
  projVegan: number
  projWater: number
  projBreakdown: { company: string; pax: number; viandas: number; trad: number; veg: number; sintacc: number; water: number }[]

  // Gran Total a Elaborar
  grandTotal: number
  grandTrad: number
  grandVeg: number
  grandSintacc: number
  grandVegan: number
  grandWater: number
}

function formatPackaging(qty: number, label: string): string {
  if (qty <= 0) return `0 bultos rotulados "${label}"`
  const full = Math.floor(qty / 10)
  const rem = qty % 10
  if (full > 0 && rem > 0) {
    return `${full} bulto${full > 1 ? 's' : ''} de 10 un. + 1 bulto de ${rem} un. rotulados "${label}"`
  }
  if (full > 0 && rem === 0) {
    return `${full} bulto${full > 1 ? 's cerrados' : ' cerrado'} de 10 un. rotulado${full > 1 ? 's' : ''} "${label}"`
  }
  return `1 bulto de ${rem} un. rotulado "${label}"`
}

export function generateFirstCutProductionHtml(data: FirstCutItemSummary): string {
  const tradBoxes = Math.ceil(data.grandTrad / 10)
  const vegBoxes = Math.ceil(data.grandVeg / 10)
  const sinBoxes = Math.ceil(data.grandSintacc / 10)
  const veganBoxes = Math.ceil(data.grandVegan / 10)
  const totalBoxes = tradBoxes + vegBoxes + sinBoxes + veganBoxes

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ORDEN DE PRODUCCIÓN — PRIMER CORTE</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 680px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0;">
          
          <!-- 1. Encabezado Técnico -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 36px 36px 32px; color: #ffffff;">
              <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); color: #ffffff; font-size: 11px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; padding: 6px 16px; border-radius: 9999px; margin-bottom: 14px;">
                PLANIFICACIÓN OPERATIVA
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase;">
                ORDEN DE PRODUCCIÓN — PRIMER CORTE
              </h1>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.15); padding-top: 16px; font-size: 14px;">
                <tr>
                  <td style="padding: 4px 0; color: #94a3b8; font-weight: 700; width: 140px;">📅 Servicio:</td>
                  <td style="padding: 4px 0; color: #ffffff; font-weight: 800; text-transform: uppercase;">${data.eventDateFormatted}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #94a3b8; font-weight: 700;">📍 Evento / Punto:</td>
                  <td style="padding: 4px 0; color: #ffffff; font-weight: 800; text-transform: uppercase;">${data.showName} — ${data.venueName}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #94a3b8; font-weight: 700;">⚡ Estado:</td>
                  <td style="padding: 4px 0; color: #fde047; font-weight: 700;">Previsión de compras y producción (corte definitivo al mediodía previo)</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #94a3b8; font-weight: 700;">🚚 Logística:</td>
                  <td style="padding: 4px 0; color: #38bdf8; font-weight: 700;">A confirmar detalles de la logística, estima 19.30 hs.</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 2. Tarjetas de Resumen Global (Visión Rápida) -->
          <tr>
            <td style="padding: 28px 36px 12px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33.3%" style="padding-right: 8px;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px 12px; text-align: center;">
                      <div style="font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">Total Sándwiches</div>
                      <div style="font-size: 26px; font-weight: 900; color: #0f172a; margin-top: 4px;">${data.grandTotal} <span style="font-size: 13px; font-weight: 700; color: #64748b;">un.</span></div>
                    </div>
                  </td>
                  <td width="33.3%" style="padding: 0 4px;">
                    <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 18px; padding: 16px 12px; text-align: center;">
                      <div style="font-size: 10px; font-weight: 900; color: #0284c7; text-transform: uppercase; letter-spacing: 0.8px;">Aguas Minerales</div>
                      <div style="font-size: 26px; font-weight: 900; color: #0369a1; margin-top: 4px;">${data.grandWater} <span style="font-size: 13px; font-weight: 700; color: #38bdf8;">un.</span></div>
                    </div>
                  </td>
                  <td width="33.3%" style="padding-left: 8px;">
                    <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 18px; padding: 16px 12px; text-align: center;">
                      <div style="font-size: 10px; font-weight: 900; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.8px;">Cajas Master</div>
                      <div style="font-size: 26px; font-weight: 900; color: #5b21b6; margin-top: 4px;">${totalBoxes} <span style="font-size: 13px; font-weight: 700; color: #a78bfa;">bultos</span></div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 3. Detalle de Producción y Empaque (Agrupado de a 10) -->
          <tr>
            <td style="padding: 16px 36px;">
              <div style="border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 14px;">
                <h2 style="font-size: 15px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">
                  Detalle de Producción y Empaque (Agrupado de a 10)
                </h2>
              </div>

              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; font-size: 13px;">
                <thead>
                  <tr style="background-color: #f1f5f9; color: #475569; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
                    <th style="padding: 12px 14px; text-align: left; width: 25%;">Producto / Variedad</th>
                    <th style="padding: 12px 14px; text-align: left; width: 33%;">Receta / Especificación</th>
                    <th style="padding: 12px 14px; text-align: center; width: 14%;">Cantidad</th>
                    <th style="padding: 12px 14px; text-align: left; width: 28%;">Fraccionamiento de Empaque</th>
                  </tr>
                </thead>
                <tbody>
                  <!-- Fila Tradicional -->
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 14px; font-weight: 800; color: #1e293b;">
                      🥖 Ciabatta Tradicional
                    </td>
                    <td style="padding: 12px 14px; color: #475569; font-size: 12px;">
                      Jamón, queso, lechuga y tomate
                    </td>
                    <td align="center" style="padding: 12px 14px; font-weight: 900; color: #0f172a; font-size: 15px;">
                      ${data.grandTrad} un.
                    </td>
                    <td style="padding: 12px 14px; color: #334155; font-size: 12px; font-weight: 700;">
                      ${formatPackaging(data.grandTrad, 'Tradicional')}
                    </td>
                  </tr>

                  <!-- Fila Vegetariana -->
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 14px; font-weight: 800; color: #1e293b;">
                      🥑 Ciabatta Vegetariana
                    </td>
                    <td style="padding: 12px 14px; color: #475569; font-size: 12px;">
                      Queso, huevo, lechuga y tomate
                    </td>
                    <td align="center" style="padding: 12px 14px; font-weight: 900; color: #0f172a; font-size: 15px;">
                      ${data.grandVeg} un.
                    </td>
                    <td style="padding: 12px 14px; color: #334155; font-size: 12px; font-weight: 700;">
                      ${formatPackaging(data.grandVeg, 'Veggie')}
                    </td>
                  </tr>

                  <!-- Fila Sin TACC -->
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 14px; font-weight: 800; color: #1e293b;">
                      🌾 Sándwich Sin TACC
                    </td>
                    <td style="padding: 12px 14px; color: #475569; font-size: 12px;">
                      Elaboración/catering sellado apto celíaco (envasado al vacío certificado)
                    </td>
                    <td align="center" style="padding: 12px 14px; font-weight: 900; color: #0f172a; font-size: 15px;">
                      ${data.grandSintacc} un.
                    </td>
                    <td style="padding: 12px 14px; color: #334155; font-size: 12px; font-weight: 700;">
                      ${formatPackaging(data.grandSintacc, 'Sin TACC')}
                    </td>
                  </tr>

                  <!-- Fila Vegano (si aplica) -->
                  ${data.grandVegan > 0 ? `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 14px; font-weight: 800; color: #1e293b;">
                      🌱 Sándwich Vegano
                    </td>
                    <td style="padding: 12px 14px; color: #475569; font-size: 12px;">
                      Vegetales frescos y aderezo vegano en pan ciabatta
                    </td>
                    <td align="center" style="padding: 12px 14px; font-weight: 900; color: #0f172a; font-size: 15px;">
                      ${data.grandVegan} un.
                    </td>
                    <td style="padding: 12px 14px; color: #334155; font-size: 12px; font-weight: 700;">
                      ${formatPackaging(data.grandVegan, 'Vegano')}
                    </td>
                  </tr>
                  ` : ''}

                  <!-- Fila Agua Mineral -->
                  <tr>
                    <td style="padding: 12px 14px; font-weight: 800; color: #0284c7;">
                      💧 Agua Mineral sin gas
                    </td>
                    <td style="padding: 12px 14px; color: #475569; font-size: 12px;">
                      Botellitas individuales 500ml
                    </td>
                    <td align="center" style="padding: 12px 14px; font-weight: 900; color: #0284c7; font-size: 15px;">
                      ${data.grandWater} un.
                    </td>
                    <td style="padding: 12px 14px; color: #0369a1; font-size: 12px; font-weight: 700;">
                      Packs cerrados de fábrica
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <!-- 4. Notas Operativas al Pie -->
          <tr>
            <td style="padding: 12px 36px 36px;">
              <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 16px; padding: 20px 24px;">
                <h3 style="margin: 0 0 10px; font-size: 13px; font-weight: 900; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;">
                  📌 Notas Operativas de Armado y Despacho
                </h3>
                <ul style="margin: 0; padding-left: 18px; color: #78350f; font-size: 12px; line-height: 1.6; font-weight: 600;">
                  <li style="margin-bottom: 6px;">
                    Todos los sándwiches van en su packaging individual (caja media pizza, papel parafinado, servilletas y sobrecitos de mayonesa).
                  </li>
                  <li style="margin-bottom: 6px;">
                    Los bultos master deben quedar agrupados de a <strong>10 unidades del mismo tipo</strong>, debidamente fajados o rotulados para agilizar la carga del reparto.
                  </li>
                  <li>
                    Corte final de cantidades a confirmar el mediodía previo al servicio.
                  </li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 36px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 11px; font-weight: 700;">
                Super Catering &bull; Sistema de Gestión Operativa
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

export async function sendFirstCutProductionEmail({
  eventId,
  eventDate,
  targetEmail = "graciel.ch@gmail.com",
  ccEmail = "fschottenfeld@gmail.com"
}: {
  eventId?: string
  eventDate?: string
  targetEmail?: string
  ccEmail?: string
}) {
  try {
    const supabase = await createClient()

    // 1. Fetch Event Master
    let eventQuery = supabase
      .from("events_master")
      .select(`
        id,
        event_date,
        show_name,
        venues ( name ),
        event_projections (
          id,
          company_name,
          projected_pax
        )
      `)

    if (eventId) {
      eventQuery = eventQuery.eq("id", eventId)
    } else if (eventDate) {
      eventQuery = eventQuery.eq("event_date", eventDate)
    } else {
      return { success: false, error: "Se requiere eventId o eventDate" }
    }

    const { data: events, error: evErr } = await eventQuery
    if (evErr || !events || events.length === 0) {
      return { success: false, error: evErr?.message || "No se encontró el evento para generar el corte" }
    }

    const event = events[0]
    const effectiveEventId = event.id
    const showName = event.show_name || "Evento Especial"
    const venueName = (event.venues as any)?.name || (event.venues as any)?.[0]?.name || "Sede a confirmar"
    const rawDate = event.event_date || ""
    const [y, m, d] = rawDate.split("-").map(Number)
    const dt = new Date(y, m - 1, d, 12, 0, 0)
    const eventDateFormatted = dt.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()

    // 2. Fetch Conversion factors & Rules
    const [{ data: clients }, { data: rules }] = await Promise.all([
      supabase.from("clients").select("name, company, sale_type, conversion_factor"),
      supabase.from("commercial_rules").select("company_name, includes_water")
    ])

    const normalizeStr = (str: string) => {
      return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
    }

    const getFactor = (companyName: string): number => {
      const clean = normalizeStr(companyName)
      if (!clean) return 1.0

      const found = clients?.find((c: any) => {
        const cn = normalizeStr(c.name)
        const cc = normalizeStr(c.company)
        return cn === clean || cc === clean || (cn && (clean.includes(cn) || cn.includes(clean)))
      })

      if (found) {
        // Business Rule: Mayorista is 100% (1.0). Minorista uses declared conversion_factor.
        if (found.sale_type === 'mayorista') return 1.0
        return Number(found.conversion_factor) ?? 1.0
      }

      return 1.0
    }

    const waterRuleMap: Record<string, boolean> = {}
    rules?.forEach(r => {
      if (r.company_name) waterRuleMap[normalizeStr(r.company_name)] = r.includes_water ?? true
    })

    // 3. Fetch Event Sales Headers (Ventas manuales / por evento)
    const { data: salesHeaders } = await supabase
      .from("event_sales_headers")
      .select(`
        id,
        company_name,
        total_sold,
        water_quantity,
        event_sales_units (
          traditional,
          vegetarian,
          vegana,
          sin_tacc
        )
      `)
      .eq("event_master_id", effectiveEventId)

    // 4. Fetch Online Stores & Paid Orders for this event
    const { data: stores } = await supabase
      .from("online_store_events")
      .select("id, title, slug, is_active")
      .eq("event_master_id", effectiveEventId)

    const storeIds = (stores || []).map(s => s.id)
    let onlineOrders: any[] = []
    if (storeIds.length > 0) {
      const { data: orders } = await supabase
        .from("online_orders")
        .select("store_event_id, status, qty_tradicional, qty_vegetariano, qty_sintacc, qty_vegano, bus_identifier")
        .in("store_event_id", storeIds)
        .eq("status", "paid")
      onlineOrders = orders || []
    }

    // Set of companies with confirmed sales to avoid duplicates in projections!
    const confirmedCompanies = new Set<string>()
    const soldSources: FirstCutItemSummary["soldSources"] = []

    let soldTrad = 0
    let soldVeg = 0
    let soldSintacc = 0
    let soldVegan = 0
    let soldWater = 0

    // Process Wholesale / Event Sales Headers
    if (salesHeaders && salesHeaders.length > 0) {
      salesHeaders.forEach(sh => {
        const comp = (sh.company_name || "").trim()
        if (comp) {
          confirmedCompanies.add(comp.toLowerCase())
        }
        let hTrad = 0
        let hVeg = 0
        let hSin = 0
        let hVegana = 0

        sh.event_sales_units?.forEach((u: any) => {
          hTrad += Number(u.traditional) || 0
          hVeg += Number(u.vegetarian) || 0
          hSin += Number(u.sin_tacc) || 0
          hVegana += Number(u.vegana) || 0
        })

        const hTotal = hTrad + hVeg + hSin + hVegana
        const hWater = Number(sh.water_quantity) || 0

        soldTrad += hTrad
        soldVeg += hVeg
        soldSintacc += hSin
        soldVegan += hVegana
        soldWater += hWater

        soldSources.push({
          name: comp ? `Mayorista: ${comp}` : "Ventas por Evento",
          qty: hTotal,
          trad: hTrad,
          veg: hVeg,
          sintacc: hSin,
          vegan: hVegana,
          water: hWater
        })
      })
    }

    // Process Online Orders
    if (onlineOrders.length > 0) {
      let oTrad = 0
      let oVeg = 0
      let oSin = 0
      let oVegana = 0

      onlineOrders.forEach(o => {
        oTrad += Number(o.qty_tradicional) || 0
        oVeg += Number(o.qty_vegetariano) || 0
        oSin += Number(o.qty_sintacc) || 0
        oVegana += Number(o.qty_vegano) || 0
      })

      const oTotal = oTrad + oVeg + oSin + oVegana
      const oWater = oTotal // Online combos include 1 mineral water each

      soldTrad += oTrad
      soldVeg += oVeg
      soldSintacc += oSin
      soldVegan += oVegana
      soldWater += oWater

      soldSources.push({
        name: "Tienda Online (Pasajeros)",
        qty: oTotal,
        trad: oTrad,
        veg: oVeg,
        sintacc: oSin,
        vegan: oVegana,
        water: oWater
      })
    }

    const soldTotal = soldTrad + soldVeg + soldSintacc + soldVegan

    // 5. Projections for Companies WITHOUT confirmed sales (Avoiding Duplication!)
    const projBreakdown: FirstCutItemSummary["projBreakdown"] = []
    let projTotalTrad = 0
    let projTotalVeg = 0
    let projTotalSintacc = 0
    let projTotalWater = 0

    const projections = event.event_projections || []
    projections.forEach((p: any) => {
      const compName = (p.company_name || "").trim()
      const compClean = normalizeStr(compName)
      if (!compClean) return

      // CHECK: If company already has confirmed sales, DO NOT DUPLICATE in projections!
      const isAlreadyConfirmed = Array.from(confirmedCompanies).some(c => {
        const cNorm = normalizeStr(c)
        return cNorm === compClean || compClean.includes(cNorm) || cNorm.includes(compClean)
      })
      if (isAlreadyConfirmed) {
        return // Skipped to avoid duplicate counting
      }

      const factor = getFactor(compName)
      const basePax = Number(p.projected_pax) || 0
      if (basePax <= 0) return

      const viandas = Math.round(basePax * factor)
      if (viandas <= 0) return

      // Statistical distribution with integer rounding
      const tradRaw = Math.round(viandas * 0.90)
      const vegRaw = Math.round(viandas * 0.05)
      const sinRaw = Math.round(viandas * 0.05)
      const diff = viandas - (tradRaw + vegRaw + sinRaw)
      const trad = tradRaw + diff // Adjust rounding remainder to traditional

      // Water rule for company
      let hasWater = true
      if (compClean.includes("terco") || compClean.includes("circus")) {
        hasWater = false
      } else if (compClean.includes("rock") || compClean.includes("proxima") || compClean.includes("rv traslados")) {
        hasWater = true
      } else if (waterRuleMap[compClean] !== undefined) {
        hasWater = waterRuleMap[compClean]
      }

      const water = hasWater ? viandas : 0

      projTotalTrad += trad
      projTotalVeg += vegRaw
      projTotalSintacc += sinRaw
      projTotalWater += water

      projBreakdown.push({
        company: compName,
        pax: basePax,
        viandas,
        trad,
        veg: vegRaw,
        sintacc: sinRaw,
        water
      })
    })

    const projTotal = projTotalTrad + projTotalVeg + projTotalSintacc

    // 6. Grand Totals
    const grandTotal = soldTotal + projTotal
    const grandTrad = soldTrad + projTotalTrad
    const grandVeg = soldVeg + projTotalVeg
    const grandSintacc = soldSintacc + projTotalSintacc
    const grandVegan = soldVegan
    const grandWater = soldWater + projTotalWater

    const summaryData: FirstCutItemSummary = {
      showName,
      venueName,
      eventDate: rawDate,
      eventDateFormatted,
      soldTotal,
      soldTrad,
      soldVeg,
      soldSintacc,
      soldVegan,
      soldWater,
      soldSources,
      projTotal,
      projTrad: projTotalTrad,
      projVeg: projTotalVeg,
      projSintacc: projTotalSintacc,
      projVegan: 0,
      projWater: projTotalWater,
      projBreakdown,
      grandTotal,
      grandTrad,
      grandVeg,
      grandSintacc,
      grandVegan,
      grandWater
    }

    const html = generateFirstCutProductionHtml(summaryData)
    const subject = `ORDEN DE PRODUCCIÓN — PRIMER CORTE — ${showName} — ${eventDateFormatted}`

    // 7. Send email
    const fromAddress = process.env.EMAIL_FROM || "Super Catering <onboarding@resend.dev>"
    const toRecipients = [targetEmail]
    const ccRecipients = ccEmail ? [ccEmail] : []

    const sendResult = await sendEmail({
      to: toRecipients,
      cc: ccRecipients,
      subject,
      html,
      from: fromAddress,
      replyTo: ccEmail || "fschottenfeld@gmail.com"
    })

    return {
      success: sendResult.success,
      error: sendResult.error,
      summary: summaryData
    }
  } catch (err: any) {
    console.error("[sendFirstCutProductionEmail Error]", err)
    return { success: false, error: err.message }
  }
}

export function generateNoOrderProductionHtml(params: {
  serviceDateFormatted: string
}): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ORDEN DE PRODUCCIÓN — PRIMER CORTE — SIN PEDIDO</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 680px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0;">
          
          <!-- Encabezado Técnico -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 36px 36px 32px; color: #ffffff;">
              <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); color: #ffffff; font-size: 11px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; padding: 6px 16px; border-radius: 9999px; margin-bottom: 14px;">
                PLANIFICACIÓN OPERATIVA
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase;">
                ORDEN DE PRODUCCIÓN — PRIMER CORTE
              </h1>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.15); padding-top: 16px; font-size: 14px;">
                <tr>
                  <td style="padding: 4px 0; color: #94a3b8; font-weight: 700; width: 140px;">📅 Servicio:</td>
                  <td style="padding: 4px 0; color: #ffffff; font-weight: 800; text-transform: uppercase;">${params.serviceDateFormatted}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #94a3b8; font-weight: 700;">⚡ Estado:</td>
                  <td style="padding: 4px 0; color: #94a3b8; font-weight: 700;">SIN PEDIDO DE PRODUCCIÓN</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Mensaje Central -->
          <tr>
            <td style="padding: 36px;">
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 18px; padding: 32px 24px; text-align: center;">
                <div style="display: inline-block; background-color: #f1f5f9; width: 56px; height: 56px; line-height: 56px; border-radius: 50%; font-size: 28px; margin-bottom: 16px;">
                  📋
                </div>
                <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">
                  Sin Pedido Programado
                </h2>
                <p style="margin: 0; color: #64748b; font-size: 14px; font-weight: 600; line-height: 1.6; max-width: 440px; margin: 0 auto;">
                  Para el día de servicio <strong style="color: #1e293b;">${params.serviceDateFormatted}</strong> no se registran eventos ni pedidos de producción de sándwiches.
                </p>
                <div style="margin-top: 20px; display: inline-block; background-color: #e2e8f0; padding: 6px 18px; border-radius: 9999px; font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase;">
                  Producción Requerida: 0 unidades
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 36px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 11px; font-weight: 700;">
                Super Catering &bull; Sistema de Gestión Operativa
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

export async function sendDailyProductionCutSchedule({
  targetDate,
  targetEmail = "graciel.ch@gmail.com",
  ccEmail = "fschottenfeld@gmail.com"
}: {
  targetDate?: string
  targetEmail?: string
  ccEmail?: string
} = {}) {
  try {
    const supabase = await createClient()

    // 1. Determinar fecha del servicio (mañana en America/Argentina/Buenos_Aires)
    let serviceDateStr = targetDate
    if (!serviceDateStr) {
      const now = new Date()
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      })
      const todayInArg = formatter.format(now)
      const [y, m, d] = todayInArg.split("-").map(Number)
      const tomorrowArg = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0))
      serviceDateStr = formatter.format(tomorrowArg)
    }

    const [y, m, d] = serviceDateStr.split("-").map(Number)
    const dateObj = new Date(Date.UTC(y, m - 1, d, 15, 0, 0))
    const formattedDate = dateObj
      .toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long"
      })
      .toUpperCase()

    // 2. Consultar eventos para esta fecha
    const { data: events, error: eventsErr } = await supabase
      .from("events_master")
      .select("id, event_date, show_name, venues ( name )")
      .eq("event_date", serviceDateStr)

    if (eventsErr) {
      console.error("[sendDailyProductionCutSchedule] Error querying events:", eventsErr)
      throw eventsErr
    }

    // 3. Caso A: Hay eventos cargados
    if (events && events.length > 0) {
      console.log(`[sendDailyProductionCutSchedule] Encontrados ${events.length} evento(s) para ${serviceDateStr}`)
      const results = []
      for (const ev of events) {
        const res = await sendFirstCutProductionEmail({
          eventId: ev.id,
          targetEmail,
          ccEmail
        })
        results.push({
          eventId: ev.id,
          showName: ev.show_name,
          res
        })
      }
      return {
        success: true,
        type: "events_sent",
        date: serviceDateStr,
        eventsCount: events.length,
        results
      }
    }

    // 4. Caso B: Sin eventos cargados -> Enviar "Sin pedido"
    console.log(`[sendDailyProductionCutSchedule] Sin eventos cargados para ${serviceDateStr}. Enviando correo 'Sin pedido'.`)
    const html = generateNoOrderProductionHtml({ serviceDateFormatted: formattedDate })
    const subject = `ORDEN DE PRODUCCIÓN — PRIMER CORTE — SIN PEDIDO — ${formattedDate}`
    const fromAddress = process.env.EMAIL_FROM || "Super Catering <onboarding@resend.dev>"

    const sendRes = await sendEmail({
      to: [targetEmail],
      cc: ccEmail ? [ccEmail] : [],
      subject,
      html,
      from: fromAddress,
      replyTo: ccEmail || "fschottenfeld@gmail.com"
    })

    return {
      success: sendRes.success,
      type: "no_order_sent",
      date: serviceDateStr,
      dateFormatted: formattedDate,
      error: sendRes.error
    }
  } catch (err: any) {
    console.error("[sendDailyProductionCutSchedule Error]", err)
    return { success: false, error: err.message }
  }
}



