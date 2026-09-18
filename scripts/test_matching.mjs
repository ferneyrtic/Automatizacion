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

function cleanFbDisplayName(name) {
  if (!name) return '';
  return name
    .split('\n')[0]
    .replace(/·.*$/, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .trim();
}

function isContractorMatch(contractor, item) {
  if (!item || !item.name) return false;

  const itemUrl = cleanUrlForMatching(item.url);
  const cUrl = cleanUrlForMatching(contractor.profileLink);

  if (cUrl && itemUrl && cUrl === itemUrl) {
    return true;
  }

  const itemNameNorm = normalizeStr(cleanFbDisplayName(item.name));
  const fbAccount = contractor.fbAccountName ? normalizeStr(contractor.fbAccountName) : '';
  const cName = normalizeStr(contractor.name.replace(/\s*[-–—].*$/, '').replace(/\s*\(.*?\)/, ''));

  if (fbAccount) {
    if (itemNameNorm === fbAccount) return true;
    const itemWords = itemNameNorm.split(/\s+/).filter(Boolean);
    const fbWords = fbAccount.split(/\s+/).filter(Boolean);
    if (itemWords.length === fbWords.length && itemWords.every((w, i) => w === fbWords[i])) {
      return true;
    }
    return false;
  }

  if (cName && itemNameNorm === cName) {
    return true;
  }

  return false;
}

function matchItem(item, contractor) {
  return isContractorMatch(contractor, item);
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
