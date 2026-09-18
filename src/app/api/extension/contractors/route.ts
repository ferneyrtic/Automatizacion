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

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET() {
  try {
    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // 1. Obtener pestañas
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title,index))',
    });

    const validSheets = (meta.data.sheets || [])
      .map(s => s.properties)
      .filter((p): p is { sheetId: number; title: string; index?: number } =>
        p?.sheetId != null && !!p.title && !p.title.startsWith('Hoja'))
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    if (validSheets.length === 0) {
      return NextResponse.json({ months: [], contractors: [] });
    }

    // Usar la primera pestaña válida (o la más reciente) para listar contratistas
    const activeSheetTitle = validSheets[validSheets.length - 1].title;
    const range = `'${activeSheetTitle.replace(/'/g, "''")}'!A1:Z150`;

    const vres = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = vres.data.values || [];

    // Buscar encabezado con "Contratista"
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(6, rows.length); r++) {
      const row = rows[r] || [];
      if (String(row[2] || '').trim().toLowerCase() === 'contratista') {
        headerRowIdx = r;
        break;
      }
    }

    const contractors: Array<{
      name: string;
      equipo: string;
      profileLink: string;
      fbAccountName: string;
      isPublicProfile: boolean;
      hasAccount: boolean;
      rowIdx: number;
    }> = [];

    if (headerRowIdx >= 0) {
      const headerRow = rows[headerRowIdx] || [];
      const equipoCol = headerRow.findIndex(c => /^equipo$/i.test(String(c).trim())) >= 0
        ? headerRow.findIndex(c => /^equipo$/i.test(String(c).trim()))
        : 1;
      const nameCol = headerRow.findIndex(c => /^contratista$/i.test(String(c).trim())) >= 0
        ? headerRow.findIndex(c => /^contratista$/i.test(String(c).trim()))
        : 2;
      const profileLinkCol = headerRow.findIndex(c => /^perfil$/i.test(String(c).trim())) >= 0
        ? headerRow.findIndex(c => /^perfil$/i.test(String(c).trim()))
        : 3;
      
      let fbAccountCol = headerRow.findIndex(c => /nombre\s*(?:del?\s*)?perfil/i.test(String(c).trim()));
      if (fbAccountCol < 0) {
        fbAccountCol = 5; // Columna F por defecto
      }

      const publicProfileCol = headerRow.findIndex(c => /perfil\s*p[uú]blico/i.test(String(c).trim()));

      for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const name = String(row[nameCol] || '').trim();
        const equipo = String(row[equipoCol] || '').trim();
        const profileLink = String(row[profileLinkCol] || '').trim();
        const fbAccountName = fbAccountCol >= 0 ? String(row[fbAccountCol] || '').trim() : '';
        const publicVal = publicProfileCol >= 0 ? String(row[publicProfileCol] || '').trim().toUpperCase() : '';
        const isPublicProfile = publicVal === 'SI' || publicVal === 'SÍ';

        if (name) {
          const hasAccount = Boolean(fbAccountName || (profileLink && profileLink.includes('facebook.com')));
          contractors.push({
            name,
            equipo: equipo || 'TIC',
            profileLink,
            fbAccountName,
            isPublicProfile,
            hasAccount,
            rowIdx: r + 1, // 1-based para A1 notation en Sheets
          });
        }
      }
    }

    return NextResponse.json(
      {
        months: validSheets.map(s => ({ id: s.sheetId, title: s.title })),
        contractors,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching contractors for extension:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener contratistas' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
