"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  ChevronDown, 
  ChevronRight, 
  LayoutGrid, 
  Users, 
  Bus, 
  User, 
  Calendar, 
  ClipboardCheck, 
  DollarSign, 
  Settings, 
  Warehouse,
  Truck,
  Box,
  TrendingUp,
  Tag,
  Package,
  Factory,
  Database,
  Car,
  Calculator
} from "lucide-react"

const sections = [
  {
    title: "Operación",
    icon: LayoutGrid,
    items: [
      { href: "/", label: "Inicio", icon: LayoutGrid },
      { href: "/crm", label: "CRM Comercial", icon: TrendingUp },
      { href: "/clients", label: "Clientes", icon: Users },
      { href: "/buses", label: "Buses", icon: Bus },
      { href: "/coordinadores", label: "Coordinadores", icon: User },
    ]
  },
  {
    title: "Eventos",
    icon: Calendar,
    items: [
      { href: "/settings/eventos", label: "Gestión de Eventos", icon: Calendar },
      { href: "/logistica-compras", label: "Efectividad de Shows", icon: TrendingUp },
      { href: "/reglas-liberados", label: "Reglas de Liberados", icon: ClipboardCheck },
      { href: "/ventas-evento", label: "Ventas por Evento", icon: DollarSign },
      { href: "/settings/reglas-precios", label: "Reglas de Precios", icon: Tag },
      { href: "/produccion", label: "Producción", icon: Factory },
      { href: "/recitales-staging", label: "Recitales Staging", icon: Database },
    ]
  },
  {
    title: "Stock e Inventario",
    icon: Warehouse,
    items: [
      { href: "/inventario/catalogo", label: "Consulta de Catálogo", icon: Package },
      { href: "/inventario/recetas", label: "Maestro de Recetas", icon: Box },
      { href: "/inventario/proyeccion", label: "Proyección de Insumos", icon: Calculator },
      { href: "/inventario/rubros-comida", label: "Categorías de Cocina", icon: Tag },
      { href: "/inventario/productos", label: "Maestro de Productos", icon: Box },
      { href: "/inventario/familias", label: "Familias de Insumos", icon: Factory },
      { href: "/inventario/proveedores", label: "Proveedores", icon: Truck },
      { href: "/inventario/stock", label: "Movimientos de Stock", icon: Warehouse },
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
  const [openSections, setOpenSections] = useState<string[]>(["Operación", "Eventos", "Stock e Inventario", "Sistema"])

  const toggleSection = (title: string) => {
    setOpenSections(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title) 
        : [...prev, title]
    )
  }

  return (
    <aside className="w-64 h-screen bg-[#0f172a] border-r border-slate-800/50 flex flex-col shadow-2xl z-20 flex-shrink-0 overflow-y-auto custom-scrollbar">
      <div className="p-8 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Warehouse className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-white font-black text-lg tracking-tighter uppercase italic leading-tight">Super Catering</h2>
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em]">Management System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-2 px-4 overflow-y-auto custom-scrollbar pb-10">
        {sections.map((section) => {
          const isOpen = openSections.includes(section.title)
          const SectionIcon = section.icon

          return (
            <div key={section.title} className="flex flex-col gap-1 mb-2">
              <button 
                onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-slate-800/40 transition-all group text-left"
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

    </aside>
  )
}