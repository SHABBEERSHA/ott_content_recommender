/* ═══════════════════════════════════════════════════════════════
   StreamIQ – Frontend Application
   Handles: API calls, rendering, search, genre filter,
            user switching, and all D3 visualizations
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── Constants ───────────────────────────────────────────────────
const GENRE_COLORS = {
  'Action':  '#ff4500',
  'Thriller':'#8b2be2',
  'Drama':   '#1d6ad8',
  'Sci-Fi':  '#0a7a55',
  'Horror':  '#bb1515',
  'Romance': '#cc1a88'
};
const GENRE_CLASS = {
  'Action':'g-Action','Thriller':'g-Thriller','Drama':'g-Drama',
  'Sci-Fi':'g-Sci-Fi','Horror':'g-Horror','Romance':'g-Romance'
};

const FALLBACK_ARTS = {
  Action: 'images/action.jpg',
  Thriller: 'images/thriller.jpg',
  Drama: 'images/drama.jpg',
  'Sci-Fi': 'images/scifi.jpg',
  Horror: 'images/horror.jpg',
  Romance: 'images/romance.jpg'
};

const AI_ARTS = {
  Action: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=900&q=80',
  Thriller: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=900&q=80',
  Drama: 'https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?auto=format&fit=crop&w=900&q=80',
  'Sci-Fi': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
  Horror: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80',
  Romance: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=900&q=80'
};

function getArtUrl(item, fallbackGenre = 'Action') {
  const genre = item?.genre || fallbackGenre;
  const primary = AI_ARTS[genre] || AI_ARTS[fallbackGenre] || AI_ARTS.Action;
  const defaultArt = FALLBACK_ARTS[genre] || FALLBACK_ARTS[fallbackGenre] || FALLBACK_ARTS.Action;

  if (!item || !item.id) return primary;
  return `${primary}&sig=${item.id}`;
}

function setBackgroundImage(element, item, fallbackGenre = 'Action') {
  if (!element) return;
  const primary = getArtUrl(item, fallbackGenre);
  const fallback = FALLBACK_ARTS[fallbackGenre] || FALLBACK_ARTS.Action;
  const overlay = `linear-gradient(180deg, rgba(8,8,15,0.12), rgba(8,8,15,0.78))`;

  element.style.backgroundImage = `${overlay}, url('${primary}')`;
  element.style.backgroundSize = 'cover';
  element.style.backgroundPosition = 'center';
  element.style.backgroundRepeat = 'no-repeat';

  const probe = new Image();
  probe.onerror = () => {
    element.style.backgroundImage = `${overlay}, url('${fallback}')`;
  };
  probe.src = primary;
}

// ── Application State ───────────────────────────────────────────
const state = {
  currentUser: 1,
  k: 5,
  allContent: [],
  users: [],
  recommendations: [],
  knnSteps: null,
  graphData: null,
  genreData: null,
  selectedGenre: 'All',
  searchQuery: '',
  activeVTab: 'genres',
  vizInited: { genres:false, graph:false, knn:false, pipeline:false }
};

// ── Utility ─────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);

function showLoader() { $('loader').classList.remove('hidden'); }
function hideLoader() { $('loader').classList.add('hidden'); }

function genreColor(genre) { return GENRE_COLORS[genre] || '#7c3aed'; }

function starRating(r) {
  return '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
}

// ── API Calls ───────────────────────────────────────────────────
async function fetchAll() {
  const [content, users, graph, genres] = await Promise.all([
    fetch('/api/content').then(r => r.json()),
    fetch('/api/users').then(r => r.json()),
    fetch('/api/graph').then(r => r.json()),
    fetch('/api/genres').then(r => r.json())
  ]);
  state.allContent = content;
  state.users      = users;
  state.graphData  = graph;
  state.genreData  = genres;
}

async function fetchRecommendations() {
  const data = await fetch(
    `/api/recommend?user=${state.currentUser}&k=${state.k}`
  ).then(r => r.json());
  state.recommendations = data.recommendations || [];
  state.knnSteps        = data.knnSteps || null;
  return data;
}

// ── Card Builder ────────────────────────────────────────────────
function buildCard(item, type = 'normal') {
  const gc    = GENRE_CLASS[item.genre] || 'g-Action';
  const color = genreColor(item.genre);

  if (type === 'foryou') {
    const recBy = (item.recommendedBy || []).slice(0, 2).join(', ');
    return `
      <div class="fy-card" data-id="${item.id}">
        <div class="fy-poster ${gc}">
          <div class="fy-top">
            <span class="reason-badge" title="${item.reason}">${item.reason}</span>
            <span class="match-badge">${item.matchPct}% Match</span>
          </div>
          <div class="fy-info">
            <div class="fy-title">${item.title}</div>
            <div class="fy-meta">
              <span style="color:var(--goldL);">★ ${item.rating}</span>
              <span>${item.year}</span>
              <span style="color:${color};">${item.genre}</span>
            </div>
            ${recBy ? `<div class="fy-recBy">Watched by <span>${recBy}</span> & similar users</div>` : ''}
          </div>
        </div>
      </div>`;
  }

  return `
    <div class="card" onclick='openModal(${JSON.stringify(item).replace(/'/g,"&apos;")})' data-id="${item.id}">
      <div class="card-poster" data-id="${item.id}" data-genre="${item.genre}" style="background: linear-gradient(180deg, rgba(8,8,15,0.12), rgba(8,8,15,0.78)), url('${getArtUrl(item, item.genre)}') center/cover no-repeat;">
        <div class="card-poster-overlay" style="background: linear-gradient(0deg, var(--bg) 0%, transparent 100%); width: 100%; height: 100%; position: absolute; inset: 0;"></div>
        <div class="card-top">
          <div class="card-rating-badge">★ ${item.rating}</div>
        </div>
        <div class="card-hover-overlay">
          <div class="btn-card-play">▶</div>
        </div>
        <div class="card-info">
          <div class="card-title">${item.title}</div>
          <div class="card-sub">
            <div class="card-genre-dot" style="background:${color}"></div>
            <span>${item.genre}</span>
            <span>${item.year}</span>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Hero ────────────────────────────────────────────────────────
function renderHero(item) {
  if (!item) return;
  const color = genreColor(item.genre);
  setBackgroundImage($('heroBg'), item, item.genre);
  $('heroBg').style.backgroundImage = `linear-gradient(to right, rgba(8,8,15,0.97) 0%, rgba(8,8,15,0.75) 40%, rgba(8,8,15,0.3) 100%), url('${getArtUrl(item, item.genre)}')`;
  $('heroTitle').textContent = item.title;
  $('heroDesc').textContent  = item.description;
  $('heroMeta').innerHTML = `
    <span class="hero-rating">★ ${item.rating} / 10</span>
    <span>${item.year}</span>
    <span>${item.duration}</span>
    <span class="hero-genre-badge">${item.genre}</span>
    ${item.reason ? `<span style="color:var(--purpleL);font-size:.82rem;">🤖 ${item.reason}</span>` : ''}
  `;
  $('heroPlay').onclick = () => openModal(item);
  $('heroInfo').onclick = () => openModal(item);
}

// ── Row Renderer ────────────────────────────────────────────────
function renderRow(containerId, items, type = 'normal') {
  const el = $(containerId);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<div class="empty-state"><div class="e-icon">🎬</div><p>Nothing to show</p></div>';
    return;
  }
  el.innerHTML = items.map(i => buildCard(i, type)).join('');
  el.querySelectorAll('.card-poster').forEach(poster => {
    const id = Number(poster.dataset.id);
    const item = state.allContent.find(c => c.id === id);
    if (item) setBackgroundImage(poster, item, item.genre);
  });
  el.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const id   = parseInt(card.dataset.id);
      const item = state.allContent.find(c => c.id === id);
      if (item) openModal(item);
    });
  });
}

// ── For You Grid ────────────────────────────────────────────────
function renderForYou() {
  const grid = $('forYouGrid');
  if (!state.recommendations.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="e-icon">🤖</div><p>No recommendations yet. Watch some content!</p></div>';
    return;
  }
  grid.innerHTML = state.recommendations.slice(0, 10).map(r => buildCard(r, 'foryou')).join('');
  grid.querySelectorAll('.fy-card').forEach(card => {
    card.addEventListener('click', () => {
      const id   = parseInt(card.dataset.id);
      const item = state.allContent.find(c => c.id === id)
                || state.recommendations.find(c => c.id === id);
      if (item) openModal(item);
    });
  });
}

// ── Genre Filter ────────────────────────────────────────────────
function renderGenreChips() {
  const genres = ['All', ...Object.keys(GENRE_COLORS)];
  $('genreChips').innerHTML = genres.map(g =>
    `<button class="chip${g === state.selectedGenre ? ' active' : ''}" data-genre="${g}">${g}</button>`
  ).join('');
  $('genreChips').querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedGenre = btn.dataset.genre;
      renderGenreChips();
      renderBrowseGrid();
    });
  });
}

function renderBrowseGrid() {
  let items = [...state.allContent];
  if (state.selectedGenre !== 'All') {
    items = items.filter(c => c.genre === state.selectedGenre);
  }
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    items = items.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.genre.toLowerCase().includes(q) ||
      (c.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  const grid = $('browseGrid');
  if (!items.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="e-icon">🔍</div><p>No results found</p></div>';
    return;
  }
  grid.innerHTML = items.map(c => buildCard(c, 'normal')).join('');
  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const id   = parseInt(card.dataset.id);
      const item = state.allContent.find(c => c.id === id);
      if (item) openModal(item);
    });
  });
}

// ── User Dropdown ────────────────────────────────────────────────
function renderUserDropdown() {
  $('userDropdown').innerHTML = state.users.map(u =>
    `<div class="user-option${u.id === state.currentUser ? ' active' : ''}" data-uid="${u.id}">
       <div class="user-avatar" style="font-size:.65rem;">${u.name[0]}</div>
       <span>${u.name}</span>
       <span style="margin-left:auto;font-size:.72rem;color:var(--txt3);">${u.watchedCount} watched</span>
     </div>`
  ).join('');
  $('userDropdown').querySelectorAll('.user-option').forEach(opt => {
    opt.addEventListener('click', async () => {
      const uid = parseInt(opt.dataset.uid);
      if (uid === state.currentUser) { toggleDropdown(false); return; }
      state.currentUser = uid;
      toggleDropdown(false);
      showLoader();
      await fetchRecommendations();
      // Reset viz flags so they re-render with new data
      state.vizInited.knn = false;
      renderPage();
      hideLoader();
    });
  });
}

function toggleDropdown(force) {
  const dd = $('userDropdown');
  if (force === false) { dd.classList.remove('show'); return; }
  dd.classList.toggle('show');
}

// ── Full Render ──────────────────────────────────────────────────
function renderPage() {
  // Update user selector display
  const user = state.users.find(u => u.id === state.currentUser);
  if (user) {
    $('userSelName').textContent = user.name;
    $('userAvatar').textContent  = user.name[0];
    document.querySelectorAll('.user-option').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.uid) === state.currentUser);
    });
  }

  // Hero: use Paradise as the top action movie, otherwise fall back to recommendation or rating
  const paradise = state.allContent.find(item => item.title.toLowerCase() === 'paradise');
  const hero = paradise
    || state.recommendations[0]
    || [...state.allContent].sort((a, b) => b.rating - a.rating)[0];
  renderHero(hero);
  document.querySelectorAll('.fy-poster').forEach(poster => {
    const id = Number(poster.dataset.id);
    const item = state.allContent.find(c => c.id === id) || state.recommendations.find(c => c.id === id);
    if (item) {
      poster.style.backgroundImage = `linear-gradient(180deg, rgba(11,11,22,0.15), rgba(11,11,22,0.78)), url('${getArtUrl(item, item.genre)}')`;
      poster.style.backgroundSize = 'cover';
      poster.style.backgroundPosition = 'center';
    }
  });

  // Trending: top-7 by rating
  const trending = [...state.allContent].sort((a, b) => b.rating - a.rating).slice(0, 10);
  renderRow('trendingRow', trending);

  // Recently watched: user's history content
  const recentIds = (state.users.find(u => u.id === state.currentUser) || {}).watchedCount;
  // Fetch full history from recommendations metadata or match against content
  // We reconstruct watched items from the knnSteps targetVector
  const watchedIds = state.knnSteps
    ? Object.keys(state.knnSteps.targetVector).map(Number)
    : [];
  const recent = watchedIds.map(id => state.allContent.find(c => c.id === id)).filter(Boolean);
  renderRow('recentRow', recent.length ? recent : trending.slice(0, 5));

  // For You
  renderForYou();

  // Genre chips + browse grid
  renderGenreChips();
  renderBrowseGrid();

  // User dropdown items
  renderUserDropdown();

  // Re-init k-NN viz if data changed
  if (state.activeVTab === 'knn') { renderKNNViz(); }
}

// ── Modal ────────────────────────────────────────────────────────
function openModal(item) {
  const modalHeroEl = $('modalHero');
  modalHeroEl.className = `modal-hero`;
  const artUrl = getArtUrl(item, item.genre);
  setBackgroundImage(modalHeroEl, item, item.genre);
  modalHeroEl.style.backgroundImage =
    `linear-gradient(to top, var(--bg2) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.1) 100%), url('${artUrl}')`;
  modalHeroEl.style.backgroundSize = 'cover';
  modalHeroEl.style.backgroundPosition = 'center';
  $('modalTitle').textContent = item.title;
  $('modalDesc').textContent  = item.description;
  $('modalMeta').innerHTML = `
    <span style="color:var(--goldL);">★ ${item.rating}/10</span>
    <span style="color:var(--txt2);">${item.year}</span>
    <span style="color:var(--txt2);">${item.duration}</span>
    <span style="color:${genreColor(item.genre)};font-weight:700;">${item.genre}</span>
    ${item.reason ? `<span style="background:rgba(124,58,237,0.15);color:var(--purpleL);padding:3px 10px;border-radius:99px;font-size:.78rem;">${item.reason}</span>` : ''}
  `;
  $('modalTags').innerHTML = (item.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
  $('modalOverlay').classList.add('open');
}

// ── Inline Viz Tabs ──────────────────────────────────────────────
function initInlineVizTabs() {
  document.querySelectorAll('[data-vtab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const vtab = tab.dataset.vtab;
      document.querySelectorAll('[data-vtab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.viz-pane').forEach(p => p.classList.remove('active'));
      $('vtab-' + vtab).classList.add('active');
      state.activeVTab = vtab;
      if (!state.vizInited[vtab]) {
        state.vizInited[vtab] = true;
        if (vtab === 'genres')   renderGenreViz();
        if (vtab === 'graph')    renderGraphViz();
        if (vtab === 'knn')      renderKNNViz();
        if (vtab === 'pipeline') renderPipelineViz();
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// ── D3 VISUALIZATION 1: Genre Equivalence Classes ─────────────
// ═══════════════════════════════════════════════════════════════
function renderGenreViz() {
  const wrap  = $('genreVizWrap');
  wrap.innerHTML = '';
  const W = wrap.clientWidth || 700, H = 380;

  const svg = d3.select('#genreVizWrap').append('svg')
    .attr('width', W).attr('height', H);

  // Defs: glows
  const defs = svg.append('defs');
  const classColors = ['#7c3aed', '#f59e0b', '#14b8a6'];
  classColors.forEach((c, i) => {
    const filt = defs.append('filter').attr('id', `glow-class-${i}`);
    filt.append('feGaussianBlur').attr('stdDeviation', '8').attr('result', 'blur');
    const merge = filt.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');
  });

  const classes = state.genreData || [];
  // Cluster centers
  const cx = [W * 0.22, W * 0.5, W * 0.78];
  const cy = [H * 0.5, H * 0.42, H * 0.5];

  // Class labels
  const classLabels = classes.map((c, i) => ({
    label: c.label, color: classColors[i], x: cx[i], y: cy[i],
    genres: c.genres, desc: c.description
  }));

  // Draw cluster halos
  classLabels.forEach((cl, i) => {
    svg.append('circle')
      .attr('cx', cl.x).attr('cy', cl.y).attr('r', 90)
      .attr('fill', cl.color).attr('opacity', 0.06)
      .attr('filter', `url(#glow-class-${i})`);
    svg.append('circle')
      .attr('cx', cl.x).attr('cy', cl.y).attr('r', 90)
      .attr('fill', 'none').attr('stroke', cl.color).attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6 4').attr('opacity', 0.3);

    // Class label
    svg.append('text')
      .attr('x', cl.x).attr('y', cl.y - 100)
      .attr('text-anchor', 'middle').attr('font-size', '11')
      .attr('font-weight', '700').attr('fill', cl.color)
      .attr('opacity', 0.8)
      .text('Class ' + i + ': ' + cl.label);
  });

  // Genre nodes
  const genreNodes = [];
  classLabels.forEach((cl, ci) => {
    cl.genres.forEach((g, gi) => {
      const angle = (gi / cl.genres.length) * Math.PI * 2 - Math.PI / 2;
      const r = 50;
      genreNodes.push({
        genre: g, classIdx: ci, color: cl.color,
        x: cl.x + Math.cos(angle) * r,
        y: cl.y + Math.sin(angle) * r
      });
    });
  });

  // Draw union edges within each class
  classLabels.forEach((cl, ci) => {
    if (cl.genres.length < 2) return;
    const gNodes = genreNodes.filter(n => n.classIdx === ci);
    for (let i = 0; i < gNodes.length; i++) {
      for (let j = i + 1; j < gNodes.length; j++) {
        svg.append('line')
          .attr('x1', gNodes[i].x).attr('y1', gNodes[i].y)
          .attr('x2', gNodes[j].x).attr('y2', gNodes[j].y)
          .attr('stroke', cl.color).attr('stroke-width', 2)
          .attr('stroke-dasharray', '5 3').attr('opacity', 0.5);
      }
    }
  });

  // Draw genre nodes
  const nodeG = svg.selectAll('.genre-node')
    .data(genreNodes).enter().append('g')
    .attr('class', 'genre-node')
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .style('cursor', 'pointer');

  nodeG.append('circle')
    .attr('r', 0).attr('fill', d => d.color).attr('opacity', 0.85)
    .attr('filter', d => `url(#glow-class-${d.classIdx})`)
    .transition().duration(600).delay((_, i) => i * 100)
    .attr('r', 28);

  nodeG.append('text')
    .attr('text-anchor', 'middle').attr('dy', '0.35em')
    .attr('font-size', '11').attr('font-weight', '700').attr('fill', '#fff')
    .text(d => d.genre)
    .attr('opacity', 0).transition().delay((_, i) => i * 100 + 300).attr('opacity', 1);

  // Hover tooltip
  const tooltip = d3.select('#genreVizWrap').append('div')
    .style('position','absolute').style('background','rgba(20,20,40,0.95)')
    .style('border','1px solid rgba(124,58,237,0.4)').style('border-radius','10px')
    .style('padding','10px 14px').style('font-size','12px').style('color','#fff')
    .style('pointer-events','none').style('opacity',0).style('max-width','200px')
    .style('top','10px').style('left','10px');

  nodeG.on('mouseover', function(event, d) {
    d3.select(this).select('circle').attr('r', 34);
    const gc = state.genreData[d.classIdx];
    tooltip.html(`<strong style="color:${d.color}">${d.genre}</strong><br/>
      Equivalence Class: <strong>${gc?.label}</strong><br/>
      <span style="color:#9ca3af;font-size:11px;">${gc?.description || ''}</span>`)
      .style('opacity', 1);
  }).on('mouseout', function() {
    d3.select(this).select('circle').attr('r', 28);
    tooltip.style('opacity', 0);
  });

  // Legend
  const legendY = H - 36;
  classLabels.forEach((cl, i) => {
    const lx = W * 0.15 + i * (W * 0.33);
    svg.append('circle').attr('cx', lx).attr('cy', legendY).attr('r', 6).attr('fill', cl.color);
    svg.append('text').attr('x', lx + 12).attr('y', legendY + 4)
      .attr('font-size', '11').attr('fill', '#9ca3af').text(cl.label);
  });

  // Union-Find step annotation
  svg.append('text').attr('x', W / 2).attr('y', H - 8).attr('text-anchor', 'middle')
    .attr('font-size', '10').attr('fill', '#5c5c7a')
    .text('Java Union-Find: union(Action,Thriller) · union(Drama,Romance) · union(Sci-Fi,Horror)');
}

// ═══════════════════════════════════════════════════════════════
// ── D3 VISUALIZATION 2: Co-Watch Graph ────────────────────────
// ═══════════════════════════════════════════════════════════════
function renderGraphViz() {
  const wrap = $('graphVizWrap');
  wrap.innerHTML = '';
  const W = wrap.clientWidth || 700, H = 480;

  const contentMap = {};
  state.allContent.forEach(c => { contentMap[c.id] = c; });

  const { nodes: nodeIds, edges } = state.graphData;

  const nodes = nodeIds.map(id => ({
    id, ...contentMap[id],
    degree: edges.filter(e => e.source === id || e.target === id).length
  }));
  const links = edges.map(e => ({ ...e }));

  const svg = d3.select('#graphVizWrap').append('svg')
    .attr('width', W).attr('height', H)
    .call(d3.zoom().scaleExtent([0.4, 2]).on('zoom', ev => g.attr('transform', ev.transform)));

  const g = svg.append('g');

  // Arrow marker
  svg.append('defs').append('marker')
    .attr('id', 'arrow').attr('viewBox', '0 -5 10 10')
    .attr('refX', 20).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
    .append('path').attr('fill', 'rgba(255,255,255,0.2)').attr('d', 'M0,-5L10,0L0,5');

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(d => 80 + (3 - d.weight) * 20))
    .force('charge', d3.forceManyBody().strength(-180))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide(24));

  const link = g.selectAll('.link').data(links).enter().append('line')
    .attr('class', 'link')
    .attr('stroke', 'rgba(255,255,255,0.12)')
    .attr('stroke-width', d => Math.max(1, d.weight * 1.5))
    .attr('opacity', d => 0.3 + d.weight * 0.15);

  const node = g.selectAll('.node').data(nodes).enter().append('g')
    .attr('class', 'node').style('cursor', 'grab')
    .call(d3.drag()
      .on('start', (ev, d) => { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag',  (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
      .on('end',   (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  node.append('circle')
    .attr('r', d => 8 + d.degree * 1.5)
    .attr('fill', d => genreColor(d.genre))
    .attr('opacity', 0.85)
    .attr('stroke', '#0a0a0f').attr('stroke-width', 2);

  node.append('text')
    .attr('text-anchor', 'middle').attr('dy', '0.35em')
    .attr('font-size', '9').attr('font-weight', '700').attr('fill', '#fff')
    .attr('pointer-events', 'none')
    .text(d => d.title.split(':')[0].split(' ').slice(0, 2).join(' '));

  // Tooltip
  const tip = d3.select('#graphVizWrap').append('div')
    .style('position','absolute').style('background','rgba(15,15,30,0.95)')
    .style('border','1px solid rgba(255,255,255,0.1)').style('border-radius','10px')
    .style('padding','10px 14px').style('font-size','12px').style('pointer-events','none')
    .style('opacity',0).style('top','10px').style('left','10px').style('color','#fff');

  node.on('mouseover', (event, d) => {
    const neighbors = links.filter(l => l.source.id === d.id || l.target.id === d.id);
    tip.html(`<strong style="color:${genreColor(d.genre)}">${d.title}</strong><br/>
      Genre: ${d.genre} | ★ ${d.rating}<br/>
      Co-watch connections: <strong>${d.degree}</strong>`)
      .style('opacity', 1);
    link.attr('opacity', l =>
      (l.source.id === d.id || l.target.id === d.id) ? 0.9 : 0.08);
    link.attr('stroke', l =>
      (l.source.id === d.id || l.target.id === d.id) ? genreColor(d.genre) : 'rgba(255,255,255,0.12)');
  }).on('mouseout', () => {
    tip.style('opacity', 0);
    link.attr('opacity', l => 0.3 + l.weight * 0.15);
    link.attr('stroke', 'rgba(255,255,255,0.12)');
  });

  sim.on('tick', () => {
    link
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  // Legend
  const legendData = Object.entries(GENRE_COLORS);
  const legendG = svg.append('g').attr('transform', `translate(12, 12)`);
  legendData.forEach(([genre, color], i) => {
    const row = legendG.append('g').attr('transform', `translate(0, ${i * 20})`);
    row.append('circle').attr('r', 5).attr('fill', color).attr('cx', 6).attr('cy', 6);
    row.append('text').attr('x', 16).attr('y', 10).attr('font-size', '10')
      .attr('fill', '#9ca3af').text(genre);
  });
}

// ═══════════════════════════════════════════════════════════════
// ── D3 VISUALIZATION 3: k-NN Process ──────────────────────────
// ═══════════════════════════════════════════════════════════════
function renderKNNViz() {
  const area = $('knnVizArea');
  area.innerHTML = '';
  if (!state.knnSteps) {
    area.innerHTML = '<div class="empty-state"><p>Load recommendations first.</p></div>';
    return;
  }

  const { targetVector, allSimilarities, neighbors, k } = state.knnSteps;
  const contentMap = {};
  state.allContent.forEach(c => { contentMap[c.id] = c; });

  // Step 1: Target vector (bar chart)
  const step1 = document.createElement('div');
  step1.className = 'knn-step active';
  const watchedItems = Object.entries(targetVector).map(([id, r]) => ({
    id: +id, rating: r, ...contentMap[+id]
  }));
  const maxR = 5;
  step1.innerHTML = `
    <div class="knn-step-header">
      <div class="knn-step-num">1</div>
      <div>
        <div class="knn-step-title">📊 Target User Rating Vector</div>
        <div class="knn-step-desc">
          User <strong style="color:var(--purpleL)">${allSimilarities[0]?.userName ? 
          state.users.find(u => u.id === state.currentUser)?.name : 'Alice'}</strong>'s
          watch history is encoded as a sparse rating vector {content_id → rating}.
        </div>
      </div>
    </div>
    <div class="vec-bars">
      ${watchedItems.map(item => `
        <div class="vec-bar-wrap">
          <div class="vec-bar" style="height:${(item.rating/maxR)*100}px;background:${genreColor(item.genre || 'Action')};"></div>
          <div class="vec-bar-label">${(item.title || 'ID:'+item.id).split(':')[0].split(' ').slice(0,2).join(' ')}</div>
          <div class="vec-bar-label" style="color:var(--purpleL);font-weight:700;">★${item.rating}</div>
        </div>`).join('')}
    </div>
    <div style="margin-top:12px;font-size:.78rem;color:var(--txt3);text-align:center;">
      Rating vector dimension: ${watchedItems.length} (sparse out of ${state.allContent.length} total items)
    </div>`;
  area.appendChild(step1);

  // Step 2: Cosine similarity with all users
  const step2 = document.createElement('div');
  step2.className = 'knn-step';
  const sortedSims = [...allSimilarities].sort((a, b) => b.similarity - a.similarity);
  const maxSim = sortedSims[0]?.similarity || 1;
  step2.innerHTML = `
    <div class="knn-step-header">
      <div class="knn-step-num">2</div>
      <div>
        <div class="knn-step-title">📐 Cosine Similarity — All Users</div>
        <div class="knn-step-desc">
          Compute <strong>cosine similarity</strong>: sim(u,v) = (u·v) / (|u|×|v|)
          between the target user and every other user. Higher = more similar taste.
        </div>
      </div>
    </div>
    <div class="sim-list">
      ${sortedSims.map(s => {
        const isNeighbor = neighbors.some(n => n.userId === s.userId);
        return `
          <div class="sim-item">
            <div class="sim-name">${s.userName}</div>
            <div class="sim-bar-wrap">
              <div class="sim-bar ${isNeighbor ? 'neighbor' : 'other'}"
                   style="width:${(s.similarity / maxSim * 100).toFixed(1)}%"></div>
            </div>
            <div class="sim-val" style="color:${isNeighbor ? 'var(--purpleL)' : 'var(--txt3)'}">
              ${(s.similarity * 100).toFixed(0)}%
              ${isNeighbor ? '🎯' : ''}
            </div>
          </div>`;
      }).join('')}
    </div>`;
  area.appendChild(step2);

  // Step 3: Top-k neighbors
  const step3 = document.createElement('div');
  step3.className = 'knn-step';
  step3.innerHTML = `
    <div class="knn-step-header">
      <div class="knn-step-num">3</div>
      <div>
        <div class="knn-step-title">🎯 k=${k} Nearest Neighbours Selected</div>
        <div class="knn-step-desc">
          The top-<strong>k</strong> most similar users are selected as neighbours.
          Their unwatched items are candidates for recommendation.
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-top:4px;">
      ${neighbors.map((n, i) => `
        <div style="background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.3);border-radius:12px;padding:14px;text-align:center;">
          <div class="user-avatar" style="margin:0 auto 8px;width:36px;height:36px;font-size:.9rem;">${n.userName[0]}</div>
          <div style="font-size:.85rem;font-weight:700;">${n.userName}</div>
          <div style="font-size:.75rem;color:var(--purpleL);margin-top:4px;">
            #${i+1} · ${(n.similarity * 100).toFixed(0)}% similar
          </div>
        </div>`).join('')}
    </div>`;
  area.appendChild(step3);

  // Step 4: Weighted aggregation → recommendations
  const step4 = document.createElement('div');
  step4.className = 'knn-step';
  const topRecs = state.recommendations.slice(0, 5);
  step4.innerHTML = `
    <div class="knn-step-header">
      <div class="knn-step-num">4</div>
      <div>
        <div class="knn-step-title">⚖️ Weighted Aggregation → Recommendations</div>
        <div class="knn-step-desc">
          score(item) = Σ <em>sim(target, neighbour<sub>i</sub>)</em> × <em>rating<sub>i</sub></em>
          — items the target hasn't watched are ranked by this weighted score.
        </div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">
      ${topRecs.map((r, i) => `
        <div style="display:flex;align-items:center;gap:12px;background:var(--bg);border-radius:10px;padding:10px 14px;border:1px solid var(--border);">
          <div style="font-size:1.1rem;font-weight:800;color:var(--purple);width:24px;">#${i+1}</div>
          <div class="user-avatar" style="border-radius:8px;width:36px;height:36px;background:${genreColor(r.genre)};font-size:.6rem;font-weight:700;display:flex;align-items:center;justify-content:center;">${r.genre.slice(0,3)}</div>
          <div style="flex:1">
            <div style="font-size:.88rem;font-weight:700;">${r.title}</div>
            <div style="font-size:.75rem;color:var(--txt2);">${r.reason}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:.82rem;font-weight:700;color:var(--purpleL);">Score: ${r.score}</div>
            <div style="font-size:.72rem;color:var(--goldL);">${r.matchPct}% match</div>
          </div>
        </div>`).join('')}
    </div>`;
  area.appendChild(step4);
}

// ═══════════════════════════════════════════════════════════════
// ── VISUALIZATION 4: System Pipeline ──────────────────────────
// ═══════════════════════════════════════════════════════════════
function renderPipelineViz() {
  const area = $('pipelineArea');
  const nodes = [
    { icon:'🎬', lang:'OOPJ', langClass:'lang-java', label:'Content & User Models',
      desc:'Java defines Content, User, WatchRecord with encapsulation & OOP design' },
    { icon:'🔗', lang:'DMGT', langClass:'lang-java', label:'Genre Equivalence Classes',
      desc:'Union-Find groups genres: Action≡Thriller, Drama≡Romance, Sci-Fi≡Horror' },
    { icon:'🕸', lang:'ADSA', langClass:'lang-java', label:'Co-Watch Graph',
      desc:'Weighted adjacency list: items co-watched by same user share an edge' },
    { icon:'📊', lang:'Python', langClass:'lang-python', label:'k-NN Collaborative Filter',
      desc:'Cosine similarity → top-k neighbours → weighted aggregation of ratings' },
    { icon:'✨', lang:'JS/HTML', langClass:'lang-js', label:'Personalised UI',
      desc:'Recommendations shown with reasons, match % and visualizations' },
  ];

  let html = '<div class="pipeline">';
  nodes.forEach((n, i) => {
    html += `<div class="pipe-node" style="animation:fadeIn 0.4s ease ${i*0.12}s both;">
      <div class="pipe-icon">${n.icon}</div>
      <div class="pipe-lang ${n.langClass}">${n.lang}</div>
      <div class="pipe-label">${n.label}</div>
      <div class="pipe-desc">${n.desc}</div>
    </div>`;
    if (i < nodes.length - 1) {
      html += `<div class="pipe-arrow">→</div>`;
    }
  });
  html += '</div>';

  // Data flow diagram
  html += `<div style="background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:20px;margin-top:16px;">
    <div style="font-size:.85rem;font-weight:700;margin-bottom:12px;color:var(--txt2);">Data Flow</div>
    <div style="display:flex;flex-direction:column;gap:10px;font-size:.82rem;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="background:rgba(245,158,11,0.15);color:var(--goldL);padding:3px 10px;border-radius:99px;font-size:.75rem;font-weight:700;">Java</span>
        <span style="color:var(--txt2);">Sample viewing records → builds Content/User objects → runs Union-Find → builds co-watch graph → writes <code style="color:var(--purpleL);">processed_data.json</code></span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="background:rgba(20,184,166,0.15);color:var(--teal);padding:3px 10px;border-radius:99px;font-size:.75rem;font-weight:700;">Python</span>
        <span style="color:var(--txt2);">Loads <code style="color:var(--purpleL);">processed_data.json</code> → computes cosine similarity matrix → selects k neighbours → returns ranked recommendations via REST API</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="background:rgba(99,102,241,0.15);color:#818cf8;padding:3px 10px;border-radius:99px;font-size:.75rem;font-weight:700;">Frontend</span>
        <span style="color:var(--txt2);">Calls <code style="color:var(--purpleL)">/api/recommend</code> → renders personalised "For You" row → shows interactive algorithm visualizations</span>
      </div>
    </div>
  </div>`;

  area.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════
// ── Event Listeners ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function initEvents() {
  // Mobile Menu Toggle
  const mobileMenuBtn = $('mobileMenuBtn');
  const navLinks = $('navLinks');
  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
    // Close menu when a link is clicked
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
      });
    });
  }

  // Navbar scroll
  window.addEventListener('scroll', () => {
    $('navbar').classList.toggle('scrolled', window.scrollY > 20);
  });

  // Search
  $('searchToggle').addEventListener('click', () => {
    $('searchWrap').classList.toggle('open');
    if ($('searchWrap').classList.contains('open')) {
      setTimeout(() => $('searchInput').focus(), 310);
    }
  });
  $('searchInput').addEventListener('input', e => {
    state.searchQuery = e.target.value.trim();
    renderBrowseGrid();
    if (state.searchQuery) {
      document.getElementById('browse').scrollIntoView({ behavior:'smooth', block:'start' });
    }
  });

  // k selector
  $('kSelect').addEventListener('change', async e => {
    state.k = parseInt(e.target.value);
    showLoader();
    await fetchRecommendations();
    state.vizInited.knn = false;
    renderPage();
    if (state.activeVTab === 'knn') { state.vizInited.knn = true; renderKNNViz(); }
    hideLoader();
  });

  // User dropdown toggle
  $('userSelBtn').addEventListener('click', e => {
    e.stopPropagation();
    renderUserDropdown();
    toggleDropdown();
  });
  document.addEventListener('click', e => {
    if (!$('userWrap').contains(e.target)) toggleDropdown(false);
  });

  // Algo button → scroll to section
  $('btnAlgo').addEventListener('click', () => {
    $('algo-section').scrollIntoView({ behavior:'smooth', block:'start' });
  });

  // k-NN link in For You header
  $('knnLink').addEventListener('click', () => {
    $('algo-section').scrollIntoView({ behavior:'smooth', block:'start' });
    // Activate k-NN tab
    setTimeout(() => {
      document.querySelector('[data-vtab="knn"]').click();
    }, 600);
  });

  // Modal close
  $('modalClose').addEventListener('click', () => {
    $('modalOverlay').classList.remove('open');
  });
  $('modalOverlay').addEventListener('click', e => {
    if (e.target === $('modalOverlay')) $('modalOverlay').classList.remove('open');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      $('modalOverlay').classList.remove('open');
      toggleDropdown(false);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// ── App Init ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
async function init() {
  showLoader();
  try {
    await fetchAll();
    await fetchRecommendations();
    initEvents();
    initInlineVizTabs();
    renderPage();
    // Auto-render the first active viz tab (genres)
    state.vizInited.genres = true;
    setTimeout(() => renderGenreViz(), 200);
  } catch (err) {
    console.error('Init error:', err);
    $('loader').innerHTML = `<div style="color:#f43f5e;text-align:center;padding:20px;">
      <div style="font-size:2rem;margin-bottom:10px;">⚠️</div>
      <div>Could not connect to server.</div>
      <div style="font-size:.8rem;margin-top:8px;color:#9ca3af;">Make sure Python server is running: <code>python app.py</code></div>
    </div>`;
    return;
  }
  hideLoader();
}

document.addEventListener('DOMContentLoaded', init);
