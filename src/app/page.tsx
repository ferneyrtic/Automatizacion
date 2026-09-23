import { redirect } from 'next/navigation';
import { getRankingData, DEPARTMENTS } from '@/lib/googleSheets';
import RankingClient from '@/components/RankingClient';
import DepartmentSelector from '@/components/DepartmentSelector';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ dep?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const { dep } = await searchParams;

  // Sin parámetro → pantalla de selección de departamento
  if (!dep) {
    return (
      <main className="min-h-screen">
        <DepartmentSelector departments={DEPARTMENTS} />
      </main>
    );
  }

  // Departamento no reconocido → vuelve al selector
  const activeDepartment = DEPARTMENTS.find(d => d.slug === dep);
  if (!activeDepartment) {
    redirect('/');
  }

  const data = await getRankingData(activeDepartment.sheetId);

  return (
    <main className="min-h-screen">
      <RankingClient
        months={data.months}
        departments={DEPARTMENTS}
        activeDepartment={activeDepartment}
      />
    </main>
  );
}
