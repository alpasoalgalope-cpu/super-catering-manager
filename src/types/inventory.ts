import { z } from "zod"

export type UnidadMedida = 'gr' | 'ml' | 'un'
export type TipoMovimientoStock = 'INGRESO_COMPRA' | 'EGRESO_MERMA' | 'EGRESO_CONSUMO' | 'EGRESO_VENTA' | 'AJUSTE_ARQUEO'

export interface Familia {
  id: string
  nombre: string
}

export interface Proveedor {
  id: string
  nombre: string
  contacto?: string
}

export interface Producto {
  id: string
  familia_id: string
  proveedor_id: string
  nombre: string
  unidad_medida: UnidadMedida
  factor_merma: number
  gramos_por_unidad: number
  iva_pct: number
  created_at: string
  // Joins
  precios_historicos?: PrecioHistorico[]
  proveedores?: { nombre: string }
  familias?: { nombre: string }
  producto_proveedores?: {
    proveedor_id: string
    proveedores?: { nombre: string }
  }[]
}

export interface PrecioHistorico {
  id: string
  producto_id: string
  fecha: string
  fecha_desde?: string
  created_at?: string
  precio_neto: number
  costo_unidad_base: number
  iva_porcentaje: number
}

export interface RubroComida {
  id: string
  nombre: string
}

export interface Receta {
  id: string
  nombre: string
  rubro_id: string | null
  es_producto_final: boolean
  precio_venta_sugerido: number
  version: string
  created_at: string
  // Joins
  rubros_comida?: { nombre: string }
  receta_insumos?: RecetaInsumo[]
}

export interface RecetaInsumo {
  id: string
  receta_id: string
  producto_id: string
  cantidad_necesaria: number
  created_at: string
  // Joins
  productos?: Producto
}

export const productFormSchema = z.object({
  familia_id: z.string().uuid("Seleccione una familia"),
  proveedor_id: z.string().uuid("Seleccione un proveedor"),
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  unidad_medida: z.enum(['gr', 'ml', 'un'], "Unidad requerida"),
  factor_merma: z.coerce.number().min(0.01).max(1000, "El rinde debe ser entre 0.01 y 1000"),
  gramos_por_unidad: z.coerce.number().min(0.01, "El contenido debe ser mayor a 0"),
  iva_pct: z.coerce.number().min(0, "IVA no puede ser negativo"),
  precio_neto: z.coerce.number().min(0, "El precio no puede ser negativo"),
  proveedores_ids: z.array(z.string().uuid()).optional()
}).refine(data => {
  if (data.proveedores_ids && data.proveedores_ids.includes(data.proveedor_id)) {
    return false
  }
  return true
}, {
  message: "El proveedor principal no puede estar seleccionado también como proveedor adicional",
  path: ["proveedores_ids"]
})

export type ProductFormData = z.infer<typeof productFormSchema>

export type PurchaseOrderStatus = 'PENDIENTE' | 'RECIBIDA' | 'CANCELADA'

export interface PurchaseOrder {
  id: string
  proveedor_id: string
  fecha_esperada: string
  estado: PurchaseOrderStatus
  costo_total: number
  created_at: string
  tipo_documento?: 'remito' | 'factura'
  nro_comprobante?: string | null
  percepcion_iva?: number
  percepcion_iibb?: number
  percepcion_ganancias?: number
  impuestos_internos?: number
  facturado?: boolean
  afip_comprobante_id?: string | null
  desvio_inflacion?: number
  // Joins
  proveedores?: { nombre: string }
  purchase_order_items?: PurchaseOrderItem[]
}

export interface PurchaseOrderItem {
  id: string
  po_id: string
  producto_id: string
  cantidad: number
  costo_unitario: number
  created_at: string
  // Joins
  productos?: Producto
}

