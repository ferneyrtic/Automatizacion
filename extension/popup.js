/**
 * AutoFace TIC - Popup Controller (Versión Mejorada)
 * Matching avanzado por URL y Nombre (con tolerancia a nombres cortos)
 * Soporte offline con 74 contratistas precargados y caché local
 */

const API_BASE_URL = 'http://localhost:3000';
// URL de Google Apps Script (Guarda directo en Google Sheets sin necesidad de servidor local)
let GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkU8p0Hxyn8XdZvxhsWgoXT62ab9cYgx-togE953MDQ2jGPKPnXUB4vkRqmWViij-6/exec';

let officialContractors = [];
let availableMonths = [];
let lastScanResults = null;
let matchedParticipants = [];

// ── Elementos DOM ──
const viewNotFacebook = document.getElementById('viewNotFacebook');
const viewReady = document.getElementById('viewReady');
const viewScanning = document.getElementById('viewScanning');
const viewResults = document.getElementById('viewResults');
const viewSuccess = document.getElementById('viewSuccess');

const connectionStatus = document.getElementById('connectionStatus');
const postDateInput = document.getElementById('postDateInput');
const monthSelect = document.getElementById('monthSelect');
const postNameInput = document.getElementById('postNameInput');

const btnStartScan = document.getElementById('btnStartScan');
const scanStepTitle = document.getElementById('scanStepTitle');
const scanStepSub = document.getElementById('scanStepSub');
const scanProgressBar = document.getElementById('scanProgressBar');
const countReactions = document.getElementById('countReactions');
const countComments = document.getElementById('countComments');
const countShares = document.getElementById('countShares');

const summaryTitle = document.getElementById('summaryTitle');
const totalPointsAwarded = document.getElementById('totalPointsAwarded');
const resReactions = document.getElementById('resReactions');
const resComments = document.getElementById('resComments');
const resShares = document.getElementById('resShares');
const participantsList = document.getElementById('participantsList');
const participantSearch = document.getElementById('participantSearch');

const btnCancelReview = document.getElementById('btnCancelReview');
const btnSaveToSheets = document.getElementById('btnSaveToSheets'); btnSaveToSheets.disabled = true; btnSaveToSheets.title = 'Deshabilitado: usa solo descargar los datos extraídos';
const btnScanAnother = document.getElementById('btnScanAnother');
const successMessageDetails = document.getElementById('successMessageDetails');

// ── Cambiar entre Vistas ──
function showView(view) {
  [viewNotFacebook, viewReady, viewScanning, viewResults, viewSuccess].forEach(v => {
    v.classList.add('hidden');
  });
  view.classList.remove('hidden');
}

// ── Formatear Fecha de Hoy en DD/MM/AAAA ──
function getTodayFormatted() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

// ── Normalizador de Strings (sin tildes, minúsculas, sin comillas) ──
function normalizeStr(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['"’`]/g, '')
    .trim();
}

// ── Limpiador de texto de nombres mostrados en Facebook ──
function cleanFbDisplayName(name) {
  if (!name) return '';
  return name
    .split('\n')[0]
    .replace(/·.*$/, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .trim();
}

// ── Normalizador de URLs para Matching ──
function cleanUrlForMatching(url) {
  if (!url) return '';
  try {
    const raw = url.startsWith('http') ? url : `https://${url}`;
    const u = new URL(raw);
    if (u.pathname === '/profile.php') {
      const id = u.searchParams.get('id');
      if (id) return `facebook.com/profile.php?id=${id}`.toLowerCase();
      return ''; // profile.php genérico sin ID no puede usarse para matching
    }
    const segs = u.pathname.split('/').filter(Boolean);
    if (segs.length > 0) {
      if (segs[0] === 'people' && segs.length >= 3) {
        return `facebook.com/people/${segs[1]}/${segs[2]}`.toLowerCase();
      }
      const ignored = ['stories', 'photo', 'watch', 'groups', 'events', 'pages', 'share', 'reel', 'reels', 'posts'];
      if (!ignored.includes(segs[0].toLowerCase())) {
        return `facebook.com/${segs[0]}`.toLowerCase();
      }
    }
  } catch (e) {}
  return url.toLowerCase().trim().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '').split('?')[0];
}

// ── Comparador Estricto de Contratistas (Evita Falsos Positivos de Ciudadanos) ──
function isContractorMatch(contractor, item) {
  if (!item || !item.name) return false;

  const itemUrl = cleanUrlForMatching(item.url);
  const cUrl = cleanUrlForMatching(contractor.profileLink);

  // 1. Coincidencia por URL limpia exacta
  if (cUrl && itemUrl && cUrl === itemUrl) {
    return true;
  }

  const itemNameNorm = normalizeStr(cleanFbDisplayName(item.name));
  const fbAccount = contractor.fbAccountName ? normalizeStr(contractor.fbAccountName) : '';
  const cName = normalizeStr(contractor.name.replace(/\s*[-–—].*$/, '').replace(/\s*\(.*?\)/, ''));

  // 2. Si el contratista tiene nombre de cuenta en Columna F:
  // Coincidencia exacta con su cuenta oficial de Facebook (evita homónimos ciudadanos)
  if (fbAccount) {
    if (itemNameNorm === fbAccount) return true;
    const itemWords = itemNameNorm.split(/\s+/).filter(Boolean);
    const fbWords = fbAccount.split(/\s+/).filter(Boolean);
    if (itemWords.length === fbWords.length && itemWords.every((w, i) => w === fbWords[i])) {
      return true;
    }
    // Allow fbAccountName to be a substring of the author's normalized name
    if (itemNameNorm.includes(fbAccount)) return true;
    return false;
  }

  // 3. Si el contratista no tiene Columna F (sin cuenta / no participa):
  // Solo coincidencia exacta con el nombre legal completo
  if (cName && itemNameNorm === cName) {
    return true;
  }

  return false;
}

// ── Inicialización ──
async function init() {
  postDateInput.value = getTodayFormatted();

  // 1. Verificar si está en Facebook
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.includes('facebook.com')) {
    showView(viewNotFacebook);
    return;
  }

  showView(viewReady);

  // 2. Cargar contratistas (Primero desde archivo bundled / caché, luego desde API)
  await loadContractorsWithFallback();
}

async function loadContractorsWithFallback() {
  // 2.1 Cargar desde contractors_default.json bundled
  try {
    const defaultRes = await fetch(chrome.runtime.getURL('contractors_default.json'));
    if (defaultRes.ok) {
      const defaultData = await defaultRes.json();
      officialContractors = defaultData.contractors || [];
      availableMonths = defaultData.months || [];
      populateMonths(availableMonths);
      updateStatusBadge(officialContractors.length, 'Cargados');
    }
  } catch (e) {
    console.warn('No se pudo cargar contractors_default.json:', e);
  }

  // 2.2 Intentar sincronizar con la API en vivo
  try {
    const res = await fetch(`${API_BASE_URL}/api/extension/contractors`);
    if (res.ok) {
      const data = await res.json();
      if (data.contractors && data.contractors.length > 0) {
        officialContractors = data.contractors;
        availableMonths = data.months || [];
        populateMonths(availableMonths);
        updateStatusBadge(officialContractors.length, 'En línea');
        chrome.storage.local.set({ officialContractors, availableMonths });
      }
    }
  } catch (err) {
    console.warn('API local no responde, usando lista guardada:', err);
    if (officialContractors.length > 0) {
      updateStatusBadge(officialContractors.length, 'Modo Local');
    } else {
      connectionStatus.innerHTML = `
        <span class="pulse-dot" style="background: #ef4444;"></span>
        <span class="status-label">Desconectado</span>
      `;
    }
  }
}

function updateStatusBadge(count, label) {
  connectionStatus.innerHTML = `
    <span class="pulse-dot" style="background: #10b981;"></span>
    <span class="status-label">${count} Contratistas (${label})</span>
  `;
}

function populateMonths(months) {
  monthSelect.innerHTML = '';
  if (!months || months.length === 0) {
    monthSelect.innerHTML = `<option value="Septiembre-2026">Septiembre-2026</option>`;
    return;
  }
  months.forEach((m, idx) => {
    const opt = document.createElement('option');
    opt.value = m.title;
    opt.textContent = m.title;
    if (idx === months.length - 1) opt.selected = true; // Seleccionar el más reciente
    monthSelect.appendChild(opt);
  });
}

// ── Iniciar Escaneo ──
btnStartScan.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  showView(viewScanning);
  scanProgressBar.style.width = '15%';
  scanStepTitle.textContent = 'Auditando publicación...';
  scanStepSub.textContent = 'Extrayendo reacciones y comentarios en Facebook';
  countReactions.textContent = '0';
  countComments.textContent = '0';
  countShares.textContent = '0';

  const progressListener = (msg) => {
    if (msg.action === 'SCAN_PROGRESS' && msg.data) {
      if (msg.data.type === 'reactions') countReactions.textContent = msg.data.count;
      if (msg.data.type === 'comments') countComments.textContent = msg.data.count;
      if (msg.data.type === 'shares') countShares.textContent = msg.data.count;
      if (msg.data.percent) scanProgressBar.style.width = `${msg.data.percent}%`;
      if (msg.data.step) scanStepTitle.textContent = msg.data.step;
    }
  };
  chrome.runtime.onMessage.addListener(progressListener);

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'START_SCAN',
      targetContractors: officialContractors,
    });
    chrome.runtime.onMessage.removeListener(progressListener);

    if (response && response.success) {
      lastScanResults = response.results;
      processResults(lastScanResults);
    } else {
      alert('No se pudo completar el escaneo. Si es un Reel o Video, haz clic primero en los comentarios para abrirlos.');
      showView(viewReady);
    }
  } catch (err) {
    chrome.runtime.onMessage.removeListener(progressListener);
    console.error('Error al enviar mensaje a la pestaña:', err);
    alert('Recarga la página de Facebook (F5) para que el asistente pueda leer la publicación.');
    showView(viewReady);
  }
});

// ── Procesar y Cruzar con Lista Oficial de Contratistas (Prioridad Columna F) ──
function processResults(scan) {
  const rawReactions = scan.reactions || [];
  const rawComments = scan.comments || [];
  const rawShares = scan.shares || [];

  matchedParticipants = [];
  let totalPts = 0;

  officialContractors.forEach(contractor => {
    // Verificar si reaccionó (exclusivamente si está en la lista de reacciones y coincide con este contratista)
    const reacted = rawReactions.some(r => isContractorMatch(contractor, r));

    // Verificar si comentó (exclusivamente si está en la lista de comentarios y coincide con este contratista)
    const commented = rawComments.some(c => isContractorMatch(contractor, c));

    // Verificar si compartió
    const shared = rawShares.some(s => isContractorMatch(contractor, s));

    if (reacted || commented || shared) {
      let points = 0;
      // Compartido se deja en 0 (pendiente, no se modifica)
      if (commented) points += 15;
      if (reacted) points += 10;

      totalPts += points;

      matchedParticipants.push({
        name: contractor.name,
        equipo: contractor.equipo || 'TIC',
        profileLink: contractor.profileLink,
        fbAccountName: contractor.fbAccountName || '',
        hasAccount: contractor.hasAccount !== false,
        rowIdx: contractor.rowIdx,
        shared,
        commented,
        reacted,
        points,
      });
    }
  });

  matchedParticipants.sort((a, b) => b.points - a.points);

  const contractorsWithLike = matchedParticipants.filter(p => p.reacted).length;
  const contractorsWithComment = matchedParticipants.filter(p => p.commented).length;
  const contractorsWithShare = matchedParticipants.filter(p => p.shared).length;

  resReactions.textContent = contractorsWithLike;
  resComments.textContent = contractorsWithComment;
  resShares.textContent = contractorsWithShare;

  summaryTitle.textContent = `${matchedParticipants.length} Contratistas (CPS) Detectados`;
  totalPointsAwarded.textContent = totalPts;

  const scanNote = document.getElementById('scanNote');
  if (scanNote) {
    scanNote.innerHTML = `✓ De ${rawComments.length} comentarios y ${rawReactions.length} likes en Facebook, se identificaron exclusivamente los ${matchedParticipants.length} contratistas auditados.`;
  }

  renderParticipantsList(matchedParticipants);
  showView(viewResults);
}

// ── Renderizar Lista de Participantes ──
function renderParticipantsList(list) {
  participantsList.innerHTML = '';

  if (list.length === 0) {
    participantsList.innerHTML = `
      <div style="text-align: center; padding: 20px; font-size: 11px; color: #94a3b8; line-height: 1.5;">
        <strong style="color: #ef4444; display: block; margin-bottom: 4px;">0 Contratistas detectados</strong>
        En Reels/Videos, asegúrate de <strong>abrir el panel lateral de comentarios</strong> (haciendo clic en el ícono con el número de comentarios) antes de escanear.
      </div>
    `;
    return;
  }

  list.forEach(p => {
    const initials = p.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
    const hasDiffFbName = p.fbAccountName && normalizeStr(p.fbAccountName) !== normalizeStr(p.name);
    const row = document.createElement('div');
    row.className = 'participant-row';
    row.innerHTML = `
      <div class="p-left">
        <div class="p-avatar">${initials}</div>
        <div class="p-info">
          <span class="p-name" title="${p.name}">${p.name}</span>
          <div class="p-meta">
            <span class="p-team">${p.equipo}</span>
            ${hasDiffFbName ? `<span class="p-fb-name" title="Cuenta en Facebook: ${p.fbAccountName}">👤 ${p.fbAccountName}</span>` : ''}
            ${!p.hasAccount ? '<span class="p-no-account" title="Sin cuenta de Facebook registrada en el Excel (0 pts)">Sin cuenta FB</span>' : ''}
          </div>
        </div>
      </div>
      <div class="p-badges">
        ${p.shared ? '<span class="chip-action chip-shared" title="Compartido (Pendiente - 0 pts)">Comp.</span>' : ''}
        ${p.commented ? '<span class="chip-action chip-commented" title="Comentó (+15 pts)">Com. (+15)</span>' : ''}
        ${p.reacted ? '<span class="chip-action chip-reacted" title="Reaccionó (+10 pts)">Like (+10)</span>' : ''}
        <span class="p-points">+${p.points}</span>
      </div>
    `;
    participantsList.appendChild(row);
  });
}

// ── Filtro de Búsqueda (Soporta Nombre de Contrato y Nombre en Facebook) ──
participantSearch.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  const filtered = matchedParticipants.filter(p => 
    p.name.toLowerCase().includes(q) || 
    p.equipo.toLowerCase().includes(q) ||
    (p.fbAccountName && p.fbAccountName.toLowerCase().includes(q))
  );
  renderParticipantsList(filtered);
});

btnCancelReview.addEventListener('click', () => {
  showView(viewReady);
});

// ── Descargar Excel rellenando la plantilla embebida (.xlsx) ──
const btnDownloadTestExcel = document.getElementById('btnDownloadTestExcel');
if (btnDownloadTestExcel) {
  btnDownloadTestExcel.addEventListener('click', async () => {
    btnDownloadTestExcel.disabled = true;
    const originalText = btnDownloadTestExcel.innerHTML;
    btnDownloadTestExcel.innerHTML = `<span>Generando Excel...</span>`;

    try {
      // 1. Cargar la plantilla embebida en la extensión
      const templateUrl = chrome.runtime.getURL('template.xlsx');
      const response = await fetch(templateUrl);
      if (!response.ok) throw new Error('No se pudo cargar la plantilla template.xlsx');
      const arrayBuffer = await response.arrayBuffer();

      // 2. Abrir con SheetJS
      const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

      // 3. Determinar la hoja objetivo según el mes seleccionado
      const selectedMonth = (monthSelect.value || 'SEPTIEMBRE-2026').toUpperCase();
      let sheetName = wb.SheetNames.find(n => n.toUpperCase() === selectedMonth);
      if (!sheetName) {
        // Buscar coincidencia parcial
        sheetName = wb.SheetNames.find(n => n.toUpperCase().includes(selectedMonth.split('-')[0]));
      }
      if (!sheetName) sheetName = wb.SheetNames[wb.SheetNames.length - 1]; // Última hoja como fallback
      const ws = wb.Sheets[sheetName];

      // 4. Estructura de la plantilla:
      //    Fila 1: Título (merged)
      //    Fila 2: Fechas — celdas merged en grupos de 3 (F2:H2, I2:K2, ...)
      //    Fila 3: Sección + TOTALES en cols BN-BQ
      //    Fila 4: Headers (No, EQUIPO, Contratista, Perfil, PERFIL PUBLICO, Compartio, Comento, Reacciono, ...)
      //    Filas 5+: Datos de contratistas
      //    Cols base de datos: F=6 (col index 5 en 0-based)
      //    Cada publicación ocupa 3 columnas: Compartio, Comento, Reacciono

      const HEADER_ROW = 4;   // Fila 4 (1-indexed)
      const DATA_START_COL = 5; // Columna F (0-indexed = 5)
      const TOTALS_COL = 65;    // Columna BN (0-indexed = 65)

      // 5. Encontrar la primera columna vacía (sin fecha real en fila 2)
      let targetCol = -1;
      for (let c = DATA_START_COL; c < TOTALS_COL; c += 3) {
        const cellRef = XLSX.utils.encode_cell({ r: 1, c: c }); // Fila 2 (0-indexed = 1)
        const cell = ws[cellRef];
        const val = cell ? String(cell.v || '').trim() : '';
        if (!val || val === '(COLOCAR FECHA)') {
          targetCol = c;
          break;
        }
      }

      if (targetCol < 0) {
        alert('No hay columnas disponibles en la plantilla. Todas están ocupadas.');
        return;
      }

      // 6. Escribir la FECHA en fila 2 (merged cell, solo escribimos en la primera del grupo)
      const dateVal = postDateInput.value.trim() || getTodayFormatted();
      const dateCellRef = XLSX.utils.encode_cell({ r: 1, c: targetCol });
      ws[dateCellRef] = { v: dateVal, t: 's' };

      // 7. Llenar los nombres de contratistas y datos del equipo en las filas correspondientes
      //    usando el rowIdx de contractors_default.json como referencia de fila Excel
      const contractorMap = new Map();
      matchedParticipants.forEach(p => {
        if (p.rowIdx) contractorMap.set(p.rowIdx, p);
      });

      // Escribir nombre, equipo y datos de cada contratista
      officialContractors.forEach(contractor => {
        const excelRow = contractor.rowIdx; // rowIdx ya es la fila exacta del Excel (1-indexed)
        if (!excelRow) return;
        const r = excelRow - 1; // Convertir a 0-indexed para SheetJS

        // Escribir nombre del contratista en col C (index 2)
        const nameRef = XLSX.utils.encode_cell({ r, c: 2 });
        ws[nameRef] = { v: contractor.name, t: 's' };

        // Escribir equipo en col B (index 1)
        const equipoRef = XLSX.utils.encode_cell({ r, c: 1 });
        ws[equipoRef] = { v: contractor.equipo || '', t: 's' };

        // Escribir perfil en col D (index 3)
        const perfilRef = XLSX.utils.encode_cell({ r, c: 3 });
        ws[perfilRef] = { v: contractor.profileLink || '', t: 's' };

        // Escribir nombre de cuenta FB en col E (index 4)
        const fbRef = XLSX.utils.encode_cell({ r, c: 4 });
        ws[fbRef] = { v: contractor.fbAccountName || '', t: 's' };

        // 8. Escribir los puntajes del escaneo en las columnas de la publicación
        const matched = contractorMap.get(excelRow);

        // Compartio (targetCol)
        const sharedRef = XLSX.utils.encode_cell({ r, c: targetCol });
        ws[sharedRef] = { v: matched && matched.shared ? 20 : 0, t: 'n' };

        // Comento (targetCol + 1)
        const commentRef = XLSX.utils.encode_cell({ r, c: targetCol + 1 });
        ws[commentRef] = { v: matched && matched.commented ? 15 : 0, t: 'n' };

        // Reacciono (targetCol + 2)
        const reactRef = XLSX.utils.encode_cell({ r, c: targetCol + 2 });
        ws[reactRef] = { v: matched && matched.reacted ? 10 : 0, t: 'n' };
      });

      // 9. Actualizar el rango de la hoja para incluir todas las celdas escritas
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const maxRow = Math.max(range.e.r, 78); // Hasta fila 78 por los contratistas
      const maxCol = Math.max(range.e.c, targetCol + 2);
      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });

      // 10. Generar y descargar el archivo
      const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (postNameInput.value.trim() || 'Publicacion').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, '').substring(0, 40);
      a.download = `SEGUIMIENTO_${selectedMonth}_${dateVal.replace(/\//g, '-')}_${safeName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Error al generar Excel desde plantilla:', err);
      alert('Error al generar el Excel: ' + err.message);
    } finally {
      btnDownloadTestExcel.disabled = false;
      btnDownloadTestExcel.innerHTML = originalText;
    }
  });
}

// ── Guardar en Google Sheets (Con Bloqueo Estricto Anti-Doble Clic) ──
let isSavingToSheets = false;
btnSaveToSheets.addEventListener('click', async () => {
  if (isSavingToSheets) return; // Bloqueo estricto anti-doble clic
  if (matchedParticipants.length === 0) {
    alert('No hay contratistas detectados para guardar.');
    return;
  }

  isSavingToSheets = true;
  btnSaveToSheets.disabled = true;
  btnSaveToSheets.innerHTML = `
    <span class="pulse-dot" style="background: white;"></span>
    Guardando... no cierres la ventana
  `;

  const payload = {
    monthTitle: monthSelect.value || 'Septiembre-2026',
    date: postDateInput.value.trim(),
    postName: postNameInput.value.trim() || 'Publicación Facebook',
    postLink: lastScanResults?.postUrl || '',
    participants: matchedParticipants,
  };

  try {
    const targetUrl = GOOGLE_APPS_SCRIPT_URL || `${API_BASE_URL}/api/extension/sync`;
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al guardar en el Excel');
    }

    const actionText = data.isUpdate ? 'actualizado' : 'registrado';
    const tagBadge = data.isUpdate
      ? '<span style="display:inline-block; background:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600; margin-bottom:6px;">✓ Actualizado en columna existente</span><br>'
      : '';

    successMessageDetails.innerHTML = `
      ${tagBadge}
      Se han ${actionText} <strong>${data.updatedCount || matchedParticipants.length} contratistas</strong> en la pestaña <strong>${payload.monthTitle}</strong> para la fecha <strong>${payload.date}</strong> (Columna <strong>${data.column || 'asignada'}</strong>).
    `;
    showView(viewSuccess);
  } catch (err) {
    alert('Error al guardar en Google Sheets: ' + err.message);
  } finally {
    isSavingToSheets = false;
    btnSaveToSheets.disabled = false;
    btnSaveToSheets.innerHTML = `Guardar en Google Sheets Oficial`;
  }
});

btnScanAnother.addEventListener('click', () => {
  showView(viewReady);
});

document.addEventListener('DOMContentLoaded', init);
