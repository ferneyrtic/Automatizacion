import fs from 'fs';
import { google } from 'googleapis';

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

async function main() {
  const spreadsheetId = env.GOOGLE_SHEET_ID;
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(sheetId,title,index))' });
  const validSheets = (meta.data.sheets || [])
    .map(s => s.properties)
    .filter(p => p?.sheetId != null && !!p.title && !p.title.startsWith('Hoja'))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  const activeSheetTitle = validSheets[validSheets.length - 1].title;
  console.log('Fetching contractors from:', activeSheetTitle);

  const range = `'${activeSheetTitle.replace(/'/g, "''")}'!A1:Z150`;
  const vres = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = vres.data.values || [];

  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(6, rows.length); r++) {
    const row = rows[r] || [];
    if (String(row[2] || '').trim().toLowerCase() === 'contratista') {
      headerRowIdx = r;
      break;
    }
  }

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
  if (fbAccountCol < 0) fbAccountCol = 5;

  const publicProfileCol = headerRow.findIndex(c => /perfil\s*p[uú]blico/i.test(String(c).trim()));

  const contractors = [];
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
        rowIdx: r + 1,
      });
    }
  }

  const out = {
    months: validSheets.map(s => ({ id: s.sheetId, title: s.title })),
    contractors,
  };

  fs.writeFileSync('extension/contractors_default.json', JSON.stringify(out, null, 2), 'utf8');
  console.log(`Successfully written ${contractors.length} contractors to extension/contractors_default.json`);
  const withFbName = contractors.filter(c => c.fbAccountName);
  console.log(`Contractors with explicit FB account name (Col F): ${withFbName.length}`);
  const withoutFbName = contractors.filter(c => !c.fbAccountName);
  console.log(`Contractors without FB account name: ${withoutFbName.length}`);
}

main().catch(console.error);
