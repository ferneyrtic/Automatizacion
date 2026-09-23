'use client';

import Image from 'next/image';
import { Users, TrendingUp, Clock, Radio, CalendarDays } from 'lucide-react';

export type MonthTab = {
  id: string;
  title: string;
};

interface HeaderProps {
  totalParticipants: number;
  activeUsers: number;
  avgParticipationRate: number;
  months: MonthTab[];
  selectedMonthId: string | null;
  onSelectMonth: (id: string) => void;
}

export default function Header({
  totalParticipants, activeUsers, avgParticipationRate,
  months, selectedMonthId, onSelectMonth,
}: HeaderProps) {
  return (
    <header className="bg-white border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Fila principal */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-4">
            <div className="bg-blue-50 rounded-xl px-3 py-1.5 flex items-center">
              <Image
                src="/logos/logo.png"
                alt="Alcaldía de Acacías"
                width={400}
                height={140}
                quality={100}
                className="object-contain w-auto h-12"
                priority
                unoptimized
              />
            </div>

            <div className="border-l border-gray-200 h-10 hidden sm:block" />

            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-[var(--foreground)] tracking-tight">
                Tabla de posiciones
              </h1>
              <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                <span>Oficina TIC</span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span>CPS · 2do semestre 2026</span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span className="text-[var(--primary)] font-medium">#RecuperandoAcacías</span>
              </p>
            </div>
          </div>

          {/* Stats compactas en header */}
          <div className="flex items-center gap-2">
            <Stat icon={Users} value={totalParticipants} label="Participantes" color="text-[var(--primary)] bg-blue-50" />
            <Stat icon={TrendingUp} value={`${activeUsers}`} label="Activos" color="text-emerald-600 bg-emerald-50" />
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50">
              <TrendingUp size={14} className="text-gray-400" />
              <div>
                <p className="text-sm font-bold text-gray-700 leading-none">{avgParticipationRate}%</p>
                <p className="text-[8px] text-gray-400 font-medium uppercase tracking-wider">Prom. Part.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Barra inferior */}
        <div className="flex items-center justify-between pb-2.5 border-t border-gray-50 pt-2">
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock size={12} />
            Actualizado hace unos segundos
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-semibold tracking-wide">
            <Radio size={10} className="animate-pulse" />
            En vivo
          </span>
        </div>

        {/* Panel de pestañas por mes: se genera automáticamente con cada pestaña válida del Excel */}
        {months.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-3 -mb-1 scrollbar-none">
            <CalendarDays size={14} className="text-gray-400 shrink-0" />
            {months.map(m => (
              <button
                key={m.id}
                onClick={() => onSelectMonth(m.id)}
                className={`shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-lg border transition-colors ${
                  selectedMonthId === m.id
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                    : 'bg-gray-50 text-gray-500 border-[var(--border)] hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                {m.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

function Stat({
  icon: Icon, value, label, color,
}: {
  icon: React.ElementType; value: string | number; label: string; color: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${color}`}>
      <Icon size={14} />
      <div>
        <p className="text-sm font-bold leading-none tabular-nums">{value}</p>
        <p className="text-[8px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      </div>
    </div>
  );
}
