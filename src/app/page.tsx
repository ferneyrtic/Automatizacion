import { getRankingData } from '@/lib/googleSheets';
import RankingClient from '@/components/RankingClient';

export const revalidate = 60;

export default async function Home() {
  const data = await getRankingData();

  return (
    <main className="min-h-screen">
      <RankingClient months={data.months} />
    </main>
  );
}
