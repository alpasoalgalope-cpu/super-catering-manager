import Link from "next/link"

const menuItems = [
  { href: "/", label: "Inicio" },
  { href: "/clients", label: "Clientes" },
  { href: "/events", label: "Eventos" },
  { href: "/buses", label: "Buses" },
  { href: "/reglas-liberados", label: "Reglas de liberados" },
  { href: "/ventas-evento", label: "Ventas por evento" },
  { href: "/coordinadores", label: "Coordinadores" },
  { href: "/productos", label: "Productos" },
  { href: "/vehicle-defaults", label: "Defaults vehículos" },
  { href: "/recitales-staging", label: "Recitales staging" },
  { href: "/produccion", label: "Producción" },
  { href: "/settings/eventos", label: "Gestión de Eventos" },
  { href: "/settings/reglas-precios", label: "Reglas de Precios" },
  { href: "/settings", label: "Configuración" },
]

export default function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-slate-100 p-4">
      <nav className="flex flex-col gap-2">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 rounded-md hover:bg-slate-200 transition"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}