import { google } from 'googleapis';

export type DayRecord = {
  date: string;
  shared: boolean;
  commented: boolean;
  reacted: boolean;
  pointsEarned: number;
};

export type UserRanking = {
  name: string;
  equipo: string;
  totalPoints: number;
  historyByDate: DayRecord[];
};

export type PublicationStat = {
  date: string;
  shortDate: string;
  totalSupported: number;
  sharedCount: number;
  commentedCount: number;
  reactedCount: number;
  totalParticipants: number;
  participationRate: number;
};

export type TeamStat = {
  equipo: string;
  totalPoints: number;
  activeMembers: number;  // personas con al menos 1 punto
  totalMembers: number;
  participationRate: number;
};

export type ActionDistribution = {
  shared: number;
  commented: number;
  reacted: number;
};

export type DashboardData = {
  ranking: UserRanking[];
  stats: PublicationStat[];
  teamStats: TeamStat[];
  actionDistribution: ActionDistribution;
  totalParticipants: number;
  totalPoints: number;
  avgParticipationRate: number;
};

const POINTS = { shared: 15, commented: 20, reacted: 10 };

function parseShortDate(dateStr: string): string {
  const match = dateStr.match(/(\d{2}\/\d{2})/);
  return match ? match[1] : dateStr.slice(0, 5);
}

export async function getRankingData(): Promise<DashboardData> {
  const empty: DashboardData = {
    ranking: [], stats: [], teamStats: [],
    actionDistribution: { shared: 0, commented: 0, reacted: 0 },
    totalParticipants: 0, totalPoints: 0, avgParticipationRate: 0,
  };

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'A2:ZZ',
    });

    const rows = response.data.values;
    if (!rows || rows.length < 4) return empty;

    const dateRow = rows[0];
    const dataRows = rows.slice(3);

    const allDates: string[] = [];
    for (let i = 6; i < dateRow.length; i += 3) {
      const date = dateRow[i]?.trim();
      if (date) allDates.push(date);
    }

    const validRows = dataRows.filter(row => row[2]?.trim());
    const rankingMap: Record<string, UserRanking> = {};

    for (const row of validRows) {
      const name = row[2].trim();
      const equipo = row[1]?.trim() || 'Sin Equipo';
      let totalPoints = 0;
      const historyByDate: DayRecord[] = [];

      allDates.forEach((date, groupIndex) => {
        const base = 6 + groupIndex * 3;
        const shared    = row[base]?.trim().toUpperCase() === 'X';
        const commented = row[base + 1]?.trim().toUpperCase() === 'X';
        const reacted   = row[base + 2]?.trim().toUpperCase() === 'X';
        const pointsEarned =
          (shared ? POINTS.shared : 0) +
          (commented ? POINTS.commented : 0) +
          (reacted ? POINTS.reacted : 0);
        totalPoints += pointsEarned;
        historyByDate.push({ date, shared, commented, reacted, pointsEarned });
      });

      rankingMap[name] = { name, equipo, totalPoints, historyByDate };
    }

    const ranking = Object.values(rankingMap).sort((a, b) => b.totalPoints - a.totalPoints);
    const totalParticipants = ranking.length;
    const totalPoints = ranking.reduce((acc, u) => acc + u.totalPoints, 0);

    // ── Estadísticas por publicación ──────────────────────────────────────
    const stats: PublicationStat[] = allDates.map((date, groupIndex) => {
      const base = 6 + groupIndex * 3;
      let sharedCount = 0, commentedCount = 0, reactedCount = 0, totalSupported = 0;

      for (const row of validRows) {
        const s = row[base]?.trim().toUpperCase() === 'X';
        const c = row[base + 1]?.trim().toUpperCase() === 'X';
        const r = row[base + 2]?.trim().toUpperCase() === 'X';
        if (s) sharedCount++;
        if (c) commentedCount++;
        if (r) reactedCount++;
        if (s || c || r) totalSupported++;
      }

      return {
        date, shortDate: parseShortDate(date),
        totalSupported, sharedCount, commentedCount, reactedCount,
        totalParticipants,
        participationRate: totalParticipants > 0
          ? Math.round((totalSupported / totalParticipants) * 100) : 0,
      };
    });

    const avgParticipationRate = stats.length > 0
      ? Math.round(stats.reduce((acc, s) => acc + s.participationRate, 0) / stats.length)
      : 0;

    // ── Estadísticas por equipo ───────────────────────────────────────────
    const teamMap: Record<string, { totalPoints: number; active: number; total: number }> = {};
    for (const user of ranking) {
      if (!teamMap[user.equipo]) teamMap[user.equipo] = { totalPoints: 0, active: 0, total: 0 };
      teamMap[user.equipo].totalPoints += user.totalPoints;
      teamMap[user.equipo].total++;
      if (user.totalPoints > 0) teamMap[user.equipo].active++;
    }
    const teamStats: TeamStat[] = Object.entries(teamMap)
      .map(([equipo, d]) => ({
        equipo,
        totalPoints: d.totalPoints,
        activeMembers: d.active,
        totalMembers: d.total,
        participationRate: d.total > 0 ? Math.round((d.active / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    // ── Distribución de acciones ──────────────────────────────────────────
    const actionDistribution: ActionDistribution = {
      shared:    stats.reduce((acc, s) => acc + s.sharedCount, 0),
      commented: stats.reduce((acc, s) => acc + s.commentedCount, 0),
      reacted:   stats.reduce((acc, s) => acc + s.reactedCount, 0),
    };

    return { ranking, stats, teamStats, actionDistribution, totalParticipants, totalPoints, avgParticipationRate };
  } catch (error) {
    console.error('Error fetching Google Sheets data:', error);
    return empty;
  }
}
