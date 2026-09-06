"use client"

import React, { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { productFormSchema, ProductFormData, Familia, Proveedor, Producto } from "@/types/inventory"
import { createProductAction, updateProductAction } from "@/app/actions/inventory"
import { PackageSearch, Save, Calculator, CheckCircle2, AlertCircle, Loader2, X, Info } from "lucide-react"
import { normalizeCurrencyInput, formatMoneyAR, formatCurrencyAR } from "@/lib/currency"

interface Props {
  familias: Familia[]
  proveedores: Proveedor[]
  initialData?: Producto & { precio_neto?: number }
  onSuccess?: () => void
  onCancel?: () => void
}

export default function ProductForm({ familias, proveedores, initialData, onSuccess, onCancel }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const isEditing = !!initialData?.id

  const { register, handleSubmit, watch, formState: { errors }, reset, setValue } = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema) as any,
    defaultValues: {
      factor_merma: 100,
      iva_pct: 21.0,
      unidad_medida: 'gr',
      gramos_por_unidad: 1000,
      precio_neto: 0,
      proveedores_ids: []
    }
  })

  // Cargar datos cuando entra en modo edición
  useEffect(() => {
    if (initialData) {
      const additionalIds = (initialData.producto_proveedores || [])
        .filter((pp: any) => pp.proveedor_id !== initialData.proveedor_id)
        .map((pp: any) => pp.proveedor_id)

      reset({
        nombre: initialData.nombre,
        familia_id: initialData.familia_id,
        proveedor_id: initialData.proveedor_id,
        unidad_medida: initialData.unidad_medida,
        factor_merma: initialData.factor_merma * 100, // Convertir 0.9 a 90 para el input
        gramos_por_unidad: initialData.gramos_por_unidad,
        iva_pct: initialData.iva_pct,
        precio_neto: initialData.precio_neto || 0,
        proveedores_ids: additionalIds
      })
    } else {
      reset({
        factor_merma: 100,
        iva_pct: 21.0,
        unidad_medida: 'gr',
        gramos_por_unidad: 1000,
        precio_neto: 0,
        proveedores_ids: []
      })
    }
  }, [initialData, reset])

  // Watch variables to calculate real-time base cost preview
  const wPrecioNeto = watch("precio_neto")
  const wGramaje = watch("gramos_por_unidad")
  const wMerma = watch("factor_merma")
  const wUnidad = watch("unidad_medida")
  const wIvaPct = watch("iva_pct")

  // Robust parsing to avoid NaN/Infinity
  const nPrecioNeto = Number(wPrecioNeto) || 0
  const nGramaje = Number(wGramaje) || 0
  const nMerma = Number(wMerma) || 0
  const nIvaPct = Number(wIvaPct) || 0

  // Lógica de divisor: 1000 para peso/volumen (gr/ml), 1 para unidades
  const divisor = (wUnidad === 'un') ? 1 : 1000

  // CALCULO 1: Costo Operativo Neto Real (Para Recetas, por gramo/ml o por unidad)
  // Formula: (Precio Neto / Divisor) / (Rinde / 100)
  const realTimeCostBase = (nPrecioNeto > 0 && nMerma > 0) 
    ? (nPrecioNeto / divisor) / (nMerma / 100) 
    : 0

  // CALCULO 2: Total Bulto con IVA (Punto de Control vs Factura)
  // (Precio_Neto_Unitario * (Gramos_por_Unidad / Divisor)) * (1 + (IVA / 100))
  const totalBultoConIva = nPrecioNeto > 0 && nGramaje > 0 
    ? (nPrecioNeto * (nGramaje / divisor)) * (1 + (nIvaPct / 100))
    : 0

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true)
    setMessage(null)
    
    const result = isEditing 
      ? await updateProductAction(initialData!.id, data)
      : await createProductAction(data)
    
    if (result.success) {
      setMessage({ type: 'success', text: isEditing ? 'Producto actualizado correctamente.' : 'Producto creado existosamente.' })
      if (!isEditing) reset() 
      if (onSuccess) onSuccess()
    } else {
      setMessage({ type: 'error', text: result.error || 'Falló la operación' })
    }
    setIsSubmitting(false)
  }

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-slate-900 p-8 sm:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex justify-between items-center w-full">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 mb-2">
              <PackageSearch size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Maestro de Productos</span>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight italic uppercase italic">
              {isEditing ? 'Edición de Insumo' : 'Alta de Producto'}
            </h2>
          </div>
          {isEditing && (
            <button 
              onClick={onCancel}
              className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-2xl transition"
              title="Cancelar Edición"
            >
              <X size={24} />
            </button>
          )}
        </div>
      </div>

      <div className="p-8 sm:p-12 md:p-16">
        {message && (
          <div className={`mb-8 p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre del Producto</label>
              <input 
                {...register("nombre")}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 font-bold focus:border-indigo-400 focus:bg-white transition"
                placeholder="Ej: Harina 0000 Blancaflor"
              />
              {errors.nombre && <span className="text-xs font-bold text-rose-500">{errors.nombre.message}</span>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Familia</label>
                <select 
                  {...register("familia_id")}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 font-bold focus:border-indigo-400 focus:bg-white transition"
                >
                  <option value="">Seleccione...</option>
                  {familias.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
                {errors.familia_id && <span className="text-xs font-bold text-rose-500">{errors.familia_id.message}</span>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Proveedor Principal</label>
                <select 
                  {...register("proveedor_id")}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 font-bold focus:border-indigo-400 focus:bg-white transition"
                >
                  <option value="">Seleccione...</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                {errors.proveedor_id && <span className="text-xs font-bold text-rose-500">{errors.proveedor_id.message}</span>}
              </div>
            </div>

            {/* Additional Providers Selection */}
            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Proveedores Adicionales (Opcional)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl max-h-48 overflow-y-auto">
                {proveedores
                  .filter(p => p.id !== watch("proveedor_id"))
                  .map(p => (
                    <label key={p.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 hover:border-indigo-200 transition cursor-pointer select-none shadow-sm text-xs font-bold text-slate-700">
                      <input 
                        type="checkbox"
                        value={p.id}
                        {...register("proveedores_ids")}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 border-slate-300 cursor-pointer"
                      />
                      <span className="truncate">{p.nombre}</span>
                    </label>
                  ))}
              </div>
              {errors.proveedores_ids && <span className="text-xs font-bold text-rose-500 block">{errors.proveedores_ids.message}</span>}
            </div>
          </div>

          {/* Otros Proveedores Habilitados */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Otros Proveedores Habilitados</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl max-h-40 overflow-y-auto">
              {proveedores.map(p => {
                if (p.id === watch("proveedor_id")) return null
                return (
                  <label key={p.id} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer hover:text-indigo-600 transition">
                    <input 
                      type="checkbox"
                      value={p.id}
                      checked={watch("proveedores_ids")?.includes(p.id) || false}
                      onChange={(e) => {
                        const currentIds = watch("proveedores_ids") || []
                        if (e.target.checked) {
                          setValue("proveedores_ids", [...currentIds, p.id])
                        } else {
                          setValue("proveedores_ids", currentIds.filter(id => id !== p.id))
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    {p.nombre}
                  </label>
                )
              })}
            </div>
            {errors.proveedores_ids && <span className="text-xs font-bold text-rose-500 block">{errors.proveedores_ids.message}</span>}
          </div>

          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 font-black italic uppercase italic">
                <Calculator size={16} className="text-indigo-600" />
                Input Factura y Operación
              </h3>
              <div className="px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-lg uppercase tracking-widest">
                Modo: {wUnidad === 'un' ? 'X Unidad' : 'X Kilo/Litro'}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
               <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">U. Medida Base</label>
                <select 
                  {...register("unidad_medida")}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl outline-none font-bold text-slate-800 focus:border-indigo-400 transition"
                >
                  <option value="gr">Gramos (gr)</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="un">Unidades (un)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contenido Bulto</label>
                <input 
                  type="text" inputMode="decimal"
                  {...register("gramos_por_unidad")}
                  onChange={(e) => {
                    register("gramos_por_unidad").onChange(e);
                    const val = e.target.value.replace(/,/g, '.').replace(/[^\d.]/g, '');
                    e.target.value = val;
                  }}
                  placeholder={wUnidad === 'un' ? 'Ej: 1' : 'Ej: 4000'}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl outline-none font-bold text-center text-slate-800 focus:border-indigo-400 transition"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {wUnidad === 'un' ? 'Precio Neto Unitario ($)' : 'Precio Neto x Kg/Lt ($)'}
                </label>
                <div className="relative">
                  <input 
                    type="text"
                    {...register("precio_neto")}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9,.]/g, '');
                      setValue("precio_neto", normalizeCurrencyInput(val));
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder="0,00"
                    className="w-full px-3 py-3 border border-slate-200 rounded-xl outline-none font-black text-center text-indigo-600 focus:border-indigo-400 transition bg-indigo-50/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">$</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">IVA (%)</label>
                <input 
                  type="text" inputMode="decimal"
                  {...register("iva_pct")}
                  onChange={(e) => {
                    register("iva_pct").onChange(e);
                    const val = e.target.value.replace(/,/g, '.').replace(/[^\d.]/g, '');
                    e.target.value = val;
                  }}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl outline-none font-bold text-center text-slate-800 focus:border-indigo-400 transition"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rinde (%)</label>
                <input 
                  type="text"
                  {...register("factor_merma")}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9,.]/g, '');
                    setValue("factor_merma", normalizeCurrencyInput(val));
                  }}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl outline-none font-bold text-center text-rose-600 focus:border-indigo-400 transition bg-rose-50/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col p-5 bg-white rounded-2xl border border-slate-200 transition hover:border-indigo-200 group">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 group-hover:text-indigo-400 transition">Costo Real Neto x {wUnidad} (Sin IVA)</span>
                <span className="text-3xl font-black text-slate-900 tracking-tighter group-hover:text-indigo-700 transition">
                  {realTimeCostBase > 0 ? formatMoneyAR(realTimeCostBase) : "-"}
                </span>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase italic">* Basado en Rinde del {nMerma}%</p>
              </div>

              <div className="flex flex-col p-5 bg-emerald-600 rounded-2xl border border-emerald-500 shadow-xl shadow-emerald-200/50 transition hover:bg-emerald-700">
                <span className="text-[10px] font-black text-emerald-100 uppercase tracking-[0.2em] mb-1 italic">Total Bulto con IVA (Referencia Factura)</span>
                <span className="text-3xl font-black text-white tracking-tighter">
                  {totalBultoConIva > 0 ? formatMoneyAR(totalBultoConIva) : "-"}
                </span>
                <p className="text-[9px] font-bold text-emerald-200 mt-1 uppercase italic">* Comparar con total de ticket/factura física</p>
              </div>
            </div>

            {(errors.precio_neto || errors.gramos_por_unidad || errors.factor_merma) && (
               <div className="text-xs font-bold text-rose-500 text-center flex items-center justify-center gap-2">
                 <AlertCircle size={14} />
                 Revise los valores numéricos ingresados (Debe cargar al menos Precio y Contenido).
               </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="group px-10 py-5 bg-slate-900 text-white font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-indigo-600 active:scale-95 transition-all outline-none focus:ring-4 focus:ring-indigo-200 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-3 shadow-2xl shadow-slate-900/20"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {isEditing ? 'Confirmar Cambios' : 'Guardar Maestro Operativo'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

