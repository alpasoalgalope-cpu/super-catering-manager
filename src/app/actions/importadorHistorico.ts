"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Interfaces de entrada
export interface ExcelEventRow {
  fecha: string;
  mes: string;
  coordi: string;
  empresa: string;
  recital: string;
  venue: string;
  estado: string;
  paxProy: number;
  vendidos: number;
  liberados: number;
  traditional: number;
  traditionalSpecial: number;
  vegetarian: number;
  vegetarianSpecial: number;
  vegana: number;
  sinTacc: number;
  waterQty: number;
  totalAmount: number;
}

export async function importHistoricalEventsAction(rows: any[], defaultYear: number = 2026): Promise<{ success: boolean; importedCount?: number; error?: string }> {
  try {
    const supabase = createClient()

    // Helper para buscar valor dinámico por palabras clave insensibles a mayúsculas/espacios
    const findValue = (row: any, keywords: string[]): any => {
      const keys = Object.keys(row)
      for (const kw of keywords) {
        const matchedKey = keys.find(k => k.toLowerCase().replace(/\s+/g, '').includes(kw.toLowerCase().replace(/\s+/g, '')))
        if (matchedKey !== undefined) {
          return row[matchedKey]
        }
      }
      return null
    }

    // Helper para sanitizar y convertir a número
    const getNumber = (val: any): number => {
      if (val === undefined || val === null) return 0
      if (typeof val === 'number') return val
      const cleaned = String(val).replace(/[^0-9.-]/g, '')
      const num = parseFloat(cleaned)
      return isNaN(num) ? 0 : num
    }

    // Helper para parsear la fecha de Excel
    const parseExcelDate = (fechaVal: any, mesVal: any, year: number): string => {
      if (!fechaVal) return `${year}-01-01`
      
      const str = String(fechaVal).trim()
      
      // Caso 1: Ya es formato YYYY-MM-DD
      const isoRegex = /^(\d{4})-(\d{2})-(\d{2})$/
      if (isoRegex.test(str)) return str

      // Caso 2: Formato DD/MM o DD/MM/YYYY o DD-MM
      const slashMatch = str.match(/^(\d+)[/-](\d+)(?:[/-](\d+))?$/)
      if (slashMatch) {
        const d = parseInt(slashMatch[1], 10)
        const m = parseInt(slashMatch[2], 10)
        const y = slashMatch[3] ? parseInt(slashMatch[3], 10) : year
        const fullYear = y < 100 ? 2000 + y : y
        return `${fullYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }

      // Caso 3: Es solo el día (ej. "1" o "13"), buscar mes en la columna Mes
      const day = parseInt(str, 10)
      let month = 1
      if (mesVal) {
        const monthMatch = String(mesVal).match(/^(\d+)\./)
        if (monthMatch) {
          month = parseInt(monthMatch[1], 10)
        }
      }
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }

    // 1. Precargar Catálogos para evitar N queries en bucles
    const [venuesRes, coordinatorsRes, clientsRes] = await Promise.all([
      supabase.from('venues').select('id, name'),
      supabase.from('coordinators').select('id, name'),
      supabase.from('clients').select('id, name')
    ])

    if (venuesRes.error) throw venuesRes.error
    if (coordinatorsRes.error) throw coordinatorsRes.error
    if (clientsRes.error) throw clientsRes.error

    const venueMap: Record<string, string> = {}
    venuesRes.data?.forEach(v => { venueMap[v.name.trim().toLowerCase()] = v.id })

    const coordinatorMap: Record<string, string> = {}
    coordinatorsRes.data?.forEach(c => { coordinatorMap[c.name.trim().toLowerCase()] = c.id })

    const clientMap: Record<string, string> = {}
    clientsRes.data?.forEach(cl => { clientMap[cl.name.trim().toLowerCase()] = cl.id })

    let importedCount = 0

    // Procesar cada fila de Excel
    for (const row of rows) {
      const fechaRaw = findValue(row, ['fecha', 'fec', 'date', 'dia'])
      const mesRaw = findValue(row, ['mes', 'periodo', 'month'])
      const recitalRaw = findValue(row, ['recital', 'show', 'evento', 'espectaculo', 'artista'])
      const venueRaw = findValue(row, ['venue', 'lugar', 'predio', 'establecimiento', 'estadio'])
      const empresaRaw = findValue(row, ['empresa', 'cliente', 'company', 'compañia', 'compania'])
      const estadoRaw = findValue(row, ['estado', 'status', 'state'])
      
      if (!fechaRaw || !recitalRaw || !venueRaw || !empresaRaw) {
        continue // Saltarse filas vacías o inválidas
      }

      const showName = String(recitalRaw).trim()
      const venueName = String(venueRaw).trim()
      const companyName = String(empresaRaw).trim()
      const status = String(estadoRaw || 'pendiente').toLowerCase().trim()
      const eventDate = parseExcelDate(fechaRaw, mesRaw, defaultYear)

      // 2. Buscar/Crear Venue
      let venueId = venueMap[venueName.toLowerCase()]
      if (!venueId) {
        const { data: newV, error: vErr } = await supabase
          .from('venues')
          .insert({ name: venueName })
          .select('id')
          .single()
        if (vErr) {
          console.error(`Error creando venue "${venueName}":`, vErr.message)
          continue
        }
        venueId = newV.id
        venueMap[venueName.toLowerCase()] = venueId
      }

      // 3. Crear Evento Maestro
      let eventId: string | null = null
      
      // Verificar si ya existe para no duplicar
      const { data: existingEv } = await supabase
        .from('events_master')
        .select('id')
        .eq('event_date', eventDate)
        .eq('show_name', showName)
        .eq('venue_id', venueId)
        .maybeSingle()

      if (existingEv) {
        eventId = existingEv.id
      } else {
        const { data: newEv, error: evErr } = await supabase
          .from('events_master')
          .insert({
            event_date: eventDate,
            show_name: showName,
            venue_id: venueId,
            status: status
          })
          .select('id')
          .single()
        if (evErr) {
          console.error(`Error creando evento "${showName}":`, evErr.message)
          continue
        }
        eventId = newEv.id
      }

      // 5. Buscar/Crear Cliente
      let clientId = clientMap[companyName.toLowerCase()]
      let finalCompanyName = companyName

      if (clientId) {
        const dbClient = clientsRes.data?.find(c => c.id === clientId)
        if (dbClient) {
          finalCompanyName = dbClient.name
        }
      } else {
        // Buscar coincidencia case-insensitive o parcial en clientes cargados
        const matchedClientName = Object.keys(clientMap).find(k => 
          k === companyName.toLowerCase() || k.includes(companyName.toLowerCase()) || companyName.toLowerCase().includes(k)
        )
        if (matchedClientName) {
          clientId = clientMap[matchedClientName]
          const dbClient = clientsRes.data?.find(c => c.id === clientId)
          if (dbClient) {
            finalCompanyName = dbClient.name
          }
        }
      }

      if (!clientId) {
        const { data: newCl, error: clErr } = await supabase
          .from('clients')
          .insert({ name: companyName })
          .select('id')
          .single()
        if (clErr) {
          console.error(`Error creando cliente "${companyName}":`, clErr.message)
        } else if (newCl) {
          clientId = newCl.id
          clientMap[companyName.toLowerCase()] = clientId
          finalCompanyName = companyName
        }
      }

      // 4. Crear Proyección
      const paxProjected = getNumber(findValue(row, ['paxproy', 'pax_proy', 'paxestimado']))
      const { error: projErr } = await supabase
        .from('event_projections')
        .upsert({
          event_id: eventId,
          company_name: finalCompanyName,
          projected_pax: paxProjected
        }, { onConflict: 'event_id,company_name' })
      if (projErr) {
        console.error(`Error creando proyección para "${finalCompanyName}":`, projErr.message)
      }

      // 6. Procesar múltiples coordinadores y crear micros
      const coordiRaw = findValue(row, ['coordi', 'coordinador', 'coodi', 'coordinadores'])
      const coordinatorsList = coordiRaw
        ? String(coordiRaw)
            .split(/ - |,|\s+y\s+/i)
            .map(name => name.trim())
            .filter(Boolean)
        : []

      let singleCoordinatorId: string | null = null

      if (coordinatorsList.length > 0 && clientId) {
        // Eliminar asignaciones viejas de micros para este evento y cliente (limpieza previa)
        await supabase
          .from('event_bus_assignments')
          .delete()
          .eq('event_id', eventId)
          .eq('client_id', clientId)

        for (let idx = 0; idx < coordinatorsList.length; idx++) {
          const coordName = coordinatorsList[idx]
          let coordId = coordinatorMap[coordName.toLowerCase()]

          // Si no existe, buscar coincidencia parcial en legajos locales
          if (!coordId) {
            const matchedName = Object.keys(coordinatorMap).find(k => 
              k.includes(coordName.toLowerCase()) || coordName.toLowerCase().includes(k)
            )
            if (matchedName) {
              coordId = coordinatorMap[matchedName]
            }
          }

          // Si sigue sin existir, insertar coordinador nuevo en base de datos
          if (!coordId) {
            const { data: newCoord, error: coErr } = await supabase
              .from('coordinators')
              .insert({
                name: coordName,
                company: companyName,
                phone: "+54 9 0000 00-0000" // Placeholder
              })
              .select('id')
              .single()
            if (coErr) {
              console.error(`Error creando coordinador "${coordName}":`, coErr.message)
            } else if (newCoord) {
              coordId = newCoord.id
              coordinatorMap[coordName.toLowerCase()] = coordId
            }
          }

          // Insertar asignación del micro (sin unit_name ya que no existe en el esquema de Supabase)
          if (coordId) {
            const { error: busInsertErr } = await supabase
              .from('event_bus_assignments')
              .insert({
                event_id: eventId,
                client_id: clientId,
                coordinator_id: coordId,
                crew_count: 0
              })
            
            if (busInsertErr) {
              console.error(`Error insertando asignación de micro para el coordinador "${coordName}":`, busInsertErr.message)
            }
            
            // Si hay un único coordinador, guardamos su ID para las ventas
            if (coordinatorsList.length === 1) {
              singleCoordinatorId = coordId
            }
          }
        }
      }

      // 7. Cargar ventas y desglose (Tradicional Esp y Vegetariano Especial se suman a sus respectivas categorías principales)
      const totalAmount = getNumber(findValue(row, ['venta', 'totalventa', 'monto', 'importe']))
      let headerId: string | null = null
      
      const { data: existingHeader, error: findHeaderErr } = await supabase
        .from('event_sales_headers')
        .select('id')
        .eq('event_master_id', eventId)
        .eq('company_name', finalCompanyName)
        .maybeSingle()

      if (findHeaderErr) {
        console.error(`Error buscando cabecera de ventas para el show "${showName}":`, findHeaderErr.message)
        continue
      }

      if (existingHeader) {
        headerId = existingHeader.id
        const { error: updateHeaderErr } = await supabase
          .from('event_sales_headers')
          .update({
            company: finalCompanyName,
            company_name: finalCompanyName,
            total_amount: totalAmount,
            pax_projected: paxProjected,
            event_date: eventDate,
            venue: venueName,
            coordinator_name: coordinatorsList[0] || null
          })
          .eq('id', headerId)

        if (updateHeaderErr) {
          console.error(`Error actualizando cabecera de ventas para el show "${showName}":`, updateHeaderErr.message)
          continue
        }
      } else {
        const { data: newHeader, error: insertHeaderErr } = await supabase
          .from('event_sales_headers')
          .insert({
            event_master_id: eventId,
            event_id: eventId,
            company: finalCompanyName,
            company_name: finalCompanyName,
            total_amount: totalAmount,
            pax_projected: paxProjected,
            event_date: eventDate,
            venue: venueName,
            coordinator_name: coordinatorsList[0] || null
          })
          .select('id')
          .single()

        if (insertHeaderErr) {
          console.error(`Error creando cabecera de ventas para el show "${showName}":`, insertHeaderErr.message)
          continue
        }
        headerId = newHeader.id
      }

      // Sumar tradicionales especiales a tradicionales
      const tradBase = getNumber(findValue(row, ['traditional', 'tradicional', 'trad']))
      const tradSpec = getNumber(findValue(row, ['tradesp', 'tradicionalesp', 'tradicionalespecial', 'tradespecial']))
      const tradTotal = tradBase + tradSpec

      // Sumar vegetarianos especiales a vegetarianos
      const vegBase = getNumber(findValue(row, ['veggie', 'vegetariano', 'vegetariana', 'veg', 'vegetarian']))
      const vegSpec = getNumber(findValue(row, ['veggieesp', 'vegetarianoesp', 'vegetarianoespecial', 'vegetarianospecial', 'veggiespecial']))
      const vegTotal = vegBase + vegSpec

      const soldQty = getNumber(findValue(row, ['vendidos', 'vendido', 'cantvendida', 'sold']))
      const liberatedQty = getNumber(findValue(row, ['liberados', 'liberado', 'cantliberada', 'free']))
      const veganaQty = getNumber(findValue(row, ['veganas', 'vegana', 'vegano', 'vegan']))
      const sinTaccQty = getNumber(findValue(row, ['sintacc', 'tacc', 'celiaco', 'sin gluten', 'sintac']))
      const waterQty = getNumber(findValue(row, ['aguassingas', 'aguas', 'agua', 'water']))

      // Limpiar unidades de ventas anteriores para esta cabecera
      await supabase
        .from('event_sales_units')
        .delete()
        .eq('header_id', headerId)

      // Insertar unidades detalladas nuevas
      const { error: insertUnitsErr } = await supabase
        .from('event_sales_units')
        .insert({
          header_id: headerId,
          unit_name: 'Micro 1',
          sold_qty: soldQty,
          liberated_qty: liberatedQty,
          traditional: tradTotal,
          vegetarian: vegTotal,
          vegana: veganaQty,
          sin_tacc: sinTaccQty,
          water_qty: waterQty,
          coordinator_id: singleCoordinatorId
        })

      if (insertUnitsErr) {
        console.error(`Error creando unidades detalladas para el show "${showName}":`, insertUnitsErr.message)
        continue
      }

      importedCount++
    }

    revalidatePath("/settings/eventos")
    revalidatePath("/ventas-evento")
    revalidatePath("/informes")
    return { success: true, importedCount }
  } catch (err: any) {
    console.error("Error importando eventos históricos:", err)
    return { success: false, error: err.message || "Error al procesar el archivo Excel." }
  }
}
