"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { 
  ChevronDown, 
  ChevronRight, 
  LayoutGrid, 
  Users, 
  Bus, 
  User, 
  Calendar, 
  DollarSign, 
  Settings, 
  Warehouse,
  Truck,
  TrendingUp,
  Tag,
  Factory,
  Car,
  Calculator,
  Boxes,
  AlertTriangle,
  Home,
  CalendarDays,
  BarChart3,
  Gift,
  ClipboardList,
  BookOpen,
  PackageSearch,
  Layers,
  ChefHat,
  LogOut
} from "lucide-react"

const sections = [
  {
    title: "Operación",
    icon: LayoutGrid,
    items: [
      { href: "/", label: "Inicio", icon: Home },
      { href: "/finanzas", label: "Flujo de Caja", icon: DollarSign },
      { href: "/finanzas/iva", label: "Gestión de IVA", icon: Calculator },
      { href: "/crm", label: "CRM Comercial", icon: TrendingUp },
      { href: "/clients", label: "Clientes", icon: Users },
      { href: "/coordinadores", label: "Coordinadores", icon: User },
      { href: "/buses", label: "Flota & Buses", icon: Bus },
    ]
  },
  {
    title: "Eventos",
    icon: Calendar,
    items: [
      { href: "/settings/eventos", label: "Gestión de Eventos", icon: CalendarDays },
      { href: "/ventas-evento", label: "Ventas por Evento", icon: DollarSign },
      { href: "/logistica-compras", label: "Efectividad de Shows", icon: BarChart3 },
      { href: "/settings/reglas-precios", label: "Reglas de Precios", icon: Tag },
      { href: "/reglas-liberados", label: "Liberados", icon: Gift },
    ]
  },
  {
    title: "Producción",
    icon: Factory,
    items: [
      { href: "/produccion", label: "Consolidado Cocina", icon: ChefHat },
      { href: "/recitales-staging", label: "Recitales (Staging)", icon: ClipboardList },
      { href: "/inventario/proyeccion", label: "Proyección de Insumos", icon: Calculator },
      { href: "/inventario/recetas", label: "Maestro de Recetas", icon: BookOpen },
      { href: "/inventario/catalogo", label: "Catálogo de Productos", icon: PackageSearch },
    ]
  },
  {
    title: "Inventario",
    icon: Warehouse,
    items: [
      { href: "/inventario/stock", label: "Control de Stock", icon: Boxes },
      { href: "/inventario/trazabilidad", label: "Auditoría de Stock", icon: ClipboardList },
      { href: "/inventario/productos", label: "Productos e Insumos", icon: PackageSearch },
      { href: "/inventario/ajustes", label: "Ajustes de Inventario", icon: AlertTriangle },
      { href: "/inventario/ordenes-compra", label: "Órdenes de Compra", icon: Truck },
      { href: "/inventario/familias", label: "Familias de Insumos", icon: Layers },
      { href: "/inventario/rubros-comida", label: "Categorías de Cocina", icon: ChefHat },
      { href: "/inventario/proveedores", label: "Proveedores", icon: Truck },
    ]
  },
  {
    title: "Informes",
    icon: BarChart3,
    items: [
      { href: "/informes", label: "Central de Informes", icon: ClipboardList },
      { href: "/informes/flujo-caja", label: "Análisis de Caja", icon: DollarSign },
      { href: "/informes/proyectado-vs-ventas", label: "Proyectado vs Ventas", icon: BarChart3 },
      { href: "/informes/rv-traslados", label: "Desempeño RV Traslados", icon: TrendingUp },
      { href: "/informes/financieros", label: "Rentabilidad y Costos", icon: Layers },
    ]
  },
  {
    title: "Sistema",
    icon: Settings,
    items: [
      { href: "/settings", label: "Configuración", icon: Settings },
      { href: "/vehicle-defaults", label: "Defaults Vehículos", icon: Car },
    ]
  }
]

export default function Sidebar() {
  const pathname = usePathname()
  const [openSections, setOpenSections] = useState<string[]>(['Operación', 'Inventario', 'Informes'])
  const [role, setRole] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Bypass temporal para asegurar acceso admin
        if (user.email === 'fschottenfeld@gmail.com') {
          setRole('admin')
          return
        }
        // Bypass temporal para el usuario de cocina
        if (user.email === 'cocina@supercatering.com' || user.email === 'alpaso.algalope@gmail.com') {
          setRole('cocina')
          return
        }
        const roleFromMeta = user.app_metadata?.role || user.user_metadata?.role
        setRole(roleFromMeta || 'cocina')
      }
    }
    loadRole()
  }, [])

  const toggleSection = (title: string) => {
    setOpenSections((prev: string[]) => 
      prev.includes(title) 
        ? prev.filter((t: string) => t !== title) 
        : [...prev, title]
    )
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const filteredSections = sections.map((section: any) => {
    if (role === 'cocina') {
      const allowedItems = section.items.filter((item: any) => {
        const restricted = [
          '/crm', '/clients', '/coordinadores', '/buses', 
          '/settings/reglas-precios', '/reglas-liberados', '/informes',
          '/settings', '/vehicle-defaults', '/inventario/recetas'
        ]
        return !restricted.includes(item.href)
      })
      if (allowedItems.length === 0) return null
      return { ...section, items: allowedItems }
    }
    return section
  }).filter(s => s !== null) as typeof sections

  return (
    <aside className="w-64 h-screen bg-[#0f172a] border-r border-slate-800/50 flex flex-col shadow-2xl z-20 flex-shrink-0 overflow-hidden">
      <div className="p-8 mb-4 flex-shrink-0">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:bg-indigo-500 transition-colors">
            <Warehouse className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-white font-black text-lg tracking-tighter uppercase italic leading-tight group-hover:text-indigo-400 transition-colors">Super Catering</h2>
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em]">Management System</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 flex flex-col gap-2 px-4 overflow-y-auto custom-scrollbar">
        {filteredSections.map((section) => {
          const isOpen = openSections.includes(section.title)
          const SectionIcon = section.icon

          return (
            <div key={section.title} className="flex flex-col gap-1 pb-4 mb-2 border-b border-slate-800/40 last:border-0">
              <button 
                onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-slate-800/40 transition-all group text-left w-full"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${isOpen ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                    <SectionIcon size={18} />
                  </div>
                  <h3 className={`text-[11px] font-black uppercase tracking-widest transition-colors ${isOpen ? 'text-indigo-100' : 'text-slate-500 group-hover:text-slate-300'}`}>
                    {section.title}
                  </h3>
                </div>
                {isOpen ? (
                  <ChevronDown size={14} className="text-slate-600" />
                ) : (
                  <ChevronRight size={14} className="text-slate-600" />
                )}
              </button>

              <div className={`flex flex-col gap-1 overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[600px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  const ItemIcon = item.icon

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all relative
                        ${isActive 
                          ? 'bg-indigo-600/10 text-white font-bold' 
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
                        }
                      `}
                    >
                      {isActive && (
                        <div className="absolute left-0 w-1 h-5 bg-indigo-500 rounded-r-full" />
                      )}
                      <ItemIcon 
                        size={16} 
                        className={`transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400'}`} 
                      />
                      <span className="text-sm tracking-tight">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-slate-800/50 flex-shrink-0">
        <div className="px-4 py-2 mb-2">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Usuario: <span className="text-indigo-400">{role || 'Cargando...'}</span></p>
        </div>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all font-black text-xs uppercase tracking-widest"
        >
          <LogOut size={18} />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}