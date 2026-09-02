import { getRankingData } from '@/lib/googleSheets';
import RankingClient from '@/components/RankingClient';

export const revalidate = 60;

export default async function Home() {
  const data = await getRankingData();

  return (
    <main className="min-h-screen">
      <RankingClient
        ranking={data.ranking}
        stats={data.stats}
        teamStats={data.teamStats}
        actionDistribution={data.actionDistribution}
        totalParticipants={data.totalParticipants}
        totalPoints={data.totalPoints}
        avgParticipationRate={data.avgParticipationRate}
      />
    </main>
  );
}