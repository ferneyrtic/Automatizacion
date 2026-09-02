'use client';

import { useState } from 'react';
import {
  X, Calendar, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Share2, MessageSquare, ThumbsUp, Check, ExternalLink,
} from 'lucide-react';
import type { UserRanking } from '@/lib/googleSheets';

interface HistorialModalProps {
  user: UserRanking | null;
  onClose: () => void;
}

export default function HistorialModal({ user, onClose }: HistorialModalProps) {
  const [expandido, setExpandido] = useState(true);

  if (!user) return null;

  const totalDias = user.historyByDate?.length || 0;
  const diasActivos = user.historyByDate?.filter(d => d.shared || d.commented || d.reacted).length || 0;
  const tasaParticipacion = totalDias > 0 ? Math.round((diasActivos / totalDias) * 100) : 0;
  const participacionCompleta = totalDias > 0 && diasActivos === totalDias;

  const acciones = [
    { label: 'Compartir', key: 'shared' as const, icon: Share2, points: 15 },
    { label: 'Comentar', key: 'commented' as const, icon: MessageSquare, points: 20 },
    { label: 'Reaccionar', key: 'reacted' as const, icon: ThumbsUp, points: 10 },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] sm:max-h-[92vh] flex flex-col overflow-hidden border border-[var(--border)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera: blanca, sin gradiente */}
        <div className="bg-white border-b border-[var(--border)] px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center text-sm font-bold tracking-wide shrink-0">
                {getInitials(user.name)}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-[var(--foreground)] break-words leading-tight">
                  {user.name}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 break-words">{user.equipo}</p>
                {user.profileLink && (
                  <a
                    href={user.profileLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] px-3.5 py-2 rounded-lg shadow-sm transition-colors"
                  >
                    <ExternalLink size={13} />
                    Ver perfil
                  </a>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg p-1.5 transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Stats de 4 columnas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4 sm:mt-5">
            <StatBox value={user.totalPoints || 0} label="Puntos totales" highlight />
            <StatBox value={diasActivos} label="Días activos" />
            <StatBox value={totalDias} label="Publicaciones" />
            <StatBox
              value={`${tasaParticipacion}%`}
              label="Participación"
              color={tasaParticipacion >= 70 ? 'text-emerald-600' : tasaParticipacion >= 40 ? 'text-amber-500' : 'text-red-500'}
            />
          </div>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50">

          {/* Banner participación completa */}
          {participacionCompleta && (
            <div className="mb-4 flex items-start sm:items-center gap-2.5 px-3.5 sm:px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                <Check size={13} className="text-white" strokeWidth={3} />
              </div>
              <p className="text-sm font-semibold text-emerald-700 leading-snug">
                Ha participado en todas las publicaciones registradas.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Calendar size={13} />
              Historial por publicación
            </h3>
            <button
              onClick={() => setExpandido(!expandido)}
              className="text-xs text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium flex items-center gap-1 transition-colors shrink-0"
            >
              {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expandido ? 'Colapsar todo' : 'Expandir todo'}
            </button>
          </div>

          {!user.historyByDate || user.historyByDate.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-[var(--border)]">
              <Calendar size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">No hay publicaciones registradas</p>
              <p className="text-xs text-gray-400 mt-1">Este usuario no tiene interacciones aún</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {user.historyByDate.map((day, index) => {
                const tieneActividad = day.shared || day.commented || day.reacted;
                const accionesHechas = acciones.filter(a => day[a.key]).length;

                return (
                  <div
                    key={index}
                    className={`bg-white rounded-xl border overflow-hidden transition-opacity ${
                      tieneActividad ? 'border-gray-200' : 'border-gray-100 opacity-60'
                    }`}
                  >
                    {/* Fila de fecha */}
                    <div className={`px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 justify-between border-b ${
                      tieneActividad ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100'
                    }`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Calendar size={13} className={`shrink-0 ${tieneActividad ? 'text-[var(--primary)]' : 'text-gray-300'}`} />
                        <span className="text-sm font-medium text-gray-800 whitespace-nowrap">{day.date}</span>
                        {tieneActividad ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                            <CheckCircle size={10} /> Participó
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                            <XCircle size={10} /> Sin actividad
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        {tieneActividad && (
                          <span className="text-sm font-bold text-[var(--primary)]">+{day.pointsEarned || 0} pts</span>
                        )}
                        <span className="text-xs text-gray-400">{accionesHechas}/3</span>
                      </div>
                    </div>

                    {/* Grid de acciones */}
                    <div className={`p-2.5 sm:p-3 grid grid-cols-3 gap-1.5 sm:gap-2 ${expandido ? 'grid' : 'hidden'}`}>
                      {acciones.map((accion, i) => {
                        const Icon = accion.icon;
                        const done = day[accion.key];
                        const pts = day[`${accion.key}Points`] || accion.points;
                        return (
                          <div
                            key={i}
                            className={`flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-3 py-2 rounded-lg border ${
                              done
                                ? 'bg-blue-50 border-blue-100'
                                : 'bg-gray-50 border-gray-100'
                            }`}
                          >
                            <Icon size={14} className={`shrink-0 ${done ? 'text-[var(--primary)]' : 'text-gray-300'}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] sm:text-xs font-semibold truncate ${done ? 'text-gray-800' : 'text-gray-400'}`}>
                                {accion.label}
                              </p>
                              <p className={`text-[10px] ${done ? 'text-[var(--primary)]' : 'text-gray-400'}`}>
                                {done ? `+${pts} pts` : 'Pendiente'}
                              </p>
                            </div>
                            {done
                              ? <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                              : <XCircle size={13} className="text-gray-200 shrink-0" />
                            }
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Resumen final */}
          <div className="mt-4 px-3.5 sm:px-4 py-3 bg-white border border-[var(--border)] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-1.5 text-center sm:text-left text-sm">
            <span className="text-gray-500 font-medium">Resumen</span>
            <span className="text-[var(--primary)] font-semibold text-xs sm:text-sm leading-snug">
              {diasActivos} de {totalDias} días activos · {tasaParticipacion}% de participación
            </span>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--border)] bg-white">
          <button
            onClick={onClose}
            className="w-full py-3 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-xl font-semibold text-sm transition-colors"
          >
            Cerrar historial
          </button>
        </div>
      </div>
    </div>
  );
}

function getInitials(name: string) {
  if (!name) return '??';
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function StatBox({
  value, label, highlight, color,
}: {
  value: string | number; label: string; highlight?: boolean; color?: string;
}) {
  return (
    <div className="bg-gray-50 border border-[var(--border)] rounded-xl px-2 py-2.5 sm:px-4 sm:py-3 text-center min-w-0">
      <p className={`text-lg sm:text-xl font-bold tabular-nums truncate ${color ?? (highlight ? 'text-[var(--primary)]' : 'text-gray-800')}`}>
        {value}
      </p>
      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-0.5 truncate">{label}</p>
    </div>
  );
}