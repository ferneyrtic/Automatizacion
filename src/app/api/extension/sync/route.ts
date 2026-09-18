import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

function colToA1(index: number): string {
  let col = '';
  let temp = index;
  while (temp >= 0) {
    col = String.fromCharCode((temp % 26) + 65) + col;
    temp = Math.floor(temp / 26) - 1;
  }
  return col;
}

function cleanUrl(url?: string): string {
  if (!url) return '';
  return url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/+$/, '')
    .split('?')[0];
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { monthTitle, date, postName, postLink, participants } = body;

    if (!monthTitle || !date || !Array.isArray(participants)) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos (monthTitle, date, participants)' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // 1. Obtener la hoja actual completa
    const safeTitle = `'${monthTitle.replace(/'/g, "''")}'`;
    const vres = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${safeTitle}!A1:ZZ150`,
    });

    const rows: string[][] = vres.data.values || [];
    if (rows.length < 4) {
      return NextResponse.json(
        { error: 'Estructura de hoja no reconocida o vacía' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // 2. Detectar fila de cabecera ("Contratista") y columna base ("Compartio")
    let headerRowIdx = -1;
    let baseCol = -1;
    for (let r = 0; r < Math.min(6, rows.length); r++) {
      const row = rows[r] || [];
      if (String(row[2] || '').trim().toLowerCase() === 'contratista') {
        for (let c = 3; c < Math.min(60, row.length); c++) {
          if (/^compartio/i.test(String(row[c] || '').trim())) {
            headerRowIdx = r;
            baseCol = c;
            break;
          }
        }
      }
      if (headerRowIdx >= 0) break;
    }

    if (headerRowIdx < 0 || baseCol < 0) {
      return NextResponse.json(
        { error: 'No se encontró la cabecera estándar de Contratista / Compartió' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // 3. Filas estructuradas:
    // headerRowIdx - 2: Fila de Fechas (ej. 11/09/2026)
    // headerRowIdx - 1: Fila de Enlace / Título de la Publicación
    // headerRowIdx    : Fila de Encabezados (Compartio, Comento, Reacciono)
    const nameRowIdx = Math.max(0, headerRowIdx - 1);
    const dateRowIdx = Math.max(0, headerRowIdx - 2);

    // Encontrar columna donde inician los TOTALES (por defecto 65 / BN) para nunca sobrepasarla
    let totalsCol = 65;
    for (let r = 0; r <= headerRowIdx; r++) {
      const row = rows[r] || [];
      for (let c = baseCol; c < row.length; c++) {
        if (/^totales/i.test(String(row[c] || '').trim())) {
          totalsCol = c;
          break;
        }
      }
      if (totalsCol < 65) break;
    }

    // 4. Buscar si la fecha ya existe o encontrar el primer espacio libre antes de TOTALES
    const dateRow = rows[dateRowIdx] || [];
    const safeDate = String(date || '').trim();
    let targetCol = -1;
    let firstEmptyCol = -1;

    for (let c = baseCol; c < totalsCol; c += 3) {
      const cellDate = String(dateRow[c] || '').trim();
      if (cellDate) {
        if (safeDate && (cellDate.includes(safeDate) || safeDate.includes(cellDate))) {
          targetCol = c;
          break;
        }
      } else if (firstEmptyCol < 0) {
        firstEmptyCol = c;
      }
    }

    if (targetCol < 0) {
      targetCol = firstEmptyCol >= 0 ? firstEmptyCol : baseCol;
    }

    const updates: Array<{ range: string; values: string[][] }> = [];

    // Fila de Fecha
    updates.push({
      range: `${safeTitle}!${colToA1(targetCol)}${dateRowIdx + 1}`,
      values: [[date]],
    });

    // Fila de Nombre / Link
    const titleContent = postLink ? `${postName}\n${postLink}` : postName;
    updates.push({
      range: `${safeTitle}!${colToA1(targetCol)}${nameRowIdx + 1}`,
      values: [[titleContent]],
    });

    // Fila de Encabezados (Compartio 20, Comento 15, Reacciono 10)
    updates.push({
      range: `${safeTitle}!${colToA1(targetCol)}${headerRowIdx + 1}:${colToA1(targetCol + 2)}${headerRowIdx + 1}`,
      values: [['Compartio (20)', 'Comento (15)', 'Reacciono (10)']],
    });

    // 5. Mapear participantes y actualizar sus filas
    const participantMap = new Map<string, any>();
    participants.forEach((p: any) => {
      if (p.profileLink) {
        participantMap.set(cleanUrl(p.profileLink), p);
      }
      if (p.name) {
        participantMap.set(p.name.toLowerCase().trim(), p);
        const cleanN = p.name.replace(/\s*[-–—].*$/, '').replace(/\s*\(.*?\)/, '').trim().toLowerCase();
        participantMap.set(cleanN, p);
      }
    });

    let updatedCount = 0;
    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const contractorName = String(row[2] || '').trim();
      const contractorLink = String(row[3] || '').trim();

      if (!contractorName) continue;

      const cleanContractorName = contractorName.replace(/\s*[-–—].*$/, '').replace(/\s*\(.*?\)/, '').trim().toLowerCase();

      const matched =
        participantMap.get(cleanUrl(contractorLink)) ||
        participantMap.get(contractorName.toLowerCase().trim()) ||
        participantMap.get(cleanContractorName);

      const sharedVal = '0'; // Compartidos no se tocan, quedan en 0
      let commentedVal = '0';
      let reactedVal = '0';

      if (matched) {
        updatedCount++;
        commentedVal = matched.commented ? '15' : '0';
        reactedVal = matched.reacted ? '10' : '0';
      }

      updates.push({
        range: `${safeTitle}!${colToA1(targetCol)}${r + 1}:${colToA1(targetCol + 2)}${r + 1}`,
        values: [[sharedVal, commentedVal, reactedVal]],
      });
    }

    // 6. Ejecutar actualizaciones en lote en Google Sheets
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        sheetTitle: monthTitle,
        date,
        column: colToA1(targetCol),
        updatedCount,
        totalUpdates: updates.length,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in extension sync route:', error);
    return NextResponse.json(
      { error: error.message || 'Error al sincronizar con Google Sheets' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
