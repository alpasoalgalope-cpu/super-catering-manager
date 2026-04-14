type DashboardCardProps = {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
}

export default function DashboardCard({
  title,
  value,
  subtitle,
  icon,
}: DashboardCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <h3 className="mt-3 text-3xl font-semibold text-slate-800">{value}</h3>
          {subtitle && <p className="mt-2 text-sm text-slate-400">{subtitle}</p>}
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF4F4] text-[#7FB3D5]">
          {icon}
        </div>
      </div>
    </div>
  )
}