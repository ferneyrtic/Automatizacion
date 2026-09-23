/**
 * AutoFace TIC - Content Script
 * Modo No Invasivo: Cero clics, cero scrolls automáticos.
 * Lee de forma limpia y directa todo lo que el usuario tenga visible y desplegado en Facebook.
 */

(() => {
  window.__autofaceLoaded = true;

  // ── Normalizador de Strings ──
  function normalizeText(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // ── Limpiador de URLs de Perfiles de Facebook ──
  function cleanFacebookUrl(rawUrl) {
    if (!rawUrl) return '';
    try {
      const u = new URL(rawUrl, window.location.origin);

      if (u.pathname === '/profile.php') {
        const id = u.searchParams.get('id');
        if (id) return `https://www.facebook.com/profile.php?id=${id}`.toLowerCase();
        return '';
      }

      if (u.pathname.startsWith('/people/')) {
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 3) {
          return `https://www.facebook.com/people/${parts[1]}/${parts[2]}`.toLowerCase();
        }
      }

      const segments = u.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        const username = segments[0];
        const ignored = [
          'stories', 'photo', 'watch', 'groups', 'events', 'pages',
          'hashtag', 'share', 'reel', 'reels', 'posts', 'permalink.php',
          'story.php', 'live', 'gaming', 'marketplace', 'notifications',
          'friends', 'help', 'messages', 'settings'
        ];
        if (!ignored.includes(username.toLowerCase())) {
          return `https://www.facebook.com/${username}`.toLowerCase();
        }
      }
    } catch (e) {}
    return '';
  }

  // ── Palabras del sistema de Facebook a ignorar ──
  const SYSTEM_WORDS = [
    'me gusta', 'responder', 'compartir', 'ver mas', 'ver más', 'todas', 'todos',
    'reacciones', 'alcaldia de acacias', 'alcaldía de acacías', 'transito acacias',
    'tránsito acacías', 'editar', 'eliminar', 'mas relevantes', 'más relevantes',
    'todos los comentarios', 'comentarios', 'comentar', 'escribe un comentario',
    'facebook', 'meta', 'privacidad', 'condiciones', 'ayuda', 'segundo', 'segundos',
    'minuto', 'minutos', 'hora', 'horas', 'dia', 'dias', 'día', 'días', 'sem', 'semana'
  ];

  // ── Personalización de Contratistas Objetivos (Columna F) ──
  let targetNamesMap = new Map(); // normalized name -> original name
  let targetUrlsSet = new Set();

  function initTargets(contractors) {
    targetNamesMap.clear();
    targetUrlsSet.clear();
    if (!Array.isArray(contractors)) return;

    contractors.forEach(c => {
      if (c.fbAccountName) {
        const norm = normalizeText(c.fbAccountName);
        if (norm) targetNamesMap.set(norm, c.fbAccountName);
      }
      if (c.name) {
        const norm = normalizeText(c.name.replace(/\s*[-–—].*$/, '').replace(/\s*\(.*?\)/, ''));
        if (norm) targetNamesMap.set(norm, c.name);
      }
      if (c.profileLink) {
        const cu = cleanFacebookUrl(c.profileLink);
        if (cu) targetUrlsSet.add(cu);
      }
    });
  }

  function isTargetContractor(name, url) {
    if (url && targetUrlsSet.has(cleanFacebookUrl(url))) return true;
    if (!name) return false;
    const norm = normalizeText(name);
    return targetNamesMap.has(norm);
  }

  function isSystemName(name) {
    if (!name) return true;
    if (isTargetContractor(name)) return false; // Si es un contratista conocido, nunca es del sistema
    if (name.length < 3) return true;
    const norm = normalizeText(name);
    if (SYSTEM_WORDS.some(w => norm === w || norm.startsWith('responder') || norm.startsWith('hace '))) return true;
    if (/^\d+\s*(h|d|min|sem|días|dias)/i.test(norm)) return true;
    return false;
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

  function getReactionsDialog() {
    const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
    return dialogs.find(d => {
      const hasTabs = d.querySelector('div[role="tablist"], [role="tab"]') !== null;
      const hasCommentInput = d.querySelector('form, [aria-label*="comentario"], [contenteditable="true"]') !== null;
      const txt = (d.innerText || '').toLowerCase();
      return hasTabs && !hasCommentInput && (txt.includes('todas') || txt.includes('me gusta') || txt.includes('personas que') || txt.includes('reacciones'));
    }) || null;
  }

  function extractNameFromElement(el) {
    if (!el) return '';
    let name = (el.innerText || el.textContent || '').split('\n')[0].trim();
    if (!name || name.length < 2) {
      const label = el.getAttribute ? (el.getAttribute('aria-label') || '') : '';
      if (label) {
        name = label.replace(/^(foto del perfil de|perfil de|ver perfil de)\s+/i, '').trim();
      }
    }
    return cleanFbDisplayName(name);
  }

  // ── Extracción 100% Pasiva y Segregada de Comentarios ──
  function extractAllVisibleComments() {
    const commentsMap = new Map(); // Key: normalized name -> { name, url }
    const reactionsDlg = getReactionsDialog();

    function addCommenter(rawName, rawUrl, el) {
      if (!rawName) return;
      // BLOQUEO ESTRICTO: Ningún elemento dentro del modal de reacciones puede ser un comentario
      if (el && reactionsDlg && reactionsDlg.contains(el)) return;

      const cleanName = cleanFbDisplayName(rawName);
      if (isSystemName(cleanName)) return;

      const normKey = normalizeText(cleanName);
      if (normKey.length < 2) return;

      const cleanUrl = cleanFacebookUrl(rawUrl);

      if (!commentsMap.has(normKey)) {
        commentsMap.set(normKey, { name: cleanName, url: cleanUrl });
      } else if (cleanUrl && !commentsMap.get(normKey).url) {
        commentsMap.get(normKey).url = cleanUrl;
      }
    }

    // 1. Artículos de comentarios (div[role="article"])
    const articles = document.querySelectorAll('div[role="article"]');
    articles.forEach(art => {
      // Si el artículo está dentro del modal de reacciones, ignorar por completo
      if (reactionsDlg && reactionsDlg.contains(art)) return;

      // 1.1 De aria-label (ej. "Comentario de Cindy Herrera hace 2 horas")
      const aria = art.getAttribute('aria-label') || '';
      let authorFound = false;

      if (aria) {
        const match = aria.match(/(?:Comentario de|Comment by)\s+([^,·\n]+)/i);
        if (match && match[1]) {
          const authorAnchor = art.querySelector('a[href]');
          addCommenter(match[1].trim(), authorAnchor ? authorAnchor.getAttribute('href') : '', art);
          authorFound = true;
        }
      }

      // 1.2 Si no tiene aria-label, buscar el autor en el primer enlace o cabecera del comentario
      if (!authorFound) {
        const anchors = art.querySelectorAll('a[href], a[role="link"]');
        for (const a of anchors) {
          const name = extractNameFromElement(a);
          const href = a.getAttribute ? a.getAttribute('href') : '';
          if (name && !isSystemName(name)) {
            addCommenter(name, href, a);
            break; // El primer enlace de persona es el autor del comentario
          }
        }
      }
    });

    // 2. Comentarios con barra de interacción ("Responder" + "Me gusta")
    const actionRows = Array.from(document.querySelectorAll('div, span')).filter(el => {
      if (reactionsDlg && reactionsDlg.contains(el)) return false;
      const t = (el.innerText || '').trim();
      return (t.includes('Me gusta') || t.includes('Like')) && (t.includes('Responder') || t.includes('Reply'));
    });

    actionRows.forEach(row => {
      const parent = row.closest('div[role="article"]') || row.parentElement?.parentElement;
      if (parent && (!reactionsDlg || !reactionsDlg.contains(parent))) {
        const authorAnchor = parent.querySelector('a[href], a[role="link"], strong');
        if (authorAnchor) {
          const name = extractNameFromElement(authorAnchor);
          const href = authorAnchor.getAttribute ? authorAnchor.getAttribute('href') : '';
          if (name && !isSystemName(name)) {
            addCommenter(name, href, authorAnchor);
          }
        }
      }
    });

    return Array.from(commentsMap.values());
  }

  // ── Extracción 100% Pasiva de Reacciones (Exclusivamente del diálogo de Likes) ──
  function extractReactions() {
    const reactionsDialog = getReactionsDialog();
    if (!reactionsDialog) return [];

    const results = new Map();
    const anchors = reactionsDialog.querySelectorAll('a[href]');
    anchors.forEach(a => {
      const name = extractNameFromElement(a);
      const href = a.getAttribute('href');
      if (name && !isSystemName(name)) {
        const clean = cleanFacebookUrl(href);
        const normKey = normalizeText(name);
        if (!results.has(normKey)) {
          results.set(normKey, { name, url: clean });
        }
      }
    });

    // También buscar en los elementos de texto con role="link" dentro del diálogo
    const roleLinks = reactionsDialog.querySelectorAll('[role="link"], span[dir="auto"]');
    roleLinks.forEach(el => {
      const name = extractNameFromElement(el);
      if (name && !isSystemName(name)) {
        const parentA = el.closest('a[href]');
        const href = parentA ? parentA.getAttribute('href') : '';
        const clean = href ? cleanFacebookUrl(href) : '';
        const normKey = normalizeText(name);
        if (!results.has(normKey)) {
          results.set(normKey, { name, url: clean });
        }
      }
    });

    return Array.from(results.values());
  }

  // ── Ejecutor Principal (Instantáneo y Pasivo) ──
  async function runScan(onProgress) {
    if (onProgress) onProgress({ step: 'Auditando comentarios en pantalla...', percent: 40 });

    const comments = extractAllVisibleComments();

    if (onProgress) {
      onProgress({
        type: 'comments',
        count: comments.length,
        step: `Comentarios detectados: ${comments.length}`,
        percent: 80,
      });
    }

    const reactions = extractReactions();
    const isReactionsOpen = reactions.length > 0 || (document.querySelector('div[role="dialog"] [role="tablist"]') !== null);

    if (onProgress) {
      if (reactions.length > 0) {
        onProgress({
          type: 'reactions',
          count: reactions.length,
          step: `Reacciones detectadas: ${reactions.length}`,
        });
      }
      onProgress({ step: 'Finalizado', percent: 100 });
    }

    return {
      postUrl: window.location.href,
      comments,
      reactions,
      isReactionsOpen,
    };
  }

  // ── Listener de Mensajes de la Extensión ──
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'PING') {
      sendResponse({
        status: 'READY',
        url: window.location.href,
        hasReactionsOpen: extractReactions().length > 0,
      });
      return true;
    }

    if (message.action === 'START_SCAN') {
      if (message.targetContractors) {
        initTargets(message.targetContractors);
      }
      runScan((update) => {
        chrome.runtime.sendMessage({ action: 'SCAN_PROGRESS', data: update }).catch(() => {});
      }).then(results => {
        sendResponse({ success: true, results });
      }).catch(err => {
        console.error('Error en runScan:', err);
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }
  });

})();
