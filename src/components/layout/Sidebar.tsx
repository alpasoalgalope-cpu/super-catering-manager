import Link from "next/link"

const menuItems = [
  { href: "/", label: "Inicio" },
  { href: "/clients", label: "Clientes" },
  { href: "/events", label: "Eventos" },
  { href: "/buses", label: "Buses" },
  { href: "/pricing-rules", label: "Reglas de precios" },
  { href: "/free-meal-rules", label: "Reglas de liberados" },
  { href: "/free-meals", label: "Liberados" },
  { href: "/event-sales-units", label: "Ventas por evento" },
  { href: "/products", label: "Productos" },
  { href: "/vehicle-defaults", label: "Defaults vehículos" },
  { href: "/recitales-staging", label: "Recitales staging" },
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