'use client';

import { useState } from 'react';
import {
  Crown, Medal, Clock, Search, BarChart2,
  Share2, MessageSquare, ThumbsUp, LineChart as LineIcon,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import type { UserRanking, PublicationStat, TeamStat, ActionDistribution } from '@/lib/googleSheets';
import Header from '@/components/header';
import HistorialModal from '@/components/HistorialModal';
import AnalyticsModal from '@/components/AnalyticsModal';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  if (!name) return '??';
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function getDenseRanking(data: UserRanking[]): number[] {
  let rank = 1;
  return data.map((u, i) => {
    if (i > 0 && u.totalPoints < data[i - 1].totalPoints) rank = i + 1;
    return rank;
  });
}

function EstadoBadge({ activo }: { activo: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
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
function BarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: PublicationStat = payload[0].payload;
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl shadow-lg p-3 text-sm max-w-[220px]">
      <p className="font-semibold text-gray-800 text-xs leading-snug mb-1.5">{d.date}</p>
      <p className="font-bold text-[var(--primary)] text-xs">
        {d.totalSupported}
        <span className="text-gray-400 font-normal"> de {d.totalParticipants} personas ({d.participationRate}%)</span>
      </p>
      <p className="text-gray-400 text-[10px] mt-1.5 pt-1.5 border-t border-gray-100">
        Toca para ver desglose por acción
      </p>
    </div>
  );
}

function DayDetailPanel({ day, onClose }: { day: PublicationStat; onClose: () => void }) {
  const actions = [
    { label: 'Compartir',  count: day.sharedCount,    icon: Share2,        bar: 'bg-[var(--primary)]' },
    { label: 'Comentar',   count: day.commentedCount, icon: MessageSquare, bar: 'bg-[var(--secondary)]' },
    { label: 'Reaccionar', count: day.reactedCount,   icon: ThumbsUp,      bar: 'bg-emerald-500' },
  ];

  return (
    <div className="mt-4 border border-[var(--border)] rounded-xl overflow-hidden bg-white">
      <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 border-b border-[var(--border)] bg-gray-50">
        <div className="min-w-0 pr-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Desglose</p>
          <p className="text-xs sm:text-sm font-semibold text-gray-800 mt-0.5 truncate">{day.date}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span className="text-xs sm:text-sm font-bold text-[var(--primary)]">
            {day.totalSupported} / {day.totalParticipants}
            <span className="text-[10px] sm:text-xs font-normal text-gray-400 ml-1">({day.participationRate}%)</span>
          </span>
          <button
            onClick={onClose}
            className="text-[11px] sm:text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1 transition-colors bg-white"
          >
            Cerrar
          </button>
        </div>
      </div>
      <div className="p-3.5 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
        {actions.map(({ label, count, icon: Icon, bar }) => {
          const pct = day.totalParticipants > 0 ? Math.round((count / day.totalParticipants) * 100) : 0;
          return (
            <div key={label} className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Icon size={13} />
                  <span className="text-xs font-medium">{label}</span>
                </div>
                <span className="text-xs font-bold text-gray-800 tabular-nums">
                  {count}<span className="text-gray-400 font-normal"> / {day.totalParticipants}</span>
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div className={`h-1.5 rounded-full ${bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-right text-gray-400 font-medium">{pct}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  ranking: UserRanking[];
  stats: PublicationStat[];
  teamStats: TeamStat[];
  actionDistribution: ActionDistribution;
  totalParticipants: number;
  totalPoints: number;
  avgParticipationRate: number;
}

export default function RankingClient({
  ranking, stats, teamStats, actionDistribution,
  totalParticipants, avgParticipationRate,
}: Props) {
  const [selectedUser, setSelectedUser]       = useState<UserRanking | null>(null);
  const [selectedDay, setSelectedDay]         = useState<PublicationStat | null>(null);
  const [search, setSearch]                   = useState('');
  const [showAnalytics, setShowAnalytics]     = useState(false);

  const activeUsers = ranking.filter(u => (u.totalPoints || 0) > 0).length;
  const filtered    = ranking.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
  const ranks       = getDenseRanking(filtered);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = (data: any) => {
    setSelectedDay(prev => prev?.date === data.date ? null : (data as PublicationStat));
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">

      <Header
        totalParticipants={totalParticipants}
        activeUsers={activeUsers}
        avgParticipationRate={avgParticipationRate}
      />

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">

        {/* ── Fila superior: participación diaria + botón de análisis ── */}
        {stats.length > 0 && (
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
            <div className="px-3.5 sm:px-5 py-3 sm:py-4 border-b border-[var(--border)] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-semibold text-gray-800 flex items-center gap-1.5 sm:gap-2 truncate">
                  <BarChart2 size={15} className="text-[var(--primary)] shrink-0" />
                  Participación por publicación
                </h2>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 truncate">
                  Toca una barra para ver el desglose
                </p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-[var(--primary)] tabular-nums">{avgParticipationRate}%</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">promedio</p>
                </div>

                {/* Botón de análisis profundo */}
                <button
                  onClick={() => setShowAnalytics(true)}
                  className="flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg transition-colors shadow-sm"
                >
                  <LineIcon size={13} />
                  <span>Análisis</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 sm:p-5">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats} margin={{ top: 5, right: 5, left: -25, bottom: 45 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="shortDate"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    angle={-45}
                    textAnchor="end"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, totalParticipants]}
                    allowDecimals={false}
                  />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: '#f0f4f8' }} />
                  <ReferenceLine
                    y={totalParticipants}
                    stroke="#d1d5db"
                    strokeDasharray="4 4"
                    label={{ value: `Total: ${totalParticipants}`, position: 'insideTopRight', fontSize: 9, fill: '#9ca3af' }}
                  />
                  <Bar dataKey="totalSupported" radius={[3, 3, 0, 0]} cursor="pointer" onClick={handleBarClick}>
                    {stats.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={selectedDay?.date === entry.date ? '#06305A' : '#0A4B8C'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {selectedDay && (
                <DayDetailPanel day={selectedDay} onClose={() => setSelectedDay(null)} />
              )}
            </div>
          </div>
        )}

        {/* ── Tabla de posiciones ── */}
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="px-3.5 sm:px-5 py-3 sm:py-4 border-b border-[var(--border)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
              <h2 className="text-xs sm:text-sm font-semibold text-gray-800 shrink-0">Tabla de posiciones</h2>
              <div className="relative w-full sm:max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar participante o equipo..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-[var(--border)] bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-xs"
                />
              </div>
            </div>
          </div>

          {/* Encabezado de la tabla */}
          <div className="grid grid-cols-[38px_1fr_auto] sm:grid-cols-[48px_1fr_auto_auto] items-center px-3.5 sm:px-5 py-2.5 bg-gray-50 border-b border-[var(--border)]">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">#</span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-1 sm:pl-2">Participante</span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right pr-1 sm:pr-4">Puntos</span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right w-24 hidden sm:block">Estado</span>
          </div>

          {/* Filas de participantes */}
          {filtered.map((user, index) => {
            const position = ranks[index] || index + 1;
            const isTop3 = position <= 3;
            return (
              <div
                key={user.name || index}
                onClick={() => setSelectedUser(user)}
                className="grid grid-cols-[38px_1fr_auto] sm:grid-cols-[48px_1fr_auto_auto] items-center px-3.5 sm:px-5 py-2.5 sm:py-3.5 border-b border-[var(--border)] last:border-0 hover:bg-blue-50/40 transition-colors cursor-pointer group"
              >
                {/* Ranking / Posición */}
                <div className="flex justify-center">
                  {isTop3 ? (
                    <div className="flex items-center gap-0.5 sm:gap-1">
                      {position === 1 && <Crown size={14} className="text-[var(--secondary)] shrink-0" />}
                      {position === 2 && <Medal size={14} className="text-gray-400 shrink-0" />}
                      {position === 3 && <Medal size={14} className="text-amber-500 shrink-0" />}
                      <span className="text-xs sm:text-sm font-bold text-gray-700">{position}</span>
                    </div>
                  ) : (
                    <span className="text-xs sm:text-sm font-medium text-gray-400 tabular-nums">{position}</span>
                  )}
                </div>

                {/* Avatar + Nombre + Equipo */}
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0 shadow-sm">
                    {getInitials(user.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate group-hover:text-[var(--primary)] transition-colors leading-tight">
                      {user.name}
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-400 truncate mt-0.5">{user.equipo}</p>
                  </div>
                </div>

                {/* Puntos */}
                <div className="text-right pr-1 sm:pr-4 flex flex-col items-end justify-center">
                  <span className="text-xs sm:text-sm font-bold tabular-nums text-[var(--primary)] sm:text-gray-800">
                    {user.totalPoints || 0}
                  </span>
                  <span className="text-[8px] text-gray-400 sm:hidden uppercase font-semibold">pts</span>
                </div>

                {/* Estado badge (solo visible en pantallas medianas y grandes para no apretar el nombre) */}
                <div className="text-right w-24 hidden sm:block">
                  <EstadoBadge activo={(user.totalPoints || 0) > 0} />
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-14 text-center text-gray-400">
              <Search size={26} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm">Sin resultados para <strong>&quot;{search}&quot;</strong></p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] sm:text-xs text-gray-400 gap-1.5 px-1 pb-6">
          <span>Total: {ranking.length} participantes</span>
          <span className="flex items-center gap-1.5">
            <Clock size={11} />
            {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Modales */}
      {selectedUser && (
        <HistorialModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}

      <AnalyticsModal
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        stats={stats}
        teamStats={teamStats}
        actionDistribution={actionDistribution}
      />
    </div>
  );
}