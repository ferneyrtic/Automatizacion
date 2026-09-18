import fs from 'fs';

const rawData = JSON.parse(fs.readFileSync('extension/contractors_default.json', 'utf8'));
const contractors = rawData.contractors;

function normalizeStr(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function cleanUrlForMatching(url) {
  if (!url) return '';
  return url.toLowerCase().trim().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '').split('?')[0];
}

function isNameMatch(contractorName, fbName) {
  if (!contractorName || !fbName) return false;
  const c = normalizeStr(contractorName);
  const fb = normalizeStr(fbName);
  if (c === fb) return true;
  const fbWords = fb.split(/\s+/).filter(w => w.length > 2);
  const cWords = c.split(/\s+/).filter(w => w.length > 2);
  if (fbWords.length >= 2 && cWords.length >= 2) {
    const allFbInC = fbWords.every(w => cWords.includes(w));
    if (allFbInC) return true;
    let matches = 0;
    for (const w of fbWords) {
      if (cWords.includes(w)) matches++;
    }
    if (matches >= 2) return true;
  }
  return false;
}

function matchItem(item, contractor) {
  const cUrl = cleanUrlForMatching(contractor.profileLink);
  const cName = contractor.name.replace(/\s*[-–—].*$/, '').replace(/\s*\(.*?\)/, '').trim();
  const fbAccount = (contractor.fbAccountName || '').trim();

  const itemUrl = cleanUrlForMatching(item.url);
  if (cUrl && itemUrl && cUrl === itemUrl) return true;

  if (fbAccount) {
    if (normalizeStr(fbAccount) === normalizeStr(item.name)) return true;
    if (isNameMatch(fbAccount, item.name)) return true;
  }

  if (isNameMatch(cName, item.name)) return true;

  return false;
}

// Test cases
const testScenarios = [
  { item: { name: 'Vivis Tics' }, expectedContractor: 'MARTHA VIVIANA MEDINA PALACIO' },
  { item: { name: 'Heber Khan' }, expectedContractor: 'HEBER ANDRES HERNANDEZ VELASQUEZ' },
  { item: { name: "D'Parranda" }, expectedContractor: 'MARCO TULIO CASTELLANOS' },
  { item: { name: 'Camilo Tokiio' }, expectedContractor: 'EDGAR CAMILO POLANIA GIRON' },
  { item: { name: 'Juan Jose Arango' }, expectedContractor: 'ANDRES FELIPE ARANGO' },
  { item: { name: 'Carolina Londoño' }, expectedContractor: 'CAROLINA YUSTI' },
  { item: { name: 'Jc Moraj' }, expectedContractor: 'MORA JIMÉNEZ JENNY CATALINA' },
  { item: { name: 'Cindy Herrera' }, expectedContractor: 'CINDY SORLEY HERRERA LATORRE' },
  { item: { name: 'Leonardo Bustos Caballero' }, expectedContractor: 'LEONARDO BUSTOS CABALLERO' },
  { item: { name: 'Pedro Perez Ciudadano' }, expectedContractor: null },
];

let allPassed = true;
console.log('=== RUNNING MATCHING TESTS ===\n');

for (const scenario of testScenarios) {
  const matched = contractors.find(c => matchItem(scenario.item, c));
  const matchedName = matched ? matched.name : null;
  const isOk = matchedName === scenario.expectedContractor;
  console.log(`Test: Item "${scenario.item.name}"`);
  console.log(`  -> Matched: ${matchedName || '(Ninguno)'}`);
  console.log(`  -> Expected: ${scenario.expectedContractor || '(Ninguno)'}`);
  console.log(`  -> Status: ${isOk ? 'PASSED OK' : 'FAILED ❌'}\n`);
  if (!isOk) allPassed = false;
}

if (allPassed) {
  console.log('✅ ALL MATCHING TESTS PASSED PERFECTLY!');
} else {
  console.error('❌ SOME TESTS FAILED');
  process.exit(1);
}
