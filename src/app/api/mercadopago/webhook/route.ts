import { NextRequest, NextResponse } from "next/server"
import { paymentClient } from "@/lib/mercadopago"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Mercado Pago sends different notification types
    // We care about "payment" notifications
    if (body.type === "payment" || body.action === "payment.updated" || body.action === "payment.created") {
      const paymentId = body.data?.id || body.id
      
      if (!paymentId) {
        console.warn("Webhook received without payment ID:", body)
        return NextResponse.json({ received: true })
      }

      // Fetch payment details from Mercado Pago
      const payment = await paymentClient.get({ id: paymentId })
      
      if (!payment || !payment.external_reference) {
        console.warn("Payment not found or missing external_reference:", paymentId)
        return NextResponse.json({ received: true })
      }

      const orderId = payment.external_reference
      const mpStatus = payment.status // approved, pending, rejected, cancelled, refunded, etc.
      
      // Map MP status to our order status
      let orderStatus: string
      switch (mpStatus) {
        case "approved":
          orderStatus = "paid"
          break
        case "rejected":
        case "cancelled":
          orderStatus = "cancelled"
          break
        case "refunded":
          orderStatus = "refunded"
          break
        default:
          orderStatus = "pending_payment"
      }

      // Update order in database
      const supabase = await createClient()
      const { error } = await supabase
        .from("online_orders")
        .update({
          mp_payment_id: String(paymentId),
          mp_status: mpStatus,
          mp_detail: payment.status_detail || null,
          status: orderStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", orderId)

      if (error) {
        console.error("Error updating order from webhook:", error)
      } else {
        console.log(`Order ${orderId} updated: status=${orderStatus}, mp_status=${mpStatus}`)
      }
    }

    // Always return 200 to MP to acknowledge receipt
    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error("Webhook processing error:", error)
    // Still return 200 to prevent MP from retrying endlessly
    return NextResponse.json({ received: true })
  }
}

// MP also sends GET requests to verify the endpoint
export async function GET() {
  return NextResponse.json({ status: "ok" })
}
