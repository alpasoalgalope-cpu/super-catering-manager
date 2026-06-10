"use client"

import React, { useState, useEffect } from "react"
import { 
  getEmployeesListAction, 
  getTodasSolicitudesVacacionesAction, 
  importClockInsAction, 
  aprobarVacacionesAction, 
  rechazarVacacionesAction,
  crearValeAction,
  crearUniformeAction,
  crearIncidenciaAction,
  crearSaldoVacacionesAction,
  subirReciboAction,
  getEmployeeExtrasAction,
  getEmployeeRecibosAction,
  getEmployeeIncidenciasAction,
  crearEmpleadoAction,
  eliminarEmpleadoAction,
  actualizarPerfilAction,
  EmployeeProfile,
  VacacionesSolicitud,
  ValeAdelanto,
  EntregaUniforme,
  ReciboSueldo,
  Incidencia
} from "@/app/actions/rrhh"
import { 
  UploadCloud, AlertTriangle, Check, X, Users, Calendar, 
  DollarSign, Shirt, Plus, CalendarDays, Eye, Loader2, Download, Trash2, ShieldAlert,
  Pencil, UserPlus
} from "lucide-react"

export default function RrhhAdminPage() {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [solicitudes, setSolicitudes] = useState<VacacionesSolicitud[]>([])
  const [activeTab, setActiveTab] = useState<'presentismo' | 'vacaciones' | 'empleados'>('presentismo')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Carga de archivo
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null)

  // Selección de empleado para Ficha Detallada
  const [selectedEmp, setSelectedEmp] = useState<EmployeeProfile | null>(null)
  const [empVales, setEmpVales] = useState<ValeAdelanto[]>([])
  const [empUniformes, setEmpUniformes] = useState<EntregaUniforme[]>([])
  const [empRecibos, setEmpRecibos] = useState<ReciboSueldo[]>([])
  const [empIncidencias, setEmpIncidencias] = useState<Incidencia[]>([])
  const [loadingEmpDetails, setLoadingEmpDetails] = useState(false)

  // Formularios de carga para el empleado seleccionado
  const [showValeModal, setShowValeModal] = useState(false)
  const [valeMonto, setValeMonto] = useState("")
  const [valeConcepto, setValeConcepto] = useState("")

  const [showUniformeModal, setShowUniformeModal] = useState(false)
  const [uniformeDetalle, setUniformeDetalle] = useState("")

  const [showReciboModal, setShowReciboModal] = useState(false)
  const [reciboPeriodo, setReciboPeriodo] = useState("")
  const [reciboUrl, setReciboUrl] = useState("")

  const [showIncidenciaModal, setShowIncidenciaModal] = useState(false)
  const [incFechaInicio, setIncFechaInicio] = useState("")
  const [incFechaFin, setIncFechaFin] = useState("")
  const [incTipo, setIncTipo] = useState<'ausencia' | 'carpeta_medica' | 'llegada_tarde' | 'franco'>('ausencia')
  const [incDesc, setIncDesc] = useState("")

  const [showSaldoModal, setShowSaldoModal] = useState(false)
  const [saldoAnio, setSaldoAnio] = useState(new Date().getFullYear())
  const [saldoDias, setSaldoDias] = useState(14)

  // Modal Crear Empleado (ABM)
  const [showCreateEmpModal, setShowCreateEmpModal] = useState(false)
  const [createEmail, setCreateEmail] = useState("")
  const [createPassword, setCreatePassword] = useState("")
  const [createNombre, setCreateNombre] = useState("")
  const [createRol, setCreateRol] = useState<'admin' | 'cocina' | 'empleado'>('empleado')
  const [createIdReloj, setCreateIdReloj] = useState("")
  const [createFechaIngreso, setCreateFechaIngreso] = useState("")
  const [createEstadoLaboral, setCreateEstadoLaboral] = useState<'en_blanco' | 'no_registrado'>('no_registrado')
  const [createVencimientoLibreta, setCreateVencimientoLibreta] = useState("")
  const [createDni, setCreateDni] = useState("")
  const [createTelefono, setCreateTelefono] = useState("")
  const [createDomicilio, setCreateDomicilio] = useState("")

  // Modal Editar Empleado (ABM)
  const [showEditEmpModal, setShowEditEmpModal] = useState(false)
  const [editNombre, setEditNombre] = useState("")
  const [editRol, setEditRol] = useState<'admin' | 'cocina' | 'empleado'>('empleado')
  const [editIdReloj, setEditIdReloj] = useState("")
  const [editFechaIngreso, setEditFechaIngreso] = useState("")
  const [editEstadoLaboral, setEditEstadoLaboral] = useState<'en_blanco' | 'no_registrado'>('no_registrado')
  const [editVencimientoLibreta, setEditVencimientoLibreta] = useState("")
  const [editDni, setEditDni] = useState("")
  const [editTelefono, setEditTelefono] = useState("")
  const [editDomicilio, setEditDomicilio] = useState("")

  useEffect(() => {
    // Inicializar fecha de ingreso por defecto
    setCreateFechaIngreso(new Date().toISOString().split('T')[0])
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    const [empRes, solRes] = await Promise.all([
      getEmployeesListAction(),
      getTodasSolicitudesVacacionesAction()
    ])

    if (empRes.error) setError(empRes.error)
    else if (empRes.data) setEmployees(empRes.data)

    if (solRes.error) setError(solRes.error)
    else if (solRes.data) setSolicitudes(solRes.data)

    setLoading(false)
  }

  // Cargar detalles extras del empleado seleccionado
  async function loadEmployeeDetails(emp: EmployeeProfile) {
    setSelectedEmp(emp)
    setLoadingEmpDetails(true)
    const [extrasRes, recibosRes, incRes] = await Promise.all([
      getEmployeeExtrasAction(emp.id),
      getEmployeeRecibosAction(emp.id),
      getEmployeeIncidenciasAction(emp.id)
    ])

    if (extrasRes.vales) setEmpVales(extrasRes.vales)
    if (extrasRes.uniformes) setEmpUniformes(extrasRes.uniformes)
    if (recibosRes.data) setEmpRecibos(recibosRes.data)
    if (incRes.data) setEmpIncidencias(incRes.data)

    setLoadingEmpDetails(false)
  }

  // Importar presentismo
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!importFile) return
    setImporting(true)
    setImportResult(null)

    try {
      const text = await importFile.text()
      const res = await importClockInsAction(text)
      setImportResult(res)
      if (res.success) {
        setImportFile(null)
      }
    } catch (err: any) {
      setImportResult({ success: false, error: err.message || "Error al leer el archivo." })
    } finally {
      setImporting(false)
    }
  }

  // Aprobar / Rechazar vacaciones
  const handleAprobarVacaciones = async (id: string) => {
    const confirm = window.confirm("¿Estás seguro de aprobar esta solicitud de vacaciones?")
    if (!confirm) return
    const res = await aprobarVacacionesAction(id)
    if (res.success) {
      alert("Solicitud aprobada y saldo de vacaciones debitado.")
      loadData()
    } else {
      alert(`Error: ${res.error}`)
    }
  }

  const handleRechazarVacaciones = async (id: string) => {
    const confirm = window.confirm("¿Estás seguro de rechazar esta solicitud de vacaciones?")
    if (!confirm) return
    const res = await rechazarVacacionesAction(id)
    if (res.success) {
      alert("Solicitud rechazada.")
      loadData()
    } else {
      alert(`Error: ${res.error}`)
    }
  }

  // Crear Vale
  const handleCrearVale = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmp) return
    const res = await crearValeAction(selectedEmp.id, parseFloat(valeMonto), valeConcepto)
    if (res.success) {
      setShowValeModal(false)
      setValeMonto("")
      setValeConcepto("")
      loadEmployeeDetails(selectedEmp)
    } else {
      alert(`Error: ${res.error}`)
    }
  }

  // Crear Uniforme
  const handleCrearUniforme = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmp) return
    const res = await crearUniformeAction(selectedEmp.id, uniformeDetalle)
    if (res.success) {
      setShowUniformeModal(false)
      setUniformeDetalle("")
      loadEmployeeDetails(selectedEmp)
    } else {
      alert(`Error: ${res.error}`)
    }
  }

  // Crear Incidencia
  const handleCrearIncidencia = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmp) return
    const res = await crearIncidenciaAction(selectedEmp.id, incFechaInicio, incFechaFin, incTipo, incDesc)
    if (res.success) {
      setShowIncidenciaModal(false)
      setIncFechaInicio("")
      setIncFechaFin("")
      setIncDesc("")
      loadEmployeeDetails(selectedEmp)
    } else {
      alert(`Error: ${res.error}`)
    }
  }

  // Subir Recibo
  const handleSubirRecibo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmp) return
    const res = await subirReciboAction(selectedEmp.id, reciboPeriodo, reciboUrl)
    if (res.success) {
      setShowReciboModal(false)
      setReciboPeriodo("")
      setReciboUrl("")
      loadEmployeeDetails(selectedEmp)
    } else {
      alert(`Error: ${res.error}`)
    }
  }

  // Crear Saldo
  const handleCrearSaldo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmp) return
    const res = await crearSaldoVacacionesAction(selectedEmp.id, saldoAnio, saldoDias)
    if (res.success) {
      setShowSaldoModal(false)
      alert("Saldo de vacaciones configurado correctamente.")
    } else {
      alert(`Error: ${res.error}`)
    }
  }

  // ABM: Crear Empleado (Alta)
  const handleCrearEmpleado = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createEmail || !createPassword || !createNombre) {
      alert("Por favor completa los campos obligatorios (Email, Contraseña, Nombre)")
      return
    }
    const res = await crearEmpleadoAction({
      email: createEmail,
      pass: createPassword,
      nombre: createNombre,
      rol: createRol,
      idReloj: createIdReloj || undefined,
      fechaIngreso: createFechaIngreso,
      estadoLaboral: createEstadoLaboral,
      vencimientoLibreta: createVencimientoLibreta || undefined,
      dni: createDni || undefined,
      telefono: createTelefono || undefined,
      domicilio: createDomicilio || undefined
    })
    if (res.success) {
      setShowCreateEmpModal(false)
      setCreateEmail("")
      setCreatePassword("")
      setCreateNombre("")
      setCreateRol("empleado")
      setCreateIdReloj("")
      setCreateFechaIngreso(new Date().toISOString().split('T')[0])
      setCreateEstadoLaboral("no_registrado")
      setCreateVencimientoLibreta("")
      setCreateDni("")
      setCreateTelefono("")
      setCreateDomicilio("")
      alert("Empleado creado con éxito en Auth y Legajo.")
      loadData()
    } else {
      alert(`Error al crear empleado: ${res.error}`)
    }
  }

  // ABM: Editar Empleado (Modificación)
  const openEditModal = () => {
    if (!selectedEmp) return
    setEditNombre(selectedEmp.nombre_completo)
    setEditRol(selectedEmp.rol)
    setEditIdReloj(selectedEmp.id_reloj || "")
    setEditFechaIngreso(selectedEmp.fecha_ingreso)
    setEditEstadoLaboral(selectedEmp.estado_laboral)
    setEditVencimientoLibreta(selectedEmp.vencimiento_libreta_sanitaria || "")
    setEditDni(selectedEmp.dni || "")
    setEditTelefono(selectedEmp.telefono || "")
    setEditDomicilio(selectedEmp.domicilio || "")
    setShowEditEmpModal(true)
  }

  const handleEditarEmpleado = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmp) return
    if (!editNombre) {
      alert("El nombre completo es obligatorio.")
      return
    }
    const res = await actualizarPerfilAction(selectedEmp.id, {
      nombre_completo: editNombre,
      rol: editRol,
      id_reloj: editIdReloj || null,
      fecha_ingreso: editFechaIngreso,
      estado_laboral: editEstadoLaboral,
      vencimiento_libreta_sanitaria: editVencimientoLibreta || null,
      dni: editDni || null,
      telefono: editTelefono || null,
      domicilio: editDomicilio || null
    })
    if (res.success) {
      setShowEditEmpModal(false)
      alert("Perfil actualizado correctamente.")
      loadData()
      loadEmployeeDetails({
        ...selectedEmp,
        nombre_completo: editNombre,
        rol: editRol,
        id_reloj: editIdReloj || null,
        fecha_ingreso: editFechaIngreso,
        estado_laboral: editEstadoLaboral,
        vencimiento_libreta_sanitaria: editVencimientoLibreta || null,
        dni: editDni || null,
        telefono: editTelefono || null,
        domicilio: editDomicilio || null
      })
    } else {
      alert(`Error al actualizar legajo: ${res.error}`)
    }
  }

  // ABM: Eliminar Empleado (Baja)
  const handleEliminarEmpleado = async () => {
    if (!selectedEmp) return
    const confirm = window.confirm(`¿Estás seguro de eliminar a ${selectedEmp.nombre_completo} de forma permanente?\nSe borrarán sus credenciales, fichajes, recibos, vales e historial de vacaciones.\n\nEsta acción NO se puede deshacer y liberará su correo para un nuevo registro.`)
    if (!confirm) return
    const res = await eliminarEmpleadoAction(selectedEmp.id)
    if (res.success) {
      alert("Empleado y cuenta asociada eliminados correctamente.")
      setSelectedEmp(null)
      loadData()
    } else {
      alert(`Error al eliminar empleado: ${res.error}`)
    }
  }


  // Buscar libretas que vencen pronto
  const libretasVencidas = employees.filter(emp => {
    if (!emp.vencimiento_libreta_sanitaria) return false
    const limit = new Date()
    limit.setDate(limit.getDate() + 30) // Próximos 30 días
    return new Date(emp.vencimiento_libreta_sanitaria) <= limit
  })

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val)

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8 pb-32">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic flex items-center gap-3">
          Panel RRHH <span className="text-indigo-600">Administrativo</span>
        </h1>
        <p className="text-slate-500 font-medium italic">Gestión de presentismo, personal, vacaciones y recibos.</p>
      </div>

      {/* Alertas de Libreta Sanitaria */}
      {libretasVencidas.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-950 rounded-3xl space-y-2 shadow-sm animate-pulse">
          <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2 text-amber-700">
            <AlertTriangle size={18} /> Alerta: Libretas Sanitarias Vencidas o Próximas a Vencer
          </h3>
          <div className="text-xs divide-y divide-amber-100 font-bold">
            {libretasVencidas.map(emp => (
              <div key={emp.id} className="py-2 flex justify-between">
                <span>{emp.nombre_completo}</span>
                <span className="text-amber-800 font-black">
                  Vence el: {emp.vencimiento_libreta_sanitaria ? new Date(emp.vencimiento_libreta_sanitaria).toLocaleDateString('es-AR') : 'S/D'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selector de Pestañas */}
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        <button 
          onClick={() => setActiveTab('presentismo')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-wider transition border-b-2 outline-none ${
            activeTab === 'presentismo' ? 'border-indigo-600 text-indigo-600 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Presentismo & Importación
        </button>
        <button 
          onClick={() => setActiveTab('vacaciones')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-wider transition border-b-2 outline-none ${
            activeTab === 'vacaciones' ? 'border-indigo-600 text-indigo-600 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Solicitudes Vacaciones ({solicitudes.filter(s => s.estado === 'pendiente').length})
        </button>
        <button 
          onClick={() => setActiveTab('empleados')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-wider transition border-b-2 outline-none ${
            activeTab === 'empleados' ? 'border-indigo-600 text-indigo-600 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Fichas Empleados ({employees.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin mr-2" />
          <span className="font-bold uppercase tracking-widest text-xs">Cargando datos RRHH...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-950 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-rose-800">Error de Base de Datos / RLS</p>
                <p className="text-xs font-medium mt-0.5">{error}</p>
              </div>
            </div>
          )}
          {/* TAB 1: PRESENTISMO & IMPORTACIÓN */}
          {activeTab === 'presentismo' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Importador de Logs */}
              <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6 lg:col-span-1">
                <div>
                  <h2 className="text-lg font-black text-slate-800 uppercase italic tracking-tight">Importador Presentismo</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Arrastra o selecciona el archivo log del reloj</p>
                </div>

                <form onSubmit={handleImport} className="space-y-4">
                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 transition rounded-3xl p-8 flex flex-col items-center justify-center text-slate-400 cursor-pointer relative">
                    <input 
                      type="file" 
                      accept=".txt"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <UploadCloud size={40} className="text-slate-300 mb-2" />
                    <span className="text-xs font-bold text-slate-500 text-center">
                      {importFile ? importFile.name : "Subir archivo AllGLog001.txt"}
                    </span>
                  </div>

                  <button 
                    type="submit"
                    disabled={!importFile || importing}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl disabled:opacity-50 transition shadow-md shadow-indigo-150"
                  >
                    {importing ? "Procesando log..." : "Procesar Archivo"}
                  </button>
                </form>

                {importResult && (
                  <div className={`p-4 rounded-2xl text-xs font-bold ${
                    importResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {importResult.success 
                      ? `Importación completada: se insertaron ${importResult.count} fichadas sin duplicados.` 
                      : `Error: ${importResult.error}`}
                  </div>
                )}
              </div>

              {/* Registro Guía de Uso del Reloj */}
              <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm lg:col-span-2 space-y-6">
                <div>
                  <h2 className="text-lg font-black text-slate-800 uppercase italic tracking-tight">Estructura Fichaje & Empleados</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verifica los IDs del reloj asignados en el perfil de cada empleado</p>
                </div>

                <div className="overflow-hidden border border-slate-100 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="p-4 pl-6">Nombre Empleado</th>
                        <th className="p-4">DNI</th>
                        <th className="p-4">Teléfono</th>
                        <th className="p-4">Domicilio</th>
                        <th className="p-4">ID Fichador</th>
                        <th className="p-4">Rol en Sistema</th>
                        <th className="p-4">Estado Laboral</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-700">
                      {employees.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-4 pl-6">{emp.nombre_completo}</td>
                          <td className="p-4 font-semibold text-slate-600">{emp.dni || "-"}</td>
                          <td className="p-4 text-slate-600">{emp.telefono || "-"}</td>
                          <td className="p-4 text-slate-500 max-w-[150px] truncate" title={emp.domicilio || ""}>{emp.domicilio || "-"}</td>
                          <td className="p-4 text-indigo-600 font-black">{emp.id_reloj || "No configurado"}</td>
                          <td className="p-4">
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase text-[10px]">{emp.rol}</span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${
                              emp.estado_laboral === 'en_blanco' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {emp.estado_laboral === 'en_blanco' ? 'En blanco' : 'No registrado'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SOLICITUDES DE VACACIONES */}
          {activeTab === 'vacaciones' && (
            <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-black text-slate-800 uppercase italic tracking-tight">Aprobador de Vacaciones</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deducción automática de saldos basada en días corridos</p>
              </div>

              <div className="overflow-hidden border border-slate-100 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="p-4 pl-6">Empleado</th>
                      <th className="p-4">Fecha Inicio</th>
                      <th className="p-4">Fecha Fin</th>
                      <th className="p-4">Días Corridos</th>
                      <th className="p-4">Motivo</th>
                      <th className="p-4">Estado</th>
                      <th className="p-4 text-right pr-6">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-700">
                    {solicitudes.map(sol => {
                      const start = new Date(sol.fecha_inicio)
                      const end = new Date(sol.fecha_fin)
                      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

                      return (
                        <tr key={sol.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-4 pl-6">{sol.profiles?.nombre_completo || "S/D"}</td>
                          <td className="p-4">{new Date(sol.fecha_inicio).toLocaleDateString('es-AR')}</td>
                          <td className="p-4">{new Date(sol.fecha_fin).toLocaleDateString('es-AR')}</td>
                          <td className="p-4 text-indigo-600 font-black">{diffDays} días</td>
                          <td className="p-4 text-slate-500 italic max-w-[200px] truncate" title={sol.motivo || ""}>
                            {sol.motivo || "S/D"}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-black ${
                              sol.estado === 'aprobado' ? 'bg-emerald-50 text-emerald-600' :
                              sol.estado === 'rechazado' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600 animate-pulse'
                            }`}>
                              {sol.estado}
                            </span>
                          </td>
                          <td className="p-4 text-right pr-6 space-x-2">
                            {sol.estado === 'pendiente' && (
                              <>
                                <button 
                                  onClick={() => handleAprobarVacaciones(sol.id)}
                                  className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition"
                                  title="Aprobar Solicitud"
                                >
                                  <Check size={16} />
                                </button>
                                <button 
                                  onClick={() => handleRechazarVacaciones(sol.id)}
                                  className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition"
                                  title="Rechazar Solicitud"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}

                    {solicitudes.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center p-12 text-slate-400 italic font-bold">
                          No hay solicitudes de vacaciones registradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: FICHAS DE EMPLEADOS */}
          {activeTab === 'empleados' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Listado de Empleados */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4 lg:col-span-1">
                <div>
                  <h2 className="text-base font-black text-slate-800 uppercase italic tracking-tight">Fichas de Personal</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selecciona un empleado para ver sus registros</p>
                </div>

                <button 
                  onClick={() => setShowCreateEmpModal(true)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-slate-100"
                >
                  <UserPlus size={14} /> Registrar Empleado
                </button>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {employees.map(emp => {
                    const isSelected = selectedEmp?.id === emp.id
                    return (
                      <div 
                        key={emp.id}
                        onClick={() => loadEmployeeDetails(emp)}
                        className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                          isSelected 
                            ? 'bg-indigo-50/70 border-indigo-200 shadow-xs' 
                            : 'bg-white border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <h4 className="font-black text-slate-800 text-sm">{emp.nombre_completo}</h4>
                        <div className="flex justify-between items-center mt-1 text-[10px] font-bold text-slate-400 uppercase">
                          <span>Reloj: <span className="text-indigo-600 font-black">{emp.id_reloj || 'S/D'}</span></span>
                          <span>{emp.rol}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Detalle del Empleado Seleccionado */}
              <div className="lg:col-span-2 space-y-6">
                {selectedEmp ? (
                  <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-8 relative">
                    {/* Ficha Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-6">
                      <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">
                          {selectedEmp.nombre_completo}
                        </h2>
                        <div className="flex flex-wrap gap-3 mt-1.5 text-xs font-bold text-slate-400 uppercase">
                          <span>Ingreso: <span className="text-slate-600">{new Date(selectedEmp.fecha_ingreso).toLocaleDateString('es-AR')}</span></span>
                          <span>•</span>
                          <span>Estado: <span className="text-slate-600">{selectedEmp.estado_laboral === 'en_blanco' ? 'En blanco' : 'No registrado'}</span></span>
                          <span>•</span>
                          <span>DNI: <span className="text-slate-600">{selectedEmp.dni || 'S/D'}</span></span>
                          <span>•</span>
                          <span>Teléfono: <span className="text-slate-600">{selectedEmp.telefono || 'S/D'}</span></span>
                          <span>•</span>
                          <span>Domicilio: <span className="text-slate-600">{selectedEmp.domicilio || 'S/D'}</span></span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={openEditModal}
                          className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition"
                        >
                          <Pencil size={12} /> Editar Legajo
                        </button>
                        <button 
                          onClick={handleEliminarEmpleado}
                          className="bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition"
                        >
                          <Trash2 size={12} /> Eliminar
                        </button>
                        <button 
                          onClick={() => setShowSaldoModal(true)}
                          className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition"
                        >
                          Configurar Saldo
                        </button>
                      </div>
                    </div>

                    {loadingEmpDetails ? (
                      <div className="flex justify-center py-20 text-slate-400">
                        <Loader2 className="animate-spin mr-2" />
                        <span className="font-bold uppercase tracking-widest text-xs">Cargando legajo...</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Columna Izquierda: Recibos de Sueldo e Incidencias */}
                        <div className="space-y-6">
                          {/* Recibos de Sueldo */}
                          <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                            <div className="flex justify-between items-center">
                              <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">Recibos de Sueldo</h3>
                              <button 
                                onClick={() => setShowReciboModal(true)}
                                className="p-1 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition"
                              >
                                <Plus size={16} />
                              </button>
                            </div>

                            <div className="space-y-2 text-xs font-bold text-slate-700">
                              {empRecibos.map(rec => (
                                <div key={rec.id} className="flex justify-between items-center p-2.5 bg-white rounded-xl border border-slate-100">
                                  <span>Periodo: <span className="font-black">{rec.periodo}</span></span>
                                  <div className="flex gap-1">
                                    <a 
                                      href={rec.archivo_url} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="p-1 text-slate-400 hover:text-indigo-600 transition"
                                    >
                                      <Download size={14} />
                                    </a>
                                  </div>
                                </div>
                              ))}

                              {empRecibos.length === 0 && (
                                <p className="text-slate-400 italic text-[11px] text-center py-4">No hay recibos cargados.</p>
                              )}
                            </div>
                          </div>

                          {/* Incidencias */}
                          <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                            <div className="flex justify-between items-center">
                              <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">Incidencias Diarias</h3>
                              <button 
                                onClick={() => setShowIncidenciaModal(true)}
                                className="p-1 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition"
                              >
                                <Plus size={16} />
                              </button>
                            </div>

                            <div className="space-y-2 text-xs font-bold text-slate-700">
                              {empIncidencias.map(inc => (
                                <div key={inc.id} className="p-3 bg-white rounded-xl border border-slate-100 space-y-1">
                                  <div className="flex justify-between items-center">
                                    <span className="font-black uppercase text-[10px] text-indigo-600">{inc.tipo.replace('_', ' ')}</span>
                                    <span className="text-[9px] text-slate-400">{inc.fecha_inicio} al {inc.fecha_fin}</span>
                                  </div>
                                  <p className="text-slate-500 italic text-[11px] leading-tight">{inc.descripcion || "Sin descripción"}</p>
                                </div>
                              ))}

                              {empIncidencias.length === 0 && (
                                <p className="text-slate-400 italic text-[11px] text-center py-4">Sin incidencias registradas.</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Columna Derecha: Vales y Uniformes */}
                        <div className="space-y-6">
                          {/* Vales de Caja */}
                          <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                            <div className="flex justify-between items-center">
                              <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">Vales y Adelantos</h3>
                              <button 
                                onClick={() => setShowValeModal(true)}
                                className="p-1 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition"
                              >
                                <Plus size={16} />
                              </button>
                            </div>

                            <div className="space-y-2 text-xs font-bold text-slate-700">
                              {empVales.map(v => (
                                <div key={v.id} className="flex justify-between items-center p-2.5 bg-white rounded-xl border border-slate-100">
                                  <div className="flex flex-col">
                                    <span>{v.concepto}</span>
                                    <span className="text-[9px] text-slate-400">{new Date(v.fecha).toLocaleDateString('es-AR')}</span>
                                  </div>
                                  <span className="font-black text-rose-600">{formatCurrency(v.monto)}</span>
                                </div>
                              ))}

                              {empVales.length === 0 && (
                                <p className="text-slate-400 italic text-[11px] text-center py-4">No hay vales registrados.</p>
                              )}
                            </div>
                          </div>

                          {/* Uniformes */}
                          <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                            <div className="flex justify-between items-center">
                              <h3 className="font-black text-xs uppercase tracking-widest text-slate-500">Uniforme / Indumentaria</h3>
                              <button 
                                onClick={() => setShowUniformeModal(true)}
                                className="p-1 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition"
                              >
                                <Plus size={16} />
                              </button>
                            </div>

                            <div className="space-y-2 text-xs font-bold text-slate-700">
                              {empUniformes.map(u => (
                                <div key={u.id} className="p-2.5 bg-white rounded-xl border border-slate-100 space-y-1">
                                  <div className="flex justify-between items-center text-[9px] text-slate-400">
                                    <span>Entrega registrada</span>
                                    <span>{new Date(u.fecha).toLocaleDateString('es-AR')}</span>
                                  </div>
                                  <p className="text-slate-700 text-[11px]">{u.detalle}</p>
                                </div>
                              ))}

                              {empUniformes.length === 0 && (
                                <p className="text-slate-400 italic text-[11px] text-center py-4">Sin entregas registradas.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-[3rem] p-20 flex flex-col items-center justify-center text-slate-400 text-center">
                    <Users size={40} className="text-slate-300 mb-2 animate-bounce" />
                    <h3 className="font-black text-sm uppercase tracking-widest text-slate-500">Selecciona un Empleado</h3>
                    <p className="text-xs text-slate-400 max-w-xs mt-1">Podrás cargar vales de caja, entregar indumentaria, subir recibos o incidencias desde su legajo.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          MODALES DE CARGA DE DATOS (STATE POPUPS)
          ============================================================ */}

      {/* Modal: Saldo Vacaciones */}
      {showSaldoModal && selectedEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl max-w-md w-full space-y-6 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase italic">Configurar Saldo de Vacaciones</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedEmp.nombre_completo}</p>
            </div>
            <form onSubmit={handleCrearSaldo} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Año de Período</label>
                <input 
                  type="number" 
                  value={saldoAnio}
                  onChange={(e) => setSaldoAnio(parseInt(e.target.value))}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Días Totales Asignados</label>
                <input 
                  type="number" 
                  value={saldoDias}
                  onChange={(e) => setSaldoDias(parseInt(e.target.value))}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowSaldoModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest py-3 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl transition"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Vale Adelanto */}
      {showValeModal && selectedEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl max-w-md w-full space-y-6 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase italic">Registrar Vale o Adelanto</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedEmp.nombre_completo}</p>
            </div>
            <form onSubmit={handleCrearVale} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Monto ($)</label>
                <input 
                  type="number" 
                  placeholder="Ej: 15000"
                  value={valeMonto}
                  onChange={(e) => setValeMonto(e.target.value)}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Concepto</label>
                <input 
                  type="text" 
                  placeholder="Ej: Adelanto quincena"
                  value={valeConcepto}
                  onChange={(e) => setValeConcepto(e.target.value)}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowValeModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest py-3 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl transition"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Uniforme */}
      {showUniformeModal && selectedEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl max-w-md w-full space-y-6 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase italic">Entrega de Indumentaria</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedEmp.nombre_completo}</p>
            </div>
            <form onSubmit={handleCrearUniforme} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Detalle del Uniforme</label>
                <textarea 
                  placeholder="Ej: Chaqueta de Chef blanca y pantalón negro talle S."
                  value={uniformeDetalle}
                  onChange={(e) => setUniformeDetalle(e.target.value)}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition min-h-[100px] resize-none"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowUniformeModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest py-3 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl transition"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Recibo */}
      {showReciboModal && selectedEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl max-w-md w-full space-y-6 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase italic">Cargar Recibo de Sueldo</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedEmp.nombre_completo}</p>
            </div>
            <form onSubmit={handleSubirRecibo} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Periodo (YYYY-MM)</label>
                <input 
                  type="text" 
                  placeholder="Ej: 2026-03"
                  value={reciboPeriodo}
                  onChange={(e) => setReciboPeriodo(e.target.value)}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Enlace / URL de archivo</label>
                <input 
                  type="text" 
                  placeholder="Ej: https://wfxgl.../recibos/2026-03.pdf"
                  value={reciboUrl}
                  onChange={(e) => setReciboUrl(e.target.value)}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowReciboModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest py-3 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl transition"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Incidencia */}
      {showIncidenciaModal && selectedEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl max-w-md w-full space-y-6 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase italic">Registrar Incidencia Diaria</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedEmp.nombre_completo}</p>
            </div>
            <form onSubmit={handleCrearIncidencia} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tipo Incidencia</label>
                <select 
                  value={incTipo}
                  onChange={(e: any) => setIncTipo(e.target.value)}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl cursor-pointer hover:bg-slate-100 transition"
                >
                  <option value="ausencia">Ausencia injustificada</option>
                  <option value="carpeta_medica">Carpeta médica / Enfermedad</option>
                  <option value="llegada_tarde">Llegada tarde</option>
                  <option value="franco">Franco programado</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha Inicio</label>
                  <input 
                    type="date" 
                    value={incFechaInicio}
                    onChange={(e) => setIncFechaInicio(e.target.value)}
                    className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha Fin</label>
                  <input 
                    type="date" 
                    value={incFechaFin}
                    onChange={(e) => setIncFechaFin(e.target.value)}
                    className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Descripción / Justificación</label>
                <input 
                  type="text" 
                  placeholder="Ej: Reposo médico 48hs por gripe."
                  value={incDesc}
                  onChange={(e) => setIncDesc(e.target.value)}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowIncidenciaModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest py-3 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl transition"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Nuevo Empleado (Alta) */}
      {showCreateEmpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl max-w-md w-full space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase italic">Registrar Nuevo Empleado</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Creará su cuenta de acceso y su legajo en el sistema</p>
            </div>
            <form onSubmit={handleCrearEmpleado} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre Completo *</label>
                <input 
                  type="text" 
                  placeholder="Ej: Carolina Gómez"
                  value={createNombre}
                  onChange={(e) => setCreateNombre(e.target.value)}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Email (Acceso) *</label>
                  <input 
                    type="email" 
                    placeholder="ejemplo@gmail.com"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Contraseña Temporal *</label>
                  <input 
                    type="password" 
                    placeholder="Mínimo 6 caracteres"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Rol en Sistema *</label>
                  <select 
                    value={createRol}
                    onChange={(e: any) => setCreateRol(e.target.value)}
                    className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl cursor-pointer hover:bg-slate-100 transition"
                  >
                    <option value="empleado">Empleado (Solo Portal)</option>
                    <option value="cocina">Cocina (Producción + Portal)</option>
                    <option value="admin">Administrador (Control Total)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ID Reloj Fichador</label>
                  <input 
                    type="text" 
                    placeholder="Ej: 000000002"
                    value={createIdReloj}
                    onChange={(e) => setCreateIdReloj(e.target.value)}
                    className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha de Ingreso *</label>
                  <input 
                    type="date" 
                    value={createFechaIngreso}
                    onChange={(e) => setCreateFechaIngreso(e.target.value)}
                    className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Estado Laboral *</label>
                  <select 
                    value={createEstadoLaboral}
                    onChange={(e: any) => setCreateEstadoLaboral(e.target.value)}
                    className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl cursor-pointer hover:bg-slate-100 transition"
                  >
                    <option value="no_registrado">No registrado / Eventual</option>
                    <option value="en_blanco">En blanco (Verificado)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Vencimiento Libreta Sanitaria</label>
                <input 
                  type="date" 
                  value={createVencimientoLibreta}
                  onChange={(e) => setCreateVencimientoLibreta(e.target.value)}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">DNI (Documento)</label>
                  <input 
                    type="text" 
                    placeholder="Ej: 38456789"
                    value={createDni}
                    onChange={(e) => setCreateDni(e.target.value)}
                    className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Número de Teléfono</label>
                  <input 
                    type="text" 
                    placeholder="Ej: +54 9 11 5555-5555"
                    value={createTelefono}
                    onChange={(e) => setCreateTelefono(e.target.value)}
                    className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Domicilio (Dirección)</label>
                <input 
                  type="text" 
                  placeholder="Ej: Av. Santa Fe 1234, CABA"
                  value={createDomicilio}
                  onChange={(e) => setCreateDomicilio(e.target.value)}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowCreateEmpModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition shadow-md shadow-indigo-100"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Legajo de Empleado (Modificación) */}
      {showEditEmpModal && selectedEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl max-w-md w-full space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase italic">Editar Legajo de Empleado</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedEmp.nombre_completo}</p>
            </div>
            <form onSubmit={handleEditarEmpleado} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre Completo *</label>
                <input 
                  type="text" 
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Rol en Sistema *</label>
                  <select 
                    value={editRol}
                    onChange={(e: any) => setEditRol(e.target.value)}
                    className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl cursor-pointer hover:bg-slate-100 transition"
                  >
                    <option value="empleado">Empleado (Solo Portal)</option>
                    <option value="cocina">Cocina (Producción + Portal)</option>
                    <option value="admin">Administrador (Control Total)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ID Reloj Fichador</label>
                  <input 
                    type="text" 
                    placeholder="Ej: 000000002"
                    value={editIdReloj}
                    onChange={(e) => setEditIdReloj(e.target.value)}
                    className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha de Ingreso *</label>
                  <input 
                    type="date" 
                    value={editFechaIngreso}
                    onChange={(e) => setEditFechaIngreso(e.target.value)}
                    className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Estado Laboral *</label>
                  <select 
                    value={editEstadoLaboral}
                    onChange={(e: any) => setEditEstadoLaboral(e.target.value)}
                    className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl cursor-pointer hover:bg-slate-100 transition"
                  >
                    <option value="no_registrado">No registrado / Eventual</option>
                    <option value="en_blanco">En blanco (Verificado)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Vencimiento Libreta Sanitaria</label>
                <input 
                  type="date" 
                  value={editVencimientoLibreta}
                  onChange={(e) => setEditVencimientoLibreta(e.target.value)}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">DNI (Documento)</label>
                  <input 
                    type="text" 
                    placeholder="Ej: 38456789"
                    value={editDni}
                    onChange={(e) => setEditDni(e.target.value)}
                    className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Número de Teléfono</label>
                  <input 
                    type="text" 
                    placeholder="Ej: +54 9 11 5555-5555"
                    value={editTelefono}
                    onChange={(e) => setEditTelefono(e.target.value)}
                    className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Domicilio (Dirección)</label>
                <input 
                  type="text" 
                  placeholder="Ej: Av. Santa Fe 1234, CABA"
                  value={editDomicilio}
                  onChange={(e) => setEditDomicilio(e.target.value)}
                  className="bg-slate-50 border-none outline-none font-bold text-xs p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowEditEmpModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition shadow-md shadow-indigo-100"
                >
                  Actualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
