import fs from 'fs';
import { google } from 'googleapis';
import ExcelJS from 'exceljs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: env.GOOGLE_CLIENT_EMAIL,
    private_key: env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

function cleanUrl(url) {
  if (!url) return '';
  return url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/+$/, '')
    .split('?')[0];
}

async function run() {
  const safeTitle = 'Septiembre-2026';
  const date = '14/09/2026';
  const postName = 'Publicación Facebook Alcaldía de Acacías';
  const postLink = 'https://www.facebook.com/share/r/1722jT4B8P/';

  // Leer valores con FORMULA y con FORMATTED_VALUE
  const [fRes, vRes] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: env.GOOGLE_SHEET_ID,
      range: `'${safeTitle}'!A1:ZZ150`,
      valueRenderOption: 'FORMULA',
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: env.GOOGLE_SHEET_ID,
      range: `'${safeTitle}'!A1:ZZ150`,
      valueRenderOption: 'FORMATTED_VALUE',
    }),
  ]);

  const formulaRows = fRes.data.values || [];
  const formattedRows = vRes.data.values || [];

  // Detectar cabecera ("Contratista") y columna base
  let headerRowIdx = -1;
  let baseCol = -1;
  for (let r = 0; r < Math.min(6, formattedRows.length); r++) {
    const row = formattedRows[r] || [];
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

  const nameRowIdx = Math.max(0, headerRowIdx - 1);
  const dateRowIdx = Math.max(0, headerRowIdx - 2);

  // Detectar columna de TOTALES (por defecto 65 / BN)
  let totalsCol = 65;
  for (let r = 0; r <= headerRowIdx; r++) {
    const row = formattedRows[r] || [];
    for (let c = baseCol; c < row.length; c++) {
      if (/^totales/i.test(String(row[c] || '').trim())) {
        totalsCol = c;
        break;
      }
    }
    if (totalsCol < 65) break;
  }

  // Encontrar el primer slot libre
  const dateRow = formattedRows[dateRowIdx] || [];
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

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(safeTitle);

  // Copiar filas: Fórmulas vivas para celdas con '=', valores formateados legibles para fechas y texto
  const maxR = Math.max(formulaRows.length, formattedRows.length);
  for (let rIdx = 0; rIdx < maxR; rIdx++) {
    const fRow = formulaRows[rIdx] || [];
    const vRow = formattedRows[rIdx] || [];
    const row = worksheet.getRow(rIdx + 1);
    const maxC = Math.max(fRow.length, vRow.length);

    for (let cIdx = 0; cIdx < maxC; cIdx++) {
      const fVal = fRow[cIdx];
      const vVal = vRow[cIdx];
      const cell = row.getCell(cIdx + 1);

      if (typeof fVal === 'string' && fVal.startsWith('=')) {
        // Preservar fórmula viva
        cell.value = { formula: fVal.slice(1) };
      } else if (vVal !== undefined && vVal !== null && vVal !== '') {
        // En filas de contratistas, si es numérico (0, 10, 15, 20), guardarlo como número
        if (rIdx > headerRowIdx && !isNaN(Number(vVal))) {
          cell.value = Number(vVal);
        } else {
          // En filas de fechas, nombres y textos, guardar el texto formateado
          cell.value = vVal;
        }
      }
    }
  }

  // Escribir la nueva publicación
  const colHeader = targetCol + 1; // 1-based para ExcelJS (AG = 33)
  worksheet.getRow(dateRowIdx + 1).getCell(colHeader).value = date;
  worksheet.getRow(nameRowIdx + 1).getCell(colHeader).value = postLink ? `${postName}\n${postLink}` : postName;
  worksheet.getRow(headerRowIdx + 1).getCell(colHeader).value = 'Compartio (20)';
  worksheet.getRow(headerRowIdx + 1).getCell(colHeader + 1).value = 'Comento (15)';
  worksheet.getRow(headerRowIdx + 1).getCell(colHeader + 2).value = 'Reacciono (10)';

  // Asignar puntos a los contratistas
  for (let r = headerRowIdx + 1; r < formattedRows.length; r++) {
    const row = formattedRows[r] || [];
    const cName = String(row[2] || '').trim();
    if (!cName) continue;

    const excelRow = worksheet.getRow(r + 1);
    excelRow.getCell(colHeader).value = 0; // Compartido queda en 0
    excelRow.getCell(colHeader + 1).value = r % 2 === 0 ? 15 : 0; // Comentario
    excelRow.getCell(colHeader + 2).value = 10; // Reacción
  }

  // Resaltar encabezados
  [colHeader, colHeader + 1, colHeader + 2].forEach(col => {
    const cell = worksheet.getRow(headerRowIdx + 1).getCell(col);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEF08A' },
    };
    cell.font = { bold: true, color: { argb: 'FF854D0E' } };
  });

  await workbook.xlsx.writeFile('PRUEBA_LOCAL_SEPTIEMBRE_2026.xlsx');
  console.log('Archivo PRUEBA_LOCAL_SEPTIEMBRE_2026.xlsx generado exitosamente.');
}

run().catch(console.error);
