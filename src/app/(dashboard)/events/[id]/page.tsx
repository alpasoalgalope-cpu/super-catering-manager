import { Button } from '@/components/ui/FormElements';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { Users, Clock, ChefHat } from 'lucide-react';

export default function EventDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Detalles del Evento</h2>
          <p className="text-sm text-foreground/50">ID: {params.id}</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-surface border border-surface-elevated text-foreground hover:bg-surface-elevated">Editar</Button>
          <Button>Aprobar Presupuesto</Button>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-3">
        <DashboardCard title="Invitados Confirmados" value="120" icon={<Users size={20} />} />
        <DashboardCard title="Hora de Servicio" value="21:00 hs" icon={<Clock size={20} />} />
        <DashboardCard title="Menús Especiales" value="5" description="3 Celíacos, 2 Veganos" icon={<ChefHat size={20} />} />
      </div>

      <div className="p-6 bg-surface border border-surface-elevated rounded-xl">
        <h3 className="text-lg font-medium mb-4">Planificación de Viandas</h3>
        <p className="text-sm text-foreground/50 mb-4">Aquí se listarán los platos, stock necesario y asignación de personal.</p>
      </div>
    </div>
  );
}
