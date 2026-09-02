// Mercado Pago SDK Configuration
// Uses the mercadopago npm package for Checkout Pro integration

import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'

// Server-side only — never expose ACCESS_TOKEN to the client
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

export const preferenceClient = new Preference(client)
export const paymentClient = new Payment(client)

export { client as mpClient }
