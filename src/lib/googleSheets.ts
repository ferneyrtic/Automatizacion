import { google } from 'googleapis';

export type DayRecord = {
  publicationId: string;
  date: string;
  publicationName?: string;
  publicationLink?: string;
  shared: boolean;
  commented: boolean;
  reacted: boolean;
  sharedPoints: number;
  commentedPoints: number;
  reactedPoints: number;
  pointsEarned: number;
};

export type UserRanking = {
  name: string;
  equipo: string;
  profileLink?: string;
  totalPoints: number;
  historyByDate: DayRecord[];
};

export type PublicationStat = {
  id: string;
  date: string;
  shortDate: string;
  name: string;
  link?: string;
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

/**
 * Interpreta una celda de acción de la hoja.
 * Antes se marcaba con "X"; ahora el valor de la casilla ES el puntaje
 * ganado (10, 15, 20, ...). Por compatibilidad, una "X" equivale al
 * puntaje estándar de esa acción.
 */
function parseActionCell(raw: string | undefined, defaultPoints: number): { done: boolean; points: number } {
  const value = (raw || '').trim();
  if (!value) return { done: false, points: 0 };
  if (value.toUpperCase() === 'X') return { done: true, points: defaultPoints };
  const numeric = parseFloat(value.replace(/\s+/g, '').replace(',', '.'));
  if (!isNaN(numeric)) {
    const points = Math.round(numeric);
    return points > 0 ? { done: true, points } : { done: false, points: 0 };
  }
  return { done: false, points: 0 };
}

const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}/;

function parseShortDate(dateStr: string): string {
  const match = dateStr.match(/(\d{2}\/\d{2})/);
  return match ? match[1] : dateStr.slice(0, 5);
}

/**
 * Normaliza nombres de equipo para agrupaciones consistentes:
 * - espacios unicode (NBSP, etc.) -> espacio normal
 * - caracteres de ancho cero eliminados
 * - espacios múltiples colapsados
 * - separador de guion estandarizado: "TIC- VIVIENDA" -> "TIC - VIVIENDA"
 * - guion colgante eliminado: "TIC - " -> "TIC"
 * - el equipo VIVIENDA no existe: cualquier equipo con "VIVIENDA" se asigna a "TIC"
 */
function normalizeTeamName(raw: string): string {
  if (!raw) return 'Sin Equipo';
  const normalized = raw
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+-\s*$/, '')
    .trim();
  if (!normalized) return 'Sin Equipo';
  if (/vivienda/i.test(normalized)) return 'TIC';
  return normalized;
}

/** Extrae el nombre legible y el link de la celda de publicación (puede ser multilínea). */
function parsePublicationCell(raw: string | undefined): { name: string; link: string } {
  const lines = (raw || '').split('\n').map(l => l.trim()).filter(Boolean);
  const link = lines.find(l => /^https?:\/\//i.test(l)) || '';
  const name = lines.find(l => !/^https?:\/\//i.test(l)) || '';
  return { name, link };
}

/**
 * Extrae el enlace de perfil de una celda (columna D del Excel).
 * Acepta URLs completas (https://...) o dominios simples (facebook.com/...).
 */
function extractProfileLink(raw: string | undefined): string | undefined {
  const lines = (raw || '').split('\n').map(l => l.trim()).filter(Boolean);
  const candidate = lines.find(l => /^https?:\/\//i.test(l)) || lines[0];
  if (!candidate) return undefined;
  const clean = (url: string) => url.replace(/[),.;!?\]]+$/g, '');
  const direct = candidate.match(/https?:\/\/[^\s"'<>]+/i);
  if (direct) return clean(direct[0]);
  const bare = candidate.match(/(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/\S*)?/);
  if (bare && /[a-zA-Z]/.test(bare[0])) return `https://${clean(bare[0])}`;
  return undefined;
}

/** Localiza la fila que contiene las fechas de las publicaciones (dd/mm/yyyy en columnas >= 6). */
function findDateRow(rows: string[][]): number {
  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const row = rows[r] || [];
    const hasDate = row.slice(6).some(c => DATE_PATTERN.test((c || '').trim()));
    if (hasDate) return r;
  }
  return -1;
}

/** Localiza la fila de encabezados de columnas ("No | EQUIPO | Contratista | ..."). */
function findHeaderRow(rows: string[][], start: number): number {
  for (let r = start; r < Math.min(start + 5, rows.length); r++) {
    if (String((rows[r] || [])[2] || '').trim().toLowerCase() === 'contratista') return r;
  }
  return -1;
}

/**
 * Detecta las filas ocultas (fold/ocultadas por el usuario) de la hoja.
 * Devuelve un Set con los índices 0-based (mismo índice que rows de values.get con A1).
 */
async function fetchHiddenRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheets: any,
  spreadsheetId: string | undefined,
): Promise<Set<number>> {
  const hidden = new Set<number>();
  if (!spreadsheetId) return hidden;
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: true,
      ranges: ['A1:ZZ'],
    });
    const grid = meta.data?.sheets?.[0]?.data?.[0];
    grid?.rowMetadata?.forEach((row: { hidden?: boolean }, i: number) => {
      if (row.hidden) hidden.add(i);
    });
  } catch (error) {
    console.error('Error fetching hidden rows:', error);
  }
  return hidden;
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
      range: 'A1:ZZ',
    });

    const rows = response.data.values;
    if (!rows || rows.length < 4) return empty;

    // Filas ocultadas por el usuario en Excel: no se leen (ni gráficas ni tabla).
    const hiddenRows = await fetchHiddenRows(sheets, process.env.GOOGLE_SHEET_ID);

    // ── Detección dinámica de la estructura de la hoja ────────────────────
    const dateRowIndex = findDateRow(rows);
    if (dateRowIndex < 0) return empty;

    const dateRow = rows[dateRowIndex];
    const nameRow = rows[dateRowIndex + 1] || [];
    const headerRowIndex = findHeaderRow(rows, dateRowIndex + 2);
    const dataStart = headerRowIndex > 0 ? headerRowIndex + 1 : dateRowIndex + 3;

    // Publicaciones: la columna base (6 + grupo * 3) es el identificador estable.
    const publications: { id: string; col: number; date: string; name: string; link?: string }[] = [];
    for (let i = 6; i < dateRow.length; i += 3) {
      const date = dateRow[i]?.trim();
      if (date) {
        const { name, link } = parsePublicationCell(nameRow[i]);
        publications.push({ id: `pub-${i}`, col: i, date, name, link: link || undefined });
      }
    }
    if (publications.length === 0) return empty;

    const dataRows = rows
      .slice(dataStart)
      .filter((row, i) => row[2]?.trim() && !hiddenRows.has(dataStart + i));
    const rankingMap: Record<string, UserRanking> = {};

    for (const row of dataRows) {
      const name = row[2].trim();
      const equipo = normalizeTeamName(row[1]);
      const profileLink = extractProfileLink(row[3]);
      let totalPoints = 0;
      const historyByDate: DayRecord[] = [];

      for (const pub of publications) {
        const base = pub.col;
        const sharedCell    = parseActionCell(row[base], POINTS.shared);
        const commentedCell = parseActionCell(row[base + 1], POINTS.commented);
        const reactedCell   = parseActionCell(row[base + 2], POINTS.reacted);
        const shared    = sharedCell.done;
        const commented = commentedCell.done;
        const reacted   = reactedCell.done;
        const pointsEarned = sharedCell.points + commentedCell.points + reactedCell.points;
        totalPoints += pointsEarned;
        historyByDate.push({
          publicationId: pub.id,
          date: pub.date,
          publicationName: pub.name || undefined,
          publicationLink: pub.link,
          shared, commented, reacted,
          sharedPoints: sharedCell.points,
          commentedPoints: commentedCell.points,
          reactedPoints: reactedCell.points,
          pointsEarned,
        });
      }

      rankingMap[name] = { name, equipo, profileLink, totalPoints, historyByDate };
    }

    const ranking = Object.values(rankingMap).sort((a, b) => b.totalPoints - a.totalPoints);
    const totalParticipants = ranking.length;
    const totalPoints = ranking.reduce((acc, u) => acc + u.totalPoints, 0);

    // ── Estadísticas por publicación ──────────────────────────────────────
    const stats: PublicationStat[] = publications.map(pub => {
      let sharedCount = 0, commentedCount = 0, reactedCount = 0, totalSupported = 0;

      for (const row of dataRows) {
        const s = parseActionCell(row[pub.col], POINTS.shared);
        const c = parseActionCell(row[pub.col + 1], POINTS.commented);
        const r = parseActionCell(row[pub.col + 2], POINTS.reacted);
        if (s.done) sharedCount++;
        if (c.done) commentedCount++;
        if (r.done) reactedCount++;
        if (s.done || c.done || r.done) totalSupported++;
      }

      return {
        id: pub.id,
        date: pub.date,
        shortDate: parseShortDate(pub.date),
        name: pub.name,
        link: pub.link,
        totalSupported, sharedCount, commentedCount, reactedCount,
        totalParticipants,
        participationRate: totalParticipants > 0
          ? Math.round((totalSupported / totalParticipants) * 100) : 0,
      };
    });

    const avgParticipationRate = stats.length > 0
      ? Math.round(stats.reduce((acc, s) => acc + s.participationRate, 0) / stats.length)
      : 0;

    // ── Estadísticas por equipo (agrupando con nombres normalizados) ──────
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
      // Un equipo solo aparece si tiene al menos un participante válido (con puntos).
      .filter(t => t.activeMembers > 0)
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
