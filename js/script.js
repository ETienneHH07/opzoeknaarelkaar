    const chapters = [
      { label: 'het begin', pct: 0, time: 0 },
      { label: 'in gesprek', pct: 22.5, time: 80 },
      { label: 'het echte probleem', pct: 45, time: 118 },
      { label: 'vertrouwen', pct: 67.5, time: 257 },
      { label: 'ons verhaal', pct: 90, time: 317 },
    ];

    const track = document.getElementById('track');
    const filled = document.getElementById('filled');
    const handle = document.getElementById('handle');
    const handleRing = document.getElementById('handleRing');
    const ticks = document.getElementById('ticks');
    const chapterName = document.getElementById('chapterName');
    const video = document.getElementById('bgImg');
    const ytContainer = document.getElementById('ytBg');
    const youtubeVideoId = (document.body.dataset.youtubeId || '').trim();
    const mediaMode = youtubeVideoId && ytContainer ? 'youtube' : 'native';
    const navButtons = document.querySelectorAll('.nav-buttons .nav-btn');
    const topDotLabel = document.querySelector('.tl-ring-dot-top span');
    const rightDotLabel = document.querySelector('.tl-ring-dot-right span');

    let currentPct = 0;
    let dragging = false;
    const timelineStorageKey = 'indexTimelinePct';
    let ytPlayer = null;
    let ytTickTimer = null;

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

    function getActiveTickIndexFromTime(timeSeconds) {
      let activeIndex = 0;
      chapters.forEach((ch, i) => {
        if (timeSeconds >= ch.time) activeIndex = i;
      });
      return activeIndex;
    }

    function interpolateRange(value, inMin, inMax, outMin, outMax) {
      if (inMax === inMin) return outMin;
      const progress = (value - inMin) / (inMax - inMin);
      return outMin + (outMax - outMin) * progress;
    }

    function getTimelinePctFromTime(timeSeconds, duration) {
      if (!Number.isFinite(duration) || duration <= 0) return 0;

      const clampedTime = Math.max(0, Math.min(duration, timeSeconds));

      for (let index = 0; index < chapters.length - 1; index += 1) {
        const startChapter = chapters[index];
        const endChapter = chapters[index + 1];
        if (clampedTime <= endChapter.time) {
          return interpolateRange(clampedTime, startChapter.time, endChapter.time, startChapter.pct, endChapter.pct);
        }
      }

      const lastChapter = chapters[chapters.length - 1];
      return interpolateRange(clampedTime, lastChapter.time, duration, lastChapter.pct, 100);
    }

    function getTimeFromTimelinePct(pct, duration) {
      if (!Number.isFinite(duration) || duration <= 0) return 0;

      const clampedPct = Math.max(0, Math.min(100, pct));

      for (let index = 0; index < chapters.length - 1; index += 1) {
        const startChapter = chapters[index];
        const endChapter = chapters[index + 1];
        if (clampedPct <= endChapter.pct) {
          return interpolateRange(clampedPct, startChapter.pct, endChapter.pct, startChapter.time, endChapter.time);
        }
      }

      const lastChapter = chapters[chapters.length - 1];
      return interpolateRange(clampedPct, lastChapter.pct, 100, lastChapter.time, duration);
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

    function getMediaDuration() {
      if (mediaMode === 'youtube') {
        if (!ytPlayer || typeof ytPlayer.getDuration !== 'function') return 0;
        const duration = ytPlayer.getDuration();
        return Number.isFinite(duration) ? duration : 0;
      }

      if (!video || !Number.isFinite(video.duration)) return 0;
      return video.duration;
    }

    function getMediaCurrentTime() {
      if (mediaMode === 'youtube') {
        if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return 0;
        const current = ytPlayer.getCurrentTime();
        return Number.isFinite(current) ? current : 0;
      }

      if (!video || !Number.isFinite(video.currentTime)) return 0;
      return video.currentTime;
    }

    function setMediaCurrentTime(timeSeconds) {
      if (!Number.isFinite(timeSeconds)) return;

      if (mediaMode === 'youtube') {
        if (!ytPlayer || typeof ytPlayer.seekTo !== 'function') return;
        ytPlayer.seekTo(timeSeconds, true);
        return;
      }

      if (!video) return;
      video.currentTime = timeSeconds;
    }

    function playMedia() {
      if (mediaMode === 'youtube') {
        if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
          ytPlayer.playVideo();
        }
        return;
      }

      if (video && typeof video.play === 'function') {
        video.play().catch(() => {
          // Browser may still require user interaction.
        });
      }
    }

    function onMediaTimeUpdate(callback) {
      if (mediaMode === 'youtube') {
        if (ytTickTimer) clearInterval(ytTickTimer);
        ytTickTimer = setInterval(callback, 250);
        return;
      }

      if (video) {
        video.addEventListener('timeupdate', callback);
      }
    }

    function loadYouTubeApi() {
      if (window.YT && window.YT.Player) {
        return Promise.resolve();
      }

      return new Promise(resolve => {
        const existingScript = document.getElementById('yt-iframe-api');
        if (!existingScript) {
          const tag = document.createElement('script');
          tag.id = 'yt-iframe-api';
          tag.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(tag);
        }

        const previousReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (typeof previousReady === 'function') {
            previousReady();
          }
          resolve();
        };
      });
    }

    function setupYouTubeBackground(initialPct) {
      if (mediaMode !== 'youtube') return;
      if (!ytContainer) return;

      if (video) {
        video.pause();
        video.style.display = 'none';
      }

      ytContainer.classList.add('is-active');

      loadYouTubeApi().then(() => {
        if (!(window.YT && window.YT.Player)) return;

        ytPlayer = new window.YT.Player('ytBg', {
          width: '100%',
          height: '100%',
          videoId: youtubeVideoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: () => {
              const duration = getMediaDuration();
              if (duration) {
                setMediaCurrentTime((initialPct / 100) * duration);
              }
              playMedia();
            },
          },
        });
      });
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
      const activeIndex = getActiveTickIndex(currentPct);
      const snappedPct = chapters[activeIndex].pct;
      handle.style.left = snappedPct + '%';
      handleRing.style.left = snappedPct + '%';
      updateDotLabels(currentPct);

      // Video synchronisatie
      const duration = getMediaDuration();
      if (duration > 0) {
        setMediaCurrentTime(getTimeFromTimelinePct(currentPct, duration));
      }

      const ch = chapters[activeIndex];
      if (chapterName) chapterName.textContent = ch.label;
      updateBottomNavButtons(currentPct);
      persistTimelinePosition(currentPct);

      ticks.querySelectorAll('.tl-tick').forEach((t, i) => {
        t.classList.toggle('active', currentPct >= chapters[i].pct);
        t.classList.toggle('current', i === activeIndex);
      });
    }

    function seek(p) { render(p); }

    function pctFromEvent(e) {
      const rect = track.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      return (x / rect.width) * 100;
    }

    handle.addEventListener('mousedown', e => { dragging = true; e.preventDefault(); });
    handle.addEventListener('touchstart', () => { dragging = true; }, { passive: true });
    handleRing.addEventListener('mousedown', e => { dragging = true; e.preventDefault(); });
    handleRing.addEventListener('touchstart', () => { dragging = true; }, { passive: true });



    document.addEventListener('mousemove', e => { if (dragging) render(pctFromEvent(e)); });
    document.addEventListener('touchmove', e => { if (dragging) render(pctFromEvent(e)); }, { passive: true });
    document.addEventListener('mouseup', () => { dragging = false; });
    document.addEventListener('touchend', () => { dragging = false; });

    track.addEventListener('click', e => { if (!dragging) seek(pctFromEvent(e)); });

    // Video timeupdate - synchroniseer timeline met video playback
    onMediaTimeUpdate(() => {
        const duration = getMediaDuration();
        if (!dragging && duration > 0) {
          const currentTime = getMediaCurrentTime();
          const pct = getTimelinePctFromTime(currentTime, duration);
          currentPct = Math.max(0, Math.min(100, pct));
          filled.style.width = currentPct + '%';
          const activeIndex = getActiveTickIndexFromTime(currentTime);
          const snappedPct = chapters[activeIndex].pct;
          handle.style.left = snappedPct + '%';
          handleRing.style.left = snappedPct + '%';
          updateDotLabels(currentPct);

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

    // Next Chapter Button
    const nextBtn = document.getElementById('nextBtn');
    const nextChapterName = document.getElementById('nextChapterName');

    function updateNextChapterButton() {
      if (nextChapterName) {
        nextChapterName.textContent = 'terug naar de start';
      }

      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.title = 'Terug naar start';
      }
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    const initialTimelinePct = readTimelinePosition();
    render(initialTimelinePct);

    if (mediaMode === 'youtube') {
      setupYouTubeBackground(initialTimelinePct);
    } else if (video) {
      const syncVideoToSavedPosition = () => {
        if (!video.duration) return;
        setMediaCurrentTime(getTimeFromTimelinePct(initialTimelinePct, video.duration));
      };

      if (video.duration) {
        syncVideoToSavedPosition();
      } else {
        video.addEventListener('loadedmetadata', syncVideoToSavedPosition, { once: true });
      }
    }

    document.addEventListener('pointerdown', () => {
      playMedia();
    }, { once: true });

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