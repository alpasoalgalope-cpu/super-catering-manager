import { NextRequest, NextResponse } from "next/server"
import { preferenceClient } from "@/lib/mercadopago"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    if (!process.env.MP_ACCESS_TOKEN) {
      console.error("ERROR: Falta MP_ACCESS_TOKEN en las variables de entorno.")
      return NextResponse.json(
        { error: "Error de configuración: Falta MP_ACCESS_TOKEN en las Variables de Entorno de Netlify." },
        { status: 500 }
      )
    }
    const body = await request.json()
    const {
      storeId,
      storeSlug,
      storeTitle,
      formData,
      combos,
      prices,

      // Fallback
      orderId: legacyOrderId,
      items: legacyItems,
      customer: legacyCustomer,
      payerEmail,
      payerName
    } = body

    const supabase = await createClient()

    let activeOrderId = legacyOrderId
    let activeItems = legacyItems || []
    let email = formData?.email?.toLowerCase()?.trim() || payerEmail || legacyCustomer?.email?.toLowerCase()?.trim()
    let fullName = formData?.fullName?.trim() || payerName || legacyCustomer?.name?.trim() || "Cliente"
    let phone = formData?.phone?.trim() || null
    let slug = storeSlug || body.slug || ""
    let title = storeTitle || "Super Catering"

    // If order is not created yet, create Customer and Order securely on the server
    if (!activeOrderId) {
      if (!email || !formData) {
        return NextResponse.json({ error: "Faltan datos de contacto del cliente" }, { status: 400 })
      }

      // 1. Upsert Customer securely on server
      const { data: existingCustomer } = await supabase
        .from('online_customers')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      let customerId = existingCustomer?.id

      if (existingCustomer) {
        await supabase
          .from('online_customers')
          .update({
            full_name: fullName,
            phone: phone,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCustomer.id)
      } else {
        const { data: newCust, error: custErr } = await supabase
          .from('online_customers')
          .insert([{
            email,
            full_name: fullName,
            phone: phone
          }])
          .select()
          .single()

        if (custErr) throw new Error("Error al registrar cliente: " + custErr.message)
        customerId = newCust.id
      }

      // Calculate totals
      const tradQty = Number(combos?.tradicional) || 0
      const vegQty = Number(combos?.vegetariano) || 0
      const staccQty = Number(combos?.sintacc) || 0
      const veganQty = Number(combos?.vegano) || 0

      const tradPrice = Number(prices?.trad) || 0
      const vegPrice = Number(prices?.veg) || 0
      const staccPrice = Number(prices?.sintacc) || 0
      const veganPrice = Number(prices?.vegan) || 0

      const totalAmount = (tradQty * tradPrice) + (vegQty * vegPrice) + (staccQty * staccPrice) + (veganQty * veganPrice)

      if (totalAmount <= 0) {
        return NextResponse.json({ error: "El total del pedido debe ser mayor a 0" }, { status: 400 })
      }

      // 2. Create Order in DB securely on server
      const { data: newOrder, error: orderErr } = await supabase
        .from('online_orders')
        .insert([{
          store_event_id: storeId,
          customer_id: customerId,
          travel_date: formData.travelDate,
          bus_identifier: formData.busIdentifier || null,
          qty_tradicional: tradQty,
          qty_vegetariano: vegQty,
          qty_sintacc: staccQty,
          qty_vegano: veganQty,
          price_trad_unit: tradPrice,
          price_veg_unit: vegPrice,
          price_sintacc_unit: staccPrice,
          price_vegan_unit: veganPrice,
          total_amount: totalAmount,
          status: 'pending_payment'
        }])
        .select()
        .single()

      if (orderErr) throw new Error("Error al crear la orden: " + orderErr.message)

      activeOrderId = newOrder.id

      // Build items list
      activeItems = [
        ...(tradQty > 0 ? [{ title: "Combo Tradicional + Agua sin Gas", quantity: tradQty, unit_price: tradPrice }] : []),
        ...(vegQty > 0 ? [{ title: "Combo Vegetariano + Agua sin Gas", quantity: vegQty, unit_price: vegPrice }] : []),
        ...(staccQty > 0 ? [{ title: "Combo Sin TACC + Agua sin Gas", quantity: staccQty, unit_price: staccPrice }] : []),
        ...(veganQty > 0 ? [{ title: "Combo Vegano + Agua sin Gas", quantity: veganQty, unit_price: veganPrice }] : []),
      ]
    }

    // Dynamic Host Resolution
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "alpasoalgalope.netlify.app"
    const proto = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
    const baseUrl = `${proto}://${host}`

    // 3. Create Mercado Pago Preference
    const preference = await preferenceClient.create({
      body: {
        items: activeItems.map((item: any) => ({
          id: item.id || activeOrderId,
          title: item.title,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          currency_id: "ARS"
        })),
        payer: {
          email: email,
          name: fullName
        },
        back_urls: {
          success: `${baseUrl}/tienda/${slug}/confirmacion?order_id=${activeOrderId}&status=approved`,
          failure: `${baseUrl}/tienda/${slug}/confirmacion?order_id=${activeOrderId}&status=failure`,
          pending: `${baseUrl}/tienda/${slug}/confirmacion?order_id=${activeOrderId}&status=pending`
        },
        external_reference: activeOrderId,
        notification_url: `${baseUrl}/api/mercadopago/webhook`,
        statement_descriptor: title.substring(0, 22),
      }
    })

    // 4. Update order with preference ID
    await supabase
      .from("online_orders")
      .update({
        mp_preference_id: preference.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", activeOrderId)

    return NextResponse.json({
      success: true,
      orderId: activeOrderId,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point
    })

  } catch (error: any) {
    console.error("Error creating order or MP preference:", error)
    return NextResponse.json(
      { error: error.message || "Error al procesar el pedido con Mercado Pago" },
      { status: 500 }
    )
  }
}
