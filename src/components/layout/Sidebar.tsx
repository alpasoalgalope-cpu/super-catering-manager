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
  Store,
  LogOut,
  Wallet,
  Sparkles,
  PieChart,
  ShieldCheck,
  Sliders,
  Utensils,
  PanelLeftClose
} from "lucide-react"
import { useSidebar } from "./SidebarContext"

const sections = [
  {
    title: "Accesos Frecuentes",
    icon: Sparkles,
    items: [
      { href: "/settings/eventos", label: "Gestión de Eventos", icon: CalendarDays },
      { href: "/inventario/proyeccion", label: "Proyección de Insumos", icon: Calculator },
      { href: "/inventario/ordenes-compra", label: "Órdenes de Compra", icon: Truck },
      { href: "/ventas-online", label: "Ventas Online", icon: Store },
      { href: "/ventas-evento", label: "Ventas por Evento", icon: DollarSign },
      { href: "/produccion", label: "Consolidado Cocina", icon: ChefHat },
      { href: "/informes", label: "Central de Informes", icon: BarChart3 },
    ]
  },
  {
    title: "Clientes",
    icon: Users,
    items: [
      { href: "/crm", label: "CRM Comercial", icon: TrendingUp },
      { href: "/settings/reglas-precios", label: "Reglas de Precios", icon: Tag },
      { href: "/clients", label: "Clientes", icon: Users },
      { href: "/buses", label: "Flota & Buses", icon: Bus },
      { href: "/coordinadores", label: "Coordinadores", icon: User },
      { href: "/reglas-liberados", label: "Liberados", icon: Gift },
    ]
  },
  {
    title: "Operación de Cocina",
    icon: ChefHat,
    items: [
      { href: "/inventario/rubros-comida", label: "Categorías de Cocina", icon: Utensils },
      { href: "/inventario/proveedores", label: "Proveedores", icon: Truck },
      { href: "/inventario/familias", label: "Familias de Insumos", icon: Layers },
      { href: "/inventario/productos", label: "Productos e Insumos", icon: PackageSearch },
      { href: "/inventario/catalogo", label: "Catálogo de Productos", icon: Boxes },
      { href: "/inventario/recetas", label: "Maestro de Recetas", icon: BookOpen },
      { href: "/inventario/stock", label: "Control de Stock", icon: Warehouse },
      { href: "/inventario/trazabilidad", label: "Auditoría de Stock", icon: ClipboardList },
      { href: "/inventario/ajustes", label: "Ajustes de Inventario", icon: AlertTriangle },
    ]
  },
  {
    title: "Finanzas e Informes",
    icon: BarChart3,
    items: [
      { href: "/informes", label: "Central de Informes", icon: BarChart3 },
      { href: "/finanzas/categorias", label: "Categorías de Gastos", icon: Layers },
      { href: "/informes/flujo-caja", label: "Análisis de Caja", icon: DollarSign },
    ]
  },
  {
    title: "Tesorería",
    icon: Wallet,
    items: [
      { href: "/finanzas/tesoreria", label: "Tesorería", icon: Wallet },
      { href: "/informes/financieros", label: "Rentabilidad y Costos", icon: PieChart },
    ]
  },
  {
    title: "Recursos Humanos",
    icon: ShieldCheck,
    items: [
      { href: "/rrhh", label: "Panel Admin", icon: ClipboardList },
      { href: "/rrhh/portal", label: "Mi Portal", icon: User },
    ]
  },
  {
    title: "Configuración",
    icon: Settings,
    items: [
      { href: "/settings", label: "Configuración", icon: Sliders },
    ]
  }
]

export default function Sidebar() {
  const pathname = usePathname()
  const [openSections, setOpenSections] = useState<string[]>([
    'Accesos Frecuentes', 
    'Clientes', 
    'Operación de Cocina',
    'Finanzas e Informes',
    'Tesorería',
    'Recursos Humanos',
    'Configuración'
  ])
  const [role, setRole] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const { isOpen, toggleSidebar } = useSidebar()

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
    if (role === 'admin') {
      return section
    }

    if (role === 'cocina') {
      const allowedItems = section.items.filter((item: any) => {
        const restricted = [
          '/crm', '/clients', '/coordinadores', '/buses', 
          '/settings/reglas-precios', '/reglas-liberados', '/informes',
          '/vehicle-defaults', '/inventario/recetas',
          '/rrhh', '/finanzas/tesoreria', '/finanzas/categorias', '/informes/financieros'
        ]
        // Allow Gestión de Eventos, Ventas por Evento y Ventas Online for cocina
        if (item.href === '/settings/eventos') return true
        if (item.href === '/ventas-evento') return true
        if (item.href === '/ventas-online') return true
        if (item.href === '/settings') return false
        return !restricted.includes(item.href)
      })
      if (allowedItems.length === 0) return null
      return { ...section, items: allowedItems }
    }

    if (role === 'empleado') {
      const allowedItems = section.items.filter((item: any) => {
        return item.href === '/rrhh/portal'
      })
      if (allowedItems.length === 0) return null
      return { ...section, items: allowedItems }
    }

    // Por defecto, solo ver el portal
    const allowedItems = section.items.filter((item: any) => {
      return item.href === '/rrhh/portal'
    })
    if (allowedItems.length === 0) return null
    return { ...section, items: allowedItems }
  }).filter(s => s !== null) as typeof sections

  return (
    <aside className={`h-screen bg-[#0f172a] border-r border-slate-800/50 flex flex-col shadow-2xl z-30 flex-shrink-0 transition-all duration-300 ease-in-out ${
      isOpen ? "w-64 opacity-100" : "w-0 opacity-0 pointer-events-none -translate-x-full overflow-hidden"
    }`}>
      {/* Top Logo Button - Always redirects to Home */}
      <div className="p-6 pb-4 flex-shrink-0 border-b border-slate-800/60 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group cursor-pointer min-w-0" title="Ir al Inicio">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:bg-indigo-500 group-hover:scale-105 transition-all shrink-0">
            <Warehouse className="text-white" size={20} />
          </div>
          <div className="truncate">
            <h2 className="text-white font-black text-lg tracking-tighter uppercase italic leading-tight group-hover:text-indigo-400 transition-colors truncate">
              Super Catering
            </h2>
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] truncate">
              Management System
            </p>
          </div>
        </Link>
        <button
          onClick={toggleSidebar}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition cursor-pointer shrink-0 ml-1"
          title="Ocultar menú lateral"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {filteredSections.map((section) => {
          const isOpen = openSections.includes(section.title)
          const SectionIcon = section.icon

          return (
            <div key={section.title} className="space-y-1">
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-black text-slate-400 hover:text-slate-200 uppercase tracking-wider rounded-xl hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <SectionIcon size={14} className="text-indigo-400" />
                  <span>{section.title}</span>
                </div>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {isOpen && (
                <div className="space-y-0.5 pl-2 mt-1">
                  {section.items.map((item: any) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                    const ItemIcon = item.icon

                    return (
                      <Link
                        key={item.href + item.label}
                        href={item.href}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          isActive
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                            : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/40"
                        }`}
                      >
                        <ItemIcon size={15} className={isActive ? "text-white" : "text-slate-400"} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* User / Logout */}
      <div className="p-4 border-t border-slate-800/60 bg-slate-900/40 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0">
            {role === 'admin' ? 'AD' : role === 'cocina' ? 'CO' : 'EM'}
          </div>
          <div className="truncate">
            <p className="text-xs font-bold text-slate-200 truncate uppercase tracking-wider">
              {role === 'admin' ? 'Admin' : role === 'cocina' ? 'Cocina' : 'Empleado'}
            </p>
            <p className="text-[10px] text-slate-500 font-medium truncate">Online</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
          title="Cerrar sesión"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}
