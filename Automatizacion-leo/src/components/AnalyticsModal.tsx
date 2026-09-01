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
import type { PublicationStat, TeamStat, ActionDistribution, UserRanking } from '@/lib/googleSheets';

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
  { id: 'actions', icon: PieIcon,    label: 'Distribución de acciones',    subtitle: 'Proporción de cada tipo de interacción en el total' },
];

// ─── GRÁFICA 1: Tendencia (Línea) ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TrendTooltip({ active, payload, label, stats }: any) {
  if (!active || !payload?.length) return null;
  const stat = (stats as PublicationStat[]).find(s => s.shortDate === label);
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs max-w-[200px]">
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
      {/* Mini KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <MiniKPI label="Promedio" value={`${avg}%`} />
        <MiniKPI label="Último dato" value={`${last.participationRate}%`} accent={isUp ? 'emerald' : 'red'} />
        <MiniKPI label="Mejor día" value={max.shortDate} accent="primary" />
        <MiniKPI label="Día más bajo" value={min.shortDate} />
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={stats} margin={{ top: 5, right: 10, left: -15, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis
            dataKey="shortDate"
            tick={{ fontSize: 11, fill: C.muted }}
            angle={-45}
            textAnchor="end"
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: C.muted }}
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
            dot={{ r: 4, fill: C.primary, strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, fill: C.primary, strokeWidth: 2, stroke: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── GRÁFICA 2: Por equipo (Barras horizontales) ──────────────────────────────

function getInitials(name: string) {
  if (!name) return '??';
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function MiembroEstado({ activo }: { activo: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold shrink-0 ${
      activo
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
        : 'bg-gray-100 text-gray-400 border border-gray-200'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${activo ? 'bg-emerald-500' : 'bg-gray-300'}`} />
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TeamTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: TeamStat = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-gray-800 mb-1">{d.equipo}</p>
      <p className="text-gray-500">Puntos totales: <span className="font-bold" style={{ color: C.primary }}>{d.totalPoints.toLocaleString()}</span></p>
      <p className="text-gray-500">Activos: <span className="font-bold text-gray-800">{d.activeMembers} / {d.totalMembers}</span></p>
      <p className="text-gray-500">Participación: <span className={`font-bold ${d.participationRate === 100 ? 'text-emerald-600' : d.participationRate >= 70 ? 'text-amber-500' : 'text-red-500'}`}>{d.participationRate}%</span></p>
      <p className="text-gray-400 mt-1 pt-1 border-t border-gray-100">Clic para ver los integrantes</p>
    </div>
  );
}

function TeamChart({ teamStats, ranking }: { teamStats: TeamStat[]; ranking: UserRanking[] }) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  if (teamStats.length === 0) return <Empty text="No hay datos de equipos disponibles." />;

  const stat = teamStats.find(t => t.equipo === selectedTeam) ?? null;

  // ── Vista detalle: integrantes del equipo seleccionado ──
  if (stat) {
    const members = ranking
      .filter(u => u.equipo === stat.equipo)
      .sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name));

    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Equipo seleccionado</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{stat.equipo}</p>
            <p className="text-xs text-gray-400 mt-0.5">{members.length} integrantes</p>
          </div>
          <button
            onClick={() => setSelectedTeam(null)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            <ChevronLeft size={14} /> Volver a la comparativa
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <MiniKPI label="Miembros" value={stat.totalMembers} />
          <MiniKPI label="Activos" value={`${stat.activeMembers} / ${stat.totalMembers}`} accent="primary" />
          <MiniKPI label="Puntos" value={stat.totalPoints.toLocaleString()} />
        </div>

        <div className="space-y-2">
          {members.map(user => (
            <div
              key={user.name}
              className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5"
            >
              <div className="w-9 h-9 rounded-full bg-[#0A4B8C] text-white flex items-center justify-center text-xs font-bold shrink-0">
                {getInitials(user.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{user.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{user.equipo}</p>
              </div>
              <span className="text-sm font-bold text-gray-700 tabular-nums shrink-0">
                {user.totalPoints.toLocaleString()} <span className="text-[10px] font-normal text-gray-400">pts</span>
              </span>
              <MiembroEstado activo={(user.totalPoints || 0) > 0} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Vista comparativa ──
  const data = teamStats.map(t => ({
    ...t,
    shortName: t.equipo.length > 22 ? t.equipo.slice(0, 20) + '…' : t.equipo,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = (payload: any) => {
    const equipo = payload?.equipo as string | undefined;
    if (equipo) setSelectedTeam(equipo);
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={Math.max(260, data.length * 48)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 55, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="shortName" tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false} width={140} />
          <RTooltip content={<TeamTooltip />} cursor={{ fill: '#f0f4f8' }} />
          <Bar
            dataKey="totalPoints"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={handleBarClick}
            label={{ position: 'right', fontSize: 11, fill: C.muted, formatter: (label: unknown) => typeof label === 'number' && label > 0 ? label.toLocaleString() : '' }}
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
      <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-gray-400 justify-center">
        {[
          { color: C.emerald,   label: '100% activos' },
          { color: C.primary,   label: '≥ 70% participación' },
          { color: C.secondary, label: '≥ 40% participación' },
          { color: '#E63946',   label: '< 40% participación' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
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
  // Máximo posible por tipo = cuántas veces pudo hacerse esa acción en total
  // (una vez por persona por publicación)
  const maxPossible = totalPublications * totalParticipants;

  // Para la dona: proporción visual entre los 3 tipos (cuál domina)
  const donutTotal = dist.shared + dist.commented + dist.reacted;

  const actions = [
    { name: 'Compartir',  value: dist.shared,    color: C.primary,   pts: 15 },
    { name: 'Comentar',   value: dist.commented, color: C.secondary, pts: 20 },
    { name: 'Reaccionar', value: dist.reacted,   color: C.emerald,   pts: 10 },
  ].map(d => ({
    ...d,
    // % de cumplimiento vs el máximo posible
    achievement: maxPossible > 0 ? Math.round((d.value / maxPossible) * 100) : 0,
    // % relativo para la dona (qué acción domina)
    donutPct: donutTotal > 0 ? Math.round((d.value / donutTotal) * 100) : 0,
  }));

  if (donutTotal === 0) return <Empty text="No hay interacciones registradas aún." />;

  return (
    <div>
      {/* Fila superior: dona + cards de cumplimiento */}
      <div className="flex flex-col sm:flex-row items-center gap-8 mb-6">

        {/* Dona (muestra qué acción domina en proporción) */}
        <div className="relative shrink-0" style={{ width: 180, height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={actions}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={82}
                dataKey="value"
                strokeWidth={3}
                stroke="#fff"
                paddingAngle={2}
              >
                {actions.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-2xl font-bold text-gray-800 tabular-nums leading-none">{donutTotal}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">total</p>
          </div>
        </div>

        {/* Nota de cálculo */}
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Base de cálculo</p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Publicaciones registradas</span>
              <span className="font-bold text-gray-800 tabular-nums">{totalPublications}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Participantes</span>
              <span className="font-bold text-gray-800 tabular-nums">{totalParticipants}</span>
            </div>
            <div className="border-t border-gray-200 pt-1 flex justify-between">
              <span className="text-gray-500 font-medium">Máx. posible por acción</span>
              <span className="font-bold text-[#0A4B8C] tabular-nums">{maxPossible.toLocaleString()}</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
            Cada persona puede hacer cada acción una vez por publicación.<br />
            {totalPublications} pub. × {totalParticipants} personas = {maxPossible.toLocaleString()} oportunidades.
          </p>
        </div>
      </div>

      {/* Barras de cumplimiento por acción */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Cumplimiento por tipo de acción
      </p>
      <div className="space-y-4">
        {actions.map(entry => (
          <div key={entry.name}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: entry.color }} />
                <span className="text-sm font-semibold text-gray-700">{entry.name}</span>
                <span className="text-xs text-gray-400">+{entry.pts} pts</span>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="text-sm font-bold text-gray-800 tabular-nums">{entry.value.toLocaleString()}</span>
                <span className="text-xs text-gray-400">de {maxPossible.toLocaleString()}</span>
                <span
                  className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md"
                  style={{ background: `${entry.color}18`, color: entry.color }}
                >
                  {entry.achievement}%
                </span>
              </div>
            </div>
            {/* Barra de progreso sobre el máximo posible */}
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden relative">
              <div
                className="h-2.5 rounded-full transition-all duration-700"
                style={{ width: `${entry.achievement}%`, background: entry.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────

function MiniKPI({ label, value, accent }: { label: string; value: string | number; accent?: 'primary' | 'emerald' | 'red' }) {
  const color = accent === 'primary' ? 'text-[#0A4B8C]' : accent === 'emerald' ? 'text-emerald-600' : accent === 'red' ? 'text-red-500' : 'text-gray-800';
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-center">
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-20 text-center text-gray-400">
      <p className="text-sm">{text}</p>
    </div>
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ranking: UserRanking[];
  stats: PublicationStat[];
  teamStats: TeamStat[];
  actionDistribution: ActionDistribution;
}

export default function AnalyticsModal({ isOpen, onClose, ranking, stats, teamStats, actionDistribution }: Props) {
  const [current, setCurrent] = useState(0);

  if (!isOpen) return null;

  const prev = () => setCurrent(i => (i - 1 + SLIDES.length) % SLIDES.length);
  const next = () => setCurrent(i => (i + 1) % SLIDES.length);

  const slide = SLIDES[current];
  const SlideIcon = slide.icon;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Análisis estadístico</h2>
            <p className="text-xs text-gray-400 mt-0.5">Datos en tiempo real desde el archivo de Google Sheets</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Título del gráfico actual */}
        <div className="px-6 pt-5 pb-0 shrink-0">
          <div className="flex items-center gap-2 mb-0.5">
            <SlideIcon size={15} className="text-[#0A4B8C]" />
            <h3 className="text-sm font-bold text-gray-900">{slide.label}</h3>
          </div>
          <p className="text-xs text-gray-400">{slide.subtitle}</p>
        </div>

        {/* Área del gráfico (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {current === 0 && <TrendChart stats={stats} />}
          {current === 1 && <TeamChart teamStats={teamStats} ranking={ranking} />}
          {current === 2 && (
            <ActionDonut
              dist={actionDistribution}
              totalPublications={stats.length}
              totalParticipants={stats[0]?.totalParticipants ?? 0}
            />
          )}
        </div>

        {/* Navegación */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          <div className="flex items-center justify-between">

            {/* Flecha anterior */}
            <button
              onClick={prev}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
            >
              <ChevronLeft size={15} />
              <span className="hidden sm:block">{SLIDES[(current - 1 + SLIDES.length) % SLIDES.length].label}</span>
            </button>

            {/* Indicadores de posición */}
            <div className="flex items-center gap-3">
              {SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setCurrent(i)}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === current ? 'w-6 bg-[#0A4B8C]' : 'w-1.5 bg-gray-200 group-hover:bg-gray-400'
                  }`} />
                  <span className={`text-[10px] hidden sm:block transition-colors ${
                    i === current ? 'text-[#0A4B8C] font-semibold' : 'text-gray-400'
                  }`}>
                    {s.label.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>

            {/* Flecha siguiente */}
            <button
              onClick={next}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
            >
              <span className="hidden sm:block">{SLIDES[(current + 1) % SLIDES.length].label}</span>
              <ChevronRight size={15} />
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}
