    const chapters = [
      { label: 'het begin', pct: 0 },
      { label: 'in gesprek', pct: 25 },
      { label: 'het echte probleem', pct: 50 },
      { label: 'vertrouwen', pct: 75 },
      { label: 'ons verhaal', pct: 100 },
    ];

    const track = document.getElementById('track');
    const filled = document.getElementById('filled');
    const handle = document.getElementById('handle');
    const handleRing = document.getElementById('handleRing');
    const ticks = document.getElementById('ticks');
    const chapterName = document.getElementById('chapterName');
    const video = document.getElementById('bgImg');
    const navButtons = document.querySelectorAll('.nav-buttons .nav-btn');
    const topDotLabel = document.querySelector('.tl-ring-dot-top span');
    const rightDotLabel = document.querySelector('.tl-ring-dot-right span');

    let currentPct = 0;
    let dragging = false;
    const timelineStorageKey = 'indexTimelinePct';

    const defaultTopLabel = topDotLabel ? topDotLabel.textContent : '';
    const defaultRightLabel = rightDotLabel ? rightDotLabel.textContent : '';
    const topDotEl = document.querySelector('.tl-ring-dot-top');
    const rightDotEl = document.querySelector('.tl-ring-dot-right');

    function getActiveTickIndex(pct) {
      let activeIndex = 0;
      chapters.forEach((ch, i) => {
        if (pct >= ch.pct) activeIndex = i;
      });
      return activeIndex;
    }

    function getSnappedTickPct(pct) {
      return chapters[getActiveTickIndex(pct)].pct;
    }

    function persistTimelinePosition(pct) {
      try {
        sessionStorage.setItem(timelineStorageKey, String(Math.max(0, Math.min(100, pct))));
      } catch (err) {
        // Ignore storage errors (private mode, blocked storage, etc.).
      }
    }

    function readTimelinePosition() {
      try {
        const saved = sessionStorage.getItem(timelineStorageKey);
        if (saved === null) return 0;
        const parsed = Number(saved);
        if (Number.isNaN(parsed)) return 0;
        return Math.max(0, Math.min(100, parsed));
      } catch (err) {
        return 0;
      }
    }

    const chapterButtonConfig = [
      [
        { text: 'De Mijnen', href: 'mijnen.html', title: 'De mijnen verdwijnen' },
        { text: 'Getallen', href: 'getallen.html', title: 'Kerkrade in vier getallen' },
      ],
      [
        { text: 'De stemmen', href: 'stemmen.html', title: 'Stemmen uit Kerkrade' },
        { text: 'Wie niet', href: 'sprakenniet.html', title: 'Wie spraken we niet?' },
      ],
      [
         { text: 'Wat Werkt', href: 'werkt.html', title: 'Wat werkt wel?' },
        
        
      ],
      [
        { text: 'Vertrouwen', href: 'vertrouwen.html', title: 'Vertrouwen over de jaren' },
        { text: 'Kleine Impact', href: 'impact.html', title: 'Kleine stap, grote impact' },
      ],
      [
       
      ],
    ];

    function updateBottomNavButtons(pct) {
      if (!navButtons.length) return;

      const activeIndex = getActiveTickIndex(pct);
      const config = chapterButtonConfig[activeIndex] || chapterButtonConfig[0];

      navButtons.forEach((button, buttonIndex) => {
        const buttonConfig = config[buttonIndex];
        if (!button) return;

        if (!buttonConfig) {
          button.style.display = 'none';
          button.setAttribute('aria-hidden', 'true');
          button.removeAttribute('href');
          return;
        }

        button.style.display = '';
        button.removeAttribute('aria-hidden');

        button.textContent = buttonConfig.text;
        button.href = buttonConfig.href;
        button.title = buttonConfig.title || buttonConfig.text;
      });
    }

    function updateDotLabels(pct) {
      if (!topDotLabel || !rightDotLabel) return;

      const activeIndex = getActiveTickIndex(pct);
      const labels = tickDotLabels[activeIndex] || {
        top: defaultTopLabel,
        right: defaultRightLabel,
      };

      topDotLabel.textContent = labels.top;
      rightDotLabel.textContent = labels.right;
      if (topDotEl && labels.topUrl) {
        topDotEl.onclick = () => window.location.href = labels.topUrl;
      }
      if (rightDotEl && labels.rightUrl) {
        rightDotEl.onclick = () => window.location.href = labels.rightUrl;
      }
    }

	

    chapters.forEach((ch, i) => {
      const el = document.createElement('div');
      el.className = 'tl-tick' + (i === 0 ? ' active' : '');
      el.style.left = ch.pct + '%';
      el.innerHTML = `<div class="tl-tick-mark"></div><div class="tl-tick-label">${ch.label}</div>`;
      el.addEventListener('click', () => seek(ch.pct));
      ticks.appendChild(el);
    });

    function getChapter(p) {
      let active = chapters[0];
      for (const ch of chapters) {
        if (p >= ch.pct && ch.label) active = ch;
      }
      return active;
    }

    function render(p) {
      currentPct = Math.max(0, Math.min(100, p));
      filled.style.width = currentPct + '%';
      handle.style.left = currentPct + '%';
      handleRing.style.left = currentPct + '%';
      updateDotLabels(currentPct);

      // Video synchronisatie
      if (video && video.duration) {
        video.currentTime = (currentPct / 100) * video.duration;
      }

      const activeIndex = getActiveTickIndex(currentPct);
      const ch = chapters[activeIndex];
      if (chapterName) chapterName.textContent = ch.label;
      updateBottomNavButtons(currentPct);
      persistTimelinePosition(currentPct);

      ticks.querySelectorAll('.tl-tick').forEach((t, i) => {
        t.classList.toggle('active', currentPct >= chapters[i].pct);
        t.classList.toggle('current', i === activeIndex);
      });
    }

    function seek(p) { render(getSnappedTickPct(p)); }

    function pctFromEvent(e) {
      const rect = track.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      return (x / rect.width) * 100;
    }

    handle.addEventListener('mousedown', e => { dragging = true; e.preventDefault(); });
    handle.addEventListener('touchstart', () => { dragging = true; }, { passive: true });
    handleRing.addEventListener('mousedown', e => { dragging = true; e.preventDefault(); });
    handleRing.addEventListener('touchstart', () => { dragging = true; }, { passive: true });



    document.addEventListener('mousemove', e => { if (dragging) render(getSnappedTickPct(pctFromEvent(e))); });
    document.addEventListener('touchmove', e => { if (dragging) render(getSnappedTickPct(pctFromEvent(e))); }, { passive: true });
    document.addEventListener('mouseup', () => { dragging = false; });
    document.addEventListener('touchend', () => { dragging = false; });

    track.addEventListener('click', e => { if (!dragging) render(pctFromEvent(e)); });

    // Video timeupdate - synchroniseer timeline met video playback
    if (video) {
      video.addEventListener('timeupdate', () => {
        if (!dragging && video.duration) {
          const pct = (video.currentTime / video.duration) * 100;
          currentPct = Math.max(0, Math.min(100, pct));
          filled.style.width = currentPct + '%';
          const snappedPct = getSnappedTickPct(currentPct);
          handle.style.left = snappedPct + '%';
          handleRing.style.left = snappedPct + '%';
          updateDotLabels(currentPct);

          const activeIndex = getActiveTickIndex(currentPct);
          const ch = chapters[activeIndex];
          if (chapterName) chapterName.textContent = ch.label;
          updateBottomNavButtons(currentPct);
          persistTimelinePosition(currentPct);

          ticks.querySelectorAll('.tl-tick').forEach((t, i) => {
            t.classList.toggle('active', currentPct >= chapters[i].pct);
            t.classList.toggle('current', i === activeIndex);
          });

          if (updateNextChapterButton) {
            updateNextChapterButton();
          }
        }
      });
    }

    // Next Chapter Button
    const nextBtn = document.getElementById('nextBtn');
    const nextChapterName = document.getElementById('nextChapterName');

    function updateNextChapterButton() {
      const currentIndex = getActiveTickIndex(currentPct);
      const nextIndex = Math.min(currentIndex + 1, chapters.length - 1);
      const nextChapter = chapters[nextIndex];
      
      if (nextChapterName) {
        nextChapterName.textContent = nextChapter.label;
      }
      
      if (nextBtn) {
        nextBtn.disabled = currentIndex >= chapters.length - 1;
      }
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const currentIndex = getActiveTickIndex(currentPct);
        if (currentIndex < chapters.length - 1) {
          seek(chapters[currentIndex + 1].pct);
          updateNextChapterButton();
        }
      });
    }

    const initialTimelinePct = readTimelinePosition();
    render(initialTimelinePct);

    if (video) {
      const syncVideoToSavedPosition = () => {
        if (!video.duration) return;
        video.currentTime = (initialTimelinePct / 100) * video.duration;
      };

      if (video.duration) {
        syncVideoToSavedPosition();
      } else {
        video.addEventListener('loadedmetadata', syncVideoToSavedPosition, { once: true });
      }
    }

    window.addEventListener('beforeunload', () => {
      persistTimelinePosition(currentPct);
    });

    updateNextChapterButton();

    function showMiniMap() {
  const wrap = document.getElementById('miniMapWrap');
  if (!wrap) return;
  wrap.classList.add('visible');
  // Laad Leaflet en initialiseer na korte delay
  // zodat het element volledig zichtbaar is voor Leaflet meet
  loadLeaflet().then(() => {
    if (!window.L) return;
    if (miniMapInst) {
      // Al geïnitialiseerd — forceer redraw
      setTimeout(() => miniMapInst.invalidateSize(), 100);
      return;
    }
    setTimeout(() => {
      miniMapInst = L.map('miniMapEl', {
        center: [50.8659, 6.0611], zoom: 15,
        zoomControl: false, attributionControl: false,
        dragging: false, scrollWheelZoom: false,
        doubleClickZoom: false, touchZoom: false, keyboard: false
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(miniMapInst);
      hotspotData.forEach(h => {
        L.circleMarker([h.lat, h.lng], {
          radius: 4,
          color: h.c,
          fillColor: h.c,
          fillOpacity: 0.85,
          weight: 1.5
        }).addTo(miniMapInst);
      });
      setTimeout(() => miniMapInst.invalidateSize(), 200);
    }, 200);
  });
}

/* ══════════════════════════════════════
   LEAFLET MINI-MAP + FULL MAP OVERLAY
══════════════════════════════════════ */
let leafletLoaded = false;
let miniMapInst   = null;
let fullMapInst   = null;
let mapOpening    = false;
const MAP_GROW_MS = 350;
const mapLayers   = {};
const mapActive   = new Set(['locaties']);

function loadLeaflet() {
  if (window.L) {
    leafletLoaded = true;
    return Promise.resolve();
  }
  if (leafletLoaded) return Promise.resolve();
  return new Promise(resolve => {
    const js  = document.createElement('script');
    js.id     = 'leaflet-js-runtime';
    js.src    = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    js.onload = () => { leafletLoaded = true; resolve(); };
    js.onerror = () => {
      const mm = document.getElementById('miniMapEl');
      if (mm) {
        mm.innerHTML = '<div style="padding:10px;font:12px/1.4 Arial,sans-serif;color:rgba(255,255,255,.75)">Kaart kon niet laden. Controleer internetverbinding of firewall.</div>';
      }
      resolve();
    };
    document.head.appendChild(js);
  });
}

/* ── Full map icon factory ── */
function mkIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};
           border:2px solid rgba(255,255,255,.5);
           box-shadow:0 0 10px ${color}88,0 2px 6px rgba(0,0,0,.6)"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7]
  });
}

/* ── Hotspot data ── */
const hotspotData = [
  { cat:'locaties', lat:50.865879, lng:6.062609, c:'#27ae60', title:'De HuB', sub:'Locatie', body:'Bibliotheek in Kerkrade.' },
  { cat:'locaties', lat:50.86131273595536, lng:6.029976058960755, c:'#27ae60', title:"'t Westhoes", sub:'Locatie', body:'Ontmoetingsplek in Kerkrade.' },
  { cat:'locaties', lat:50.853064171850406, lng:6.066393891478174, c:'#27ae60', title:"Patronaat", sub:'Locatie', body:'Buurthuis.' },
  { cat:'locaties', lat:50.869305780323614, lng:6.069903308522318, c:'#27ae60', title:'De Oostkamer', sub:'Locatie', body:'Buurthuis' },
  { cat:'locaties', lat:50.865270320424514, lng:6.062021357048032, c:'#27ae60', title:'Het Raadhuis', sub:'Locatie', body:'Gemeente' },
  { cat:'locaties', lat:50.86650618136392, lng:6.0588781669694365, c:'#27ae60', title:'De Vie', sub:'Locatie', body:'Zwembad en ontmoetingsplek' },
  { cat:'locaties', lat:50.8649439389104, lng:6.061197078885108, c:'#27ae60', title:'Heemwonen', sub:'Locatie', body:'Woningcorporatie in Kerkrade.' },
  { cat:'locaties', lat:50.85380179253691, lng:6.065280209827551, c:'#27ae60', title:'Impuls', sub:'Locatie', body:'Maatschappelijke organisatie in Kerkrade.' },
  { cat:'locaties', lat:50.85641172251661, lng:6.006002831250797, c:'#27ae60', title:'De Woonwijzerwinkel', sub:'Locatie', body:'Informatiepunt voor wonen.' },
];

/* ── Open / close full map ── */
async function openFullMap() {
  const overlay = document.getElementById('mapOverlay');
  const wrap = document.getElementById('miniMapWrap');

  if (!overlay || mapOpening || overlay.classList.contains('open')) return;

  mapOpening = true;
  if (wrap) {
    wrap.classList.add('expanding');
    await new Promise(resolve => setTimeout(resolve, MAP_GROW_MS));
  }

  overlay.classList.add('open');
  if (wrap) {
    wrap.classList.add('overlay-open-hidden');
  }

  await loadLeaflet();
  if (!window.L) {
    mapOpening = false;
    return;
  }
  if (!fullMapInst) {
    fullMapInst = L.map('fullMapEl', {
      center: [50.8656, 6.0560], zoom: 14,
      zoomControl: false, attributionControl: false
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 })
      .addTo(fullMapInst);
    // Voeg alle hotspot-lagen toe
    ['locaties'].forEach(cat => {
      mapLayers[cat] = L.layerGroup();
    });
    hotspotData.forEach(h => {
      const m = L.marker([h.lat, h.lng], { icon: mkIcon(h.c) });
      m.bindPopup(`<div class="mp-inner">
        <span class="mp-cat" style="color:${h.c}">${h.sub}</span>
        <div class="mp-title">${h.title}</div>
        <div class="mp-body">${h.body}</div>
      </div>`, { maxWidth: 260, closeButton: false });
      mapLayers[h.cat].addLayer(m);
    });
    Object.values(mapLayers).forEach(l => l.addTo(fullMapInst));
  }
  setTimeout(() => fullMapInst.invalidateSize(), 50);
  mapOpening = false;
}

function closeFullMap() {
  const overlay = document.getElementById('mapOverlay');
  const wrap = document.getElementById('miniMapWrap');

  if (!overlay || mapOpening) return;
  mapOpening = true;

  if (wrap) {
    // Start from full-size minimap, then animate back to the compact widget.
    wrap.classList.add('expanding');
    wrap.classList.remove('overlay-open-hidden');
  }

  overlay.classList.remove('open');

  if (wrap) {
    setTimeout(() => {
      wrap.classList.remove('expanding');
    }, 80);
  }

  setTimeout(() => {
    mapOpening = false;
  }, MAP_GROW_MS + 120);
}

function toggleMapFilter(btn) {
  const cat = btn.dataset.cat;
  btn.classList.toggle('on');
  if (mapActive.has(cat)) {
    mapActive.delete(cat);
    fullMapInst && fullMapInst.removeLayer(mapLayers[cat]);
  } else {
    mapActive.add(cat);
    fullMapInst && mapLayers[cat].addTo(fullMapInst);
  }
}

// ESC sluit de kaart
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeFullMap();
    document.querySelectorAll('.panel-overlay').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.util-btn').forEach(b => b.classList.remove('active-btn'));
  }
});

showMiniMap();