import { supabase } from "@/lib/supabase"
import { Plus, Trash2, Truck, Phone } from "lucide-react"
import { deleteProveedorAction } from "@/app/actions/inventory"
import ProveedorForm from "@/components/forms/ProveedorForm"

export const dynamic = "force-dynamic"

export default async function ProveedoresPage() {
  const { data: proveedores } = await supabase.from("proveedores").select("*").order("nombre")

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-black tracking-tighter text-slate-800 uppercase">Proveedores de Insumos</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">Gestión de contactos y origen de mercadería.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="md:col-span-1">
          <ProveedorForm />
        </div>

        {/* List Column */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Proveedor</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Contacto</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {proveedores?.map(p => (
                  <tr key={p.id} className="group hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 font-bold text-slate-700 flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 rounded-lg text-emerald-500"><Truck size={14} /></div>
                      {p.nombre}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {p.contacto ? (
                        <div className="flex items-center gap-2 italic">
                          <Phone size={10} /> {p.contacto}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <form action={async () => { "use server"; await deleteProveedorAction(p.id); }}>
                        <button type="submit" className="p-2 text-slate-300 hover:text-rose-500 transition">
                          <Trash2 size={16} />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {(!proveedores || proveedores.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                      No hay proveedores cargados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
