import { supabase } from "@/lib/supabase"
import NewProductButton from "@/components/forms/NewProductButton"

export const dynamic = "force-dynamic"

export default async function ProductsPage() {
  const { data: products, error } = await supabase
    .from("sandwich_catalog")
    .select("*")
    .order("name", { ascending: true })

  if (error) {
    return (
      <div className="p-4 rounded border border-red-200 bg-red-50 text-red-600">
        Error al cargar los productos: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Catálogo de Productos
          </h1>
          <p className="text-sm text-slate-500">
            Gestión de sándwiches y otros ítems tercerizados o de producción propia.
          </p>
        </div>
        <NewProductButton />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#EAF4F4] text-slate-700 uppercase text-xs tracking-wide">
              <th className="text-left p-4 font-semibold border-b border-slate-200">
                Nombre
              </th>
              <th className="text-left p-4 font-semibold border-b border-slate-200">
                Tipo
              </th>
              <th className="text-left p-4 font-semibold border-b border-slate-200">
                Gluten Free
              </th>
              <th className="text-left p-4 font-semibold border-b border-slate-200">
                Observaciones
              </th>
              <th className="text-left p-4 font-semibold border-b border-slate-200">
                Tercerizado
              </th>
            </tr>
          </thead>
          <tbody>
            {products?.map((product, i) => (
              <tr
                key={product.id || i}
                className="border-b border-slate-100 hover:bg-slate-50 transition"
              >
                <td className="p-4 text-slate-800 font-medium">
                  {product.name ?? "-"}
                </td>
                <td className="p-4 text-slate-600">
                  {product.type ?? "-"}
                </td>
                <td className="p-4">
                  {product.is_gluten_free ? (
                    <span className="inline-flex items-center rounded-full bg-[#A8D8B9]/20 px-2 py-1 text-xs font-semibold text-[#6BAA82]">
                      Sí
                    </span>
                  ) : (
                    <span className="text-slate-400 text-sm">No</span>
                  )}
                </td>
                <td className="p-4 text-slate-500 text-sm">
                  {product.restrictions ?? "-"}
                </td>
                <td className="p-4">
                  {product.is_outsourced ? (
                    <span className="inline-flex items-center rounded-full bg-[#CDB4DB]/20 px-2 py-1 text-xs font-semibold text-[#9F7AAB]">
                      Sí
                    </span>
                  ) : (
                    <span className="text-slate-400 text-sm">No</span>
                  )}
                </td>
              </tr>
            ))}

            {!products?.length && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  No hay productos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
