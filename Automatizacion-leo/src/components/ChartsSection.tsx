'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts';
import {
  TrendingUp, PieChart as PieChartIcon, Users2,
} from 'lucide-react';
import type { PublicationStat, TeamStat, ActionDistribution } from '@/lib/googleSheets';

// ─── Paleta de colores (hex directos para recharts) ──────────────────────────
const C = {
  primary:      '#0A4B8C',
  primaryDark:  '#06305A',
  secondary:    '#F5A623',
  emerald:      '#059669',
  border:       '#E5E7EB',
  muted:        '#9CA3AF',
  text:         '#111827',
  textLight:    '#6B7280',
};

// ─── Wrapper de tarjeta de gráfica ───────────────────────────────────────────
function ChartCard({ title, subtitle, icon: Icon, children }: {
  title: string; subtitle: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden h-full">
      <div className="px-5 py-4 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Icon size={15} className="text-[var(--primary)]" />
          {title}
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── 1. TENDENCIA DE PARTICIPACIÓN (Línea) ───────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TrendTooltip({ active, payload, label, stats }: any) {
  if (!active || !payload?.length) return null;
  const stat = (stats as PublicationStat[]).find(s => s.shortDate === label);
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-800 mb-1 max-w-[180px] leading-snug">{stat?.date ?? label}</p>
      <p className="text-[var(--primary)] font-bold">
        {payload[0].value}%
        <span className="text-gray-400 font-normal ml-1">de participación</span>
      </p>
      <p className="text-gray-400 mt-1">
        {stat?.totalSupported} de {stat?.totalParticipants} personas
      </p>
    </div>
  );
}

function TrendChart({ stats }: { stats: PublicationStat[] }) {
  if (stats.length === 0) return null;

  const avg = Math.round(stats.reduce((a, s) => a + s.participationRate, 0) / stats.length);
  const trend = stats.length >= 2
    ? stats[stats.length - 1].participationRate - stats[0].participationRate
    : 0;

  return (
    <ChartCard
      title="Tendencia de participación"
      subtitle="Evolución del porcentaje de participación por publicación"
      icon={TrendingUp}
    >
      {/* Mini KPIs de contexto */}
      <div className="flex gap-4 mb-4">
        <div className="text-xs">
          <p className="text-gray-400">Promedio</p>
          <p className="text-base font-bold text-gray-800">{avg}%</p>
        </div>
        <div className="text-xs">
          <p className="text-gray-400">Tendencia</p>
          <p className={`text-base font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend >= 0 ? '+' : ''}{trend}pp
          </p>
        </div>
        <div className="text-xs">
          <p className="text-gray-400">Mejor día</p>
          <p className="text-base font-bold text-gray-800">
            {stats.reduce((best, s) => s.participationRate > best.participationRate ? s : best, stats[0]).shortDate}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={stats} margin={{ top: 5, right: 10, left: -20, bottom: 45 }}>
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
          {/* Área de relleno bajo la línea (sin Area component para evitar complejidad) */}
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
    </ChartCard>
  );
}

// ─── 2. DISTRIBUCIÓN DE ACCIONES (Dona) ──────────────────────────────────────

function ActionDonut({ dist }: { dist: ActionDistribution }) {
  const total = dist.shared + dist.commented + dist.reacted;

  const data = [
    { name: 'Compartir',  value: dist.shared,    color: C.primary,   pts: 15 },
    { name: 'Comentar',   value: dist.commented, color: C.secondary, pts: 20 },
    { name: 'Reaccionar', value: dist.reacted,   color: C.emerald,   pts: 10 },
  ].map(d => ({
    ...d,
    pct: total > 0 ? Math.round((d.value / total) * 100) : 0,
  }));

  return (
    <ChartCard
      title="Distribución de acciones"
      subtitle="Proporción de cada tipo de interacción en el total acumulado"
      icon={PieChartIcon}
    >
      <div className="flex flex-col items-center">
        {/* Dona con label central */}
        <div className="relative w-48 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={88}
                dataKey="value"
                strokeWidth={3}
                stroke="#fff"
                paddingAngle={2}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Label central sobrepuesta */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-2xl font-bold text-gray-800 tabular-nums leading-none">{total}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">acciones</p>
          </div>
        </div>

        {/* Leyenda con desglose */}
        <div className="w-full mt-3 space-y-2.5">
          {data.map(entry => (
            <div key={entry.name} className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: entry.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-gray-600 font-medium">{entry.name}</span>
                  <span className="text-xs font-bold text-gray-800 tabular-nums">
                    {entry.value}
                    <span className="text-gray-400 font-normal ml-1 text-[10px]">({entry.pct}%)</span>
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1 mt-1 overflow-hidden">
                  <div
                    className="h-1 rounded-full transition-all duration-700"
                    style={{ width: `${entry.pct}%`, background: entry.color }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-gray-400 mt-3 text-center">
          Comentar puntúa más (+20 pts) · Compartir +15 · Reaccionar +10
        </p>
      </div>
    </ChartCard>
  );
}

// ─── 3. COMPARATIVA POR EQUIPO (Barras horizontales) ─────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TeamTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: TeamStat = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-gray-800 mb-1">{d.equipo}</p>
      <p className="text-gray-500">Puntos totales:
        <span className="font-bold text-[#0A4B8C] ml-1">{d.totalPoints.toLocaleString()}</span>
      </p>
      <p className="text-gray-500">Miembros activos:
        <span className="font-bold text-gray-800 ml-1">{d.activeMembers} / {d.totalMembers}</span>
      </p>
      <p className="text-gray-500">Participación:
        <span className={`font-bold ml-1 ${d.participationRate === 100 ? 'text-emerald-600' : d.participationRate >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
          {d.participationRate}%
        </span>
      </p>
    </div>
  );
}

function TeamChart({ teamStats }: { teamStats: TeamStat[] }) {
  if (teamStats.length === 0) return null;

  const data = teamStats.map(t => ({
    ...t,
    // Nombre corto para el eje Y
    shortName: t.equipo.length > 20 ? t.equipo.slice(0, 18) + '…' : t.equipo,
  }));

  return (
    <ChartCard
      title="Comparativa por equipo"
      subtitle="Puntos acumulados y nivel de participación por área — verde = 100% activos"
      icon={Users2}
    >
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 46)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 50, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: C.muted }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            tick={{ fontSize: 11, fill: C.text }}
            tickLine={false}
            axisLine={false}
            width={130}
          />
          <RTooltip content={<TeamTooltip />} cursor={{ fill: '#f0f4f8' }} />
          <Bar dataKey="totalPoints" radius={[0, 4, 4, 0]}             label={{ position: 'right', fontSize: 11, fill: C.textLight, formatter: (label: unknown) => typeof label === 'number' && label > 0 ? label.toLocaleString() : '' }}>
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

      {/* Leyenda de colores */}
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-400 justify-center">
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
    </ChartCard>
  );
}

// ─── Export principal ─────────────────────────────────────────────────────────

interface Props {
  stats: PublicationStat[];
  teamStats: TeamStat[];
  actionDistribution: ActionDistribution;
}

export default function ChartsSection({ stats, teamStats, actionDistribution }: Props) {
  return (
    <div className="space-y-5">
      {/* Fila 1: Tendencia (ancho completo) */}
      {stats.length > 1 && <TrendChart stats={stats} />}

      {/* Fila 2: Equipo (izquierda) + Dona (derecha) */}
      {(teamStats.length > 0 || (actionDistribution.shared + actionDistribution.commented + actionDistribution.reacted) > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 items-start">
          {teamStats.length > 0 && <TeamChart teamStats={teamStats} />}
          {(actionDistribution.shared + actionDistribution.commented + actionDistribution.reacted) > 0 && (
            <ActionDonut dist={actionDistribution} />
          )}
        </div>
      )}
    </div>
  );
}
