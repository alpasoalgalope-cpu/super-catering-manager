"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { 
  getEmployeeProfileByIdAction, 
  getAttendanceReportAction, 
  getEmployeeSaldosAction, 
  getEmployeeSolicitudesAction, 
  getEmployeeRecibosAction, 
  getEmployeeExtrasAction, 
  solicitarVacacionesAction,
  subirDocumentoLegajoAction,
  getEmployeeLegajosAction,
  crearIncidenciaAction,
  EmployeeProfile, 
  DailyAttendance, 
  VacacionesSaldo, 
  VacacionesSolicitud, 
  ReciboSueldo, 
  ValeAdelanto, 
  EntregaUniforme,
  LegajoDocumento
} from "@/app/actions/rrhh"
import { 
  CalendarDays, Download, Calendar, ShieldAlert, Award, FileSpreadsheet, 
  CreditCard, Shirt, AlertCircle, Loader2, ArrowRight, UserCheck, Users, LayoutDashboard,
  FileText, UploadCloud, Plus, ExternalLink
} from "lucide-react"

export default function EmployeePortalPage() {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [attendance, setAttendance] = useState<DailyAttendance[]>([])
  const [saldos, setSaldos] = useState<VacacionesSaldo[]>([])
  const [solicitudes, setSolicitudes] = useState<VacacionesSolicitud[]>([])
  const [recibos, setRecibos] = useState<ReciboSueldo[]>([])
  const [vales, setVales] = useState<ValeAdelanto[]>([])
  const [uniformes, setUniformes] = useState<EntregaUniforme[]>([])
  const [legajos, setLegajos] = useState<LegajoDocumento[]>([])
  
  // Mes seleccionado para el presentismo (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Formulario de certificado médico
  const [showCertModal, setShowCertModal] = useState(false)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [certTitulo, setCertTitulo] = useState("")
  const [certFechaInicio, setCertFechaInicio] = useState("")
  const [certFechaFin, setCertFechaFin] = useState("")
  const [uploadingCert, setUploadingCert] = useState(false)

  // Formulario de solicitud de vacaciones
  const [vacStart, setVacStart] = useState("")
  const [vacEnd, setVacEnd] = useState("")
  const [vacMotivo, setVacMotivo] = useState("")
  const [sendingRequest, setSendingRequest] = useState(false)

  // Inicialización de mes actual
  useEffect(() => {
    const now = new Date()
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(currentKey)
  }, [])

  useEffect(() => {
    if (selectedMonth) {
      loadProfileAndData()
    }
  }, [selectedMonth])

  async function loadProfileAndData() {
    if (!selectedMonth) return
    
    // Si es la primera carga, encendemos el loader general
    if (!profile) setLoading(true)
    else setLoadingAttendance(true)

    setError(null)
    
    try {
      const profRes = await getEmployeeProfileByIdAction()
      if (profRes.error) {
        setError(profRes.error)
        setLoading(false)
        setLoadingAttendance(false)
        return
      }

      if (profRes.data) {
        const emp = profRes.data
        setProfile(emp)

        // Cargas paralelas para el empleado
        const [attRes, saldosRes, solRes, recibosRes, extrasRes, legajosRes] = await Promise.all([
          getAttendanceReportAction(selectedMonth, emp.id),
          getEmployeeSaldosAction(emp.id),
          getEmployeeSolicitudesAction(emp.id),
          getEmployeeRecibosAction(emp.id),
          getEmployeeExtrasAction(emp.id),
          getEmployeeLegajosAction(emp.id)
        ])

        if (attRes.data) setAttendance(attRes.data)
        if (saldosRes.data) setSaldos(saldosRes.data)
        if (solRes.data) setSolicitudes(solRes.data)
        if (recibosRes.data) setRecibos(recibosRes.data)
        if (extrasRes.vales) setVales(extrasRes.vales)
        if (extrasRes.uniformes) setUniformes(extrasRes.uniformes)
        if (legajosRes.data) setLegajos(legajosRes.data)
      }
    } catch (err: any) {
      setError(err.message || "Error al cargar la información del portal.")
    } finally {
      setLoading(false)
      setLoadingAttendance(false)
    }
  }

  // Subir Certificado Médico a Google Drive
  const handleSubmitCertificado = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !certFile || !certFechaInicio || !certFechaFin) {
      alert("Por favor completa los campos y selecciona la foto o PDF del certificado.")
      return
    }

    setUploadingCert(true)

    const formData = new FormData()
    formData.append('file', certFile)
    formData.append('profileId', profile.id)
    formData.append('employeeName', profile.nombre_completo)
    formData.append('tipo', 'certificado_medico')
    formData.append('titulo', certTitulo || `Certificado Médico (${certFechaInicio} al ${certFechaFin})`)
    formData.append('periodo', `${certFechaInicio} al ${certFechaFin}`)

    const res = await subirDocumentoLegajoAction(formData)

    if (res.success) {
      // Registrar incidencia automática como carpeta médica
      await crearIncidenciaAction(
        profile.id,
        certFechaInicio,
        certFechaFin,
        'carpeta_medica',
        `Certificado Médico: ${certTitulo || 'Presentado por el empleado'} - Comprobante: ${res.url}`
      )

      setShowCertModal(false)
      setCertFile(null)
      setCertTitulo("")
      setCertFechaInicio("")
      setCertFechaFin("")
      alert("Certificado médico subido con éxito y notificado a RRHH.")
      loadProfileAndData()
    } else {
      alert(`Error al subir certificado: ${res.error}`)
    }

    setUploadingCert(false)
  }

  // Enviar solicitud de vacaciones
  const handleSubmitVacation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vacStart || !vacEnd) return
    setSendingRequest(true)

    const res = await solicitarVacacionesAction(vacStart, vacEnd, vacMotivo)
    if (res.success) {
      alert("Solicitud de vacaciones enviada con éxito.")
      setVacStart("")
      setVacEnd("")
      setVacMotivo("")
      // Recargar datos
      loadProfileAndData()
    } else {
      alert(`Error al enviar la solicitud: ${res.error}`)
    }
    setSendingRequest(false)
  }

  // Cómputo de antigüedad
  const getAntiguedad = (fechaIngreso: string) => {
    const start = new Date(fechaIngreso)
    const now = new Date()
    let years = now.getFullYear() - start.getFullYear()
    let months = now.getMonth() - start.getMonth()
    if (months < 0 || (months === 0 && now.getDate() < start.getDate())) {
      years--
      months += 12
    }
    return `${years} años y ${months} meses`
  }

  // Determinar color de alerta de Libreta Sanitaria
  const getLibretaColor = (vencimiento: string | null) => {
    if (!vencimiento) return 'text-slate-400 bg-slate-50 border-slate-200'
    const limit = new Date()
    limit.setDate(limit.getDate() + 30) // Próximos 30 días
    const vencDate = new Date(vencimiento)
    const today = new Date()
    if (vencDate < today) return 'text-rose-600 bg-rose-50 border-rose-100' // Vencida
    if (vencDate <= limit) return 'text-amber-600 bg-amber-50 border-amber-100' // Por vencer
    return 'text-emerald-600 bg-emerald-50 border-emerald-100' // OK
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p className="font-bold tracking-widest uppercase text-sm italic">Cargando mi portal personal...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-rose-50 border border-rose-100 text-rose-600 rounded-3xl font-bold flex items-center gap-3">
        <AlertCircle size={24} className="flex-shrink-0" />
        <span>{error}</span>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto py-16 px-6 text-center space-y-6">
        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
          <Users size={36} />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tight">
            Portal de Empleado no Vinculado
          </h2>
          <p className="text-slate-500 text-sm font-medium">
            Tu usuario actual no tiene un legajo de empleado asociado en la base de datos de RRHH.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-left text-xs font-medium text-slate-600 space-y-3">
          <p className="font-bold text-slate-700">
            📌 ¿Qué debes hacer según tu rol?
          </p>
          <ul className="space-y-2 list-disc pl-4 text-slate-600">
            <li>
              <strong>Si eres Administrador:</strong> Puedes crear y gestionar los legajos de los empleados desde el panel central.
            </li>
            <li>
              <strong>Si eres Empleado:</strong> Solicita al responsable de RRHH o administración que cree tu cuenta desde el Panel de RRHH.
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/rrhh"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-md shadow-indigo-100"
          >
            <Users size={16} /> Ir al Panel Admin de RRHH
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition"
          >
            <LayoutDashboard size={16} /> Ir al Inicio
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tighter uppercase italic flex items-center gap-3">
            Mi Portal de <span className="text-indigo-600">Recursos Humanos</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium italic">Acceso personal a tu legajo, presentismo, recibos y solicitudes.</p>
        </div>

        <button
          onClick={() => setShowCertModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider py-3.5 px-5 rounded-2xl shadow-md shadow-indigo-100 flex items-center gap-2 transition"
        >
          <UploadCloud size={16} /> Subir Certificado Médico
        </button>
      </div>

      {/* Grid Superior: Ficha Personal y Saldos Vacaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Ficha Legajo Empleado */}
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6 lg:col-span-2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <Award size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 uppercase italic leading-none">{profile.nombre_completo}</h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 inline-block">
                Legajo Activo • Rol: {profile.rol}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-xs font-bold text-slate-600 uppercase pt-2 border-t border-slate-100">
            <div>
              <p className="text-[9px] text-slate-400 font-black">Fecha Ingreso</p>
              <p className="text-slate-800 font-black mt-0.5">{new Date(profile.fecha_ingreso).toLocaleDateString('es-AR')}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 font-black">Antigüedad</p>
              <p className="text-slate-800 font-black mt-0.5">{getAntiguedad(profile.fecha_ingreso)}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 font-black">Código Reloj</p>
              <p className="text-indigo-600 font-black mt-0.5">{profile.id_reloj || 'No asignado'}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 font-black">DNI</p>
              <p className="text-slate-800 font-black mt-0.5">{profile.dni || 'S/D'}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 font-black">Teléfono</p>
              <p className="text-slate-800 font-black mt-0.5">{profile.telefono || 'S/D'}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 font-black">Domicilio</p>
              <p className="text-slate-800 font-black mt-0.5 truncate max-w-[150px]" title={profile.domicilio || ""}>{profile.domicilio || 'S/D'}</p>
            </div>
          </div>

          {/* Libreta Sanitaria & DNI URL */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <div className={`flex-1 p-4 rounded-2xl border text-xs font-bold ${getLibretaColor(profile.vencimiento_libreta_sanitaria)}`}>
              <span className="text-[9px] font-black uppercase tracking-wider block">Libreta Sanitaria</span>
              <span className="font-black mt-0.5 block">
                {profile.vencimiento_libreta_sanitaria 
                  ? `Vence el: ${new Date(profile.vencimiento_libreta_sanitaria).toLocaleDateString('es-AR')}`
                  : "No cargada en sistema"
                }
              </span>
            </div>

            {profile.dni_url && (
              <a 
                href={profile.dni_url} 
                target="_blank" 
                rel="noreferrer"
                className="flex-1 p-4 rounded-2xl border border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600 transition flex items-center justify-between text-xs font-bold"
              >
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider block text-slate-400">Identificación</span>
                  <span className="font-black mt-0.5 block">DNI Digital Cargado</span>
                </div>
                <Download size={18} />
              </a>
            )}
          </div>
        </div>

        {/* Saldos Vacaciones */}
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <h3 className="font-black text-sm uppercase tracking-widest text-slate-500">Vacaciones</h3>
              <CalendarDays className="text-slate-300" size={24} />
            </div>

            {saldos.length > 0 ? (
              <div className="space-y-4 mt-6">
                {saldos.slice(0, 2).map(sal => {
                  const disp = sal.dias_totales - sal.dias_usados
                  return (
                    <div key={sal.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                      <div className="flex justify-between items-center text-xs font-black text-slate-800">
                        <span>Período {sal.anio}</span>
                        <span className="text-indigo-600">{disp} días libres</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                        <span>Totales: {sal.dias_totales}</span>
                        <span>Usados: {sal.dias_usados}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-slate-400 italic text-xs mt-6 text-center">No posees saldos configurados para este período.</p>
            )}
          </div>
        </div>
      </div>

      {/* Grid Medio: Calendario continuo y Recibos/Extras */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Calendario de Jornada Continua */}
        <div className="bg-white p-6 sm:p-8 rounded-[3rem] border border-slate-200 shadow-sm lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-800 uppercase italic tracking-tight">Mi Control de Asistencia</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Línea de tiempo diaria del período seleccionado</p>
            </div>

            {/* Selector de Mes */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 self-start">
              <span className="text-[9px] font-black text-slate-400 uppercase">Período:</span>
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent border-none outline-none font-black text-slate-700 text-xs cursor-pointer"
              />
            </div>
          </div>

          {loadingAttendance ? (
            <div className="flex justify-center py-20 text-slate-400">
              <Loader2 className="animate-spin mr-2" />
              <span className="font-bold uppercase tracking-widest text-xs">Agrupando fichadas...</span>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {attendance.map(day => {
                const dateParts = day.date.split('-')
                const displayDate = `${dateParts[2]}/${dateParts[1]}`
                
                return (
                  <div key={day.date} className="p-4 bg-slate-50 hover:bg-slate-100/70 border border-slate-150/40 rounded-2xl transition flex items-center justify-between gap-4">
                    {/* Fecha */}
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800 text-sm">{day.dayName}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{displayDate}</span>
                    </div>

                    {/* Fichadas reales */}
                    <div className="flex-1 flex justify-center gap-8 text-xs font-black">
                      {day.status === 'completo' && (
                        <>
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Entrada</span>
                            <span className="text-slate-800 mt-0.5">{day.entrada || '--'} hs</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Salida</span>
                            <span className="text-slate-800 mt-0.5">{day.salida || '--'} hs</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Total</span>
                            <span className="text-indigo-600 mt-0.5">{day.horasNetas} hs</span>
                          </div>
                        </>
                      )}

                      {day.status === 'falta_salida' && (
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Entrada</span>
                            <span className="text-slate-800 mt-0.5">{day.entrada || '--'} hs</span>
                          </div>
                          <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-wider flex items-center gap-1.5">
                            <AlertCircle size={12} /> Falta Salida
                          </span>
                        </div>
                      )}

                      {day.status === 'incidencia' && (
                        <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-wider">
                          [{day.incidenciaTipo?.replace('_', ' ')}] {day.incidenciaDesc}
                        </span>
                      )}

                      {day.status === 'falta' && (
                        <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-wider">
                          Falta
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}

              {attendance.length === 0 && (
                <p className="text-slate-400 italic text-center py-10">Selecciona un período de asistencia.</p>
              )}
            </div>
          )}
        </div>

        {/* Recibos de Sueldo e Información Contable */}
        <div className="space-y-8">
          
          {/* Recibos de Sueldo (Condicionado por RLS/UI) */}
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 className="font-black text-sm uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <FileSpreadsheet size={18} /> Recibos de Sueldo
              </h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {profile.estado_laboral === 'en_blanco' ? 'Descarga directa de recibos' : 'Módulo restringido'}
              </p>
            </div>

            {profile.estado_laboral === 'no_registrado' ? (
              <div className="p-4 bg-slate-100 border border-slate-200 text-slate-500 rounded-2xl flex items-start gap-3">
                <ShieldAlert size={20} className="text-slate-400 flex-shrink-0" />
                <p className="text-[11px] font-bold leading-normal">
                  Los recibos de sueldo digitales están disponibles únicamente para el personal registrado bajo convenio laboral.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {recibos.map(rec => (
                  <div key={rec.id} className="flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition text-xs font-bold">
                    <span>Período: <span className="font-black">{rec.periodo}</span></span>
                    <a 
                      href={rec.archivo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 bg-white border border-slate-200 hover:bg-indigo-50 text-indigo-600 rounded-lg transition"
                      title="Descargar Recibo"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                ))}

                {recibos.length === 0 && (
                  <p className="text-slate-400 italic text-[11px] text-center py-4">No posees recibos cargados.</p>
                )}
              </div>
            )}
          </div>

          {/* Vales y Uniformes del Empleado */}
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 className="font-black text-sm uppercase tracking-widest text-slate-500">Mi Registro Histórico</h3>
            </div>

            {/* Vales de Caja */}
            <div className="space-y-3 border-b border-slate-100 pb-4">
              <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                <CreditCard size={14} /> Vales y Adelantos
              </h4>
              <div className="space-y-1.5 max-h-[150px] overflow-y-auto text-xs font-bold">
                {vales.map(v => (
                  <div key={v.id} className="flex justify-between items-center py-1">
                    <span>{v.concepto} <span className="text-[9px] font-normal text-slate-400">({new Date(v.fecha).toLocaleDateString('es-AR')})</span></span>
                    <span className="text-rose-600 font-black">{formatCurrency(v.monto)}</span>
                  </div>
                ))}

                {vales.length === 0 && (
                  <p className="text-slate-400 italic text-[10px]">No posees adelantos en este período.</p>
                )}
              </div>
            </div>

            {/* Uniformes */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                <Shirt size={14} /> Entrega de Indumentaria
              </h4>
              <div className="space-y-1.5 max-h-[150px] overflow-y-auto text-[11px] font-bold">
                {uniformes.map(u => (
                  <div key={u.id} className="py-1">
                    <span className="text-slate-500 font-normal">{new Date(u.fecha).toLocaleDateString('es-AR')} • </span>
                    <span>{u.detalle}</span>
                  </div>
                ))}

                {uniformes.length === 0 && (
                  <p className="text-slate-400 italic text-[10px]">Sin entregas registradas.</p>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Panel de Solicitud de Vacaciones & Historial de Peticiones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Formulario de Solicitud */}
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6 lg:col-span-1">
          <div>
            <h3 className="font-black text-sm uppercase tracking-widest text-slate-500">Nueva Petición Vacaciones</h3>
          </div>

          <form onSubmit={handleSubmitVacation} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha Inicio</label>
                <input 
                  type="date"
                  value={vacStart}
                  onChange={(e) => setVacStart(e.target.value)}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha Fin</label>
                <input 
                  type="date"
                  value={vacEnd}
                  onChange={(e) => setVacEnd(e.target.value)}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Motivo / Aclaración</label>
              <input 
                type="text"
                placeholder="Ej: Licencia ordinaria período 2026."
                value={vacMotivo}
                onChange={(e) => setVacMotivo(e.target.value)}
                className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>

            <button 
              type="submit"
              disabled={sendingRequest || !vacStart || !vacEnd}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest py-4 rounded-xl transition shadow-md shadow-indigo-150 flex items-center justify-center gap-2"
            >
              {sendingRequest ? "Enviando..." : (
                <>
                  Enviar Solicitud <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Historial de Peticiones */}
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm lg:col-span-2 space-y-6">
          <div>
            <h3 className="font-black text-sm uppercase tracking-widest text-slate-500">Historial de Solicitudes</h3>
          </div>

          <div className="overflow-hidden border border-slate-100 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="p-4 pl-6">Fecha Inicio</th>
                  <th className="p-4">Fecha Fin</th>
                  <th className="p-4">Días Corridos</th>
                  <th className="p-4">Motivo</th>
                  <th className="p-4 text-right pr-6">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-700">
                {solicitudes.map(sol => {
                  const start = new Date(sol.fecha_inicio)
                  const end = new Date(sol.fecha_fin)
                  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

                  return (
                    <tr key={sol.id}>
                      <td className="p-4 pl-6">{new Date(sol.fecha_inicio).toLocaleDateString('es-AR')}</td>
                      <td className="p-4">{new Date(sol.fecha_fin).toLocaleDateString('es-AR')}</td>
                      <td className="p-4 text-indigo-600 font-black">{diff} días</td>
                      <td className="p-4 text-slate-500 italic max-w-[200px] truncate" title={sol.motivo || ""}>
                        {sol.motivo || "S/D"}
                      </td>
                      <td className="p-4 text-right pr-6">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          sol.estado === 'aprobado' ? 'bg-emerald-50 text-emerald-600' :
                          sol.estado === 'rechazado' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {sol.estado}
                        </span>
                      </td>
                    </tr>
                  )
                })}

                {solicitudes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center p-12 text-slate-400 italic">
                      No posees solicitudes de vacaciones enviadas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Panel de Documentación y Legajo Legal (Google Drive) */}
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-black text-sm uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <FileText size={18} className="text-indigo-600" /> Mi Legajo & Certificados (Google Drive)
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Documentos laborales, comprobantes y certificados médicos almacenados
            </p>
          </div>

          <button
            onClick={() => setShowCertModal(true)}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-black text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl flex items-center gap-2 transition"
          >
            <Plus size={16} /> Subir Certificado Médico
          </button>
        </div>

        <div className="overflow-hidden border border-slate-100 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="p-4 pl-6">Documento</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Período</th>
                <th className="p-4">Fecha Carga</th>
                <th className="p-4 text-right pr-6">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-700">
              {legajos.map(doc => (
                <tr key={doc.id} className="hover:bg-slate-50/60 transition">
                  <td className="p-4 pl-6 font-black text-slate-800 flex items-center gap-2">
                    <FileText size={16} className="text-slate-400" />
                    {doc.titulo}
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      doc.tipo === 'certificado_medico' ? 'bg-amber-50 text-amber-600 border border-amber-150' :
                      doc.tipo === 'arca_931' ? 'bg-emerald-50 text-emerald-600 border border-emerald-150' :
                      doc.tipo === 'alta_temprana' ? 'bg-indigo-50 text-indigo-600 border border-indigo-150' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {doc.tipo === 'certificado_medico' ? 'Certificado Médico' :
                       doc.tipo === 'arca_931' ? 'Formulario F.931 ARCA' :
                       doc.tipo === 'alta_temprana' ? 'Alta Temprana' :
                       doc.tipo.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500">{doc.periodo || '—'}</td>
                  <td className="p-4 text-slate-400 text-[11px]">{doc.created_at ? new Date(doc.created_at).toLocaleDateString('es-AR') : '—'}</td>
                  <td className="p-4 text-right pr-6">
                    <a
                      href={doc.archivo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl transition text-[11px] font-black uppercase"
                    >
                      <ExternalLink size={13} /> Ver en Drive
                    </a>
                  </td>
                </tr>
              ))}

              {legajos.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center p-12 text-slate-400 italic">
                    No tienes documentos de legajo o certificados médicos cargados en el sistema.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Subir Certificado Médico */}
      {showCertModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-800 uppercase italic">Subir Certificado Médico</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Se guardará en Google Drive y notificará a RRHH</p>
              </div>
              <button
                onClick={() => setShowCertModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-black transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitCertificado} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Título o Motivo</label>
                <input
                  type="text"
                  placeholder="Ej: Licencia médica por cuadro gripal"
                  value={certTitulo}
                  onChange={(e) => setCertTitulo(e.target.value)}
                  className="w-full bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha Desde *</label>
                  <input
                    type="date"
                    value={certFechaInicio}
                    onChange={(e) => setCertFechaInicio(e.target.value)}
                    required
                    className="w-full bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha Hasta *</label>
                  <input
                    type="date"
                    value={certFechaFin}
                    onChange={(e) => setCertFechaFin(e.target.value)}
                    required
                    className="w-full bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Archivo / Foto del Certificado (PDF o Imagen) *</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  required
                  onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer bg-slate-50 p-2 rounded-xl"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCertModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-wider rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploadingCert || !certFile || !certFechaInicio || !certFechaFin}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-indigo-100"
                >
                  {uploadingCert ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Subiendo a Drive...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} /> Subir Certificado
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
