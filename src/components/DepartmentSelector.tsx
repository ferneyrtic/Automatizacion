'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Building2, Loader2, Users, FileText, ClipboardCheck, GraduationCap,
  Leaf, Shield, Heart, Cpu, MapPin, Stethoscope, HardHat, HandHeart,
} from 'lucide-react';
import type { Department } from '@/lib/googleSheets';

// Icono por cada departamento (por slug)
const DEPT_ICONS: Record<string, React.ElementType> = {
  tic:             Cpu,
  administrativa:  FileText,
  contratacion:    ClipboardCheck,
  'control-interno': Shield,
  espa:            GraduationCap,
  fomento:         Leaf,
  gobierno:        Building2,
  hospital:        Heart,
  itta:            GraduationCap,
  planeacion:      MapPin,
  salud:           Stethoscope,
  infraestructura: HardHat,
  social:          HandHeart,
};

// Colores de acento por departamento (clases Tailwind)
const DEPT_COLORS: Record<string, { bg: string; icon: string; border: string }> = {
  tic:             { bg: 'bg-blue-50',   icon: 'text-blue-600',   border: 'border-blue-200'   },
  administrativa:  { bg: 'bg-amber-50',  icon: 'text-amber-600',  border: 'border-amber-200'  },
  contratacion:    { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-200' },
  'control-interno':{ bg: 'bg-red-50',   icon: 'text-red-600',    border: 'border-red-200'    },
  espa:            { bg: 'bg-indigo-50', icon: 'text-indigo-600', border: 'border-indigo-200' },
  fomento:         { bg: 'bg-green-50',  icon: 'text-green-600',  border: 'border-green-200'  },
  gobierno:        { bg: 'bg-sky-50',    icon: 'text-sky-600',    border: 'border-sky-200'    },
  hospital:        { bg: 'bg-rose-50',   icon: 'text-rose-600',   border: 'border-rose-200'   },
  itta:            { bg: 'bg-violet-50', icon: 'text-violet-600', border: 'border-violet-200' },
  planeacion:      { bg: 'bg-orange-50', icon: 'text-orange-600', border: 'border-orange-200' },
  salud:           { bg: 'bg-teal-50',   icon: 'text-teal-600',   border: 'border-teal-200'   },
  infraestructura: { bg: 'bg-stone-50',  icon: 'text-stone-600',  border: 'border-stone-200'  },
  social:          { bg: 'bg-pink-50',   icon: 'text-pink-600',   border: 'border-pink-200'   },
};

interface Props {
  departments: Department[];
}

export default function DepartmentSelector({ departments }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  // ── Pre-calentar el caché de todos los departamentos en segundo plano ──────
  // Se lanza silenciosamente al montar el componente; no bloquea la UI.
  useEffect(() => {
    departments.forEach(dep => {
      // router.prefetch le dice a Next.js que descargue y ejecute esa página
      // en segundo plano; llena el caché del servidor automáticamente.
      router.prefetch(`/?dep=${dep.slug}`);
    });
  }, [departments, router]);

  const handleSelect = (dep: Department) => {
    if (loading) return; // evita doble clic
    setLoading(dep.slug);
    router.push(`/?dep=${dep.slug}`);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">

      {/* Header mínimo */}
      <header className="bg-white border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <div className="bg-blue-50 rounded-xl px-3 py-1.5">
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
          <div className="border-l border-gray-200 h-10" />
          <div>
            <h1 className="text-lg font-semibold text-[var(--foreground)] tracking-tight">
              Tabla de posiciones
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">CPS · 2do semestre 2026 · #RecuperandoAcacías</p>
          </div>
        </div>
      </header>

      {/* Selector centrado */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-[var(--primary)] text-white px-4 py-1.5 rounded-full text-xs font-semibold mb-4 tracking-wide">
            <Users size={12} />
            Alcaldía de Acacías
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] mb-2">
            Seleccione su departamento
          </h2>
          <p className="text-sm text-gray-400">
            Elige la dependencia para ver su tabla de posiciones
          </p>
        </div>

        {/* Grid de departamentos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 w-full max-w-5xl">
          {departments.map(dep => {
            const Icon = DEPT_ICONS[dep.slug] ?? Building2;
            const colors = DEPT_COLORS[dep.slug] ?? { bg: 'bg-gray-50', icon: 'text-gray-600', border: 'border-gray-200' };
            const isLoading = loading === dep.slug;
            const isDisabled = !!loading && !isLoading;

            return (
              <button
                key={dep.slug}
                onClick={() => handleSelect(dep)}
                onMouseEnter={() => router.prefetch(`/?dep=${dep.slug}`)}
                disabled={isDisabled}
                className={`
                  relative flex flex-col items-center gap-3 p-4 rounded-xl border
                  transition-all duration-200 text-left group
                  ${isLoading
                    ? `${colors.bg} ${colors.border} border-2 shadow-md`
                    : isDisabled
                      ? 'bg-gray-50 border-[var(--border)] opacity-40 cursor-not-allowed'
                      : `bg-white border-[var(--border)] hover:${colors.bg} hover:${colors.border} hover:border-2 hover:shadow-md cursor-pointer`
                  }
                `}
              >
                {/* Icono */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.bg} ${isLoading ? 'ring-2 ring-offset-1 ring-current' : ''}`}>
                  {isLoading
                    ? <Loader2 size={20} className={`${colors.icon} animate-spin`} />
                    : <Icon size={20} className={`${colors.icon} transition-transform duration-200 group-hover:scale-110`} />
                  }
                </div>

                {/* Nombre */}
                <span className={`text-xs font-semibold text-center leading-tight ${isLoading ? colors.icon : 'text-gray-700'}`}>
                  {dep.name}
                </span>

                {/* Indicador de carga */}
                {isLoading && (
                  <span className="absolute bottom-1.5 text-[9px] font-medium text-gray-400">
                    Cargando...
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-8 text-[10px] text-gray-300 tracking-wide uppercase">
          Los datos se actualizan cada 5 minutos
        </p>
      </div>
    </div>
  );
}
