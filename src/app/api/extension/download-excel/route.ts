import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';

function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  return google.sheets({ version: 'v4', auth });
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

    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Leer valores de la pestaña actual en Google Sheets (fórmulas vivas + textos y fechas legibles)
    const safeTitle = monthTitle || 'Septiembre-2026';
    const [formulaRes, formattedRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${safeTitle.replace(/'/g, "''")}'!A1:ZZ150`,
        valueRenderOption: 'FORMULA',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${safeTitle.replace(/'/g, "''")}'!A1:ZZ150`,
        valueRenderOption: 'FORMATTED_VALUE',
      }),
    ]);

    const formulaRows: (string | number)[][] = (formulaRes.data.values as any) || [];
    const rows: string[][] = (formattedRes.data.values as any) || [];
    if (rows.length < 4) {
      return NextResponse.json({ error: 'No se encontraron datos en la hoja' }, { status: 400 });
    }

    // 1. Detectar cabecera ("Contratista") y columna base ("Compartio")
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
      headerRowIdx = 3;
      baseCol = 5;
    }

    // Filas estructuradas:
    // headerRowIdx - 2: Fila de Fechas (ej. 11/09/2026)
    // headerRowIdx - 1: Fila de Enlace / Título de la Publicación
    // headerRowIdx    : Fila de Encabezados (Compartio, Comento, Reacciono)
    const nameRowIdx = Math.max(0, headerRowIdx - 1);
    const dateRowIdx = Math.max(0, headerRowIdx - 2);

    // 2. Encontrar la columna de TOTALES (por defecto 65 / BN) para nunca sobrepasarla
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

    // 3. Determinar el slot dentro del rango de publicaciones [baseCol ... totalsCol)
    const safeDate = String(date || '').trim();
    const dateRow = rows[dateRowIdx] || [];
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

    // Crear libro de Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(safeTitle);

    // Copiar filas originales: Fórmulas vivas para celdas con '=', valores legibles para fechas y textos
    const maxR = Math.max(formulaRows.length, rows.length);
    for (let rIdx = 0; rIdx < maxR; rIdx++) {
      const fRow = formulaRows[rIdx] || [];
      const vRow = rows[rIdx] || [];
      const row = worksheet.getRow(rIdx + 1);
      const maxC = Math.max(fRow.length, vRow.length);

      for (let cIdx = 0; cIdx < maxC; cIdx++) {
        const fVal = fRow[cIdx];
        const vVal = vRow[cIdx];
        const cell = row.getCell(cIdx + 1);

        if (typeof fVal === 'string' && fVal.startsWith('=')) {
          cell.value = { formula: fVal.slice(1) };
        } else if (vVal !== undefined && vVal !== null && vVal !== '') {
          if (rIdx > headerRowIdx && !isNaN(Number(vVal))) {
            cell.value = Number(vVal);
          } else {
            cell.value = vVal;
          }
        }
      }
    }

    // Escribir nueva publicación en el slot libre correspondiente (ej. AG=33, AH=34, AI=35)
    const colHeader = targetCol + 1; // 1-based para ExcelJS
    worksheet.getRow(dateRowIdx + 1).getCell(colHeader).value = date;
    worksheet.getRow(nameRowIdx + 1).getCell(colHeader).value = postLink ? `${postName}\n${postLink}` : postName;
    worksheet.getRow(headerRowIdx + 1).getCell(colHeader).value = 'Compartio (20)';
    worksheet.getRow(headerRowIdx + 1).getCell(colHeader + 1).value = 'Comento (15)';
    worksheet.getRow(headerRowIdx + 1).getCell(colHeader + 2).value = 'Reacciono (10)';

    // Mapear participantes
    const participantMap = new Map<string, any>();
    (participants || []).forEach((p: any) => {
      if (p.profileLink) participantMap.set(cleanUrl(p.profileLink), p);
      if (p.name) {
        participantMap.set(p.name.toLowerCase().trim(), p);
        const cleanN = p.name.replace(/\s*[-–—].*$/, '').replace(/\s*\(.*?\)/, '').trim().toLowerCase();
        participantMap.set(cleanN, p);
      }
    });

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const cName = String(row[2] || '').trim();
      const cLink = String(row[3] || '').trim();
      if (!cName) continue;

      const cleanCName = cName.replace(/\s*[-–—].*$/, '').replace(/\s*\(.*?\)/, '').trim().toLowerCase();
      const matched =
        participantMap.get(cleanUrl(cLink)) ||
        participantMap.get(cName.toLowerCase().trim()) ||
        participantMap.get(cleanCName);

      const excelRow = worksheet.getRow(r + 1);
      // Compartido queda en 0 (no se modifica)
      excelRow.getCell(colHeader).value = 0;
      // Comentario: 15 pts si comentó, 0 si no
      excelRow.getCell(colHeader + 1).value = matched?.commented ? 15 : 0;
      // Reacción: 10 pts si reaccionó, 0 si no
      excelRow.getCell(colHeader + 2).value = matched?.reacted ? 10 : 0;
    }

    // Resaltar encabezados de la nueva columna agregada
    [colHeader, colHeader + 1, colHeader + 2].forEach(col => {
      const cell = worksheet.getRow(headerRowIdx + 1).getCell(col);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEF08A' },
      };
      cell.font = { bold: true, color: { argb: 'FF854D0E' } };
    });

    const buffer = await workbook.xlsx.writeBuffer();

    const fileDate = safeDate ? safeDate.replace(/\//g, '-') : 'NUEVA';
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="PRUEBA_${safeTitle}_${fileDate}.xlsx"`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('Error generating test excel:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
