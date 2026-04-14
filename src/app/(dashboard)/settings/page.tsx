import { Button, Input } from '@/components/ui/FormElements';

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
    </div>
  );
}
