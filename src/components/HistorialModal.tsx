'use client';

import { useState } from 'react';
import {
  X, Calendar, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Share2, MessageSquare, ThumbsUp, Check,
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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-[var(--border)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="bg-white border-b border-[var(--border)] px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center text-xs sm:text-sm font-bold tracking-wide shrink-0">
                {getInitials(user.name)}
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-[var(--foreground)] truncate">{user.name}</h2>
                <p className="text-xs sm:text-sm text-gray-500 truncate">{user.equipo}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg p-1.5 transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Stats: 2 columnas en mobile, 4 en desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4">
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
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 bg-gray-50 space-y-3">

          {/* Banner participación completa */}
          {participacionCompleta && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 sm:px-4 sm:py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="w-5 h-5 sm:w-6 sm:h-6 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                <Check size={12} className="text-white" strokeWidth={3} />
              </div>
              <p className="text-xs sm:text-sm font-semibold text-emerald-800">
                ¡Participación perfecta en todas las publicaciones!
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <h3 className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={13} />
              Historial por publicación
            </h3>
            <button
              onClick={() => setExpandido(!expandido)}
              className="text-xs text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium flex items-center gap-1 transition-colors"
            >
              {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span>{expandido ? 'Colapsar' : 'Expandir'}</span>
            </button>
          </div>

          {!user.historyByDate || user.historyByDate.length === 0 ? (
            <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-[var(--border)]">
              <Calendar size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">No hay publicaciones registradas</p>
              <p className="text-xs text-gray-400 mt-0.5">Este participante no tiene interacciones aún</p>
            </div>
          ) : (
            <div className="space-y-2">
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
                    <div className={`px-3.5 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between border-b ${
                      tieneActividad ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100'
                    }`}>
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <Calendar size={13} className={tieneActividad ? 'text-[var(--primary)] shrink-0' : 'text-gray-300 shrink-0'} />
                        <span className="text-xs sm:text-sm font-semibold text-gray-800 truncate">{day.date}</span>
                        {tieneActividad ? (
                          <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full shrink-0">
                            <CheckCircle size={9} /> <span className="hidden xs:inline">Apoyó</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-gray-400 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-full shrink-0">
                            <XCircle size={9} /> <span className="hidden xs:inline">Pendiente</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {tieneActividad && (
                          <span className="text-xs sm:text-sm font-bold text-[var(--primary)]">+{day.pointsEarned || 0} pts</span>
                        )}
                        <span className="text-[11px] sm:text-xs text-gray-400 font-medium">{accionesHechas}/3</span>
                      </div>
                    </div>

                    {/* Grid de acciones */}
                    <div className={`p-2.5 sm:p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 ${expandido ? 'grid' : 'hidden'}`}>
                      {acciones.map((accion, i) => {
                        const Icon = accion.icon;
                        const done = day[accion.key];
                        return (
                          <div
                            key={i}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border ${
                              done
                                ? 'bg-blue-50/70 border-blue-100'
                                : 'bg-gray-50 border-gray-100'
                            }`}
                          >
                            <Icon size={14} className={done ? 'text-[var(--primary)] shrink-0' : 'text-gray-300 shrink-0'} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] sm:text-xs font-semibold truncate ${done ? 'text-gray-800' : 'text-gray-400'}`}>
                                {accion.label}
                              </p>
                              <p className={`text-[9px] sm:text-[10px] ${done ? 'text-[var(--primary)] font-medium' : 'text-gray-400'}`}>
                                {done ? `+${accion.points} pts` : 'No registrada'}
                              </p>
                            </div>
                            {done
                              ? <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                              : <XCircle size={13} className="text-gray-300 shrink-0" />
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
        </div>

        <div className="p-3.5 sm:p-4 border-t border-[var(--border)] bg-white">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-xl font-semibold text-xs sm:text-sm transition-colors shadow-sm"
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
    <div className="bg-gray-50 border border-[var(--border)] rounded-xl px-2.5 sm:px-4 py-2 sm:py-2.5 text-center">
      <p className={`text-base sm:text-lg font-bold tabular-nums ${color ?? (highlight ? 'text-[var(--primary)]' : 'text-gray-800')}`}>
        {value}
      </p>
      <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-0.5 truncate">{label}</p>
    </div>
  );
}