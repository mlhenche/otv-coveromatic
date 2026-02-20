    // ============================================
    // OTV CoverOmatic 3.0 — Plugin UI Logic
    // ============================================

    // -- State --
    let apiKey = '';
    let currentCategory = 'movie';   // movie | tv | person
    let currentQuery = '';
    let currentResults = [];
    let selectionCount = 0;
    let coverCount = 0;
    let componentType = 'unknown';   // card-portrait | card-landscape | vps | unknown
    let currentGenreId = null;       // null = all genres
    let genresCache = {};            // { movie: [...], tv: [...] }
    let apiLog = [];                 // API log entries

    // -- OTV catalog state --
    let otvCatalog = null;           // Full catalog object
    let otvMovies = [];              // Filtered: movies only
    let otvSeries = [];              // Filtered: series only
    let filteredCatalog = [];        // Current filtered results (before random selection)
    const ITEMS_PER_PAGE = 25;       // Number of random items to show

    // -- Episode/Chapter state --
    let chapterCardCount = 0;              // Number of card_chapters in selection
    let seasonPickerEntry = null;          // OTV entry being used for season picker
    let seasonPickerSeasons = [];          // Seasons array from TMDB
    let seasonPickerEpisodes = [];         // Episodes array from selected season

    // -- VPS Next Step Dialog state --
    let vpsCurrentEntry = null;            // Current VPS entry for persistent dialog

    // -- Person search by content state --
    let personSearchMode = 'by-name';     // 'by-name' | 'by-content'
    let contentAutocomplete = [];         // Autocomplete results
    let selectedContent = null;           // { id, title, media_type }
    let autocompleteTimer = null;         // Debounce timer

    const IMAGE_BASE = 'https://image.tmdb.org/t/p/';
    const API_BASE = 'https://api.themoviedb.org/3';
    const OTV_BASE = 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod';

    // -- Supabase configuration (v3) --
    const SUPABASE_URL = 'https://zmzehngquxtqirpjxyhn.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptemVobmdxdXh0cWlycGp4eWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MjU3ODksImV4cCI6MjA4NzEwMTc4OX0.aE19KXi3m0WjmZpxRyLNyETDVI5sAyg0JfLNOe_c4Aw';
    const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

    // -- REMOVED: Embedded OTV catalog is now in Supabase --
    // To reduce plugin size and enable dynamic updates, catalog now loads from Supabase
    // Catalog now loaded from Supabase (removed ~50KB of embedded JSON)
    // URL patterns are fetched from Supabase config table

    // -- Supabase helper --
    async function sbFetch(endpoint) {
      const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Supabase error ${response.status}: ${await response.text()}`);
      }

      return response.json();
    }

    // -- Load OTV catalog from Supabase --
    async function loadOTVCatalog() {
      try {
        console.log('Loading OTV catalog from Supabase...');

        // Fetch contents and genres in parallel
        const [contents, genres, config] = await Promise.all([
          sbFetch('contents?active=eq.true&select=title,content_id,media_type,tmdb_id,tmdb_title,genre_ids,provider'),
          sbFetch('genres?select=id,name'),
          sbFetch('config?key=eq.url_patterns&select=value')
        ]);

        // Build genre names map
        const genreNames = {};
        genres.forEach(g => {
          genreNames[g.id] = g.name;
        });

        // Transform to match expected format (camelCase properties)
        const catalog = {};
        contents.forEach(c => {
          const key = c.title.toLowerCase().replace(/[^a-z0-9]/g, '');
          catalog[key] = {
            title: c.title,
            contentId: c.content_id,
            mediaType: c.media_type,
            tmdbId: c.tmdb_id,
            tmdbTitle: c.tmdb_title,
            genreIds: c.genre_ids || []
          };
        });

        // Get URL patterns from config or use defaults
        const urlPatterns = config[0]?.value || {
          coverArt: 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/COVER_ART/{contentId}_COVER_ART.jpg?width=3840&height=2160',
          vertical: 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/VERTICAL/{contentId}_VERTICAL.jpg?width=3840&height=2160',
          background: 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/BACKGROUND/{contentId}_BACKGROUND.jpg?width=3840&height=2160',
          titleTreatment: 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/TITLE_TREATMENT/{contentId}_title_treatment.png?width=1280&height=720'
        };

        // Build catalog object matching expected structure
        otvCatalog = {
          generatedAt: new Date().toISOString(),
          source: 'Supabase',
          totalContents: contents.length,
          urlPatterns,
          catalog,
          genreNames
        };

        // Filter into movies and series
        const entries = Object.values(catalog);
        otvMovies = entries.filter(e => e.mediaType === 'movie');
        otvSeries = entries.filter(e => e.mediaType === 'tv');

        console.log(`OTV catalog loaded from Supabase: ${otvMovies.length} movies, ${otvSeries.length} series`);

        // Save to cache via code.ts
        parent.postMessage({
          pluginMessage: {
            type: 'cache-catalog',
            data: otvCatalog
          }
        }, '*');

        // Render UI if we're on an OTV tab (movie or tv)
        if (currentCategory === 'movie' || currentCategory === 'tv') {
          loadGenres(currentCategory);
          loadContent();
        }

        return true;
      } catch (error) {
        console.error('Error loading catalog from Supabase:', error);

        // Try to load from cache via code.ts
        console.log('Attempting to load from cache...');
        parent.postMessage({
          pluginMessage: {
            type: 'get-cached-catalog'
          }
        }, '*');

        return false;
      }
    }

    // -- Shuffle array (Fisher-Yates algorithm) --
    function shuffleArray(array) {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    // -- API Log: fetch wrapper --
    async function tmdbFetch(url) {
      const maskedUrl = url.replace(/api_key=[^&]+/, 'api_key=***');
      const startTime = performance.now();
      const entry = {
        timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false }),
        url: maskedUrl,
        status: null,
        statusText: '',
        duration: 0,
        responsePreview: '',
        success: false
      };

      try {
        const response = await fetch(url);
        entry.duration = Math.round(performance.now() - startTime);
        entry.status = response.status;
        entry.statusText = response.statusText;
        entry.success = response.ok;

        // Clone to read body for log while returning original
        const cloned = response.clone();
        try {
          const body = await cloned.json();
          // Summarize response
          const summary = {};
          if (body.total_results !== undefined) summary.total_results = body.total_results;
          if (body.total_pages !== undefined) summary.total_pages = body.total_pages;
          if (body.results) summary.results_count = body.results.length;
          if (body.id) summary.id = body.id;
          if (body.title) summary.title = body.title;
          if (body.name) summary.name = body.name;
          if (body.genres) summary.genres = body.genres.length;
          if (body.status_message) summary.status_message = body.status_message;
          entry.responsePreview = JSON.stringify(summary, null, 2);
        } catch (_) {
          entry.responsePreview = '(no se pudo leer el body)';
        }

        addLogEntry(entry);
        return response;
      } catch (err) {
        entry.duration = Math.round(performance.now() - startTime);
        entry.status = 'ERR';
        entry.statusText = err.message;
        entry.success = false;
        entry.responsePreview = err.stack || err.message;
        addLogEntry(entry);
        throw err;
      }
    }

    function addLogEntry(entry) {
      apiLog.unshift(entry);
      if (apiLog.length > 100) apiLog.pop();
      renderLog();
    }

    function renderLog() {
      const container = document.getElementById('logEntries');
      const empty = document.getElementById('logEmpty');
      if (!container) return;

      if (apiLog.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
      }
      empty.classList.add('hidden');

      container.innerHTML = apiLog.map((e, i) => `
        <div class="log-entry ${e.success ? 'success' : 'error'}" onclick="this.classList.toggle('expanded')">
          <div class="log-entry-header">
            <span class="log-entry-status ${e.success ? 'ok' : 'fail'}">${e.status} ${e.statusText}</span>
            <span class="log-entry-time">${e.timestamp}</span>
          </div>
          <div class="log-entry-url">${escapeHtml(e.url)}</div>
          <div class="log-entry-duration">${e.duration}ms</div>
          <div class="log-entry-body">${escapeHtml(e.responsePreview)}</div>
        </div>
      `).join('');
    }

    function clearLog() {
      apiLog = [];
      renderLog();
    }

    // -- DOM refs --
    const apiKeySection = document.getElementById('apiKeySection');
    const headerKeyBtn = document.getElementById('headerKeyBtn');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const searchInput = document.getElementById('searchInput');
    const searchClearBtn = document.getElementById('searchClearBtn');
    const gridContainer = document.getElementById('gridContainer');
    const imageGrid = document.getElementById('imageGrid');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const selectionInfo = document.getElementById('selectionInfo');
    const reloadBtn = document.getElementById('reloadBtn');
    const applyingOverlay = document.getElementById('applyingOverlay');
    const btnPortrait = document.getElementById('btnPortrait');
    const btnLandscape = document.getElementById('btnLandscape');
    const genreFilter = document.getElementById('genreFilter');
    const logPanel = document.getElementById('logPanel');
    const randomBar = document.getElementById('randomBar');
    const btnRandom = document.getElementById('btnRandom');

    // -- Init --
    (function init() {
      // Load catalog asynchronously from Supabase
      // If it fails, it will request cached catalog and the 'cached-catalog' handler will decide what to show
      loadOTVCatalog();
      parent.postMessage({ pluginMessage: { type: 'load-api-key' } }, '*');
      parent.postMessage({ pluginMessage: { type: 'get-selection' } }, '*');
      loadContent();
    })();

    // -- API Key --
    function toggleApiKey() {
      apiKeySection.classList.toggle('collapsed');
    }

    function saveApiKey() {
      const key = apiKeyInput.value.trim();
      if (!key) return;
      apiKey = key;
      parent.postMessage({ pluginMessage: { type: 'save-api-key', apiKey: apiKey } }, '*');
      headerKeyBtn.classList.add('connected');
      apiKeySection.classList.add('collapsed');
      currentPage = 1;
      if (currentCategory !== 'person') loadGenres(currentCategory);
      loadContent();
    }

    // -- Tabs --
    function switchTab(category) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelector(`.tab[data-category="${category}"]`).classList.add('active');

      // Log tab — show log panel, hide everything else
      const controlsBar = document.querySelector('.controls-bar');
      if (category === 'log') {
        controlsBar.classList.add('hidden');
        genreFilter.classList.add('hidden');
        randomBar.classList.remove('visible');
        gridContainer.classList.add('hidden');
        logPanel.classList.add('visible');
        document.querySelector('.footer').classList.add('hidden');
        renderLog();
        return;
      }

      // Normal content tabs — hide log, show content
      logPanel.classList.remove('visible');
      controlsBar.classList.remove('hidden');
      gridContainer.classList.remove('hidden');
      document.querySelector('.footer').classList.remove('hidden');

      currentCategory = category;
      currentPage = 1;
      currentQuery = '';
      currentGenreId = null;
      searchInput.value = '';

      const placeholders = {
        movie: 'Buscar películas...',
        tv: 'Buscar series...',
        person: personSearchMode === 'by-content' ? 'Buscar película o serie...' : 'Buscar personas...'
      };
      searchInput.placeholder = placeholders[category] || 'Buscar...';

      // Toggle UI elements based on category
      const btnRandomIcon = document.querySelector('#btnRandom .icon');
      const btnRandomLabel = document.querySelector('#btnRandom span:last-child');
      if (category === 'person') {
        genreFilter.classList.add('hidden');
        document.getElementById('personSearchModeToggle').classList.remove('hidden');
        if (btnRandomIcon) btnRandomIcon.textContent = '🎬';
        if (btnRandomLabel) btnRandomLabel.textContent = 'Añadir reparto';
      } else {
        genreFilter.classList.remove('hidden');
        loadGenres(category);
        document.getElementById('personSearchModeToggle').classList.add('hidden');
        // Reset person search state when leaving Personas tab
        resetPersonSearchState();
        if (btnRandomIcon) btnRandomIcon.textContent = '🎲';
        if (btnRandomLabel) btnRandomLabel.textContent = 'Contenido aleatorio';
      }

      loadContent();
    }

    // -- Genres --
    async function loadGenres(category) {
      // For movie/tv: extract genres from OTV catalog
      if (category === 'movie' || category === 'tv') {
        if (!otvCatalog) return;

        // Use cache if available
        if (genresCache[category]) {
          renderGenres(genresCache[category]);
          return;
        }

        // Extract unique genre IDs from catalog
        const source = category === 'movie' ? otvMovies : otvSeries;
        const genreSet = new Set();
        source.forEach(e => {
          (e.genreIds || []).forEach(id => genreSet.add(id));
        });

        // Build genre list with names from catalog
        const genres = Array.from(genreSet)
          .map(id => ({ id, name: otvCatalog.genreNames[id] }))
          .filter(g => g.name)
          .sort((a, b) => a.name.localeCompare(b.name));

        genresCache[category] = genres;
        renderGenres(genres);
        return;
      }

      // For person: no genres
      return;
    }

    function renderGenres(genres) {
      const dropdown = document.getElementById('genreDropdown');
      dropdown.innerHTML = '';

      const allOpt = document.createElement('button');
      allOpt.className = 'genre-option' + (currentGenreId === null ? ' active' : '');
      allOpt.textContent = 'Todos';
      allOpt.addEventListener('click', () => selectGenre(null));
      dropdown.appendChild(allOpt);

      for (const genre of genres) {
        const opt = document.createElement('button');
        opt.className = 'genre-option' + (currentGenreId === genre.id ? ' active' : '');
        opt.textContent = genre.name;
        opt.addEventListener('click', () => selectGenre(genre.id));
        dropdown.appendChild(opt);
      }
    }

    function selectGenre(genreId) {
      currentGenreId = genreId;
      currentPage = 1;

      const btn = document.getElementById('genreBtn');
      if (genreId === null) {
        btn.className = 'genre-btn';
        btn.innerHTML = 'Género <span style="font-size:8px">▾</span>';
      } else {
        const name = otvCatalog.genreNames[genreId] || 'Género';
        btn.className = 'genre-btn active';
        btn.innerHTML = name + ' <span class="genre-clear" onclick="event.stopPropagation(); selectGenre(null)">×</span>';
      }

      document.querySelectorAll('.genre-option').forEach(o => o.classList.remove('active'));
      document.getElementById('genreDropdown').classList.remove('open');
      loadContent();
    }

    function toggleGenreDropdown() {
      document.getElementById('genreDropdown').classList.toggle('open');
    }

    document.addEventListener('click', (e) => {
      const filter = document.getElementById('genreFilter');
      if (filter && !filter.contains(e.target)) {
        document.getElementById('genreDropdown').classList.remove('open');
      }
    });

    // -- Person Search by Content --
    function setPersonSearchMode(mode) {
      personSearchMode = mode;
      document.getElementById('btnByName').classList.toggle('active', mode === 'by-name');
      document.getElementById('btnByContent').classList.toggle('active', mode === 'by-content');

      // Reset state
      clearSelectedContent();
      searchInput.value = '';
      currentQuery = '';
      currentPage = 1;
      hideAutocomplete();

      // Update placeholder
      if (mode === 'by-content') {
        searchInput.placeholder = 'Buscar película o serie...';
      } else {
        searchInput.placeholder = 'Buscar personas...';
      }

      loadContent();
    }

    function resetPersonSearchState() {
      personSearchMode = 'by-name';
      selectedContent = null;
      contentAutocomplete = [];
      document.getElementById('btnByName').classList.add('active');
      document.getElementById('btnByContent').classList.remove('active');
      document.getElementById('contentContextBar').classList.add('hidden');
      hideAutocomplete();
    }

    async function loadContentAutocomplete(query) {
      if (!apiKey) return;

      const dropdown = document.getElementById('autocompleteDropdown');
      dropdown.classList.remove('hidden');
      dropdown.innerHTML = '<div class="autocomplete-loading"><div class="spinner"></div>Buscando...</div>';

      try {
        const url = `${API_BASE}/search/multi?api_key=${apiKey}&language=es-ES&query=${encodeURIComponent(query)}&page=1`;
        const response = await tmdbFetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        // Filter only movies and tv shows
        contentAutocomplete = (data.results || [])
          .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
          .slice(0, 10);

        renderAutocomplete();
      } catch (err) {
        console.error('Autocomplete error:', err);
        dropdown.innerHTML = '<div class="autocomplete-empty">Error al buscar contenido</div>';
      }
    }

    function renderAutocomplete() {
      const dropdown = document.getElementById('autocompleteDropdown');

      if (contentAutocomplete.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-empty">No se encontraron películas ni series</div>';
        return;
      }

      dropdown.innerHTML = '';
      for (const item of contentAutocomplete) {
        const title = item.title || item.name || 'Sin título';
        const date = item.release_date || item.first_air_date || '';
        const year = date ? date.substring(0, 4) : '';
        const typeLabel = item.media_type === 'movie' ? 'Película' : 'Serie';
        const posterPath = item.poster_path;

        const div = document.createElement('div');
        div.className = 'autocomplete-item';

        const posterHtml = posterPath
          ? `<img class="autocomplete-item-poster" src="${IMAGE_BASE}w92${posterPath}" alt="" />`
          : `<div class="autocomplete-item-poster"></div>`;

        div.innerHTML = `
          ${posterHtml}
          <div class="autocomplete-item-info">
            <div class="autocomplete-item-title">${escapeHtml(title)}</div>
            <div class="autocomplete-item-meta">${typeLabel}${year ? ' · ' + year : ''}</div>
          </div>
        `;

        div.addEventListener('click', () => selectContentItem(item.id, title, item.media_type));
        dropdown.appendChild(div);
      }
    }

    function hideAutocomplete() {
      const dropdown = document.getElementById('autocompleteDropdown');
      dropdown.classList.add('hidden');
      dropdown.innerHTML = '';
      contentAutocomplete = [];
    }

    function selectContentItem(id, title, mediaType) {
      selectedContent = { id, title, media_type: mediaType };
      hideAutocomplete();

      // Show context bar
      const contextBar = document.getElementById('contentContextBar');
      document.getElementById('contextTitle').textContent = title;
      contextBar.classList.remove('hidden');

      // Clear search input
      searchInput.value = '';
      searchInput.placeholder = 'Buscar película o serie...';

      // Load credits
      loadContentCredits(id, mediaType);
    }

    async function loadContentCredits(contentId, mediaType, contentTitle = null) {
      if (!apiKey) return;

      showLoading();

      let finalId = contentId;

      // VALIDACIÓN: Si no hay ID, intentar fallback por título
      if (!contentId || contentId === 'undefined' || contentId === 'null') {
        if (!contentTitle) {
          showEmpty('⚠️', 'No se pudo cargar el reparto:\nFalta información de identificación');
          return;
        }

        // FALLBACK: Buscar por título
        try {
          console.log(`[FALLBACK] Buscando "${contentTitle}" en TMDB...`);
          const searchUrl = `${API_BASE}/search/multi?api_key=${apiKey}&language=es-ES&query=${encodeURIComponent(contentTitle)}`;
          const searchResponse = await tmdbFetch(searchUrl);
          if (!searchResponse.ok) throw new Error(`HTTP ${searchResponse.status}`);

          const searchData = await searchResponse.json();

          if (searchData.results && searchData.results.length > 0) {
            // Filtrar solo resultados que coincidan con el mediaType (movie o tv)
            const matchingResult = searchData.results.find(r => r.media_type === mediaType);

            if (matchingResult) {
              finalId = matchingResult.id;
              console.log(`[FALLBACK] ID encontrado para "${contentTitle}": ${finalId}`);
            } else {
              showEmpty('🔍', `No se encontró "${contentTitle}" en TMDB`);
              return;
            }
          } else {
            showEmpty('🔍', `No se encontró "${contentTitle}" en TMDB`);
            return;
          }
        } catch (error) {
          console.error('[FALLBACK ERROR]', error);
          showEmpty('⚠️', `Error al buscar el contenido en TMDB:\n${error.message}`);
          return;
        }
      }

      try {
        const url = `${API_BASE}/${mediaType}/${finalId}/credits?api_key=${apiKey}&language=es-ES`;
        const response = await tmdbFetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        const castAll = (data.cast || []).filter(p => p.profile_path);
        const crewAll = (data.crew || []).filter(p => p.profile_path);

        // Order: Director → Writer/Screenplay → rest of cast (deduplicated)
        const director = crewAll.find(c => c.job === 'Director');
        const writers = crewAll.filter(c => c.job === 'Screenplay' || c.job === 'Writer');

        const seen = new Set();
        const people = [];
        if (director) { seen.add(director.id); people.push(director); }
        for (const w of writers) {
          if (!seen.has(w.id)) { seen.add(w.id); people.push(w); }
        }
        for (const c of castAll) {
          if (!seen.has(c.id)) { seen.add(c.id); people.push(c); }
        }

        if (people.length === 0) {
          showEmpty('👤', 'No se encontraron personas con foto para este contenido');
          return;
        }

        // Map to the format expected by renderGrid
        currentResults = people.map(p => ({
          id: p.id,
          name: p.name,
          profile_path: p.profile_path,
          known_for_department: p.known_for_department || (p.job ? 'Crew' : 'Acting'),
          character: p.character || p.job || ''
        }));
        totalPages = 1;
        currentPage = 1;

        renderGrid();
      } catch (err) {
        console.error('Credits fetch error:', err);
        showEmpty('⚠️', `Error al cargar créditos:\n${err.message}`);
      }
    }

    function clearSelectedContent() {
      selectedContent = null;
      document.getElementById('contentContextBar').classList.add('hidden');
      document.getElementById('contextTitle').textContent = '';
      searchInput.value = '';
      currentQuery = '';
      currentPage = 1;

      if (currentCategory === 'person') {
        if (personSearchMode === 'by-content') {
          searchInput.placeholder = 'Buscar película o serie...';
        } else {
          searchInput.placeholder = 'Buscar personas...';
        }
        loadContent();
      }
    }

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('autocompleteDropdown');
      const searchWrapper = document.querySelector('.search-input-wrapper');
      if (!searchWrapper.contains(e.target)) {
        hideAutocomplete();
      }
    });

    // -- Search --
    let searchTimeout = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      const query = searchInput.value.trim();

      // In person-by-content mode, show autocomplete instead of searching persons
      if (currentCategory === 'person' && personSearchMode === 'by-content') {
        clearTimeout(autocompleteTimer);
        if (query.length >= 3) {
          autocompleteTimer = setTimeout(() => loadContentAutocomplete(query), 300);
        } else {
          hideAutocomplete();
        }
        return;
      }

      searchTimeout = setTimeout(() => {
        currentQuery = query;
        currentPage = 1;
        loadContent();
      }, 400);

      // Toggle clear button visibility
      searchClearBtn.classList.toggle('visible', query.length > 0);
    });

    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchClearBtn.classList.remove('visible');
      searchInput.focus();
      searchInput.dispatchEvent(new Event('input'));
    });

    // -- Load Content --
    async function loadContent() {
      // For movie/tv tabs: use OTV catalog
      if (currentCategory === 'movie' || currentCategory === 'tv') {
        renderCatalog();
        return;
      }

      // For person tab: use TMDB (v1 behavior)
      if (!apiKey) {
        showEmpty('🔑', 'Introduce tu API Key de TMDB para empezar');
        return;
      }

      // If we have a selected content in person-by-content mode, don't reload
      if (selectedContent && currentCategory === 'person' && personSearchMode === 'by-content') {
        return;
      }

      showLoading();

      try {
        let url;
        if (currentQuery) {
          // Search endpoint
          url = `${API_BASE}/search/${currentCategory}?api_key=${apiKey}&language=es-ES&query=${encodeURIComponent(currentQuery)}&page=1`;
        } else {
          // Trending
          url = `${API_BASE}/trending/${currentCategory}/week?api_key=${apiKey}&language=es-ES&page=1`;
        }

        const response = await tmdbFetch(url);
        if (!response.ok) {
          if (response.status === 401) {
            showEmpty('🔑', 'API Key inválida. Haz clic en el icono de llave para revisarla.');
            headerKeyBtn.classList.remove('connected');
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Filter results with profile_path
        let results = data.results || [];
        currentResults = results.filter(item => item.profile_path);

        if (currentResults.length === 0) {
          showEmpty('🎬', 'No se encontraron resultados');
        } else {
          console.log(`Loaded ${currentResults.length} results for ${currentCategory}`);
          renderGrid();
        }
      } catch (err) {
        console.error('TMDB fetch error:', err);
        const errorMsg = err.message || 'Error desconocido';
        showEmpty('⚠️', `Error al conectar con TMDB:\n${errorMsg}\n\nVerifica tu conexión y API Key.`);
      }
    }

    // -- Render OTV Catalog (local filtering) --
    function renderCatalog() {
      if (!otvCatalog) {
        showEmpty('⚠️', 'Catálogo OTV no cargado.');
        return;
      }

      // Get source based on category
      const source = currentCategory === 'movie' ? otvMovies : otvSeries;

      // Filter by query
      let results = source;
      if (currentQuery) {
        const q = normalizeTitle(currentQuery);
        results = results.filter(e => normalizeTitle(e.title).includes(q));
      }

      // Filter by genre
      if (currentGenreId) {
        results = results.filter(e => e.genreIds && e.genreIds.includes(currentGenreId));
      }

      // Save filtered results
      filteredCatalog = results;

      if (filteredCatalog.length === 0) {
        showEmpty('🎬', 'No se encontraron resultados');
      } else {
        // Shuffle and show first 25
        const shuffled = shuffleArray(filteredCatalog);
        currentResults = shuffled.slice(0, ITEMS_PER_PAGE);

        console.log(`Showing ${currentResults.length} of ${filteredCatalog.length} OTV catalog entries`);
        renderGrid();
      }
    }

    // -- Render Grid (OTV catalog or Personas) --
    function renderGrid() {
      imageGrid.innerHTML = '';
      loadingState.classList.add('hidden');
      emptyState.classList.add('hidden');
      imageGrid.classList.remove('hidden');

      // Always portrait for OTV grid (uses VERTICAL thumbnails)
      imageGrid.classList.remove('landscape');

      for (const item of currentResults) {
        // Check if this is OTV catalog entry or TMDB result
        const isOTVEntry = !!item.contentId;

        let imagePath, thumbUrl, title, year;

        if (isOTVEntry) {
          // OTV catalog entry: use VERTICAL for thumbnail
          title = item.title || 'Sin título';
          year = ''; // We'll get year from TMDB metadata when applying
          thumbUrl = `${OTV_BASE}/VERTICAL/${item.contentId}_VERTICAL.jpg?width=3840&height=2160`;
        } else {
          // TMDB result (for Personas tab)
          imagePath = currentCategory === 'person' ? item.profile_path : item.poster_path;
          title = item.title || item.name || 'Sin título';
          const date = item.release_date || item.first_air_date || '';
          year = date ? date.substring(0, 4) : '';
          thumbUrl = imagePath ? `${IMAGE_BASE}w342${imagePath}` : null;
        }

        const div = document.createElement('div');

        if (thumbUrl) {
          div.className = 'grid-item';
          const isSeries = isOTVEntry && item.mediaType === 'tv';

          if (isSeries) {
            // Series: show dual buttons on hover (Datos + Temporadas)
            div.innerHTML = `
              <img src="${thumbUrl}" alt="${escapeHtml(title)}"
                   onload="this.classList.add('loaded')"
                   onerror="this.parentElement.classList.add('no-image'); this.style.display='none'; this.parentElement.innerHTML='<span>Error al cargar imagen</span>';" />
              <div class="overlay overlay-series">
                <div class="overlay-title">${escapeHtml(title)}</div>
                <div class="overlay-buttons">
                  <button class="overlay-btn overlay-btn-datos">Serie</button>
                  <button class="overlay-btn overlay-btn-temporadas">Capit.</button>
                </div>
              </div>
            `;
            div.querySelector('.overlay-btn-datos').addEventListener('click', (e) => {
              e.stopPropagation();
              applyOTVContent(item);
            });
            div.querySelector('.overlay-btn-temporadas').addEventListener('click', (e) => {
              e.stopPropagation();
              openSeasonPicker(item);
            });
          } else {
            div.innerHTML = `
              <img src="${thumbUrl}" alt="${escapeHtml(title)}"
                   onload="this.classList.add('loaded')"
                   onerror="this.parentElement.classList.add('no-image'); this.style.display='none'; this.parentElement.innerHTML='<span>Error al cargar imagen</span>';" />
              <div class="overlay">
                <div class="overlay-title">${escapeHtml(title)}</div>
                ${year ? `<div class="overlay-year">${year}</div>` : ''}
              </div>
            `;

            if (isOTVEntry) {
              div.addEventListener('click', () => applyOTVContent(item));
            } else {
              // Personas: use v1 logic
              const fullUrl = `${IMAGE_BASE}original${imagePath}`;
              div.addEventListener('click', () => applyImage(fullUrl, item));
            }
          }
        } else {
          div.className = 'grid-item no-image';
          div.innerHTML = `<span>${escapeHtml(title)}</span>`;
        }

        imageGrid.appendChild(div);
      }

      // Enable reload button for movie/tv (random reload), disable for empty results
      const isOTVCatalog = currentCategory === 'movie' || currentCategory === 'tv';
      reloadBtn.disabled = isOTVCatalog ? false : (currentResults.length === 0);
      updateSelectionInfo(); // Update random button visibility
    }

    // -- Fetch detail (with age certification via append_to_response) --
    async function fetchDetail(id) {
      const append = currentCategory === 'movie' ? 'release_dates' : 'content_ratings';
      const detailUrl = `${API_BASE}/${currentCategory}/${id}?api_key=${apiKey}&language=es-ES&append_to_response=${append}`;
      const res = await tmdbFetch(detailUrl);
      if (!res.ok) return null;
      return await res.json();
    }

    // -- Extract Spanish age certification from detail response --
    const AGE_RATING_MAP = { 'A': 'TP', '7': '7', '12': '12', '16': '16', '18': '18' };

    function extractAgeRating(detail) {
      let certification = '';

      if (currentCategory === 'movie' && detail.release_dates) {
        const esRelease = detail.release_dates.results.find(r => r.iso_3166_1 === 'ES');
        if (esRelease) {
          const entry = esRelease.release_dates.find(rd => rd.certification) || {};
          certification = entry.certification || '';
        }
      } else if (currentCategory === 'tv' && detail.content_ratings) {
        const esRating = detail.content_ratings.results.find(r => r.iso_3166_1 === 'ES');
        if (esRating) {
          certification = esRating.rating || '';
        }
      }

      return AGE_RATING_MAP[certification] || '';
    }

    // -- Map TMDB department to Spanish role label --
    const DEPARTMENT_MAP = {
      'Directing': 'Director/a',
      'Writing': 'Guionista',
      'Production': 'Productor/a',
      'Editing': 'Editor/a',
      'Camera': 'Director/a de fotografía',
      'Sound': 'Sonido',
      'Art': 'Dirección de arte',
      'Costume & Make-Up': 'Vestuario y maquillaje',
      'Visual Effects': 'Efectos visuales',
      'Crew': 'Equipo técnico',
      'Lighting': 'Iluminación',
    };

    // -- Format duration --
    function formatDuration(minutes) {
      if (!minutes || minutes <= 0) return '';
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      if (h === 0) return `${m}min`;
      return `${h}h ${m}min`;
    }

    // -- Fetch OTV metadata from TMDB --
    async function fetchOTVMetadata(entry) {
      if (!entry.tmdbId) {
        return {
          title: entry.title,
          rating: '',
          year: '',
          duration: '',
          ageRating: '',
          sinopsis: '',
          genres: [],
          contentId: entry.contentId
        };
      }

      const type = entry.mediaType || 'movie';
      const append = type === 'movie' ? 'release_dates' : 'content_ratings';
      const detailUrl = `${API_BASE}/${type}/${entry.tmdbId}?api_key=${apiKey}&language=es-ES&append_to_response=${append}`;

      const res = await tmdbFetch(detailUrl);
      if (!res.ok) {
        return {
          title: entry.title,
          rating: '',
          year: '',
          duration: '',
          ageRating: '',
          sinopsis: '',
          genres: [],
          contentId: entry.contentId
        };
      }

      const detail = await res.json();

      // Extract metadata (same as v1)
      const title = detail.title || detail.name || entry.title;
      const rating = detail.vote_average ? detail.vote_average.toFixed(1) : '';
      const year = detail.release_date || detail.first_air_date ?
                   (detail.release_date || detail.first_air_date).substring(0, 4) : '';

      let duration = '';
      if (type === 'movie') {
        duration = formatDuration(detail.runtime);
      } else {
        const n = detail.number_of_seasons;
        if (n) duration = `${n} temporada${n === 1 ? '' : 's'}`;
      }

      const ageRating = extractAgeRating(detail);
      const sinopsis = detail.overview || '';

      // Convert genreIds to genre names (max 3)
      const genres = (entry.genreIds || [])
        .slice(0, 3)
        .map(id => otvCatalog.genreNames[id])
        .filter(Boolean);

      return { title, rating, year, duration, ageRating, sinopsis, genres, contentId: entry.contentId };
    }

    // -- Fetch seasons for a TV series from TMDB --
    async function fetchSeasons(tmdbId) {
      const url = `${API_BASE}/tv/${tmdbId}?api_key=${apiKey}&language=es-ES`;
      const res = await tmdbFetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.seasons || []).filter(s => s.season_number > 0);
    }

    // -- Fetch episodes for a specific season from TMDB --
    async function fetchEpisodes(tmdbId, seasonNumber) {
      const url = `${API_BASE}/tv/${tmdbId}/season/${seasonNumber}?api_key=${apiKey}&language=es-ES`;
      const res = await tmdbFetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      // Filter out special episodes (episode_number 0) and sort by episode number
      return (data.episodes || [])
        .filter(ep => ep.episode_number > 0)
        .sort((a, b) => a.episode_number - b.episode_number);
    }

    // -- Format episode chapter string (T01 E03) --
    function formatChapter(seasonNumber, episodeNumber) {
      const s = String(seasonNumber).padStart(2, '0');
      const e = String(episodeNumber).padStart(2, '0');
      return `T${s} E${e}`;
    }

    // -- Build episode still URL from TMDB --
    function episodeStillUrl(stillPath) {
      if (!stillPath) return null;
      return `https://image.tmdb.org/t/p/w780${stillPath}`;
    }

    // -- Image type picker: shows overlay and resolves with user's choice --
    let _resolveTypePicker = null;

    function pickImageType() {
      return new Promise((resolve) => {
        _resolveTypePicker = resolve;
        document.getElementById('typePickerOverlay').classList.remove('hidden');
      });
    }

    document.getElementById('btnPickPortrait').addEventListener('click', () => {
      document.getElementById('typePickerOverlay').classList.add('hidden');
      if (_resolveTypePicker) { _resolveTypePicker('card-portrait'); _resolveTypePicker = null; }
    });
    document.getElementById('btnPickLandscape').addEventListener('click', () => {
      document.getElementById('typePickerOverlay').classList.add('hidden');
      if (_resolveTypePicker) { _resolveTypePicker('card-landscape'); _resolveTypePicker = null; }
    });
    document.getElementById('btnPickBackground').addEventListener('click', () => {
      document.getElementById('typePickerOverlay').classList.add('hidden');
      if (_resolveTypePicker) { _resolveTypePicker('vps'); _resolveTypePicker = null; }
    });
    document.getElementById('btnPickCancel').addEventListener('click', () => {
      document.getElementById('typePickerOverlay').classList.add('hidden');
      if (_resolveTypePicker) { _resolveTypePicker(null); _resolveTypePicker = null; }
    });

    // -- Apply OTV content --
    async function applyOTVContent(entry) {
      if (coverCount === 0) {
        alert('No hay frames "cover" en la selección actual.\n\nSelecciona componentes que contengan un frame llamado "cover".');
        return;
      }

      applyingOverlay.classList.remove('hidden');

      try {
        // 1. Resolve the image type (detected or user-chosen)
        let typeToUse = componentType;
        if (typeToUse === 'unknown') {
          typeToUse = await pickImageType();
          if (!typeToUse) {
            applyingOverlay.classList.add('hidden');
            return; // user cancelled
          }
        }

        // 2. Build the URL for the resolved type
        let coverUrl, titleTreatmentUrl;
        switch (typeToUse) {
          case 'card-portrait':
            coverUrl = `${OTV_BASE}/VERTICAL/${entry.contentId}_VERTICAL.jpg?width=3840&height=2160`;
            break;
          case 'card-landscape':
            coverUrl = `${OTV_BASE}/COVER_ART/${entry.contentId}_COVER_ART.jpg?width=3840&height=2160`;
            break;
          case 'slideshow':
          case 'vps':
            coverUrl = `${OTV_BASE}/BACKGROUND/${entry.contentId}_BACKGROUND.jpg?width=3840&height=2160`;
            titleTreatmentUrl = `${OTV_BASE}/TITLE_TREATMENT/${entry.contentId}_title_treatment.png?width=1280&height=720`;
            break;
          default:
            coverUrl = `${OTV_BASE}/VERTICAL/${entry.contentId}_VERTICAL.jpg?width=3840&height=2160`;
        }

        // 3. Fetch metadata from TMDB (using tmdbId)
        const metadata = await fetchOTVMetadata(entry);

        // 4. Send to sandbox
        parent.postMessage({
          pluginMessage: {
            type: 'apply-cover-url',
            coverUrl,
            titleTreatmentUrl: titleTreatmentUrl || null,
            metadata: metadata
          }
        }, '*');

        setTimeout(() => {
          applyingOverlay.classList.add('hidden');
        }, 800);

        // 4. If VPS → show next step dialog
        if (typeToUse === 'vps' && entry.tmdbId) {
          // Clear previous VPS entry if different
          if (vpsCurrentEntry && vpsCurrentEntry.contentId !== entry.contentId) {
            vpsCurrentEntry = null;
            hideVPSNextDialog();
          }

          setTimeout(() => {
            showVPSNextDialog(entry);
          }, 1000);
        }
      } catch (err) {
        console.error('Error applying OTV cover:', err);
        applyingOverlay.classList.add('hidden');
        alert(`Error al aplicar la cover:\n\n${err.message}\n\nInténtalo de nuevo o prueba con otra imagen.`);
      }
    }

    // -- Switch to Personas tab for content --
    function switchToPersonasForContent(entry) {
      // Set state BEFORE switchTab so loadContent()'s guard fires and skips trending load
      personSearchMode = 'by-content';
      selectedContent = { id: entry.tmdbId, title: entry.title, media_type: entry.mediaType };

      switchTab('person'); // loadContent() returns early because selectedContent is already set

      // Sync mode-toggle button states (bypassed setPersonSearchMode to avoid reset)
      document.getElementById('btnByName').classList.remove('active');
      document.getElementById('btnByContent').classList.add('active');
      searchInput.placeholder = 'Buscar película o serie...';

      // Show context bar
      document.getElementById('contentContextBar').classList.remove('hidden');
      document.getElementById('contextTitle').textContent = `Personas de: ${entry.title}`;

      // Load cast/crew in correct order
      loadContentCredits(entry.tmdbId, entry.mediaType, entry.title);
    }

    // -- Season Picker: open, navigate, apply --

    async function openSeasonPicker(entry) {
      if (!entry.tmdbId) {
        alert('Esta serie no tiene ID de TMDB asociado.');
        return;
      }

      seasonPickerEntry = entry;
      seasonPickerEpisodes = [];

      const overlay = document.getElementById('seasonPickerOverlay');
      const content = document.getElementById('seasonPickerContent');
      const title = document.getElementById('seasonPickerTitle');
      const backBtn = document.getElementById('seasonPickerBack');

      overlay.classList.remove('hidden');
      backBtn.classList.add('hidden');
      title.textContent = entry.title;
      content.innerHTML = '<div class="season-picker-loading"><div class="spinner"></div><span>Cargando temporadas...</span></div>';

      const seasons = await fetchSeasons(entry.tmdbId);
      seasonPickerSeasons = seasons;

      if (seasons.length === 0) {
        content.innerHTML = '<div class="season-picker-empty">No se encontraron temporadas</div>';
        return;
      }

      renderSeasonList(seasons);
    }

    function renderSeasonList(seasons) {
      const content = document.getElementById('seasonPickerContent');
      const backBtn = document.getElementById('seasonPickerBack');
      backBtn.classList.add('hidden');
      document.getElementById('seasonPickerTitle').textContent = seasonPickerEntry.title;

      content.innerHTML = seasons.map(s => `
        <button class="season-item" data-season="${s.season_number}">
          <span class="season-name">Temporada ${s.season_number}</span>
          <span class="season-episodes">${s.episode_count} episodios</span>
        </button>
      `).join('');

      content.querySelectorAll('.season-item').forEach(btn => {
        btn.addEventListener('click', () => {
          selectSeason(parseInt(btn.dataset.season));
        });
      });
    }

    async function selectSeason(seasonNumber) {
      const content = document.getElementById('seasonPickerContent');
      const backBtn = document.getElementById('seasonPickerBack');
      const title = document.getElementById('seasonPickerTitle');

      title.textContent = `${seasonPickerEntry.title} — T${String(seasonNumber).padStart(2, '0')}`;
      backBtn.classList.remove('hidden');
      content.innerHTML = '<div class="season-picker-loading"><div class="spinner"></div><span>Cargando episodios...</span></div>';

      const episodes = await fetchEpisodes(seasonPickerEntry.tmdbId, seasonNumber);
      seasonPickerEpisodes = episodes;

      if (episodes.length === 0) {
        content.innerHTML = '<div class="season-picker-empty">No se encontraron episodios</div>';
        return;
      }

      renderEpisodeList(episodes, seasonNumber);
    }

    function renderEpisodeList(episodes, seasonNumber) {
      const content = document.getElementById('seasonPickerContent');

      if (chapterCardCount > 1) {
        // MULTI-CARD: show batch apply button + preview
        const applyCount = Math.min(episodes.length, chapterCardCount);
        content.innerHTML = `
          <div class="episode-batch-info">
            <p>${episodes.length} episodios disponibles</p>
            <p>${chapterCardCount} tarjetas seleccionadas</p>
            <p class="episode-batch-note">Se aplicarán los primeros ${applyCount} episodios en orden.</p>
          </div>
          <button class="btn-apply-episodes" id="btnApplyEpisodesBatch">Añadir capítulos</button>
          <div class="episode-preview-list">
            ${episodes.slice(0, applyCount).map(ep => `
              <div class="episode-preview-item">
                <span class="ep-num">${formatChapter(seasonNumber, ep.episode_number)}</span>
                <span class="ep-name">${escapeHtml(ep.name || 'Sin título')}</span>
              </div>
            `).join('')}
          </div>
        `;
        document.getElementById('btnApplyEpisodesBatch').addEventListener('click', () => {
          applyEpisodesBatch(seasonNumber);
        });
      } else {
        // SINGLE-CARD: show episode list for user to pick one
        content.innerHTML = episodes.map(ep => `
          <button class="episode-item" data-episode="${ep.episode_number}">
            <div class="episode-item-header">
              <span class="ep-num">${formatChapter(seasonNumber, ep.episode_number)}</span>
              <span class="ep-duration">${formatDuration(ep.runtime)}</span>
            </div>
            <span class="ep-name">${escapeHtml(ep.name || 'Sin título')}</span>
          </button>
        `).join('');

        content.querySelectorAll('.episode-item').forEach(btn => {
          btn.addEventListener('click', () => {
            applySingleEpisode(seasonNumber, parseInt(btn.dataset.episode));
          });
        });
      }
    }

    async function applySingleEpisode(seasonNumber, episodeNumber) {
      const episode = seasonPickerEpisodes.find(ep => ep.episode_number === episodeNumber);
      if (!episode) return;

      // Copy entry BEFORE closing picker (which clears this variable)
      const entry = seasonPickerEntry;

      closeSeasonPicker();
      applyingOverlay.classList.remove('hidden');

      try {
        const stillUrl = episodeStillUrl(episode.still_path);
        const coverUrl = stillUrl || `${OTV_BASE}/COVER_ART/${entry.contentId}_COVER_ART.jpg?width=3840&height=2160`;

        parent.postMessage({
          pluginMessage: {
            type: 'apply-episode-covers',
            episodesData: [{
              coverUrl,
              metadata: {
                title: episode.name || 'Sin título',
                chapter: formatChapter(seasonNumber, episode.episode_number),
                duration: formatDuration(episode.runtime),
                sinopsis: episode.overview || ''
              }
            }]
          }
        }, '*');

        setTimeout(() => { applyingOverlay.classList.add('hidden'); }, 800);
      } catch (err) {
        console.error('Error applying episode:', err);
        applyingOverlay.classList.add('hidden');
        alert(`Error al aplicar el episodio:\n\n${err.message}`);
      }
    }

    async function applyEpisodesBatch(seasonNumber) {
      // Copy episodes and entry BEFORE closing picker (which clears these variables)
      const episodes = seasonPickerEpisodes;
      const entry = seasonPickerEntry;

      closeSeasonPicker();
      applyingOverlay.classList.remove('hidden');

      try {
        const applyCount = Math.min(episodes.length, chapterCardCount);

        const episodesData = [];

        for (let i = 0; i < applyCount; i++) {
          const ep = episodes[i];
          const stillUrl = episodeStillUrl(ep.still_path);
          const coverUrl = stillUrl || `${OTV_BASE}/COVER_ART/${entry.contentId}_COVER_ART.jpg?width=3840&height=2160`;

          episodesData.push({
            coverUrl,
            metadata: {
              title: ep.name || 'Sin título',
              chapter: formatChapter(seasonNumber, ep.episode_number),
              duration: formatDuration(ep.runtime),
              sinopsis: ep.overview || ''
            }
          });
        }

        parent.postMessage({
          pluginMessage: {
            type: 'apply-episode-covers',
            episodesData
          }
        }, '*');

        setTimeout(() => { applyingOverlay.classList.add('hidden'); }, 800);
      } catch (err) {
        console.error('Error applying episode batch:', err);
        applyingOverlay.classList.add('hidden');
        alert(`Error al aplicar los capítulos:\n\n${err.message}`);
      }
    }

    function seasonPickerGoBack() {
      renderSeasonList(seasonPickerSeasons);
    }

    function closeSeasonPicker() {
      document.getElementById('seasonPickerOverlay').classList.add('hidden');
      seasonPickerEntry = null;
      seasonPickerSeasons = [];
      seasonPickerEpisodes = [];

      // Reopen VPS dialog if there's a saved entry
      if (vpsCurrentEntry) {
        setTimeout(() => showVPSNextDialog(vpsCurrentEntry), 300);
      }
    }

    // -- VPS Next Step Dialog --
    function showVPSNextDialog(entry) {
      // Save entry for persistence
      vpsCurrentEntry = entry;

      const overlay = document.getElementById('vpsNextDialog');
      const buttonsContainer = document.getElementById('vpsNextDialogButtons');

      const isSeries = entry.mediaType === 'tv';

      if (isSeries) {
        // Series: show "Añadir capítulos", "Contenido relacionado", and "Ver reparto"
        buttonsContainer.innerHTML = `
          <button class="vps-next-btn vps-next-btn-primary" id="vpsNextBtnChapters">Añadir capítulos</button>
          <button class="vps-next-btn vps-next-btn-secondary" id="vpsNextBtnRelated">Añadir contenido relacionado</button>
          <button class="vps-next-btn vps-next-btn-secondary" id="vpsNextBtnCast">Ver reparto</button>
          <button class="vps-next-btn vps-next-btn-tertiary" id="vpsNextBtnClose">Más tarde</button>
        `;

        document.getElementById('vpsNextBtnChapters').addEventListener('click', () => {
          hideVPSNextDialog();
          openSeasonPicker(entry);
        });

        document.getElementById('vpsNextBtnRelated').addEventListener('click', () => {
          applyRelatedContent(entry);
        });

        document.getElementById('vpsNextBtnCast').addEventListener('click', () => {
          hideVPSNextDialog();
          switchToPersonasForContent(entry);
        });
      } else {
        // Movie: show "Contenido relacionado" and "Ver reparto"
        buttonsContainer.innerHTML = `
          <button class="vps-next-btn vps-next-btn-primary" id="vpsNextBtnRelated">Añadir contenido relacionado</button>
          <button class="vps-next-btn vps-next-btn-secondary" id="vpsNextBtnCast">Ver reparto</button>
          <button class="vps-next-btn vps-next-btn-tertiary" id="vpsNextBtnClose">Más tarde</button>
        `;

        document.getElementById('vpsNextBtnRelated').addEventListener('click', () => {
          applyRelatedContent(entry);
        });

        document.getElementById('vpsNextBtnCast').addEventListener('click', () => {
          hideVPSNextDialog();
          switchToPersonasForContent(entry);
        });
      }

      document.getElementById('vpsNextBtnClose').addEventListener('click', closeVPSNextDialog);

      overlay.classList.remove('hidden');
    }

    function hideVPSNextDialog() {
      // Temporarily hide without clearing the entry
      document.getElementById('vpsNextDialog').classList.add('hidden');
    }

    function closeVPSNextDialog() {
      // Fully close and clear the entry
      document.getElementById('vpsNextDialog').classList.add('hidden');
      vpsCurrentEntry = null;
    }

    async function applyRelatedContent(entry) {
      // Check if we have portrait/landscape cards selected (not VPS)
      if (coverCount <= 1) {
        alert('Selecciona múltiples componentes card portrait o landscape para añadir contenido relacionado.');
        return;
      }

      if (componentType === 'vps') {
        alert('El contenido relacionado solo se puede aplicar a cards portrait o landscape, no a VPS.');
        return;
      }

      if (!entry.genreIds || entry.genreIds.length === 0) {
        alert('Este contenido no tiene géneros asociados.');
        return;
      }

      hideVPSNextDialog();
      applyingOverlay.classList.remove('hidden');

      try {
        // Exclude the VPS content itself and build catalog
        const allOTVItems = [...otvMovies, ...otvSeries].filter(
          item => item.contentId !== entry.contentId
        );

        const selectedIds = new Set();
        const selectedItems = [];

        // 1. Iterate genre by genre from the main content
        for (const genreId of entry.genreIds) {
          if (selectedItems.length >= coverCount) break;

          // Find content from this genre that hasn't been selected yet
          const genreItems = allOTVItems.filter(item => {
            if (selectedIds.has(item.contentId)) return false;
            if (!item.genreIds || item.genreIds.length === 0) return false;
            return item.genreIds.includes(genreId);
          });

          // Shuffle randomly and add as many as fit
          const shuffled = genreItems.sort(() => Math.random() - 0.5);
          for (const item of shuffled) {
            if (selectedItems.length >= coverCount) break;
            selectedIds.add(item.contentId);
            selectedItems.push(item);
          }
        }

        // 2. If still missing, fill with random content from catalog
        if (selectedItems.length < coverCount) {
          const remaining = allOTVItems.filter(item => !selectedIds.has(item.contentId));
          const shuffledRemaining = remaining.sort(() => Math.random() - 0.5);

          for (const item of shuffledRemaining) {
            if (selectedItems.length >= coverCount) break;
            selectedIds.add(item.contentId);
            selectedItems.push(item);
          }
        }

        // Resolve image type (detected or user-chosen)
        let typeToUse = componentType;
        if (typeToUse === 'unknown') {
          typeToUse = await pickImageType();
          if (!typeToUse) {
            applyingOverlay.classList.add('hidden');
            setTimeout(() => showVPSNextDialog(entry), 300);
            return; // user cancelled
          }
        }

        // Build URLs for each item
        const coversUrlData = [];
        for (const item of selectedItems) {
          let coverUrl;
          switch (typeToUse) {
            case 'card-portrait':
              coverUrl = `${OTV_BASE}/VERTICAL/${item.contentId}_VERTICAL.jpg?width=3840&height=2160`;
              break;
            case 'card-landscape':
              coverUrl = `${OTV_BASE}/COVER_ART/${item.contentId}_COVER_ART.jpg?width=3840&height=2160`;
              break;
            default:
              coverUrl = `${OTV_BASE}/VERTICAL/${item.contentId}_VERTICAL.jpg?width=3840&height=2160`;
          }
          const metadata = await fetchOTVMetadata(item);
          coversUrlData.push({ coverUrl, titleTreatmentUrl: null, metadata });
        }

        // Send to sandbox
        parent.postMessage({
          pluginMessage: {
            type: 'apply-multiple-covers-url',
            coversUrlData: coversUrlData.slice(0, coverCount)
          }
        }, '*');

        setTimeout(() => {
          applyingOverlay.classList.add('hidden');
          // Reopen dialog after applying
          setTimeout(() => showVPSNextDialog(entry), 300);
        }, 800);

      } catch (err) {
        console.error('Error applying related content:', err);
        applyingOverlay.classList.add('hidden');
        alert(`Error al aplicar contenido relacionado:\n\n${err.message}`);
        setTimeout(() => showVPSNextDialog(entry), 300);
      }
    }

    // Wire up season picker buttons
    document.getElementById('seasonPickerBack').addEventListener('click', seasonPickerGoBack);
    document.getElementById('seasonPickerClose').addEventListener('click', closeSeasonPicker);

    // -- Apply Image (v1 - kept for Personas tab) --
    async function applyImage(imageUrl, item) {
      if (coverCount === 0) {
        alert('No hay frames "cover" en la selección actual.\n\nSelecciona componentes que contengan un frame llamado "cover".');
        return;
      }

      applyingOverlay.classList.remove('hidden');

      try {
        // Build metadata from list data
        const title = item.title || item.name || '';
        const rating = item.vote_average ? item.vote_average.toFixed(1) : '';
        const date = item.release_date || item.first_air_date || '';
        const year = date ? date.substring(0, 4) : '';
        let duration = '';
        let ageRating = '';
        let sinopsis = '';

        // Fetch detail for duration/seasons (only for movies and TV)
        if (currentCategory === 'movie' || currentCategory === 'tv') {
          try {
            const detail = await fetchDetail(item.id);
            if (detail) {
              if (currentCategory === 'movie') {
                duration = formatDuration(detail.runtime);
              } else {
                const n = detail.number_of_seasons;
                if (n) duration = `${n} temporada${n === 1 ? '' : 's'}`;
              }
              ageRating = extractAgeRating(detail);
              sinopsis = detail.overview || '';
            }
          } catch (detailErr) {
            // Continue without detail data
          }
        }

        // Fetch image bytes
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Error al descargar la imagen: HTTP ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buffer));

        // Build metadata object
        let metadata = null;
        if (currentCategory === 'person') {
          const personName = item.name || '';
          const dept = item.known_for_department || '';
          const isActor = dept === 'Acting';
          const rol = isActor ? '' : (DEPARTMENT_MAP[dept] || dept);
          metadata = { personName, rol, isActor: isActor };
        } else {
          metadata = { title, rating, year, duration, ageRating, sinopsis };
        }

        parent.postMessage({
          pluginMessage: {
            type: 'apply-cover',
            imageBytes: bytes,
            metadata: metadata
          }
        }, '*');

        setTimeout(() => {
          applyingOverlay.classList.add('hidden');
        }, 800);
      } catch (err) {
        console.error('Error applying cover:', err);
        applyingOverlay.classList.add('hidden');
        alert(`Error al aplicar la cover:\n\n${err.message}\n\nInténtalo de nuevo o prueba con otra imagen.`);
      }
    }

    // -- Apply Random Content to Multiple Covers --
    async function applyRandomContent() {
      if (coverCount <= 1) {
        alert('Selecciona múltiples componentes con "cover" para usar contenido aleatorio.');
        return;
      }

      // Check if we have enough items
      const validItems = currentResults.filter(item => {
        // For OTV catalog: all items have images
        if (item.contentId) return true;
        // For TMDB (personas): check profile_path
        return !!item.profile_path;
      });

      if (validItems.length === 0) {
        alert('No hay contenidos con imagen disponibles.');
        return;
      }
      if (currentCategory !== 'person' && validItems.length < coverCount) {
        alert(`No hay suficientes contenidos con imagen. Se necesitan al menos ${coverCount}.\n\nResultados disponibles: ${validItems.length}\nIntenta cargar más resultados o selecciona menos componentes.`);
        return;
      }

      applyingOverlay.classList.remove('hidden');

      try {
        // For personas from a selected content: preserve Director → Writer → Cast order
        // For everything else: shuffle randomly
        let selectedItems;
        if (currentCategory === 'person' && personSearchMode === 'by-content') {
          selectedItems = validItems.slice(0, coverCount);
        } else {
          const shuffled = [...validItems].sort(() => Math.random() - 0.5);
          selectedItems = shuffled.slice(0, coverCount);
        }

        const isOTVMode = !!selectedItems[0].contentId;

        if (isOTVMode) {
          // Resolve image type (detected or user-chosen)
          let typeToUse = componentType;
          if (typeToUse === 'unknown') {
            typeToUse = await pickImageType();
            if (!typeToUse) {
              applyingOverlay.classList.add('hidden');
              return; // user cancelled
            }
          }

          // OTV catalog: build URL for each item using resolved type
          const coversUrlData = [];

          for (const item of selectedItems) {
            let coverUrl, titleTreatmentUrl;
            switch (typeToUse) {
              case 'card-portrait':
                coverUrl = `${OTV_BASE}/VERTICAL/${item.contentId}_VERTICAL.jpg?width=3840&height=2160`;
                break;
              case 'card-landscape':
                coverUrl = `${OTV_BASE}/COVER_ART/${item.contentId}_COVER_ART.jpg?width=3840&height=2160`;
                break;
              case 'vps':
                coverUrl = `${OTV_BASE}/BACKGROUND/${item.contentId}_BACKGROUND.jpg?width=3840&height=2160`;
                titleTreatmentUrl = `${OTV_BASE}/TITLE_TREATMENT/${item.contentId}_title_treatment.png?width=1280&height=720`;
                break;
              default:
                coverUrl = `${OTV_BASE}/VERTICAL/${item.contentId}_VERTICAL.jpg?width=3840&height=2160`;
            }
            const metadata = await fetchOTVMetadata(item);
            coversUrlData.push({ coverUrl, titleTreatmentUrl: titleTreatmentUrl || null, metadata });
          }

          parent.postMessage({
            pluginMessage: {
              type: 'apply-multiple-covers-url',
              coversUrlData: coversUrlData.slice(0, coverCount)
            }
          }, '*');
        } else {
          // TMDB personas: fetch bytes in UI (CORS supported by TMDB)
          const coversData = [];

          for (let i = 0; i < selectedItems.length; i++) {
            const item = selectedItems[i];
            try {
              const coverUrl = `${IMAGE_BASE}original${item.profile_path}`;
              const personName = item.name || '';
              const dept = item.known_for_department || '';
              const isActor = dept === 'Acting';
              const rol = isActor ? '' : (DEPARTMENT_MAP[dept] || dept);
              const metadata = { personName, rol, isActor: isActor };

              const response = await fetch(coverUrl);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const buffer = await response.arrayBuffer();
              const bytes = Array.from(new Uint8Array(buffer));

              coversData.push({ imageBytes: bytes, metadata: metadata });
            } catch (itemErr) {
              console.error(`Error processing person ${i}:`, itemErr);
            }
          }

          if (coversData.length === 0) {
            throw new Error('No se pudo procesar ninguna imagen.');
          }

          parent.postMessage({
            pluginMessage: {
              type: 'apply-multiple-covers',
              coversData: coversData.slice(0, coverCount)
            }
          }, '*');
        }

        setTimeout(() => {
          applyingOverlay.classList.add('hidden');
        }, 800);
      } catch (err) {
        console.error('Error applying random content:', err);
        applyingOverlay.classList.add('hidden');
        alert(`Error al aplicar contenido aleatorio:\n\n${err.message}\n\nRevisar la consola para más detalles.`);
      }
    }

    // -- Reload / More --
    function reloadImages() {
      // For movie/tv tabs: reload random 25 from filtered catalog
      if (currentCategory === 'movie' || currentCategory === 'tv') {
        if (filteredCatalog && filteredCatalog.length > 0) {
          const shuffled = shuffleArray(filteredCatalog);
          currentResults = shuffled.slice(0, ITEMS_PER_PAGE);
          console.log(`Reloading ${currentResults.length} random items from ${filteredCatalog.length} total`);
          renderGrid();
        }
        return;
      }

      // For person tab: use pagination (original behavior)
      if (currentPage < totalPages) {
        currentPage++;
      } else {
        currentPage = 1;
      }
      loadContent();
    }

    // -- Messages from Sandbox --
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === 'selection-changed') {
        // Immediately reset componentType so stale values don't get used at apply time
        componentType = 'unknown';
      }

      if (msg.type === 'selection-info') {
        selectionCount = msg.count;
        coverCount = msg.coverCount;
        componentType = msg.componentType || 'unknown';
        chapterCardCount = msg.chapterCardCount || 0;
        updateSelectionInfo();
      }

      if (msg.type === 'loaded-api-key') {
        if (msg.apiKey) {
          apiKey = msg.apiKey;
          apiKeyInput.value = apiKey;
          headerKeyBtn.classList.add('connected');
          apiKeySection.classList.add('collapsed');
          if (currentCategory !== 'person') loadGenres(currentCategory);
          loadContent();
        } else {
          apiKeySection.classList.remove('collapsed');
          showEmpty('🔑', 'Introduce tu API Key de TMDB para empezar');
        }
      }

      // -- Handle cached catalog (v3) --
      if (msg.type === 'cached-catalog') {
        if (msg.data) {
          const cacheAge = Date.now() - (msg.timestamp || 0);
          const isExpired = cacheAge > CACHE_TTL_MS;

          // Use cached data even if expired (better than nothing)
          otvCatalog = msg.data;
          const entries = Object.values(otvCatalog.catalog);
          otvMovies = entries.filter(e => e.mediaType === 'movie');
          otvSeries = entries.filter(e => e.mediaType === 'tv');

          if (isExpired) {
            const ageHours = Math.round(cacheAge / 1000 / 60 / 60);
            console.warn(`Using EXPIRED cached catalog (age: ${ageHours} hours). Offline mode.`);
            console.log(`OTV catalog loaded from cache: ${otvMovies.length} movies, ${otvSeries.length} series`);
          } else {
            const ageMinutes = Math.round(cacheAge / 1000 / 60);
            console.log(`Using cached catalog (age: ${ageMinutes} minutes)`);
            console.log(`OTV catalog loaded from cache: ${otvMovies.length} movies, ${otvSeries.length} series`);
          }

          // Render UI if we're on an OTV tab (movie or tv)
          if (currentCategory === 'movie' || currentCategory === 'tv') {
            loadGenres(currentCategory);
            loadContent();
          }
        } else {
          // No cache at all and Supabase failed
          showEmpty('⚠️', 'No hay catálogo disponible.\\nComprueba tu conexión a internet.');
        }
      }
    };

    function updateSelectionInfo() {
      if (selectionCount === 0) {
        selectionInfo.innerHTML = '<span style="color:var(--warning)">Selecciona componentes</span>';
      } else if (coverCount === 0) {
        selectionInfo.innerHTML = `${selectionCount} seleccionado(s) · <span style="color:var(--error)">sin "cover"</span>`;
      } else {
        selectionInfo.innerHTML = `<strong>${coverCount}</strong> cover(s)`;
      }

      // Show/hide random button based on cover count and results
      if (coverCount > 1 && currentResults.length > 0) {
        randomBar.classList.add('visible');

        // Count valid items with images
        const validItemsCount = currentResults.filter(item => {
          // OTV catalog entries have contentId
          if (item.contentId) return true;
          // Personas have profile_path
          if (currentCategory === 'person') return !!item.profile_path;
          // Fallback for TMDB results
          return !!(item.poster_path || item.backdrop_path);
        }).length;

        // Disable if not enough valid results (for persons, allow partial — apply as many as available)
        btnRandom.disabled = currentCategory === 'person' ? validItemsCount === 0 : validItemsCount < coverCount;
      } else {
        randomBar.classList.remove('visible');
      }
    }

    // -- Helpers --
    function showLoading() {
      imageGrid.classList.add('hidden');
      emptyState.classList.add('hidden');
      loadingState.classList.remove('hidden');
      randomBar.classList.remove('visible');
    }

    function showEmpty(icon, text) {
      imageGrid.classList.add('hidden');
      loadingState.classList.add('hidden');
      emptyState.classList.remove('hidden');
      randomBar.classList.remove('visible');
      emptyState.innerHTML = `
        <span class="icon">${icon}</span>
        <p>${text}</p>
      `;
    }

    // -- Normalize title for OTV matching --
    function normalizeTitle(title) {
      return title.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  </script>
</body>

</html>