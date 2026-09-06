"use client";

import Link from "next/link";
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Users, 
  DollarSign, Sandwich, CheckCircle2, Clock, X, Store, ArrowRight, Music, CalendarDays
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export interface EventData {
  id: string;
  date: string;
  show: string;
  venue: string;
  status: string;
  projected: number;
  sold: number;
  revenue: number;
  projections?: {
    company: string;
    pax: number;
    adjusted: number;
  }[];
}

interface Props {
  events?: EventData[];
  role?: string | null;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function MonthlyScheduleCalendar({ events = [], role = null }: Props) {
  const supabase = createClient();
  const [internalEvents, setInternalEvents] = useState<EventData[]>(events);
  const [userRole, setUserRole] = useState<string | null>(role);
  const [selectedDayModal, setSelectedDayModal] = useState<{ dateStr: string; dayNumber: number; data: any } | null>(null);

  // Load user role and ensure events are populated from Supabase if prop is empty
  useEffect(() => {
    async function loadData() {
      // 1. Role
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (user.email === 'alpaso.algalope@gmail.com' || user.email === 'cocina@supercatering.com') {
          setUserRole('cocina');
        } else {
          setUserRole(user.app_metadata?.role || user.user_metadata?.role || 'admin');
        }
      }

      // 2. Fetch full events data if not passed or empty
      if (!events || events.length === 0) {
        const [{ data: masters }, { data: rulesData }, { data: clientsData }, { data: salesHeaders }] = await Promise.all([
          supabase
            .from('events_master')
            .select('id, event_date, show_name, status, venues(name), event_projections(company_name, projected_pax)')
            .order('event_date', { ascending: true }),
          supabase.from('commercial_rules').select('*'),
          supabase.from('clients').select('name, conversion_factor'),
          supabase.from('event_sales_headers').select('event_master_id, total_amount, total_sold')
        ]);

        if (masters) {
          const conversionMap: Record<string, number> = {};
          clientsData?.forEach(c => {
            if (c.name) conversionMap[c.name.trim().toLowerCase()] = Number(c.conversion_factor) || 1.0;
          });

          const rulesMap: Record<string, any> = {};
          rulesData?.forEach(r => {
            if (r.company_name) rulesMap[r.company_name.trim().toLowerCase()] = r;
          });

          const revenueByMaster: Record<string, number> = {};
          const soldByMaster: Record<string, number> = {};
          salesHeaders?.forEach(sh => {
            if (sh.event_master_id) {
              revenueByMaster[sh.event_master_id] = (revenueByMaster[sh.event_master_id] || 0) + (Number(sh.total_amount) || 0);
              soldByMaster[sh.event_master_id] = (soldByMaster[sh.event_master_id] || 0) + (Number(sh.total_sold) || 0);
            }
          });

          const mapped: EventData[] = masters.map((m: any) => {
            let totalAdjusted = 0;
            let totalProjectedRev = 0;
            const projections: any[] = [];

            m.event_projections?.forEach((p: any) => {
              const compKey = (p.company_name || '').trim().toLowerCase();
              const factor = conversionMap[compKey] || 1.0;
              const rule = rulesMap[compKey];
              const basePax = Number(p.projected_pax) || 0;
              const adj = basePax * factor;
              totalAdjusted += adj;
              projections.push({
                company: p.company_name,
                pax: basePax,
                adjusted: Math.round(adj)
              });

              if (rule) {
                totalProjectedRev += adj * (Number(rule.price_base) || 0);
              }
            });

            const eRev = revenueByMaster[m.id] || 0;
            const eSold = soldByMaster[m.id] || 0;
            const vName = m.venues?.name || '-';

            return {
              id: m.id,
              date: m.event_date,
              show: m.show_name,
              status: (m.status || 'pendiente').toLowerCase(),
              venue: vName,
              projected: Math.round(totalAdjusted),
              sold: eSold,
              revenue: eRev > 0 ? eRev : totalProjectedRev,
              projections
            };
          });

          setInternalEvents(mapped);
        }
      } else {
        setInternalEvents(events);
      }
    }

    loadData();
  }, [events, supabase]);

  const isCocina = userRole === 'cocina';

  // Selected month state
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const selectedYear = currentDate.getFullYear();
  const selectedMonth = currentDate.getMonth(); // 0-indexed

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(selectedYear, selectedMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(selectedYear, selectedMonth + 1, 1));
  };

  const handleToday = () => {
    const d = new Date();
    setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  // Group events by date (YYYY-MM-DD), STRICTLY EXCLUDING CANCELLED EVENTS
  const eventsByDate = useMemo(() => {
    const map: Record<string, {
      hasActiveEvents: boolean;
      shows: EventData[];
      totalPax: number;
      totalViandas: number;
      totalPossibleRevenue: number;
      confirmedPax: number;
      confirmedViandas: number;
      confirmedRevenue: number;
      pendingPax: number;
      pendingViandas: number;
      pendingRevenue: number;
    }> = {};

    internalEvents.forEach(ev => {
      if (!ev.date) return;
      const st = (ev.status || '').toLowerCase().trim();

      // STRICT RULE: Exclude cancelled events from the universe of the schedule
      if (st === 'cancelado' || st === 'cancelada') {
        return;
      }

      const dateKey = ev.date.split('T')[0].trim();
      if (!map[dateKey]) {
        map[dateKey] = {
          hasActiveEvents: true,
          shows: [],
          totalPax: 0,
          totalViandas: 0,
          totalPossibleRevenue: 0,
          confirmedPax: 0,
          confirmedViandas: 0,
          confirmedRevenue: 0,
          pendingPax: 0,
          pendingViandas: 0,
          pendingRevenue: 0
        };
      }

      map[dateKey].shows.push(ev);

      // Total raw passengers
      const paxFromProjections = ev.projections?.reduce((sum, p) => sum + (Number(p.pax) || 0), 0) || 0;
      const effectivePax = paxFromProjections > 0 ? paxFromProjections : ev.projected;
      const viandas = Number(ev.projected) || 0;
      const revenue = Number(ev.revenue) || 0;

      map[dateKey].totalPax += effectivePax;
      map[dateKey].totalViandas += viandas;
      map[dateKey].totalPossibleRevenue += revenue;

      if (st === 'confirmado' || st === 'ejecutado' || st === 'confirmada' || st === 'ejecutada') {
        map[dateKey].confirmedPax += effectivePax;
        map[dateKey].confirmedViandas += viandas;
        map[dateKey].confirmedRevenue += revenue;
      } else {
        // Pending status
        map[dateKey].pendingPax += effectivePax;
        map[dateKey].pendingViandas += viandas;
        map[dateKey].pendingRevenue += revenue;
      }
    });

    return map;
  }, [internalEvents]);

  // Generate calendar grid structure (Weeks of Monday - Sunday)
  const calendarWeeks = useMemo(() => {
    const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1);
    const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = lastDayOfMonth.getDate();

    const weeks: Array<{
      weekIndex: number;
      days: Array<{
        dateStr: string;
        dayNumber: number;
        isCurrentMonth: boolean;
        isToday: boolean;
        data?: typeof eventsByDate[string];
      }>;
      weekTotalPax: number;
      weekTotalViandas: number;
      weekTotalRevenue: number;
      weekConfirmedPax: number;
      weekConfirmedRevenue: number;
      weekConfirmedViandas: number;
      weekPendingPax: number;
      weekPendingRevenue: number;
      weekPendingViandas: number;
    }> = [];

    let currentDay = 1;
    let prevMonthLastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    let nextMonthDay = 1;

    let weekNumber = 1;
    let finished = false;

    while (!finished) {
      const days = [];
      let weekPax = 0;
      let weekViandas = 0;
      let weekRev = 0;
      let weekConfPax = 0;
      let weekConfRev = 0;
      let weekConfViandas = 0;
      let weekPendPax = 0;
      let weekPendRev = 0;
      let weekPendViandas = 0;

      for (let d = 0; d < 7; d++) {
        if (weeks.length === 0 && d < startDayOfWeek) {
          // Days from previous month
          const pDay = prevMonthLastDay - (startDayOfWeek - 1 - d);
          const pMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
          const pYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
          const pDateStr = `${pYear}-${String(pMonth + 1).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`;
          const evData = eventsByDate[pDateStr];

          if (evData) {
            weekPax += evData.totalPax;
            weekViandas += evData.totalViandas;
            weekRev += evData.totalPossibleRevenue;
            weekConfPax += evData.confirmedPax;
            weekConfRev += evData.confirmedRevenue;
            weekConfViandas += evData.confirmedViandas;
            weekPendPax += evData.pendingPax;
            weekPendRev += evData.pendingRevenue;
            weekPendViandas += evData.pendingViandas;
          }

          days.push({
            dateStr: pDateStr,
            dayNumber: pDay,
            isCurrentMonth: false,
            isToday: pDateStr === todayStr,
            data: evData
          });
        } else if (currentDay <= daysInMonth) {
          // Days in current month
          const cDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
          const evData = eventsByDate[cDateStr];

          if (evData) {
            weekPax += evData.totalPax;
            weekViandas += evData.totalViandas;
            weekRev += evData.totalPossibleRevenue;
            weekConfPax += evData.confirmedPax;
            weekConfRev += evData.confirmedRevenue;
            weekConfViandas += evData.confirmedViandas;
            weekPendPax += evData.pendingPax;
            weekPendRev += evData.pendingRevenue;
            weekPendViandas += evData.pendingViandas;
          }

          days.push({
            dateStr: cDateStr,
            dayNumber: currentDay,
            isCurrentMonth: true,
            isToday: cDateStr === todayStr,
            data: evData
          });
          currentDay++;
        } else {
          // Days in next month
          const nMonth = selectedMonth === 11 ? 0 : selectedMonth + 1;
          const nYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
          const nDateStr = `${nYear}-${String(nMonth + 1).padStart(2, '0')}-${String(nextMonthDay).padStart(2, '0')}`;
          const evData = eventsByDate[nDateStr];

          if (evData) {
            weekPax += evData.totalPax;
            weekViandas += evData.totalViandas;
            weekRev += evData.totalPossibleRevenue;
            weekConfPax += evData.confirmedPax;
            weekConfRev += evData.confirmedRevenue;
            weekConfViandas += evData.confirmedViandas;
            weekPendPax += evData.pendingPax;
            weekPendRev += evData.pendingRevenue;
            weekPendViandas += evData.pendingViandas;
          }

          days.push({
            dateStr: nDateStr,
            dayNumber: nextMonthDay,
            isCurrentMonth: false,
            isToday: nDateStr === todayStr,
            data: evData
          });
          nextMonthDay++;
        }
      }

      weeks.push({
        weekIndex: weekNumber,
        days,
        weekTotalPax: weekPax,
        weekTotalViandas: weekViandas,
        weekTotalRevenue: weekRev,
        weekConfirmedPax: weekConfPax,
        weekConfirmedRevenue: weekConfRev,
        weekConfirmedViandas: weekConfViandas,
        weekPendingPax: weekPendPax,
        weekPendingRevenue: weekPendRev,
        weekPendingViandas: weekPendViandas
      });

      weekNumber++;
      if (currentDay > daysInMonth) {
        finished = true;
      }
    }

    return weeks;
  }, [selectedYear, selectedMonth, eventsByDate, todayStr]);

  // Monthly totals calculation (only summing active days of the current month)
  const monthTotals = useMemo(() => {
    let totalPax = 0;
    let totalViandas = 0;
    let totalRevenue = 0;
    let confirmedPax = 0;
    let confirmedRevenue = 0;
    let confirmedViandas = 0;
    let pendingPax = 0;
    let pendingRevenue = 0;
    let pendingViandas = 0;
    let activeDays = 0;

    const prefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

    Object.entries(eventsByDate).forEach(([dateStr, data]) => {
      if (dateStr.startsWith(prefix) && data.totalPax > 0) {
        totalPax += data.totalPax;
        totalViandas += data.totalViandas;
        totalRevenue += data.totalPossibleRevenue;
        confirmedPax += data.confirmedPax;
        confirmedRevenue += data.confirmedRevenue;
        confirmedViandas += data.confirmedViandas;
        pendingPax += data.pendingPax;
        pendingRevenue += data.pendingRevenue;
        pendingViandas += data.pendingViandas;
        activeDays++;
      }
    });

    return { 
      totalPax, totalViandas, totalRevenue, 
      confirmedPax, confirmedRevenue, confirmedViandas,
      pendingPax, pendingRevenue, pendingViandas,
      activeDays
    };
  }, [eventsByDate, selectedYear, selectedMonth]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <section className="mt-12 mb-8 bg-white border border-slate-200/90 rounded-[2.5rem] p-6 lg:p-8 shadow-sm">
      {/* HEADER: Title, Month Controls & Status Legend */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <CalendarIcon size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight flex items-center gap-2">
                Cronograma Mensual de Pasajeros y Demanda
              </h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Planificación operativa semanal (Lunes a Domingo + Totales Semanales)
              </p>
            </div>
          </div>
        </div>

        {/* Month Navigation Controls & Status Legend */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Color Legend */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-2xs">
            <span className="flex items-center gap-1.5 text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Confirmados (Verde)
            </span>
            <span className="flex items-center gap-1.5 text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-md">
              <span className="w-2 h-2 rounded-full bg-amber-600"></span> Pendientes (Amarillo)
            </span>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white transition cursor-pointer active:scale-95"
              title="Mes anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-4 py-1 text-sm font-black text-slate-800 uppercase tracking-wider min-w-[170px] text-center">
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white transition cursor-pointer active:scale-95"
              title="Mes siguiente"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleToday}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm cursor-pointer"
          >
            Hoy
          </button>
        </div>
      </div>

      {/* MONTH SUMMARY STATS STRIP WITH STATUS BREAKDOWN */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        {/* Total Pasajeros */}
        <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
            <Users size={13} className="text-indigo-500" /> Pasajeros en el Mes
          </p>
          <p className="text-3xl font-black text-slate-900 tabular-nums">
            {monthTotals.totalPax.toLocaleString('es-AR')} <span className="text-xs font-bold text-slate-400">PAX Total</span>
          </p>
          <div className="flex items-center gap-2 mt-2 text-[10px] font-black uppercase">
            <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200">
              🟢 {monthTotals.confirmedPax} PAX Confirmados
            </span>
            <span className="text-amber-900 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200">
              🟡 {monthTotals.pendingPax} PAX Pendientes
            </span>
          </div>
        </div>

        {/* Venta Posible / Viandas */}
        <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
            {isCocina ? (
              <>
                <Sandwich size={13} className="text-amber-500" /> Viandas Previstas Mes
              </>
            ) : (
              <>
                <DollarSign size={13} className="text-emerald-500" /> Venta Posible Mes
              </>
            )}
          </p>
          <p className="text-3xl font-black text-slate-900 tabular-nums">
            {isCocina ? (
              <>
                {monthTotals.totalViandas.toLocaleString('es-AR')} <span className="text-xs font-bold text-slate-400">Viandas Total</span>
              </>
            ) : (
              <span className="text-emerald-600">{formatCurrency(monthTotals.totalRevenue)}</span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-2 text-[10px] font-black uppercase">
            {isCocina ? (
              <>
                <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200">
                  🟢 {monthTotals.confirmedViandas} u. Conf.
                </span>
                <span className="text-amber-900 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200">
                  🟡 {monthTotals.pendingViandas} u. Pend.
                </span>
              </>
            ) : (
              <>
                <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200">
                  🟢 {formatCurrency(monthTotals.confirmedRevenue)}
                </span>
                <span className="text-amber-900 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200">
                  🟡 {formatCurrency(monthTotals.pendingRevenue)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Días con Eventos Activos */}
        <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
            <CalendarIcon size={13} className="text-sky-500" /> Días de Operación
          </p>
          <p className="text-3xl font-black text-slate-900 tabular-nums">
            {monthTotals.activeDays} <span className="text-xs font-bold text-slate-400">Días activos</span>
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">
            Eventos confirmados y pendientes en {MONTH_NAMES[selectedMonth]}
          </p>
        </div>
      </div>

      {/* CALENDAR TABLE (8 Columns: Mon-Sun + Total Semana) */}
      <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-xs">
        <table className="w-full border-collapse text-left min-w-[1050px]">
          <thead>
            <tr className="bg-slate-900 text-white text-xs font-black uppercase tracking-wider">
              {DAY_NAMES.map((dayName, idx) => (
                <th key={idx} className="p-3.5 border-r border-slate-800 text-center w-[12%]">
                  {dayName}
                </th>
              ))}
              <th className="p-3.5 bg-indigo-950 text-indigo-200 text-center w-[16%] border-l border-indigo-800">
                ⭐ TOTAL SEMANA
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-slate-50/50">
            {calendarWeeks.map((week, wIdx) => (
              <tr key={wIdx} className="divide-x divide-slate-200">
                {/* 7 Daily Cells */}
                {week.days.map((day, dIdx) => {
                  const hasEvents = day.data && day.data.totalPax > 0;
                  const hasConfirmed = day.data && day.data.confirmedPax > 0;
                  const hasPending = day.data && day.data.pendingPax > 0;

                  return (
                    <td
                      key={dIdx}
                      className={`p-1.5 align-top h-36 transition-all ${
                        !day.isCurrentMonth
                          ? 'bg-slate-100/50 opacity-40 text-slate-400'
                          : day.isToday
                          ? 'bg-indigo-50/60 ring-2 ring-indigo-500 ring-inset'
                          : hasEvents
                          ? 'bg-white hover:bg-indigo-50/30'
                          : 'bg-white/60'
                      }`}
                    >
                      {hasEvents && day.data ? (
                        <button
                          type="button"
                          onClick={() => setSelectedDayModal({ dateStr: day.dateStr, dayNumber: day.dayNumber, data: day.data })}
                          className="w-full text-left block h-full p-1 rounded-2xl hover:bg-slate-50/90 transition-all group/day cursor-pointer"
                          title={`Ver opciones de gestión para el ${day.dateStr}`}
                        >
                          {/* Day Number Header */}
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className={`text-xs font-black transition-colors group-hover/day:text-indigo-600 ${
                                day.isToday
                                  ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-xs'
                                  : day.isCurrentMonth
                                  ? 'text-slate-800'
                                  : 'text-slate-400'
                              }`}
                            >
                              {day.dayNumber}
                            </span>

                            <div className="flex items-center gap-1">
                              {day.isToday && (
                                <span className="bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider animate-pulse">
                                  ¡Hoy!
                                </span>
                              )}
                              <span className="opacity-0 group-hover/day:opacity-100 transition-opacity text-[10px] text-indigo-600 font-black">
                                ↗
                              </span>
                            </div>
                          </div>

                          {/* Daily Data Cards (Direct numbers in Green & Yellow) */}
                          <div className="space-y-1.5">
                            {/* 🟢 CONFIRMED BLOCK */}
                            {hasConfirmed && (
                              <div className="bg-emerald-50 group-hover/day:bg-emerald-100/70 border border-emerald-300 rounded-xl p-1.5 shadow-2xs space-y-0.5 transition-colors">
                                <div className="flex items-center justify-between text-[9.5px] font-black text-emerald-900">
                                  <span className="flex items-center gap-0.5">
                                    <Users size={10} className="text-emerald-700" /> PAX:
                                  </span>
                                  <span className="text-emerald-950 font-black">{day.data.confirmedPax}</span>
                                </div>

                                <div className="flex items-center justify-between text-[9.5px] font-black text-emerald-800">
                                  {isCocina ? (
                                    <>
                                      <span className="flex items-center gap-0.5 text-[9px]">
                                        <Sandwich size={9} className="text-emerald-700" /> Viandas:
                                      </span>
                                      <span className="font-black text-emerald-950">{day.data.confirmedViandas}</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="flex items-center gap-0.5 text-[9px]">
                                        <DollarSign size={9} className="text-emerald-700" /> Venta:
                                      </span>
                                      <span className="font-black text-emerald-950">
                                        ${(day.data.confirmedRevenue / 1000).toFixed(0)}k
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* 🟡 PENDING BLOCK */}
                            {hasPending && (
                              <div className="bg-amber-50 group-hover/day:bg-amber-100/70 border border-amber-300 rounded-xl p-1.5 shadow-2xs space-y-0.5 transition-colors">
                                <div className="flex items-center justify-between text-[9.5px] font-black text-amber-900">
                                  <span className="flex items-center gap-0.5">
                                    <Users size={10} className="text-amber-700" /> PAX:
                                  </span>
                                  <span className="text-amber-950 font-black">{day.data.pendingPax}</span>
                                </div>

                                <div className="flex items-center justify-between text-[9.5px] font-black text-amber-800">
                                  {isCocina ? (
                                    <>
                                      <span className="flex items-center gap-0.5 text-[9px]">
                                        <Sandwich size={9} className="text-amber-700" /> Viandas:
                                      </span>
                                      <span className="font-black text-amber-950">{day.data.pendingViandas}</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="flex items-center gap-0.5 text-[9px]">
                                        <DollarSign size={9} className="text-amber-700" /> Venta:
                                      </span>
                                      <span className="font-black text-amber-950">
                                        ${(day.data.pendingRevenue / 1000).toFixed(0)}k
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </button>
                      ) : (
                        <div className="p-1 h-full">
                          {/* Day Number Header */}
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className={`text-xs font-extrabold ${
                                day.isToday
                                  ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-xs'
                                  : day.isCurrentMonth
                                  ? 'text-slate-800'
                                  : 'text-slate-400'
                              }`}
                            >
                              {day.dayNumber}
                            </span>

                            {day.isToday && (
                              <span className="bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider animate-pulse">
                                ¡Hoy!
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}

                {/* 8th Column: TOTAL SEMANA */}
                <td className="p-2.5 align-middle bg-gradient-to-br from-indigo-950/15 via-slate-900/5 to-indigo-900/10 border-l-2 border-indigo-200 text-center">
                  <div className="space-y-1.5">
                    <span className="inline-block bg-indigo-100 text-indigo-900 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                      Semana {week.weekIndex}
                    </span>

                    <div className="space-y-1.5 bg-white border border-indigo-100 p-2.5 rounded-2xl shadow-xs text-left">
                      {/* Pasajeros Semanales */}
                      <div>
                        <p className="text-[8.5px] font-extrabold text-slate-400 uppercase tracking-wider">
                          Pasajeros Semana
                        </p>
                        <p className="text-sm font-black text-slate-900 tabular-nums">
                          {week.weekTotalPax.toLocaleString('es-AR')} <span className="text-[9px] text-slate-400 font-bold">PAX</span>
                        </p>

                        <div className="flex flex-col text-[8.5px] font-black uppercase mt-1 space-y-0.5">
                          {week.weekConfirmedPax > 0 && (
                            <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded">
                              🟢 {week.weekConfirmedPax} Confirmados
                            </span>
                          )}
                          {week.weekPendingPax > 0 && (
                            <span className="text-amber-900 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded">
                              🟡 {week.weekPendingPax} Pendientes
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Venta Posible / Viandas Semanales */}
                      <div className="pt-1.5 border-t border-slate-100">
                        <p className="text-[8.5px] font-extrabold text-slate-400 uppercase tracking-wider">
                          {isCocina ? 'Viandas Semana' : 'Venta Posible'}
                        </p>
                        <p className="text-xs font-black tabular-nums">
                          {isCocina ? (
                            <span className="text-amber-800">{week.weekTotalViandas.toLocaleString('es-AR')} u.</span>
                          ) : (
                            <span className="text-emerald-700 font-black">{formatCurrency(week.weekTotalRevenue)}</span>
                          )}
                        </p>

                        {!isCocina && (
                          <div className="flex flex-col text-[8px] font-black uppercase mt-0.5 space-y-0.5">
                            {week.weekConfirmedRevenue > 0 && (
                              <span className="text-emerald-700">
                                🟢 {formatCurrency(week.weekConfirmedRevenue)}
                              </span>
                            )}
                            {week.weekPendingRevenue > 0 && (
                              <span className="text-amber-700">
                                🟡 {formatCurrency(week.weekPendingRevenue)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pop-up Modal to select destination for clicked date */}
      {selectedDayModal && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedDayModal(null)}
        >
          <div 
            className="bg-white rounded-[2.5rem] border border-slate-200 p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 shrink-0">
                  <CalendarIcon size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {(() => {
                      const [y, m, d] = selectedDayModal.dateStr.split('-').map(Number);
                      const dt = new Date(y, m - 1, d);
                      return dt.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                    })()}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    {selectedDayModal.data.shows.length} show{selectedDayModal.data.shows.length > 1 ? 's' : ''} • {selectedDayModal.data.totalPax} PAX Estimados
                    {!isCocina && selectedDayModal.data.totalPossibleRevenue > 0 && ` • ${formatCurrency(selectedDayModal.data.totalPossibleRevenue)}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayModal(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            {/* List of Shows on this day */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Eventos de la fecha:</p>
              <div className="flex flex-wrap gap-2">
                {selectedDayModal.data.shows.map((s: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 uppercase">
                    <Music size={12} className="text-indigo-600" />
                    <span className="truncate max-w-[200px]">{s.show}</span>
                    <span className="text-[10px] text-slate-400 font-bold">@{s.venue}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Options */}
            <div className="space-y-3 pt-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">¿A dónde querés ir?</p>
              
              {/* Option 1: Gestión de Eventos */}
              <Link
                href={`/settings/eventos?date=${selectedDayModal.dateStr}`}
                className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 hover:border-emerald-400 bg-white hover:bg-emerald-50/40 transition-all group cursor-pointer shadow-xs hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm uppercase group-hover:text-emerald-900">
                      Gestión de Eventos
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Cronograma operativo, micros y coordinadores de la fecha.
                    </p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
              </Link>

              {/* Option 2: Ventas por Evento */}
              <Link
                href={`/ventas-evento?date=${selectedDayModal.dateStr}`}
                className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 hover:border-amber-400 bg-white hover:bg-amber-50/40 transition-all group cursor-pointer shadow-xs hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm uppercase group-hover:text-amber-900">
                      Ventas por Evento
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Carga y planilla de ventas por empresa de esta fecha.
                    </p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-slate-300 group-hover:text-amber-600 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
              </Link>

              {/* Option 3: Ventas Online */}
              <Link
                href={`/ventas-online?date=${selectedDayModal.dateStr}`}
                className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 hover:border-teal-400 bg-white hover:bg-teal-50/40 transition-all group cursor-pointer shadow-xs hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Store size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm uppercase group-hover:text-teal-900">
                      Ventas Online
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Pedidos de pasajeros y tiendas virtuales de esta fecha.
                    </p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-slate-300 group-hover:text-teal-600 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}