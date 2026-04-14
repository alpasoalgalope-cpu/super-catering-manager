import DashboardCard from "@/components/ui/DashboardCard";
import { Users, Calendar, DollarSign, Activity } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">
            Panel de Control
          </h2>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          title="Eventos este Mes"
          value="12"
          description="+2 desde el mes pasado"
          icon={<Calendar size={20} />}
        />
        <DashboardCard
          title="Clientes Activos"
          value="48"
          description="+5 nuevos clientes"
          icon={<Users size={20} />}
        />
        <DashboardCard
          title="Ingresos Estimados"
          value="$12,450"
          description="+15% respecto al mes anterior"
          icon={<DollarSign size={20} />}
        />
        <DashboardCard
          title="Viandas Pendientes"
          value="156"
          description="Para entrega esta semana"
          icon={<Activity size={20} />}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800">Próximos Eventos</h3>
        <p className="mt-2 text-sm text-slate-500">
          Placeholder para lista de eventos próximos.
        </p>
      </div>
    </div>
  );
}