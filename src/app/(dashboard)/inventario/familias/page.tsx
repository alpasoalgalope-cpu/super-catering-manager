import { supabase } from "@/lib/supabase"
import { Trash2, Tag } from "lucide-react"
import { deleteFamiliaAction } from "@/app/actions/inventory"
import FamiliaForm from "@/components/forms/FamiliaForm"

export const dynamic = "force-dynamic"

export default async function FamiliasPage() {
  const { data: familias } = await supabase.from("familias").select("*").order("nombre")

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-black tracking-tighter text-slate-800 uppercase">Familias de Insumos</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">Categorización de productos para reportes y filtros.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="md:col-span-1">
          <FamiliaForm />
        </div>

        {/* List Column */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Familia</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {familias?.map(f => (
                  <tr key={f.id} className="group hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 font-bold text-slate-700 flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-500"><Tag size={14} /></div>
                      {f.nombre}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <form action={async () => { "use server"; await deleteFamiliaAction(f.id); }}>
                        <button type="submit" className="p-2 text-slate-300 hover:text-rose-500 transition">
                          <Trash2 size={16} />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {(!familias || familias.length === 0) && (
                  <tr>
                    <td colSpan={2} className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                      No hay familias cargadas
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
