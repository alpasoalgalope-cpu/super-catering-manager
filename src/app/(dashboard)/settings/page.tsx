import { Button, Input } from '@/components/ui/FormElements';
import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configuración del Sistema</h2>
        <p className="text-sm text-foreground/50">Gestiona las preferencias de tu plataforma.</p>
      </div>

      <div className="p-6 bg-surface border border-surface-elevated rounded-xl space-y-4">
        <h3 className="text-lg font-medium">Perfil de la Empresa</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre de la Empresa</label>
            <Input defaultValue="Super Catering Manager" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email de Contacto</label>
            <Input defaultValue="contacto@supercatering.com" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Moneda por Defecto</label>
            <Input defaultValue="USD" />
          </div>
          <Button className="mt-4">Guardar Cambios</Button>
        </div>
      </div>

      <div className="p-6 bg-surface border border-surface-elevated rounded-xl space-y-4">
        <h3 className="text-lg font-medium">Herramientas y Datos</h3>
        <p className="text-sm text-foreground/50">Utilidades avanzadas de administración de datos.</p>
          <div className="flex flex-wrap gap-3">
            <Link 
              href="/settings/importar-historicos" 
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest border border-indigo-100 transition-all shadow-sm"
            >
              📂 Importar Eventos Históricos
            </Link>
            <Link 
              href="/ventas-evento/rv-coordinadores" 
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200 transition-all shadow-sm"
            >
              👤 Consolidación RV Coordinadores
            </Link>
          </div>
      </div>
    </div>
  );
}

