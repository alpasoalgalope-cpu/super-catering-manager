import { getIVABalance, getComprobantesPeriodo } from "@/app/actions/iva"
import IvaDashboard from "@/components/finances/IvaDashboard"

export const dynamic = 'force-dynamic'

export default async function IvaPage() {
  // Determine current period based on current calendar date (e.g. "2026-05")
  const now = new Date()
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Fetch initial calculations and list for the current month
  const balanceRes = await getIVABalance(currentPeriod)
  const compsRes = await getComprobantesPeriodo(currentPeriod)

  const initialBalance = balanceRes.success ? balanceRes.data : {
    periodo: currentPeriod,
    debito_fiscal_puro: 0,
    credito_fiscal_puro: 0,
    saldo_tecnico_anterior_trasladado: 0,
    saldo_tecnico_fisco: 0,
    saldo_tecnico_contribuyente_remanente: 0,
    saldo_libre_disp_anterior_trasladado: 0,
    retenciones_percepciones_del_mes: 0,
    saldo_libre_disp_remanente: 0,
    saldo_a_pagar: 0,
    saldo_anterior_manual: 0,
    cerrado: false,
    pagado: false,
    fecha_pago: null
  }

  const initialComprobantes = compsRes.success ? compsRes.data : []

  return (
    <div className="p-4 md:p-10 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <IvaDashboard 
        initialPeriod={currentPeriod}
        initialBalance={initialBalance}
        initialComprobantes={initialComprobantes || []}
      />
    </div>
  )
}
