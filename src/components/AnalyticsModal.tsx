'use client';

import { useState } from 'react';
import {
  X, ChevronLeft, ChevronRight,
  TrendingUp, Users2, PieChart as PieIcon,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import type { PublicationStat, TeamStat, ActionDistribution } from '@/lib/googleSheets';

// ─── Colores (hex para recharts) ─────────────────────────────────────────────
const C = {
  primary:   '#0A4B8C',
  secondary: '#F5A623',
  emerald:   '#059669',
  muted:     '#9CA3AF',
  border:    '#E5E7EB',
};

// ─── Definición de gráficas del carrusel ─────────────────────────────────────
const SLIDES = [
  { id: 'trend',   icon: TrendingUp, label: 'Tendencia de participación',  subtitle: 'Evolución del % de participación a lo largo del tiempo' },
  { id: 'team',    icon: Users2,     label: 'Comparativa por equipo',      subtitle: 'Puntos acumulados y nivel de participación por área' },
  { id: 'actions', icon: PieIcon,    label: 'Distribución de acciones',    subtitle: 'Cumplimiento por cada tipo de interacción' },
];

// ─── GRÁFICA 1: Tendencia (Línea) ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TrendTooltip({ active, payload, label, stats }: any) {
  if (!active || !payload?.length) return null;
  const stat = (stats as PublicationStat[]).find(s => s.shortDate === label);
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-2.5 sm:p-3 text-xs max-w-[200px]">
      <p className="font-semibold text-gray-800 mb-1 leading-snug">{stat?.date ?? label}</p>
      <p className="font-bold" style={{ color: C.primary }}>
        {payload[0].value}%
        <span className="text-gray-400 font-normal ml-1">de participación</span>
      </p>
      {stat && (
        <p className="text-gray-400 mt-0.5">{stat.totalSupported} de {stat.totalParticipants} personas</p>
      )}
    </div>
  );
}

function TrendChart({ stats }: { stats: PublicationStat[] }) {
  if (stats.length === 0) return <Empty text="No hay publicaciones registradas aún." />;

  const avg     = Math.round(stats.reduce((a, s) => a + s.participationRate, 0) / stats.length);
  const max     = stats.reduce((best, s) => s.participationRate > best.participationRate ? s : best, stats[0]);
  const min     = stats.reduce((worst, s) => s.participationRate < worst.participationRate ? s : worst, stats[0]);
  const last    = stats[stats.length - 1];
  const isUp    = stats.length > 1 && last.participationRate >= stats[0].participationRate;

  return (
    <div>
      {/* Mini KPIs: 2 columnas en mobile, 4 en desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
        <MiniKPI label="Promedio" value={`${avg}%`} />
        <MiniKPI label="Último dato" value={`${last.participationRate}%`} accent={isUp ? 'emerald' : 'red'} />
        <MiniKPI label="Mejor día" value={max.shortDate} accent="primary" />
        <MiniKPI label="Día más bajo" value={min.shortDate} />
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={stats} margin={{ top: 5, right: 5, left: -25, bottom: 45 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis
            dataKey="shortDate"
            tick={{ fontSize: 10, fill: C.muted }}
            angle={-45}
            textAnchor="end"
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 10, fill: C.muted }}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
          />
          <RTooltip content={<TrendTooltip stats={stats} />} />
          <Line
            type="monotone"
            dataKey="participationRate"
            stroke={C.primary}
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: C.primary, strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 5.5, fill: C.primary, strokeWidth: 2, stroke: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── GRÁFICA 2: Por equipo (Barras horizontales) ──────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TeamTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: TeamStat = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-2.5 sm:p-3 text-xs space-y-1">
      <p className="font-semibold text-gray-800 mb-1">{d.equipo}</p>
      <p className="text-gray-500">Puntos totales: <span className="font-bold" style={{ color: C.primary }}>{d.totalPoints.toLocaleString()}</span></p>
      <p className="text-gray-500">Activos: <span className="font-bold text-gray-800">{d.activeMembers} / {d.totalMembers}</span></p>
      <p className="text-gray-500">Participación: <span className={`font-bold ${d.participationRate === 100 ? 'text-emerald-600' : d.participationRate >= 70 ? 'text-amber-500' : 'text-red-500'}`}>{d.participationRate}%</span></p>
    </div>
  );
}

function TeamChart({ teamStats }: { teamStats: TeamStat[] }) {
  if (teamStats.length === 0) return <Empty text="No hay datos de equipos disponibles." />;

  const data = teamStats.map(t => ({
    ...t,
    shortName: t.equipo.length > 18 ? t.equipo.slice(0, 16) + '…' : t.equipo,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={Math.max(240, data.length * 44)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="shortName" tick={{ fontSize: 10, fill: '#374151' }} tickLine={false} axisLine={false} width={115} />
          <RTooltip content={<TeamTooltip />} cursor={{ fill: '#f0f4f8' }} />
          <Bar
            dataKey="totalPoints"
            radius={[0, 4, 4, 0]}
            label={{ position: 'right', fontSize: 10, fill: C.muted, formatter: (v: any) => typeof v === 'number' && v > 0 ? v.toLocaleString() : '' }}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.participationRate === 100 ? C.emerald :
                  entry.participationRate >= 70   ? C.primary :
                  entry.participationRate >= 40   ? C.secondary :
                  '#E63946'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Leyenda */}
      <div className="mt-3 flex flex-wrap gap-2.5 sm:gap-4 text-[9px] sm:text-[10px] text-gray-400 justify-center">
        {[
          { color: C.emerald,   label: '100% activos' },
          { color: C.primary,   label: '≥ 70%' },
          { color: C.secondary, label: '≥ 40%' },
          { color: '#E63946',   label: '< 40%' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── GRÁFICA 3: Distribución de acciones (Dona) ──────────────────────────────

function ActionDonut({ dist, totalPublications, totalParticipants }: {
  dist: ActionDistribution;
  totalPublications: number;
  totalParticipants: number;
}) {
  const maxPossible = totalPublications * totalParticipants;
  const donutTotal = dist.shared + dist.commented + dist.reacted;

  const actions = [
    { name: 'Compartir',  value: dist.shared,    color: C.primary,   pts: 15 },
    { name: 'Comentar',   value: dist.commented, color: C.secondary, pts: 20 },
    { name: 'Reaccionar', value: dist.reacted,   color: C.emerald,   pts: 10 },
  ].map(d => ({
    ...d,
    achievement: maxPossible > 0 ? Math.round((d.value / maxPossible) * 100) : 0,
    donutPct: donutTotal > 0 ? Math.round((d.value / donutTotal) * 100) : 0,
  }));

  if (donutTotal === 0) return <Empty text="No hay interacciones registradas aún." />;

  return (
    <div className="space-y-5">
      {/* Fila superior: dona + cards de cumplimiento */}
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">

        {/* Dona */}
        <div className="relative shrink-0" style={{ width: 160, height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={actions}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={74}
                dataKey="value"
                strokeWidth={2}
                stroke="#fff"
                paddingAngle={2}
              >
                {actions.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-xl font-bold text-gray-800 tabular-nums leading-none">{donutTotal}</p>
            <p className="text-[9px] text-gray-400 uppercase tracking-wider mt-1">total</p>
          </div>
        </div>

        {/* Base de cálculo */}
        <div className="flex-1 w-full">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Base de cálculo</p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 space-y-1 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Publicaciones</span>
              <span className="font-bold text-gray-800 tabular-nums">{totalPublications}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Participantes</span>
              <span className="font-bold text-gray-800 tabular-nums">{totalParticipants}</span>
            </div>
            <div className="border-t border-gray-200 pt-1 flex justify-between">
              <span className="text-gray-600 font-medium">Máx. posible c/u</span>
              <span className="font-bold text-[#0A4B8C] tabular-nums">{maxPossible.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Barras de cumplimiento por acción */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
          Cumplimiento por tipo de acción
        </p>
        <div className="space-y-3">
          {actions.map(entry => (
            <div key={entry.name}>
              <div className="flex items-center justify-between mb-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-sm" style={{ background: entry.color }} />
                  <span className="font-semibold text-gray-700">{entry.name}</span>
                  <span className="text-[10px] text-gray-400">+{entry.pts} pts</span>
                </div>
                <div className="flex items-center gap-1.5 text-right">
                  <span className="font-bold text-gray-800 tabular-nums">{entry.value.toLocaleString()}</span>
                  <span className="text-[10px] text-gray-400">/ {maxPossible.toLocaleString()}</span>
                  <span
                    className="text-[10px] font-bold tabular-nums px-1.5 py-0.2 rounded"
                    style={{ background: `${entry.color}18`, color: entry.color }}
                  >
                    {entry.achievement}%
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-700"
                  style={{ width: `${entry.achievement}%`, background: entry.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────

function MiniKPI({ label, value, accent }: { label: string; value: string; accent?: 'primary' | 'emerald' | 'red' }) {
  const color = accent === 'primary' ? 'text-[#0A4B8C]' : accent === 'emerald' ? 'text-emerald-600' : accent === 'red' ? 'text-red-500' : 'text-gray-800';
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl px-2.5 py-2 text-center">
      <p className={`text-base sm:text-lg font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wide mt-0.5 truncate">{label}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-16 text-center text-gray-400">
      <p className="text-xs sm:text-sm">{text}</p>
    </div>
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stats: PublicationStat[];
  teamStats: TeamStat[];
  actionDistribution: ActionDistribution;
}

export default function AnalyticsModal({ isOpen, onClose, stats, teamStats, actionDistribution }: Props) {
  const [current, setCurrent] = useState(0);

  if (!isOpen) return null;

  const prev = () => setCurrent(i => (i - 1 + SLIDES.length) % SLIDES.length);
  const next = () => setCurrent(i => (i + 1) % SLIDES.length);

  const slide = SLIDES[current];
  const SlideIcon = slide.icon;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="min-w-0 pr-2">
            <h2 className="text-sm sm:text-base font-bold text-gray-900 truncate">Análisis estadístico</h2>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 truncate">Datos en tiempo real desde Google Sheets</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg p-1.5 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Título del gráfico actual */}
        <div className="px-4 sm:px-6 pt-4 pb-0 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5">
            <SlideIcon size={15} className="text-[#0A4B8C] shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 truncate">{slide.label}</h3>
          </div>
          <p className="text-[10px] sm:text-xs text-gray-400 truncate">{slide.subtitle}</p>
        </div>

        {/* Área del gráfico (scrollable) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
          {current === 0 && <TrendChart stats={stats} />}
          {current === 1 && <TeamChart teamStats={teamStats} />}
          {current === 2 && (
            <ActionDonut
              dist={actionDistribution}
              totalPublications={stats.length}
              totalParticipants={stats[0]?.totalParticipants ?? 0}
            />
          )}
        </div>

        {/* Navegación */}
        <div className="px-4 sm:px-6 py-3 border-t border-gray-100 shrink-0">
          <div className="flex items-center justify-between">

            {/* Flecha anterior */}
            <button
              onClick={prev}
              className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline">{SLIDES[(current - 1 + SLIDES.length) % SLIDES.length].label.split(' ')[0]}</span>
            </button>

            {/* Indicadores de posición */}
            <div className="flex items-center gap-2">
              {SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setCurrent(i)}
                  className="flex flex-col items-center gap-1 group py-1"
                >
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === current ? 'w-5 bg-[#0A4B8C]' : 'w-1.5 bg-gray-200 group-hover:bg-gray-400'
                  }`} />
                </button>
              ))}
            </div>

            {/* Flecha siguiente */}
            <button
              onClick={next}
              className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <span className="hidden sm:inline">{SLIDES[(current + 1) % SLIDES.length].label.split(' ')[0]}</span>
              <ChevronRight size={16} />
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}
