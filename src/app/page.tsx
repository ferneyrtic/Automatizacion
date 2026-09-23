import { getRankingData, DEPARTMENTS } from '@/lib/googleSheets';
import RankingClient from '@/components/RankingClient';

// La página es dinámica (lee searchParams). El caché está en googleSheets.ts (in-memory, 5 min).
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ dep?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const { dep } = await searchParams;

  // Busca la dependencia que coincida con el slug; si no existe o no se pasa, usa TIC (índice 0)
  const activeDepartment =
    DEPARTMENTS.find(d => d.slug === dep) ?? DEPARTMENTS[0];

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
