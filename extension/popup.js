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
const btnSaveToSheets = document.getElementById('btnSaveToSheets');
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

// ── Normalizador de Strings (sin tildes, minúsculas) ──
function normalizeStr(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

// ── Comparador de Nombres con Tolerancia (Primer Nombre + Apellido) ──
function isNameMatch(contractorName, fbName) {
  if (!contractorName || !fbName) return false;
  const c = normalizeStr(contractorName);
  const fb = normalizeStr(fbName);

  if (c === fb) return true;

  const fbWords = fb.split(/\s+/).filter(w => w.length > 2);
  const cWords = c.split(/\s+/).filter(w => w.length > 2);

  if (fbWords.length >= 2 && cWords.length >= 2) {
    // Si todas las palabras de fb están contenidas en el contratista (ej. "Cindy Herrera" en "Cindy Sorley Herrera Latorre")
    const allFbInC = fbWords.every(w => cWords.includes(w));
    if (allFbInC) return true;

    // Si al menos 2 palabras clave coinciden (ej. Nombre + Apellido)
    let matches = 0;
    for (const w of fbWords) {
      if (cWords.includes(w)) matches++;
    }
    if (matches >= 2) return true;
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
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'START_SCAN' });
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

// ── Procesar y Cruzar con Lista Oficial de Contratistas ──
function processResults(scan) {
  const rawReactions = scan.reactions || [];
  const rawComments = scan.comments || [];
  const rawShares = scan.shares || [];

  matchedParticipants = [];
  let totalPts = 0;

  officialContractors.forEach(contractor => {
    const cUrl = cleanUrlForMatching(contractor.profileLink);
    const cName = contractor.name.replace(/\s*[-–—].*$/, '').replace(/\s*\(.*?\)/, '').trim();

    // Verificar si reaccionó (por URL exacta o por nombre)
    const reacted = rawReactions.some(r => {
      const rUrl = cleanUrlForMatching(r.url);
      const urlMatch = cUrl && rUrl && cUrl === rUrl;
      return urlMatch || isNameMatch(cName, r.name);
    });

    // Verificar si comentó (por URL exacta o por nombre)
    const commented = rawComments.some(c => {
      const comUrl = cleanUrlForMatching(c.url);
      const urlMatch = cUrl && comUrl && cUrl === comUrl;
      return urlMatch || isNameMatch(cName, c.name);
    });

    // Verificar si compartió
    const shared = rawShares.some(s => {
      const sUrl = cleanUrlForMatching(s.url);
      const urlMatch = cUrl && sUrl && cUrl === sUrl;
      return urlMatch || isNameMatch(cName, s.name);
    });

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
    scanNote.innerHTML = `✓ De ${rawComments.length} comentarios y ${rawReactions.length} likes en Facebook, se filtraron exclusivamente los ${matchedParticipants.length} contratistas válidos de la Alcaldía.`;
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
    const row = document.createElement('div');
    row.className = 'participant-row';
    row.innerHTML = `
      <div class="p-left">
        <div class="p-avatar">${initials}</div>
        <div class="p-info">
          <span class="p-name" title="${p.name}">${p.name}</span>
          <span class="p-team">${p.equipo}</span>
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

// ── Filtro de Búsqueda ──
participantSearch.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  const filtered = matchedParticipants.filter(p => p.name.toLowerCase().includes(q) || p.equipo.toLowerCase().includes(q));
  renderParticipantsList(filtered);
});

btnCancelReview.addEventListener('click', () => {
  showView(viewReady);
});

// ── Descargar Excel de Prueba (.xlsx) Local ──
const btnDownloadTestExcel = document.getElementById('btnDownloadTestExcel');
if (btnDownloadTestExcel) {
  btnDownloadTestExcel.addEventListener('click', async () => {
    btnDownloadTestExcel.disabled = true;
    const originalText = btnDownloadTestExcel.innerHTML;
    btnDownloadTestExcel.innerHTML = `<span>Generando Excel...</span>`;

    const payload = {
      monthTitle: monthSelect.value || 'Septiembre-2026',
      date: postDateInput.value.trim(),
      postName: postNameInput.value.trim() || 'Publicación Facebook',
      postLink: lastScanResults?.postUrl || '',
      participants: matchedParticipants,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/extension/download-excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Error al generar Excel');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PRUEBA_${payload.monthTitle}_${payload.date.replace(/\//g, '-')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Servidor local no disponible para exportación, descargando directo de Google Sheets:', err);
      const directDownloadUrl = `https://docs.google.com/spreadsheets/d/1xA8UvFMuz3LfbB1o4JfnZ1T0ok12aYg_0f6rdjIbD1Q/export?format=xlsx`;
      window.open(directDownloadUrl, '_blank');
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
