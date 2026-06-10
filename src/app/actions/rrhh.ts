"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Interfaces de datos
export interface EmployeeProfile {
  id: string;
  nombre_completo: string;
  rol: 'admin' | 'cocina' | 'empleado';
  id_reloj: string | null;
  fecha_ingreso: string;
  dni_url: string | null;
  estado_laboral: 'en_blanco' | 'no_registrado';
  vencimiento_libreta_sanitaria: string | null;
  created_at?: string;
  dni: string | null;
  telefono: string | null;
  domicilio: string | null;
}

export interface ClockIn {
  id: string;
  profile_id: string;
  id_reloj: string;
  timestamp: string;
}

export interface Incidencia {
  id: string;
  profile_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  tipo: 'ausencia' | 'carpeta_medica' | 'llegada_tarde' | 'franco';
  descripcion: string | null;
}

export interface ReciboSueldo {
  id: string;
  profile_id: string;
  periodo: string;
  archivo_url: string;
  created_at?: string;
}

export interface VacacionesSaldo {
  id: string;
  profile_id: string;
  anio: number;
  dias_totales: number;
  dias_usados: number;
}

export interface VacacionesSolicitud {
  id: string;
  profile_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  motivo: string | null;
  created_at?: string;
  profiles?: {
    nombre_completo: string;
  };
}

export interface ValeAdelanto {
  id: string;
  profile_id: string;
  fecha: string;
  monto: number;
  concepto: string;
}

export interface EntregaUniforme {
  id: string;
  profile_id: string;
  fecha: string;
  detalle: string;
}

export interface DailyAttendance {
  date: string;
  dayName: string;
  entrada: string | null;
  salida: string | null;
  horasNetas: number;
  status: 'completo' | 'falta_salida' | 'falta' | 'incidencia';
  incidenciaTipo?: string;
  incidenciaDesc?: string;
}

// ------------------------------------------------------------
// 1. CARGA MASIVA DE PRESENTISMO
// ------------------------------------------------------------

export async function importClockInsAction(fileContent: string): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const supabase = createClient()

    // Fetch perfiles para mapear id_reloj -> profile_id
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, id_reloj')

    if (pErr) throw pErr
    if (!profiles || profiles.length === 0) {
      return { success: false, error: "No hay empleados registrados en el sistema." }
    }

    // Armar mapa de correspondencia (soporta coincidencia exacta y numérica por ceros de relleno)
    const profileMap: Record<string, string> = {}
    profiles.forEach(p => {
      if (p.id_reloj) {
        const key = p.id_reloj.trim()
        profileMap[key] = p.id
        const numVal = parseInt(key, 10)
        if (!isNaN(numVal)) {
          profileMap[String(numVal)] = p.id
        }
      }
    })

    const lines = fileContent.split(/\r?\n/)
    const dataToInsert: Array<{ profile_id: string; id_reloj: string; timestamp: string }> = []

    // Expresión Regular obligatoria para el formato real de 6 columnas:
    // Línea ej: "000002    1    000000004    caro                001    2026/03/02  10:47:06"
    const lineRegex = /^(\S+)\s+(\S+)\s+(\S+)\s+(.+?)\s+(\S+)\s+(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})$/

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Omitir fila de encabezado
      if (trimmed.toLowerCase().includes('userid') || trimmed.toLowerCase().includes('fecha')) {
        continue
      }

      const match = trimmed.match(lineRegex)
      if (!match) continue

      const idRelojRaw = match[3].trim()
      const dateRaw = match[6].trim()
      const timeRaw = match[7].trim()

      // Resolver ID del empleado
      let profileId = profileMap[idRelojRaw]
      if (!profileId) {
        const numVal = parseInt(idRelojRaw, 10)
        if (!isNaN(numVal)) {
          profileId = profileMap[String(numVal)]
        }
      }

      if (!profileId) continue // Empleado no registrado, ignorar

      // Adaptar separadores de fecha: reemplazar / por -
      const dateFormatted = dateRaw.replace(/\//g, '-')
      
      // Concatenar como timestamp ISO sin zona horaria
      const timestampISO = `${dateFormatted}T${timeRaw}`

      dataToInsert.push({
        profile_id: profileId,
        id_reloj: idRelojRaw,
        timestamp: timestampISO
      })
    }

    if (dataToInsert.length === 0) {
      return { success: true, count: 0 }
    }

    // Guardar usando upsert para ignorar duplicados (ON CONFLICT DO NOTHING)
    const { error: insertErr } = await supabase
      .from('clock_ins')
      .upsert(dataToInsert, { onConflict: 'id_reloj,timestamp', ignoreDuplicates: true })

    if (insertErr) throw insertErr

    revalidatePath("/rrhh")
    revalidatePath("/rrhh/portal")
    return { success: true, count: dataToInsert.length }
  } catch (err: any) {
    console.error("Error importando fichadas:", err)
    return { success: false, error: err.message || "Error al procesar el archivo." }
  }
}

// ------------------------------------------------------------
// 2. REPORTES DE ASISTENCIA Y PRESENTISMO CONTINUO
// ------------------------------------------------------------

export async function getAttendanceReportAction(month: string, profileId?: string): Promise<{ data?: DailyAttendance[]; error?: string }> {
  try {
    const supabase = createClient()

    let targetId = profileId
    if (!targetId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { error: "No autenticado" }
      targetId = user.id
    }

    // Validar formato YYYY-MM
    const monthRegex = /^\d{4}-\d{2}$/
    if (!monthRegex.test(month)) {
      return { error: "Periodo inválido. Debe ser YYYY-MM" }
    }

    const [yearStr, monthStr] = month.split('-')
    const year = parseInt(yearStr, 10)
    const monthNum = parseInt(monthStr, 10)

    // Determinar cantidad de días del mes en hora local
    const startDate = `${month}-01`
    const lastDay = new Date(year, monthNum, 0).getDate()
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`

    // 1. Obtener fichadas en el periodo (se cargaron como TIMESTAMP WITHOUT TIME ZONE)
    const { data: clockIns, error: cErr } = await supabase
      .from('clock_ins')
      .select('timestamp')
      .eq('profile_id', targetId)
      .gte('timestamp', `${startDate}T00:00:00`)
      .lte('timestamp', `${endDate}T23:59:59`)

    if (cErr) throw cErr

    // 2. Obtener incidencias que solapen con el mes
    const { data: incidencias, error: iErr } = await supabase
      .from('incidencias')
      .select('*')
      .eq('profile_id', targetId)
      .filter('fecha_inicio', 'lte', endDate)
      .filter('fecha_fin', 'gte', startDate)

    if (iErr) throw iErr

    // Agrupar fichadas por fecha de forma literal
    const clockInsByDate: Record<string, string[]> = {}
    clockIns?.forEach(c => {
      const parts = c.timestamp.split('T')
      const datePart = parts[0] // "YYYY-MM-DD"
      const timePart = parts[1] ? parts[1].substring(0, 5) : "" // "HH:MM"
      if (!clockInsByDate[datePart]) {
        clockInsByDate[datePart] = []
      }
      if (timePart) clockInsByDate[datePart].push(timePart)
    })

    const daysList: DailyAttendance[] = []
    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

    // Generar días en orden cronológico descendente (desde el último del mes hasta el primero)
    for (let day = lastDay; day >= 1; day--) {
      const currentDayStr = String(day).padStart(2, '0')
      const fullDateStr = `${month}-${currentDayStr}`
      
      const dateObj = new Date(year, monthNum - 1, day)
      const dayName = diasSemana[dateObj.getDay()]

      const times = clockInsByDate[fullDateStr] || []
      times.sort() // Ordenar horas ascendente de forma literal

      let entrada: string | null = null
      let salida: string | null = null
      let horasNetas = 0
      let status: 'completo' | 'falta_salida' | 'falta' | 'incidencia' = 'falta'
      let incidenciaTipo: string | undefined
      let incidenciaDesc: string | undefined

      if (times.length > 0) {
        entrada = times[0]
        if (times.length === 1) {
          salida = null
          status = 'falta_salida'
          horasNetas = 0
        } else {
          salida = times[times.length - 1]
          status = 'completo'
          
          // Cálculo literal
          const [hEnt, mEnt] = entrada.split(':').map(Number)
          const [hSal, mSal] = salida.split(':').map(Number)
          const entMin = hEnt * 60 + mEnt
          const salMin = hSal * 60 + mSal
          const diffHrs = (salMin - entMin) / 60
          horasNetas = Math.round(diffHrs * 10) / 10
        }
      } else {
        // Verificar incidencias
        const matchedInc = incidencias?.find(inc => 
          fullDateStr >= inc.fecha_inicio && fullDateStr <= inc.fecha_fin
        )

        if (matchedInc) {
          status = 'incidencia'
          incidenciaTipo = matchedInc.tipo
          incidenciaDesc = matchedInc.descripcion || ""
        } else {
          status = 'falta'
        }
      }

      daysList.push({
        date: fullDateStr,
        dayName,
        entrada,
        salida,
        horasNetas,
        status,
        incidenciaTipo,
        incidenciaDesc
      })
    }

    return { data: daysList }
  } catch (err: any) {
    console.error("Error en reporte de presentismo:", err)
    return { error: err.message || "Error al obtener reporte de presentismo." }
  }
}

// ------------------------------------------------------------
// 3. GESTIÓN DE PERFILES DE EMPLEADOS
// ------------------------------------------------------------

export async function getEmployeesListAction(): Promise<{ data?: EmployeeProfile[]; error?: string }> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('nombre_completo', { ascending: true })

    if (error) throw error
    return { data: data as EmployeeProfile[] }
  } catch (err: any) {
    return { error: err.message || "Error al obtener la lista de empleados." }
  }
}

export async function getEmployeeProfileByIdAction(id?: string): Promise<{ data?: EmployeeProfile; error?: string }> {
  try {
    const supabase = createClient()
    let targetId = id
    if (!targetId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { error: "No autenticado" }
      targetId = user.id
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .single()

    if (error) throw error
    return { data: data as EmployeeProfile }
  } catch (err: any) {
    return { error: err.message || "Error al obtener perfil del empleado." }
  }
}

export async function crearPerfilAction(profile: Omit<EmployeeProfile, 'created_at'>): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .insert(profile)

    if (error) throw error
    revalidatePath("/rrhh")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function actualizarPerfilAction(id: string, data: Partial<EmployeeProfile>): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', id)

    if (error) throw error
    revalidatePath("/rrhh")
    revalidatePath("/rrhh/portal")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function crearEmpleadoAction(params: {
  email: string
  pass: string
  nombre: string
  rol: string
  idReloj?: string
  fechaIngreso: string
  estadoLaboral: string
  vencimientoLibreta?: string
  dni?: string
  telefono?: string
  domicilio?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase.rpc('crear_empleado_completo', {
      p_email: params.email,
      p_password: params.pass,
      p_nombre_completo: params.nombre,
      p_rol: params.rol,
      p_id_reloj: params.idReloj || null,
      p_fecha_ingreso: params.fechaIngreso,
      p_estado_laboral: params.estadoLaboral,
      p_vencimiento_libreta: params.vencimientoLibreta || null,
      p_dni: params.dni || null,
      p_telefono: params.telefono || null,
      p_domicilio: params.domicilio || null
    })

    if (error) throw error
    revalidatePath("/rrhh")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function eliminarEmpleadoAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase.rpc('eliminar_empleado', {
      p_id: id
    })

    if (error) throw error
    revalidatePath("/rrhh")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}


// ------------------------------------------------------------
// 4. LÓGICA DE VACACIONES
// ------------------------------------------------------------

export async function getEmployeeSaldosAction(profileId?: string): Promise<{ data?: VacacionesSaldo[]; error?: string }> {
  try {
    const supabase = createClient()
    let targetId = profileId
    if (!targetId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { error: "No autenticado" }
      targetId = user.id
    }

    const { data, error } = await supabase
      .from('vacaciones_saldos')
      .select('*')
      .eq('profile_id', targetId)
      .order('anio', { ascending: false })

    if (error) throw error
    return { data: data as VacacionesSaldo[] }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function getEmployeeSolicitudesAction(profileId?: string): Promise<{ data?: VacacionesSolicitud[]; error?: string }> {
  try {
    const supabase = createClient()
    let targetId = profileId
    if (!targetId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { error: "No autenticado" }
      targetId = user.id
    }

    const { data, error } = await supabase
      .from('vacaciones_solicitudes')
      .select('*')
      .eq('profile_id', targetId)
      .order('fecha_inicio', { ascending: false })

    if (error) throw error
    return { data: data as VacacionesSolicitud[] }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function getTodasSolicitudesVacacionesAction(): Promise<{ data?: VacacionesSolicitud[]; error?: string }> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('vacaciones_solicitudes')
      .select('*, profiles(nombre_completo)')
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data: data as VacacionesSolicitud[] }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function solicitarVacacionesAction(startDate: string, endDate: string, motivo: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "No autenticado." }

    const { error } = await supabase
      .from('vacaciones_solicitudes')
      .insert({
        profile_id: user.id,
        fecha_inicio: startDate,
        fecha_fin: endDate,
        motivo,
        estado: 'pendiente'
      })

    if (error) throw error
    revalidatePath("/rrhh/portal")
    revalidatePath("/rrhh")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function aprobarVacacionesAction(solicitudId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    // Llamar a la función transaccional de Supabase RPC
    const { error } = await supabase.rpc('aprobar_vacaciones_gastro', { solicitud_id: solicitudId })
    if (error) throw error
    
    revalidatePath("/rrhh")
    revalidatePath("/rrhh/portal")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Error al aprobar la solicitud." }
  }
}

export async function rechazarVacacionesAction(solicitudId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('vacaciones_solicitudes')
      .update({ estado: 'rechazado' })
      .eq('id', solicitudId)

    if (error) throw error
    revalidatePath("/rrhh")
    revalidatePath("/rrhh/portal")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ------------------------------------------------------------
// 5. RECIBOS DE SUELDO
// ------------------------------------------------------------

export async function getEmployeeRecibosAction(profileId?: string): Promise<{ data?: ReciboSueldo[]; error?: string }> {
  try {
    const supabase = createClient()
    let targetId = profileId
    if (!targetId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { error: "No autenticado" }
      targetId = user.id
    }

    const { data, error } = await supabase
      .from('recibos_sueldo')
      .select('*')
      .eq('profile_id', targetId)
      .order('periodo', { ascending: false })

    if (error) throw error
    return { data: data as ReciboSueldo[] }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function subirReciboAction(profileId: string, periodo: string, fileUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('recibos_sueldo')
      .upsert({
        profile_id: profileId,
        periodo,
        archivo_url: fileUrl
      }, { onConflict: 'profile_id,periodo' })

    if (error) throw error
    revalidatePath("/rrhh")
    revalidatePath("/rrhh/portal")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function eliminarReciboAction(reciboId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('recibos_sueldo')
      .delete()
      .eq('id', reciboId)

    if (error) throw error
    revalidatePath("/rrhh")
    revalidatePath("/rrhh/portal")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ------------------------------------------------------------
// 6. EXTRAS (VALES E INDUMENTARIA)
// ------------------------------------------------------------

export async function getEmployeeExtrasAction(profileId?: string): Promise<{ vales?: ValeAdelanto[]; uniformes?: EntregaUniforme[]; error?: string }> {
  try {
    const supabase = createClient()
    let targetId = profileId
    if (!targetId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { error: "No autenticado" }
      targetId = user.id
    }

    const [valesRes, uniformesRes] = await Promise.all([
      supabase.from('vales_adelantos').select('*').eq('profile_id', targetId).order('fecha', { ascending: false }),
      supabase.from('entrega_uniformes').select('*').eq('profile_id', targetId).order('fecha', { ascending: false })
    ])

    if (valesRes.error) throw valesRes.error
    if (uniformesRes.error) throw uniformesRes.error

    return {
      vales: valesRes.data as ValeAdelanto[],
      uniformes: uniformesRes.data as EntregaUniforme[]
    }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function crearValeAction(profileId: string, monto: number, concepto: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('vales_adelantos')
      .insert({
        profile_id: profileId,
        monto,
        concepto
      })

    if (error) throw error
    revalidatePath("/rrhh")
    revalidatePath("/rrhh/portal")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function crearUniformeAction(profileId: string, detalle: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('entrega_uniformes')
      .insert({
        profile_id: profileId,
        detalle
      })

    if (error) throw error
    revalidatePath("/rrhh")
    revalidatePath("/rrhh/portal")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ------------------------------------------------------------
// 7. GESTIÓN DE INCIDENCIAS
// ------------------------------------------------------------

export async function crearIncidenciaAction(profileId: string, fechaInicio: string, fechaFin: string, tipo: 'ausencia' | 'carpeta_medica' | 'llegada_tarde' | 'franco', descripcion: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('incidencias')
      .insert({
        profile_id: profileId,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tipo,
        descripcion
      })

    if (error) throw error
    revalidatePath("/rrhh")
    revalidatePath("/rrhh/portal")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function getEmployeeIncidenciasAction(profileId?: string): Promise<{ data?: Incidencia[]; error?: string }> {
  try {
    const supabase = createClient()
    let targetId = profileId
    if (!targetId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { error: "No autenticado" }
      targetId = user.id
    }

    const { data, error } = await supabase
      .from('incidencias')
      .select('*')
      .eq('profile_id', targetId)
      .order('fecha_inicio', { ascending: false })

    if (error) throw error
    return { data: data as Incidencia[] }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function crearSaldoVacacionesAction(profileId: string, anio: number, diasTotales: number): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('vacaciones_saldos')
      .insert({
        profile_id: profileId,
        anio,
        dias_totales: diasTotales,
        dias_usados: 0
      })

    if (error) throw error
    revalidatePath("/rrhh")
    revalidatePath("/rrhh/portal")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
