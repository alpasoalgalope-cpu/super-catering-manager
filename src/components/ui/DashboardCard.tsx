// components/dashboard/DashboardCard.tsx
import React from 'react'

type DashboardCardProps = {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  color?: 'purple' | 'emerald' | 'slate' // Para diferenciar métricas
  href?: string
}

export default function DashboardCard({
  title,
  value,
  subtitle,
  icon,
  color = 'purple',
  href
}: DashboardCardProps) {

  const colorMap = {
    purple: "bg-purple-50 text-purple-600",
    emerald: "bg-emerald-50 text-emerald-600",
    slate: "bg-slate-50 text-slate-600",
  }

  const InnerCard = (
    <div className={`rounded-2xl border ${href ? 'border-indigo-100 hover:border-indigo-300 shadow-sm hover:shadow-md cursor-pointer' : 'border-slate-100 shadow-sm'} bg-white p-6 transition-all duration-300 group`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 group-hover:text-indigo-600 transition-colors">{title}</p>
          <h3 className="mt-3 text-3xl font-bold text-slate-800">{value}</h3>
          {subtitle && <p className="mt-2 text-sm text-slate-400 font-medium">{subtitle}</p>}
        </div>

        <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${href ? 'group-hover:bg-indigo-100 group-hover:text-indigo-600' : ''} ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  )

  if (href) {
     const Link = require('next/link').default
     return <Link href={href} className="block w-full">{InnerCard}</Link>
  }

  return InnerCard
}