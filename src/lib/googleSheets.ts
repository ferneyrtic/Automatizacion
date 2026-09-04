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

export type ActionPoints = {
  shared: number;
  commented: number;
  reacted: number;
};

/** Datos completos de una pestaña de mes (una pestaña válida del spreadsheet). */
export type MonthData = {
  id: string;               // sheetId de la pestaña (identificador estable)
  title: string;            // nombre de la pestaña (ej. "AGOSTO-2026")
  ranking: UserRanking[];
  stats: PublicationStat[];
  teamStats: TeamStat[];
  actionDistribution: ActionDistribution;
  points: ActionPoints;     // puntos por acción definidos en el encabezado de esa pestaña
  totalParticipants: number;
  totalPoints: number;
  avgParticipationRate: number;
};

export type DashboardData = {
  months: MonthData[];
};

const DEFAULT_POINTS: ActionPoints = { shared: 15, commented: 20, reacted: 10 };

/**
 * Interpreta una celda de acción de la hoja.
 * Antes se marcaba con "X"; ahora el valor de la casilla ES el puntaje
 * ganado (10, 15, 20, ...). Por compatibilidad, una "X" equivale al
 * puntaje estándar de esa acción (el del encabezado de la pestaña).
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
const DATE_PATTERN_ES = /^\d{1,2} de [a-záéíóúñü]+ de \d{4}$/i;

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function isPublicationDateCell(text: string): boolean {
  return DATE_PATTERN.test(text) || DATE_PATTERN_ES.test(text);
}

function parseShortDate(dateStr: string): string {
  const match = dateStr.match(/(\d{2}\/\d{2})/);
  if (match) return match[1];
  const es = dateStr.match(/^(\d{1,2}) de ([a-záéíóúñü]+)/i);
  if (es) {
    const mesIdx = MONTHS_ES.findIndex(m => m.toLowerCase() === es[2].toLowerCase());
    const abr = mesIdx >= 0 ? MONTHS_ES[mesIdx].slice(0, 3) : es[2].slice(0, 3);
    return `${es[1]} ${abr.charAt(0).toUpperCase() + abr.slice(1)}`;
  }
  return dateStr.slice(0, 5);
}

/** Lee el valor de puntos de una celda de encabezado como "Compartio (20)". */
function parsePointsFromHeader(cell: string | undefined, fallback: number): number {
  const m = (cell || '').match(/\((\d+)\)/);
  return m ? parseInt(m[1], 10) : fallback;
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

type SheetStructure = {
  headerRowIdx: number;
  baseCol: number;      // columna donde inician las acciones (Compartio)
  dateRowIdx: number;
  nameRowIdx: number;
  dataStart: number;
};

/**
 * Detecta si una pestaña tiene el formato de tabla analizable:
 * fila de encabezados con "Contratista" + "Compartio/Comento/Reacciono",
 * y una fila de fechas de publicación (dd/mm/yyyy o "1 de septiembre de 2026").
 * La columna base se detecta por contenido, por lo que tolera columnas desplazadas.
 */
function detectStructure(rows: string[][]): SheetStructure | null {
  const max = Math.min(6, rows.length);

  let headerRowIdx = -1;
  let baseCol = -1;
  for (let r = 0; r < max; r++) {
    const row = rows[r] || [];
    if (String(row[2] || '').trim().toLowerCase() !== 'contratista') continue;
    for (let c = 3; c < Math.min(60, row.length); c++) {
      if (/^compartio/i.test((row[c] || '').trim())) {
        headerRowIdx = r;
        baseCol = c;
        break;
      }
    }
    if (headerRowIdx >= 0) break;
  }
  if (headerRowIdx < 0) return null;

  // Fila de fechas: buscar hacia arriba desde el encabezado.
  let dateRowIdx = -1;
  for (let r = headerRowIdx - 1; r >= 0; r--) {
    const row = rows[r] || [];
    for (let c = baseCol; c < row.length; c += 3) {
      if (isPublicationDateCell((row[c] || '').trim())) {
        dateRowIdx = r;
        break;
      }
    }
    if (dateRowIdx >= 0) break;
  }
  if (dateRowIdx < 0) return null;

  return { headerRowIdx, baseCol, dateRowIdx, nameRowIdx: dateRowIdx + 1, dataStart: headerRowIdx + 1 };
}

/** Construye todos los datos de una pestaña de mes. Devuelve null si no es válida. */
function buildMonthData(
  id: string,
  title: string,
  rows: string[][],
  hiddenRows: Set<number>,
): MonthData | null {
  const structure = detectStructure(rows);
  if (!structure) return null;

  const { headerRowIdx, baseCol, dateRowIdx, nameRowIdx, dataStart } = structure;
  const dateRow = rows[dateRowIdx];
  const nameRow = rows[nameRowIdx] || [];
  const headerRow = rows[headerRowIdx] || [];

  // Puntos por acción definidos en el encabezado de esta pestaña.
  const points: ActionPoints = {
    shared: parsePointsFromHeader(headerRow[baseCol], DEFAULT_POINTS.shared),
    commented: parsePointsFromHeader(headerRow[baseCol + 1], DEFAULT_POINTS.commented),
    reacted: parsePointsFromHeader(headerRow[baseCol + 2], DEFAULT_POINTS.reacted),
  };

  // Publicaciones: la columna base (desplazada por 3) es el identificador estable.
  const publications: { id: string; col: number; date: string; name: string; link?: string }[] = [];
  for (let c = baseCol; c < dateRow.length; c += 3) {
    const date = dateRow[c]?.trim();
    if (date && isPublicationDateCell(date)) {
      const { name, link } = parsePublicationCell(nameRow[c]);
      publications.push({ id: `pub-${c}`, col: c, date, name, link: link || undefined });
    }
  }
  if (publications.length === 0) return null;

  // Filas de datos: después del encabezado, con nombre y no ocultas en Excel.
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
      const sharedCell    = parseActionCell(row[base], points.shared);
      const commentedCell = parseActionCell(row[base + 1], points.commented);
      const reactedCell   = parseActionCell(row[base + 2], points.reacted);
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
      const s = parseActionCell(row[pub.col], points.shared);
      const c = parseActionCell(row[pub.col + 1], points.commented);
      const r = parseActionCell(row[pub.col + 2], points.reacted);
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

  return {
    id, title, ranking, stats, teamStats, actionDistribution, points,
    totalParticipants, totalPoints, avgParticipationRate,
  };
}

/**
 * Detecta las filas ocultas (fold/ocultadas por el usuario) de cada pestaña.
 * Devuelve un mapa sheetId -> Set de índices 0-based (mismo índice que rows de values.get con A1).
 */
async function fetchHiddenRowsBySheet(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheets: any,
  spreadsheetId: string | undefined,
  sheetInfos: { sheetId: number; title: string }[],
  ranges: string[],
): Promise<Record<string, Set<number>>> {
  const hiddenBySheet: Record<string, Set<number>> = {};
  if (!spreadsheetId) return hiddenBySheet;
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: true,
      ranges,
    });
    (meta.data?.sheets || []).forEach((sheet: { data?: unknown[] }, i: number) => {
      const id = String(sheetInfos[i]?.sheetId);
      const set = new Set<number>();
      // La API devuelve `hidden` en rowMetadata aunque el tipo no lo declare.
      const grid = (sheet.data as Array<{ rowMetadata?: Array<{ hidden?: boolean }> }> | undefined)?.[0];
      grid?.rowMetadata?.forEach((rm, ri) => {
        if (rm.hidden) set.add(ri);
      });
      hiddenBySheet[id] = set;
    });
  } catch (error) {
    console.error('Error fetching hidden rows:', error);
  }
  return hiddenBySheet;
}

export async function getRankingData(): Promise<DashboardData> {
  const empty: DashboardData = { months: [] };

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // ── Lista de pestañas del spreadsheet ────────────────────────────────
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title,index))',
    });
    const sheetInfos = (meta.data.sheets || [])
      .map(s => s.properties)
      .filter((p): p is { sheetId: number; title: string; index?: number } =>
        p?.sheetId != null && !!p.title)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    if (sheetInfos.length === 0) return empty;

    const ranges = sheetInfos.map(p => `'${p.title.replace(/'/g, "''")}'!A1:ZZ`);

    // ── Valores de todas las pestañas ────────────────────────────────────
    const vres = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges });

    // ── Filas ocultas por pestaña (no se leen: ni gráficas ni tabla) ─────
    const hiddenBySheet = await fetchHiddenRowsBySheet(sheets, spreadsheetId, sheetInfos, ranges);

    // ── Procesar cada pestaña; solo se incluyen las que tienen el formato ─
    const months: MonthData[] = [];
    sheetInfos.forEach((info, i) => {
      const rows = vres.data.valueRanges?.[i]?.values;
      if (!rows || rows.length < 4) return;
      const month = buildMonthData(
        String(info.sheetId),
        info.title,
        rows,
        hiddenBySheet[String(info.sheetId)] ?? new Set<number>(),
      );
      if (month) months.push(month);
    });

    return { months };
  } catch (error) {
    console.error('Error fetching Google Sheets data:', error);
    return empty;
  }
}
