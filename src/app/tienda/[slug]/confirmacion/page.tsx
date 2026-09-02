import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { CheckCircle, XCircle, Clock, ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: {
    slug: string
  }
  searchParams: {
    status?: string
    order_id?: string
    payment_id?: string
    external_reference?: string
  }
}

export default async function ConfirmationPage({ params, searchParams }: Props) {
  const { status, order_id, payment_id } = searchParams

  // Fallback update of the order status if we arrive here and it's approved
  if (order_id && status === 'approved') {
    await supabase
      .from('online_orders')
      .update({ 
        status: 'paid', 
        mp_status: 'approved',
        mp_payment_id: payment_id || null
      })
      .eq('id', order_id)
  }

  const renderContent = () => {
    switch (status) {
      case 'approved':
        return (
          <>
            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase text-center mb-4">
              ¡Pago Exitoso!
            </h1>
            <p className="text-slate-400 text-center mb-8 text-lg">
              Tu pedido ha sido confirmado. Te esperamos en el viaje.
            </p>
            {order_id && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 w-full mb-8 text-center">
                <p className="text-sm text-slate-500 uppercase tracking-wider mb-1">Número de Orden</p>
                <p className="font-mono text-white text-lg">{order_id.slice(0, 8).toUpperCase()}</p>
              </div>
            )}
          </>
        )
      case 'failure':
        return (
          <>
            <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-red-500/20">
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase text-center mb-4">
              Algo salió mal
            </h1>
            <p className="text-slate-400 text-center mb-8 text-lg">
              No pudimos procesar tu pago. Por favor, intenta nuevamente.
            </p>
          </>
        )
      case 'pending':
        return (
          <>
            <div className="w-24 h-24 bg-amber-500/20 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-amber-500/20">
              <Clock className="w-12 h-12 text-amber-500" />
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase text-center mb-4">
              Pago Pendiente
            </h1>
            <p className="text-slate-400 text-center mb-8 text-lg">
              Estamos procesando tu pago. Te notificaremos cuando se apruebe.
            </p>
          </>
        )
      default:
        return (
          <>
            <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase text-center mb-4">
              Estado Desconocido
            </h1>
            <p className="text-slate-400 text-center mb-8 text-lg">
              No pudimos determinar el estado de tu pago.
            </p>
          </>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-indigo-950/20 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full flex flex-col items-center bg-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
        
        {renderContent()}

        <Link 
          href={`/tienda/${params.slug}`}
          className="flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 rounded-full py-4 px-6 font-bold uppercase tracking-widest text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la tienda
        </Link>
      </div>
    </div>
  )
}
