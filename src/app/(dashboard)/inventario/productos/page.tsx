import { supabase } from "@/lib/supabase"
import ProductManager from "@/components/inventory/ProductManager"
import { AlertCircle } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ProductosMaestroPage() {
  const [{ data: familias }, { data: proveedores }, { data: productos }] = await Promise.all([
    supabase.from("familias").select("*").order("nombre"),
    supabase.from("proveedores").select("*").order("nombre"),
    supabase.from("productos")
      .select("*, familias(nombre), proveedores!productos_proveedor_id_fkey(nombre), precios_historicos(*), producto_proveedores(proveedor_id, proveedores!producto_proveedores_proveedor_id_fkey(nombre))")
      .order("nombre")
  ])

  return (
    <div className="space-y-6 p-6 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-slate-800 uppercase italic">Maestro de Insumos</h1>
          <p className="text-sm font-medium text-slate-500 mt-1 uppercase text-[10px] tracking-widest font-black">Gestión operativa de mercadería y mermas.</p>
        </div>
        <div className="flex gap-3">
           <a href="/inventario/familias" className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition shadow-sm">
             Config. Familias
           </a>
           <a href="/inventario/proveedores" className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition shadow-sm">
             Config. Proveedores
           </a>
        </div>
      </div>

      {(!familias?.length || !proveedores?.length) && (
        <div className="bg-rose-50 border border-rose-100 text-rose-600 p-6 rounded-[2rem] flex items-center gap-6 text-sm font-bold shadow-sm animate-pulse">
          <div className="p-3 bg-white rounded-2xl text-rose-500 shadow-sm"><AlertCircle size={24} /></div>
          <div>
            <p className="text-base font-black uppercase tracking-tight">Acción Requerida</p>
            <p className="font-medium opacity-80">Faltan Familias o Proveedores. Debes cargarlos para poder dar de alta Productos.</p>
          </div>
        </div>
      )}

      {/* Gestor de Productos (Alta, Edición y Listado) */}
      <ProductManager 
        initialProductos={productos || []} 
        familias={familias || []} 
        proveedores={proveedores || []} 
      />
    </div>
  )
}
