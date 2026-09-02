/**
 * Intelligent Routing Engine for Super Catering Manager
 * Optimizes the sequence of bus deliveries based on coordinates (lat/lng)
 * using Nearest Neighbor TSP algorithm, and generates Waze & Google Maps deeplinks.
 */

export interface GeoPoint {
  lat: number
  lng: number
  id: string
  label?: string
}

/**
 * Calculates Great-Circle Distance between two coordinates in meters (Haversine formula)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

/**
 * Sequences a list of stops to minimize driving distance starting from an origin point.
 */
export function optimizeRouteSequence<T extends { id: string; location_lat: number | null; location_lng: number | null }>(
  origin: { lat: number; lng: number },
  stops: T[]
): Array<T & { route_order: number; distance_from_prev_meters: number }> {
  // Separate stops with valid GPS coordinates from those without
  const validStops = stops.filter(s => s.location_lat !== null && s.location_lng !== null)
  const pendingGpsStops = stops.filter(s => s.location_lat === null || s.location_lng === null)

  const sequenced: Array<T & { route_order: number; distance_from_prev_meters: number }> = []
  let currentPos = { lat: origin.lat, lng: origin.lng }
  const remaining = [...validStops]

  let orderIndex = 1

  while (remaining.length > 0) {
    let nearestIndex = 0
    let minDistance = Infinity

    for (let i = 0; i < remaining.length; i++) {
      const stop = remaining[i]
      const dist = calculateHaversineDistance(
        currentPos.lat,
        currentPos.lng,
        stop.location_lat!,
        stop.location_lng!
      )
      if (dist < minDistance) {
        minDistance = dist
        nearestIndex = i
      }
    }

    const nextStop = remaining.splice(nearestIndex, 1)[0]
    sequenced.push({
      ...nextStop,
      route_order: orderIndex++,
      distance_from_prev_meters: minDistance === Infinity ? 0 : minDistance
    })

    currentPos = { lat: nextStop.location_lat!, lng: nextStop.location_lng! }
  }

  // Append any stops that have not yet sent GPS at the end of the route
  pendingGpsStops.forEach(s => {
    sequenced.push({
      ...s,
      route_order: orderIndex++,
      distance_from_prev_meters: 0
    })
  })

  return sequenced
}

/**
 * Generates Navigation Deeplinks for mobile devices
 */
export function getNavigationLinks(lat: number, lng: number, label?: string) {
  const cleanLat = lat.toFixed(7)
  const cleanLng = lng.toFixed(7)
  const encodedLabel = encodeURIComponent(label || 'Parada Catering')

  return {
    waze: `https://waze.com/ul?ll=${cleanLat},${cleanLng}&navigate=yes`,
    wazeApp: `waze://?ll=${cleanLat},${cleanLng}&navigate=yes`,
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${cleanLat},${cleanLng}&destination_place_id=${encodedLabel}`,
    googleMapsApp: `geo:${cleanLat},${cleanLng}?q=${cleanLat},${cleanLng}(${encodedLabel})`,
    appleMaps: `maps://?daddr=${cleanLat},${cleanLng}&q=${encodedLabel}`
  }
}
