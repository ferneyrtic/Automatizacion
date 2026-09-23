'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { Users, TrendingUp, Clock, Radio, CalendarDays, Building2, ChevronDown, Check } from 'lucide-react';
import type { Department } from '@/lib/googleSheets';

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
  departments: Department[];
  activeDepartment: Department;
}

export default function Header({
  totalParticipants, activeUsers, avgParticipationRate,
  months, selectedMonthId, onSelectMonth,
  departments, activeDepartment,
}: HeaderProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectDepartment = (dep: Department) => {
    setDropdownOpen(false);
    router.push(`/?dep=${dep.slug}`);
  };

  return (
    <header className="bg-white border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Fila principal */}
        <div className="flex items-center justify-between py-3 gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <a href="/" className="bg-blue-50 rounded-xl px-3 py-1.5 flex items-center hover:bg-blue-100 transition-colors" title="Volver al selector">
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
            </a>

            <div className="border-l border-gray-200 h-10 hidden sm:block" />

            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-[var(--foreground)] tracking-tight">
                Tabla de posiciones
              </h1>
              <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                <span className="text-[var(--primary)] font-medium">{activeDepartment.name}</span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span>CPS · 2do semestre 2026</span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span className="text-[var(--primary)] font-medium">#RecuperandoAcacías</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* ─── Selector de dependencia ─── */}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setDropdownOpen(prev => !prev)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-white hover:bg-gray-50 transition-colors text-sm font-semibold text-gray-700 shadow-sm max-w-[220px]"
              >
                <Building2 size={14} className="text-[var(--primary)] shrink-0" />
                <span className="truncate">{activeDepartment.name}</span>
                <ChevronDown
                  size={13}
                  className={`text-gray-400 shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-64 bg-white border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-50">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      Seleccionar dependencia
                    </p>
                  </div>
                  <ul className="max-h-72 overflow-y-auto py-1">
                    {departments.map(dep => (
                      <li key={dep.slug}>
                        <button
                          onClick={() => handleSelectDepartment(dep)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${
                            dep.slug === activeDepartment.slug
                              ? 'bg-blue-50 text-[var(--primary)] font-semibold'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className="flex-1 truncate">{dep.name}</span>
                          {dep.slug === activeDepartment.slug && (
                            <Check size={13} className="text-[var(--primary)] shrink-0" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Stats compactas */}
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

        {/* Panel de pestañas por mes */}
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
