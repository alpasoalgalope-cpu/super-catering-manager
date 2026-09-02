import { supabase } from "@/lib/supabase"
import CatalogManager from "@/components/inventory/CatalogManager"
import { Tags } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function CatalogoConsultaPage() {
  const [
    { data: productos },
    { data: familias },
    { data: proveedores }
  ] = await Promise.all([
    supabase
      .from("productos")
      .select("*, familias(nombre), proveedores!productos_proveedor_id_fkey(nombre), precios_historicos(*), producto_proveedores(proveedor_id, proveedores!producto_proveedores_proveedor_id_fkey(nombre))")
      .order("nombre"),
    supabase.from("familias").select("*").order("nombre"),
    supabase.from("proveedores").select("*").order("nombre")
  ])

  return (
    <div className="p-6 md:p-10 space-y-10 w-full animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-indigo-500">
            <Tags size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-indigo-50 rounded">Consulta Operativa</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase italic">Catálogo de Insumos</h1>
          <p className="text-slate-500 font-medium max-w-2xl text-xs uppercase tracking-widest">
            Hoja de costos y mermas homologadas para consulta técnica.
          </p>
        </div>
      </div>

      {/* Componente de Gestión de Lista y Búsqueda */}
      <CatalogManager 
        productos={productos || []} 
        familias={familias || []}
        proveedores={proveedores || []}
      />
    </div>
  )
}
