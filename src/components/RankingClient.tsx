'use client';

import { useMemo, useState } from 'react';
import {
  Crown, Medal, Clock, Search, BarChart2,
  Share2, MessageSquare, ThumbsUp, LineChart as LineIcon,
  Calendar, X, ExternalLink, ChevronUp, ChevronDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import type { UserRanking, PublicationStat, TeamStat, ActionDistribution, DayRecord } from '@/lib/googleSheets';
import Header from '@/components/header';
import HistorialModal from '@/components/HistorialModal';
import AnalyticsModal from '@/components/AnalyticsModal';

// ─── Tipos y constantes de filtro por acción ─────────────────────────────────

type ActionFilter = 'all' | 'shared' | 'commented' | 'reacted';

const ACTION_KEYS: ActionFilter[] = ['all', 'shared', 'commented', 'reacted'];

const ACTION_LABELS: Record<ActionFilter, string> = {
  all: 'Todos',
  shared: 'Compartidos',
  commented: 'Comentarios',
  reacted: 'Reacciones',
};

const ACTION_CHIPS: Record<Exclude<ActionFilter, 'all'>, { label: string; pts: number; Icon: typeof Share2; cls: string }> = {
  shared:    { label: 'Compartió', pts: 15, Icon: Share2,        cls: 'bg-blue-50 text-[var(--primary)] border-blue-100' },
  commented: { label: 'Comentó',   pts: 20, Icon: MessageSquare, cls: 'bg-amber-50 text-[var(--secondary)] border-amber-100' },
  reacted:   { label: 'Reaccionó', pts: 10, Icon: ThumbsUp,      cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
};

const EMPTY_MESSAGES: Record<ActionFilter, string> = {
  all:       'No hay participantes en esta publicación.',
  shared:    'No hay participantes que hayan compartido esta publicación.',
  commented: 'No hay participantes que hayan comentado esta publicación.',
  reacted:   'No hay participantes que hayan reaccionado a esta publicación.',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  if (!name) return '??';
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function pointsForFilter(day: DayRecord, f: ActionFilter): number {
  if (f === 'all') return day.pointsEarned;
  if (!day[f]) return 0;
  if (f === 'shared') return day.sharedPoints;
  if (f === 'commented') return day.commentedPoints;
  return day.reactedPoints;
}

function SortablePointsHeader({ sort, onToggle, label = 'Puntos' }: {
  sort: 'asc' | 'desc';
  onToggle: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onToggle}
      title="Ordenar por puntos (ascendente / descendente)"
      className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider hover:text-[var(--primary)] transition-colors"
    >
      {label}
      <span className="flex flex-col leading-none -space-y-0.5">
        <ChevronUp size={9} strokeWidth={3} className={sort === 'asc' ? 'text-[var(--primary)]' : 'text-gray-300'} />
        <ChevronDown size={9} strokeWidth={3} className={sort === 'desc' ? 'text-[var(--primary)]' : 'text-gray-300'} />
      </span>
    </button>
  );
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
      <p className="font-semibold text-gray-800 text-xs leading-snug mb-0.5">{d.name || d.date}</p>
      {d.name && <p className="text-gray-400 text-[11px] mb-1.5">{d.date}</p>}
      <p className="text-xs text-gray-400">
        <span className="text-gray-600">{d.totalSupported}</span> de {d.totalParticipants} personas participaron
      </p>
      <p className="text-gray-400 text-xs mt-1.5 pt-1.5 border-t border-gray-100">
        Clic para filtrar la tabla por esta publicación
      </p>
    </div>
  );
}

// ─── Panel de publicación seleccionada ───────────────────────────────────────

function PublicationPanel({
  pub, actionCounts, selectedAction, onActionChange, onClose,
}: {
  pub: PublicationStat;
  actionCounts: Record<ActionFilter, number>;
  selectedAction: ActionFilter;
  onActionChange: (f: ActionFilter) => void;
  onClose: () => void;
}) {
  const actions = [
    { label: 'Compartir',  count: pub.sharedCount,    icon: Share2,        bar: 'bg-[var(--primary)]' },
    { label: 'Comentar',   count: pub.commentedCount, icon: MessageSquare, bar: 'bg-[var(--secondary)]' },
    { label: 'Reaccionar', count: pub.reactedCount,   icon: ThumbsUp,      bar: 'bg-emerald-500' },
  ];

  return (
    <div className="mt-4 border border-[var(--border)] rounded-xl overflow-hidden bg-white">
      {/* Cabecera: publicación seleccionada */}
      <div className="px-5 py-3.5 border-b border-[var(--border)] bg-gray-50 flex flex-wrap items-start gap-3 justify-between">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center shrink-0">
            <Calendar size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Publicación seleccionada</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5 leading-snug">{pub.date}</p>
            {pub.name && <p className="text-xs text-gray-500 truncate mt-0.5">{pub.name}</p>}
            {pub.link && (
              <a
                href={pub.link}
                target="_blank"
                rel="noreferrer"
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] px-4 py-2 rounded-lg shadow-sm transition-colors"
              >
                <ExternalLink size={14} /> Ver publicación
              </a>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors shrink-0"
        >
          <X size={13} /> Todas las publicaciones
        </button>
      </div>

      {/* Desglose por acción */}
      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-5 border-b border-[var(--border)]">
        {actions.map(({ label, count, icon: Icon, bar }) => {
          const pct = pub.totalParticipants > 0 ? Math.round((count / pub.totalParticipants) * 100) : 0;
          return (
            <div key={label} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Icon size={13} />
                  <span className="text-xs font-medium">{label}</span>
                </div>
                <span className="text-xs font-bold text-gray-800 tabular-nums">
                  {count}<span className="text-gray-400 font-normal"> / {pub.totalParticipants}</span>
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div className={`h-1.5 rounded-full ${bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-right text-gray-400">{pct}%</p>
            </div>
          );
        })}
      </div>

      {/* Filtro por tipo de acción */}
      <div className="px-5 py-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-1">Acciones:</span>
        {ACTION_KEYS.map(f => (
          <button
            key={f}
            onClick={() => onActionChange(f)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              selectedAction === f
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                : 'bg-gray-50 text-gray-500 border-[var(--border)] hover:bg-gray-100'
            }`}
          >
            {ACTION_LABELS[f]}
            <span className={`ml-1.5 tabular-nums ${selectedAction === f ? 'text-white/70' : 'text-gray-400'}`}>
              {actionCounts[f]}
            </span>
          </button>
        ))}
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
  const [selectedPublication, setSelectedPublication] = useState<PublicationStat | null>(null);
  const [selectedAction, setSelectedAction]   = useState<ActionFilter>('all');
  const [search, setSearch]                   = useState('');
  const [showAnalytics, setShowAnalytics]     = useState(false);
  const [pointsSort, setPointsSort]           = useState<'asc' | 'desc'>('desc');
  const [globalAction, setGlobalAction]       = useState<ActionFilter>('all');

  const togglePointsSort = () => setPointsSort(s => (s === 'asc' ? 'desc' : 'asc'));

  const activeUsers = ranking.filter(u => (u.totalPoints || 0) > 0).length;

  // Participantes con actividad en la publicación seleccionada (una fila por persona).
  const publicationRows = useMemo(() => {
    if (!selectedPublication) return [];
    return ranking
      .map(user => {
        const day = user.historyByDate?.find(d => d.publicationId === selectedPublication.id);
        return day && (day.shared || day.commented || day.reacted) ? { user, day } : null;
      })
      .filter((x): x is { user: UserRanking; day: DayRecord } => x !== null);
  }, [ranking, selectedPublication]);

  const actionCounts = useMemo(() => {
    const counts: Record<ActionFilter, number> = { all: 0, shared: 0, commented: 0, reacted: 0 };
    for (const { day } of publicationRows) {
      counts.all++;
      if (day.shared) counts.shared++;
      if (day.commented) counts.commented++;
      if (day.reacted) counts.reacted++;
    }
    return counts;
  }, [publicationRows]);

  const filtered       = ranking.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
  const ranksByName    = useMemo(() => {
    const map: Record<string, number> = {};
    const sorted = [...filtered].sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name));
    let rank = 1;
    sorted.forEach((u, i) => {
      if (i > 0 && u.totalPoints < sorted[i - 1].totalPoints) rank = i + 1;
      map[u.name] = rank;
    });
    return map;
  }, [filtered]);

  const visibleRanking = useMemo(() => {
    const list = [...filtered];
    const dir = pointsSort === 'asc' ? -1 : 1;
    list.sort((a, b) => dir * (b.totalPoints - a.totalPoints) || a.name.localeCompare(b.name));
    return list;
  }, [filtered, pointsSort]);

  const visibleRows = useMemo(() => {
    if (!selectedPublication) return [];
    const rows = publicationRows
      .filter(r => selectedAction === 'all' || r.day[selectedAction])
      .filter(r => r.user.name.toLowerCase().includes(search.toLowerCase()));
    const dir = pointsSort === 'asc' ? -1 : 1;
    rows.sort((a, b) =>
      dir * (pointsForFilter(b.day, selectedAction) - pointsForFilter(a.day, selectedAction)) ||
      a.user.name.localeCompare(b.user.name)
    );
    return rows;
  }, [publicationRows, selectedPublication, selectedAction, search, pointsSort]);

  const globalActionCounts = useMemo(() => {
    const counts: Record<ActionFilter, number> = { all: ranking.length, shared: 0, commented: 0, reacted: 0 };
    for (const user of ranking) {
      for (const day of user.historyByDate || []) {
        if (day.shared) counts.shared++;
        if (day.commented) counts.commented++;
        if (day.reacted) counts.reacted++;
      }
    }
    return counts;
  }, [ranking]);

  const globalActionRows = useMemo(() => {
    const action = globalAction === 'all' ? null : globalAction;
    if (!action) return [] as { user: UserRanking; count: number; points: number }[];
    const rows = ranking
      .map(user => {
        let count = 0;
        let points = 0;
        for (const day of user.historyByDate || []) {
          if (day[action]) {
            count++;
            points += day[`${action}Points`] || 0;
          }
        }
        return { user, count, points };
      })
      .filter(r => r.count > 0)
      .filter(r => r.user.name.toLowerCase().includes(search.toLowerCase()));
    const dir = pointsSort === 'asc' ? -1 : 1;
    rows.sort((a, b) =>
      dir * (b.points - a.points) ||
      b.count - a.count ||
      a.user.name.localeCompare(b.user.name)
    );
    return rows;
  }, [ranking, globalAction, search, pointsSort]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = (data: any) => {
    const pub = data as PublicationStat;
    if (!pub || !pub.id) return;
    // Alterna: volver a hacer clic en la misma barra restaura la vista general.
    setSelectedPublication(prev => (prev?.id === pub.id ? null : pub));
    setSelectedAction('all');
  };

  const closePublication = () => {
    setSelectedPublication(null);
    setSelectedAction('all');
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">

      <Header
        totalParticipants={totalParticipants}
        activeUsers={activeUsers}
        avgParticipationRate={avgParticipationRate}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Fila superior: participación diaria + botón de análisis ── */}
        {stats.length > 0 && (
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <BarChart2 size={15} className="text-[var(--primary)] shrink-0" />
                  Participación por publicación
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Selecciona una barra para filtrar los participantes por publicación
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-[var(--primary)] tabular-nums">{avgParticipationRate}%</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">promedio</p>
                </div>

                {/* Botón de análisis profundo */}
                <button
                  onClick={() => setShowAnalytics(true)}
                  className="flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-sm"
                >
                  <LineIcon size={13} />
                  Ver análisis
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-5">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats} margin={{ top: 5, right: 10, left: -20, bottom: 45 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="shortDate"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    angle={-45}
                    textAnchor="end"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
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
                    label={{ value: `Total: ${totalParticipants}`, position: 'insideTopRight', fontSize: 10, fill: '#9ca3af' }}
                  />
                  <Bar dataKey="totalSupported" radius={[3, 3, 0, 0]} cursor="pointer" onClick={handleBarClick}>
                    {stats.map(entry => (
                      <Cell
                        key={entry.id}
                        fill={selectedPublication?.id === entry.id ? '#06305A' : '#0A4B8C'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {selectedPublication && (
                <PublicationPanel
                  pub={selectedPublication}
                  actionCounts={actionCounts}
                  selectedAction={selectedAction}
                  onActionChange={setSelectedAction}
                  onClose={closePublication}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Tabla de posiciones / participantes por publicación ── */}
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-[var(--border)]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="text-sm font-semibold text-gray-800 shrink-0">
                {selectedPublication
                  ? 'Participantes por publicación'
                  : globalAction !== 'all'
                    ? 'Participantes por acción'
                    : 'Tabla de posiciones'}
              </h2>
              {selectedPublication && (
                <span className="text-[10px] font-semibold text-[var(--primary)] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full shrink-0">
                  {selectedPublication.shortDate}
                </span>
              )}
              {!selectedPublication && globalAction !== 'all' && (
                <span className="text-[10px] font-semibold text-[var(--primary)] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full shrink-0">
                  {ACTION_LABELS[globalAction]}
                </span>
              )}
              <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar participante..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-[var(--border)] bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-xs"
                />
              </div>
            </div>

            {!selectedPublication && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-1">Acciones:</span>
                {ACTION_KEYS.map(f => (
                  <button
                    key={f}
                    onClick={() => setGlobalAction(f)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                      globalAction === f
                        ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                        : 'bg-gray-50 text-gray-500 border-[var(--border)] hover:bg-gray-100'
                    }`}
                  >
                    {ACTION_LABELS[f]}
                    <span className={`ml-1.5 tabular-nums ${globalAction === f ? 'text-white/70' : 'text-gray-400'}`}>
                      {globalActionCounts[f]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedPublication ? (
            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
                <div className="grid grid-cols-[56px_minmax(0,1fr)_auto_auto_auto] items-center px-5 py-2.5 bg-gray-50 border-b border-[var(--border)]">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">#</span>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Participante</span>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Acción</span>
                  <span className="text-right">
                    <SortablePointsHeader sort={pointsSort} onToggle={togglePointsSort} />
                  </span>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right w-24">Estado</span>
                </div>

                {visibleRows.map(({ user, day }, index) => (
                  <div
                    key={user.name}
                    onClick={() => setSelectedUser(user)}
                    className="grid grid-cols-[56px_minmax(0,1fr)_auto_auto_auto] items-center px-5 py-3 border-b border-[var(--border)] last:border-0 hover:bg-blue-50/30 transition-colors cursor-pointer group"
                  >
                    <div className="flex justify-center">
                      <span className="text-sm font-medium text-gray-400 tabular-nums">{index + 1}</span>
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {getInitials(user.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-[var(--primary)] transition-colors">
                          {user.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{user.equipo}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                      {(selectedAction === 'all' ? (['shared', 'commented', 'reacted'] as const) : [selectedAction]).map(k => {
                        if (!day[k]) return null;
                        const chip = ACTION_CHIPS[k];
                        const pts = k === 'shared' ? day.sharedPoints : k === 'commented' ? day.commentedPoints : day.reactedPoints;
                        return (
                          <span key={k} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${chip.cls}`}>
                            <chip.Icon size={11} />
                            {chip.label} <span className="opacity-70">+{pts}</span>
                          </span>
                        );
                      })}
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-right text-gray-700 pr-4">
                      {pointsForFilter(day, selectedAction)}
                    </span>
                    <div className="text-right w-24">
                      <EstadoBadge activo={(user.totalPoints || 0) > 0} />
                    </div>
                  </div>
                ))}

                {visibleRows.length === 0 && (
                  <div className="py-14 text-center text-gray-400">
                    <Search size={26} className="mx-auto mb-3 text-gray-200" />
                    <p className="text-sm">{EMPTY_MESSAGES[selectedAction]}</p>
                    {search && (
                      <p className="text-xs text-gray-400 mt-1">
                        para la búsqueda <strong>&quot;{search}&quot;</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : globalAction !== 'all' ? (
            <>
              <div className="grid grid-cols-[56px_minmax(0,1fr)_auto_auto_auto] items-center px-5 py-2.5 bg-gray-50 border-b border-[var(--border)]">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">#</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Participante</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Veces</span>
                <span className="text-right">
                  <SortablePointsHeader sort={pointsSort} onToggle={togglePointsSort} />
                </span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right w-24">Estado</span>
              </div>

              {globalActionRows.map(({ user, count, points }, index) => (
                <div
                  key={user.name}
                  onClick={() => setSelectedUser(user)}
                  className="grid grid-cols-[56px_minmax(0,1fr)_auto_auto_auto] items-center px-5 py-3 border-b border-[var(--border)] last:border-0 hover:bg-blue-50/30 transition-colors cursor-pointer group"
                >
                  <div className="flex justify-center">
                    <span className="text-sm font-medium text-gray-400 tabular-nums">{index + 1}</span>
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {getInitials(user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate group-hover:text-[var(--primary)] transition-colors">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{user.equipo}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-right text-gray-700 pr-4">
                    {count} <span className="text-[10px] font-normal text-gray-400">veces</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-right text-gray-700 pr-4">
                    {points}
                  </span>
                  <div className="text-right w-24">
                    <EstadoBadge activo={points > 0} />
                  </div>
                </div>
              ))}

              {globalActionRows.length === 0 && (
                <div className="py-14 text-center text-gray-400">
                  <Search size={26} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-sm">{EMPTY_MESSAGES[globalAction]}</p>
                  {search && (
                    <p className="text-xs text-gray-400 mt-1">
                      para la búsqueda <strong>&quot;{search}&quot;</strong>
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-[56px_1fr_auto_auto] items-center px-5 py-2.5 bg-gray-50 border-b border-[var(--border)]">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">#</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Participante</span>
                <span className="text-right">
                  <SortablePointsHeader sort={pointsSort} onToggle={togglePointsSort} />
                </span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right w-24">Estado</span>
              </div>

              {visibleRanking.map((user, index) => {
                const position = ranksByName[user.name] || index + 1;
                const isTop3 = position <= 3;
                return (
                  <div
                    key={user.name || index}
                    onClick={() => setSelectedUser(user)}
                    className="grid grid-cols-[56px_1fr_auto_auto] items-center px-5 py-3.5 border-b border-[var(--border)] last:border-0 hover:bg-blue-50/30 transition-colors cursor-pointer group"
                  >
                    <div className="flex justify-center">
                      {isTop3 ? (
                        <div className="flex items-center gap-1">
                          {position === 1 && <Crown size={15} className="text-[var(--secondary)]" />}
                          {position === 2 && <Medal size={15} className="text-gray-400" />}
                          {position === 3 && <Medal size={15} className="text-amber-500" />}
                          <span className="text-sm font-bold text-gray-700">{position}</span>
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-gray-400 tabular-nums">{position}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {getInitials(user.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-[var(--primary)] transition-colors">
                          {user.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{user.equipo}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-right text-gray-700 pr-4">
                      {user.totalPoints || 0}
                    </span>
                    <div className="text-right w-24">
                      <EstadoBadge activo={(user.totalPoints || 0) > 0} />
                    </div>
                  </div>
                );
              })}

              {visibleRanking.length === 0 && (
                <div className="py-14 text-center text-gray-400">
                  <Search size={26} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-sm">Sin resultados para <strong>&quot;{search}&quot;</strong></p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-2 px-1 pb-6">
          <span>
            {selectedPublication
              ? `Total: ${publicationRows.length} participantes en esta publicación`
              : globalAction !== 'all'
                ? `Total: ${globalActionRows.length} participantes · ${globalActionCounts[globalAction]} ${ACTION_LABELS[globalAction].toLowerCase()} en total`
                : `Total: ${ranking.length} participantes`}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={11} />
            {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Modales */}
      {selectedUser && (
        <HistorialModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}

      <AnalyticsModal
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        ranking={ranking}
        stats={stats}
        teamStats={teamStats}
        actionDistribution={actionDistribution}
      />
    </div>
  );
}
