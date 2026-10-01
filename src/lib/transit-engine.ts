/**
 * Módulo de Planificación y Estimación de Tránsito Logístico
 * Super Catering Manager
 *
 * Integra Google Maps Routes API (computeRoutes) con modelado de tráfico en tiempo real,
 * cálculo de tiempos de carga en cocina, modalidades paralela vs. secuencial dedicada,
 * redondeo a rangos de 30 minutos (múltiplos de 15 min) para coordinadores y exportación a WhatsApp.
 */

import { EventTransitPlan, TransitModality, TransitStop, TransitTravelMode } from "@/types/logistics"

export const ORIGIN_KITCHEN_ADDRESS = "Coronel Belgrano 2429, Munro, Provincia de Buenos Aires"
export const ORIGIN_KITCHEN_COORDS = { lat: -34.5298, lng: -58.5284 }

// Calibraciones AMBA desde Munro para fallback inteligente si no hay Google Maps API Key o ante errores
interface VenueCalibration {
  name: string
  keywords: string[]
  distanceKm: number
  avgDurationMins: number
  address: string
}

const VENUE_FALLBACK_DATABASE: VenueCalibration[] = [
  {
    name: "Movistar Arena",
    keywords: ["movistar arena", "humboldt", "villa crespo", "corrientes 6094"],
    distanceKm: 14.5,
    avgDurationMins: 32,
    address: "Humboldt 450 / Av. Corrientes 6094, Villa Crespo, CABA"
  },
  {
    name: "Estadio River Plate (Mâs Monumental)",
    keywords: ["river", "monumental", "udaondo", "figueroa alcorta 7597", "libertador"],
    distanceKm: 9.8,
    avgDurationMins: 22,
    address: "Av. Pres. Figueroa Alcorta 7597, Núñez, CABA"
  },
  {
    name: "Estadio Vélez Sarsfield (José Amalfitani)",
    keywords: ["velez", "vélez", "amalfitani", "juan b. justo 9200", "liniers"],
    distanceKm: 16.2,
    avgDurationMins: 35,
    address: "Av. Juan B. Justo 9200, Liniers, CABA"
  },
  {
    name: "La Rural",
    keywords: ["rural", "sarmiento 2704", "palermo", "plaza italia"],
    distanceKm: 12.4,
    avgDurationMins: 28,
    address: "Av. Sarmiento 2704, Palermo, CABA"
  },
  {
    name: "Campo Argentino de Polo",
    keywords: ["polo", "dorrego", "libertador 3800"],
    distanceKm: 11.8,
    avgDurationMins: 26,
    address: "Av. del Libertador 3800, Palermo, CABA"
  },
  {
    name: "Estadio Tomás Adolfo Ducó (Huracán)",
    keywords: ["huracan", "huracán", "parque patricios", "amancio alcorta"],
    distanceKm: 22.0,
    avgDurationMins: 45,
    address: "Av. Amancio Alcorta 2544, Parque Patricios, CABA"
  },
  {
    name: "Estadio Racing Club / Independiente (Avellaneda)",
    keywords: ["racing", "cilindro", "independiente", "avellaneda", "alsina"],
    distanceKm: 25.5,
    avgDurationMins: 52,
    address: "Diego Alberto Milito 300, Avellaneda, Provincia de Buenos Aires"
  },
  {
    name: "Estadio Único Diego Armando Maradona (La Plata)",
    keywords: ["la plata", "estadio unico", "estadio único", "avenida 32"],
    distanceKm: 74.0,
    avgDurationMins: 85,
    address: "Av. 32 y 25, B1900 La Plata, Provincia de Buenos Aires"
  },
  {
    name: "Estadio Luna Park",
    keywords: ["luna park", "corrientes 283", "madero", "puerto madero"],
    distanceKm: 19.5,
    avgDurationMins: 42,
    address: "Av. Eduardo Madero 470, San Nicolás, CABA"
  }
]

/**
 * 1. Calcula el tiempo de carga en cocina:
 * Fórmula especificada: Math.ceil(totalViandas / 100) * 5 minutos.
 */
export function calculateKitchenLoadingTime(totalViandas: number): number {
  if (!totalViandas || totalViandas <= 0) return 5
  return Math.max(5, Math.ceil(totalViandas / 100) * 5)
}

/**
 * Convierte cadena "HH:MM" a minutos transcurridos desde 00:00
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 19 * 60 // 19:00 default
  const parts = timeStr.trim().split(":")
  if (parts.length < 2) return 19 * 60
  const h = parseInt(parts[0], 10) || 0
  const m = parseInt(parts[1], 10) || 0
  return (h % 24) * 60 + (m % 60)
}

/**
 * Convierte minutos desde 00:00 a cadena "HH:MM"
 */
export function minutesToTimeString(minutes: number): string {
  const norm = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(norm / 60)
  const m = norm % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * Suma minutos a una hora "HH:MM" considerando el cruce de medianoche
 */
export function addMinutesToTimeString(timeStr: string, minutesToAdd: number): string {
  const total = parseTimeToMinutes(timeStr) + minutesToAdd
  return minutesToTimeString(total)
}

/**
 * Transforma el ETA puntual calculado (ej. 20:12) en un rango estimado de 30 minutos
 * redondeado a múltiplos de 15 minutos (:00, :15, :30, :45).
 * Ejemplo:
 * - 20:12 -> 20:00 a 20:30 hs
 * - 20:25 -> 20:15 a 20:45 hs
 * - 20:38 -> 20:30 a 21:00 hs
 * - 20:52 -> 20:45 a 21:15 hs
 */
export function calculateCoordinatorTimeRange(etaTimeStr: string): {
  start: string
  end: string
  formatted: string
} {
  const totalMins = parseTimeToMinutes(etaTimeStr)
  const m = totalMins % 60
  const h = Math.floor(totalMins / 60)

  // Redondeo hacia abajo al múltiplo de 15 inferior para contener el ETA holgadamente
  const floored15 = Math.floor(m / 15) * 15
  const startMinutes = h * 60 + floored15
  const endMinutes = startMinutes + 30

  const start = minutesToTimeString(startMinutes)
  const end = minutesToTimeString(endMinutes)

  return {
    start,
    end,
    formatted: `${start} a ${end} hs`
  }
}

/**
 * Obtiene fallback calibrado de tránsito desde Munro si no se puede consultar Google Maps
 */
function getFallbackTransit(destination: string): { durationMins: number; distanceMeters: number } {
  const destLower = (destination || "").toLowerCase()
  const found = VENUE_FALLBACK_DATABASE.find(v =>
    v.keywords.some(k => destLower.includes(k)) || destLower.includes(v.name.toLowerCase())
  )

  if (found) {
    return {
      durationMins: found.avgDurationMins,
      distanceMeters: Math.round(found.distanceKm * 1000)
    }
  }

  // Genérico AMBA con tráfico de recital
  return {
    durationMins: 35,
    distanceMeters: 15500
  }
}

/**
 * Consulta la Google Maps Routes API (computeRoutes) o ejecuta el fallback inteligente
 */
export async function computeRouteGoogleOrFallback({
  originAddress,
  destinationAddress,
  travelMode = "DRIVE",
  departureIsoTimestamp
}: {
  originAddress: string
  destinationAddress: string
  travelMode?: TransitTravelMode
  departureIsoTimestamp?: string
}): Promise<{
  durationMinutes: number
  distanceMeters: number
  isRealGoogleApi: boolean
}> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim()

  if (apiKey) {
    try {
      const endpoint = "https://routes.googleapis.com/directions/v2:computeRoutes"
      const bodyPayload: Record<string, any> = {
        origin: { address: originAddress || ORIGIN_KITCHEN_ADDRESS },
        destination: { address: destinationAddress },
        travelMode: travelMode === "TWO_WHEELER" ? "TWO_WHEELER" : "DRIVE",
        routingPreference: "TRAFFIC_AWARE_OPTIMAL"
      }

      if (departureIsoTimestamp) {
        bodyPayload.departureTime = departureIsoTimestamp
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.description"
        },
        body: JSON.stringify(bodyPayload),
        cache: "no-store"
      })

      if (res.ok) {
        const json = await res.json()
        const route = json.routes?.[0]
        if (route) {
          const rawDurationSeconds = parseInt(String(route.duration || "").replace("s", ""), 10) || 0
          const durationMinutes = Math.max(5, Math.round(rawDurationSeconds / 60))
          const distanceMeters = Number(route.distanceMeters) || 0

          return {
            durationMinutes,
            distanceMeters,
            isRealGoogleApi: true
          }
        }
      } else {
        console.warn("[Google Routes API] Error response:", res.status, await res.text())
      }
    } catch (err) {
      console.warn("[Google Routes API] Fallback triggered due to error:", err)
    }
  }

  // Fallback inteligente
  const fallback = getFallbackTransit(destinationAddress)
  return {
    durationMinutes: fallback.durationMins,
    distanceMeters: fallback.distanceMeters,
    isRealGoogleApi: false
  }
}

/**
 * Genera link de navegación de Google Maps para choferes
 */
export function buildGoogleMapsDirUrl(destinationAddress: string): string {
  const clean = destinationAddress?.trim() || "CABA, Buenos Aires"
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(ORIGIN_KITCHEN_ADDRESS)}&destination=${encodeURIComponent(clean)}`
}

/**
 * Calcula el Plan Logístico completo según modalidad:
 * 1. DESPACHO_PARALELO: Todos salen juntos desde Munro
 * 2. DEDICADA_SECUENCIAL_SERGIO: Ruteo acumulativo parada por parada
 */
export async function calculateTransitPlan(
  rawStops: TransitStop[],
  kitchenCallTime: string,
  modality: TransitModality,
  dischargeMarginMinutes: number = 12,
  travelMode: TransitTravelMode = "DRIVE",
  eventDateIso: string = new Date().toISOString().split("T")[0]
): Promise<{
  loadingTimeMinutes: number
  kitchenDepartureTime: string
  totalViandas: number
  totalWater: number
  calculatedStops: TransitStop[]
}> {
  // 1. Calcular Viandas y Tiempo de Carga
  const totalViandas = rawStops.reduce((acc, s) => acc + (Number(s.viandas_count) || 0), 0)
  const totalWater = rawStops.reduce((acc, s) => acc + (Number(s.water_count) || 0), 0)
  const loadingTimeMinutes = calculateKitchenLoadingTime(totalViandas)
  const kitchenDepartureTime = addMinutesToTimeString(kitchenCallTime, loadingTimeMinutes)

  // Armar departure timestamp ISO para Google Maps
  const [depH, depM] = kitchenDepartureTime.split(":")
  const departureDate = new Date(`${eventDateIso}T${depH.padStart(2, "0")}:${depM.padStart(2, "0")}:00`)
  const departureIso = isNaN(departureDate.getTime()) ? undefined : departureDate.toISOString()

  const calculatedStops: TransitStop[] = []

  if (modality === "DESPACHO_PARALELO") {
    // --- 1. DESPACHO EN PARALELO ---
    // Cada móvil sale en simultáneo desde Munro hacia su destino
    for (let i = 0; i < rawStops.length; i++) {
      const stop = rawStops[i]
      const dest = stop.destination_address || stop.destination_name || "Buenos Aires"

      const routeResult = await computeRouteGoogleOrFallback({
        originAddress: ORIGIN_KITCHEN_ADDRESS,
        destinationAddress: dest,
        travelMode,
        departureIsoTimestamp: departureIso
      })

      const exactEta = addMinutesToTimeString(kitchenDepartureTime, routeResult.durationMinutes)
      const coordRange = calculateCoordinatorTimeRange(exactEta)

      calculatedStops.push({
        ...stop,
        stop_order: i + 1,
        distance_meters: routeResult.distanceMeters,
        duration_minutes: routeResult.durationMinutes,
        exact_eta: exactEta,
        coordinator_range_start: coordRange.start,
        coordinator_range_end: coordRange.end,
        coordinator_range_formatted: coordRange.formatted,
        google_maps_url: buildGoogleMapsDirUrl(dest)
      })
    }
  } else {
    // --- 2. DEDICADA SECUENCIAL (SERGIO) ---
    // Recorrido acumulativo: Munro -> P1 -> P2 -> ...
    let currentDepartureTime = kitchenDepartureTime
    let prevAddress = ORIGIN_KITCHEN_ADDRESS

    for (let i = 0; i < rawStops.length; i++) {
      const stop = rawStops[i]
      const dest = stop.destination_address || stop.destination_name || "Buenos Aires"

      let durationMinutes = 30
      let distanceMeters = 15000

      if (i === 0) {
        // Tramo 1: Munro -> Parada 1
        const routeResult = await computeRouteGoogleOrFallback({
          originAddress: ORIGIN_KITCHEN_ADDRESS,
          destinationAddress: dest,
          travelMode,
          departureIsoTimestamp: departureIso
        })
        durationMinutes = routeResult.durationMinutes
        distanceMeters = routeResult.distanceMeters
      } else {
        // Tramo intermedio: Parada anterior -> Parada actual
        // Si es el mismo venue o punto muy cercano
        if (
          prevAddress.toLowerCase().trim() === dest.toLowerCase().trim() ||
          (stop.destination_name && prevAddress.toLowerCase().includes(stop.destination_name.toLowerCase()))
        ) {
          durationMinutes = 8 // Traslado interno entre accesos
          distanceMeters = 1200
        } else {
          const routeResult = await computeRouteGoogleOrFallback({
            originAddress: prevAddress,
            destinationAddress: dest,
            travelMode
          })
          durationMinutes = routeResult.durationMinutes
          distanceMeters = routeResult.distanceMeters
        }
      }

      const exactEta = addMinutesToTimeString(currentDepartureTime, durationMinutes)
      const coordRange = calculateCoordinatorTimeRange(exactEta)
      const departureFromStop = addMinutesToTimeString(exactEta, dischargeMarginMinutes)

      calculatedStops.push({
        ...stop,
        stop_order: i + 1,
        distance_meters: distanceMeters,
        duration_minutes: durationMinutes,
        exact_eta: exactEta,
        coordinator_range_start: coordRange.start,
        coordinator_range_end: coordRange.end,
        coordinator_range_formatted: coordRange.formatted,
        departure_from_stop: departureFromStop,
        google_maps_url: buildGoogleMapsDirUrl(dest)
      })

      // Preparar siguiente parada
      currentDepartureTime = departureFromStop
      prevAddress = dest
    }
  }

  return {
    loadingTimeMinutes,
    kitchenDepartureTime,
    totalViandas,
    totalWater,
    calculatedStops
  }
}

/**
 * Formatea el Itinerario Logístico Oficial para copiar a WhatsApp
 */
export function formatWhatsAppItinerary({
  showName,
  eventDateStr,
  venueName,
  plan
}: {
  showName: string
  eventDateStr: string
  venueName: string
  plan: EventTransitPlan
}): string {
  const isSequential = plan.modality === "DEDICADA_SECUENCIAL_SERGIO"
  const modalityTitle = isSequential
    ? "🚐 Recorrido Secuencial Dedicado (Sergio - Furgón)"
    : "🚀 Despacho en Paralelo (Múltiples Móviles / Ubers)"

  const totalViandas = plan.stops_data.reduce((acc, s) => acc + (Number(s.viandas_count) || 0), 0)
  const totalAguas = plan.stops_data.reduce((acc, s) => acc + (Number(s.water_count) || 0), 0)

  let text = `*CRONOGRAMA LOGÍSTICO — SUPER CATERING*\n`
  text += `📅 *Evento:* ${showName} — ${eventDateStr}\n`
  text += `🏟️ *Sede:* ${venueName}\n`
  text += `⚙️ *Modalidad:* ${modalityTitle}\n`
  text += `📍 *Origen:* Cocina Munro (${ORIGIN_KITCHEN_ADDRESS})\n\n`

  text += `⏰ *TIMELINE EN COCINA:*\n`
  text += `• Citación / Inicio de carga: *${plan.kitchen_call_time} hs*\n`
  text += `• Tiempo de carga: *${plan.loading_time_minutes} min* (${totalViandas} viandas + ${totalAguas} aguas)\n`
  text += `• Salida de Munro: *${plan.kitchen_departure_time} hs*\n\n`

  text += `══════════════════════════════════\n`

  plan.stops_data.forEach((s, idx) => {
    const stopNum = idx + 1
    const prefix = isSequential ? `📍 *PARADA ${stopNum}: ${s.company_name.toUpperCase()}*` : `🚗 *MÓVIL ${stopNum} ➔ ${s.company_name.toUpperCase()}*`

    text += `${prefix}\n`
    text += `• *Entrega estimada:* ${s.coordinator_range_formatted || "A coordinar"}\n`
    if (s.delivery_point) {
      text += `• *Punto / Acceso:* ${s.delivery_point}\n`
    }
    if (s.destination_address) {
      text += `• *Dirección:* ${s.destination_address}\n`
    }
    if (s.coordinator_name) {
      text += `• *Coordinador:* ${s.coordinator_name} ${s.coordinator_phone ? `(${s.coordinator_phone})` : ""}\n`
    }
    text += `• *Carga:* ${s.viandas_count} viandas${s.water_count > 0 ? ` + ${s.water_count} aguas` : ""}\n`

    if (s.google_maps_url) {
      text += `🗺️ *Navegar con Google Maps:*\n${s.google_maps_url}\n`
    }

    if (isSequential && s.departure_from_stop && idx < plan.stops_data.length - 1) {
      text += `⏱️ _(Descarga estimada: ${plan.discharge_time_minutes} min | Salida hacia próx. parada: ${s.departure_from_stop} hs)_\n`
    }

    text += `══════════════════════════════════\n`
  })

  text += `\nℹ️ *Nota:* Los horarios de entrega contemplan el margen de tolerancia y tránsito del recital.`

  return text
}

/**
 * Formatea un mensaje individual rápido de WhatsApp para un coordinador específico
 */
export function formatCoordinatorWhatsAppMessage({
  showName,
  stop
}: {
  showName: string
  stop: TransitStop
}): string {
  const coordGreeting = stop.coordinator_name ? `Hola ${stop.coordinator_name}!` : "Hola!"

  let msg = `*SUPER CATERING — Horario de Entrega*\n\n`
  msg += `${coordGreeting} Te informamos los detalles de entrega para *${stop.company_name}* en el evento *${showName}*:\n\n`
  msg += `📦 *Entrega estimada:* ${stop.coordinator_range_formatted || "A coordinar"}\n`
  if (stop.delivery_point) {
    msg += `📍 *Punto de encuentro:* ${stop.delivery_point}\n`
  }
  if (stop.destination_address) {
    msg += `🏢 *Dirección:* ${stop.destination_address}\n`
  }
  msg += `🥪 *Carga asignada:* ${stop.viandas_count} viandas${stop.water_count > 0 ? ` + ${stop.water_count} aguas` : ""}\n\n`
  msg += `El equipo de logística ya está en camino. Cualquier duda nos avisás por este medio. ¡Buen show!`

  return msg
}
