/**
 * places.js — Nearby places feature.
 * Loads from data/places.json, groups by category, runs a spoken tour.
 *
 * Demo data is for a generic London campus area.
 * If the user grants geolocation, we note their position but still use
 * the static places list (no live mapping in this prototype).
 */

const Places = (() => {

  // ── Category display order and labels ──────────────────────────────────
  const CATEGORY_ORDER = [
    'campus service',
    'grocery',
    'pharmacy',
    'cafe',
    'launderette',
    'bin/recycling point',
  ];

  const CATEGORY_LABELS = {
    'campus service':      'Campus services',
    'grocery':             'Grocery shops',
    'pharmacy':            'Pharmacies',
    'cafe':                'Cafés and food',
    'launderette':         'Launderettes',
    'bin/recycling point': 'Recycling points',
  };

  let _places     = [];
  let _tourList   = [];
  let _tourIndex  = 0;

  // ── Data loading ────────────────────────────────────────────────────────

  /**
   * Fetch and cache places from JSON. Resolves immediately if already loaded.
   * @returns {Promise<Array>}
   */
  async function loadPlaces() {
    if (_places.length) return _places;
    try {
      const resp = await fetch('data/places.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      _places = await resp.json();
    } catch (err) {
      console.warn('Places: could not load places.json', err);
      _places = [];
    }
    return _places;
  }

  // ── Grouping and sorting ────────────────────────────────────────────────

  /**
   * Group places by category. Within each group, independent shops come first.
   * @param {Array} places
   * @returns {Map<string, Array>}
   */
  function groupByCategory(places) {
    const groups = new Map();
    CATEGORY_ORDER.forEach(cat => groups.set(cat, []));

    places.forEach(p => {
      const cat = p.category || 'other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(p);
    });

    // Within each group, independent shops first, then by walk time
    groups.forEach((list, cat) => {
      list.sort((a, b) => {
        if (a.independent !== b.independent) return a.independent ? -1 : 1;
        return (a.approxWalkMinutes || 99) - (b.approxWalkMinutes || 99);
      });
    });

    return groups;
  }

  // ── Spoken summary ──────────────────────────────────────────────────────

  /**
   * Speak a high-level summary grouped by category.
   * E.g. "There are 3 grocery shops nearby. The closest is Green Street Grocers, 4 minutes' walk."
   */
  function speakSummary(places) {
    if (!places.length) {
      Voice.speak('No nearby places found. Make sure data/places.json is present.');
      return;
    }

    const groups = groupByCategory(places);
    const parts  = [];

    parts.push('Here is what is near you. I will go through each category. Independent shops are listed first.');

    groups.forEach((list, cat) => {
      if (!list.length) return;
      const label = CATEGORY_LABELS[cat] || cat;
      const indep = list.filter(p => p.independent);
      const first = list[0];

      let line = `${label}: ${list.length} place${list.length > 1 ? 's' : ''}.`;
      if (indep.length) {
        line += ` ${indep.length} independent.`;
      }
      line += ` Closest is ${first.name}, about ${first.approxWalkMinutes} minute${first.approxWalkMinutes === 1 ? '' : 's'} away.`;
      parts.push(line);
    });

    parts.push('Press "Next place" to hear details about each one, or "Stop tour" to finish.');
    Voice.speak(parts.join(' '));
  }

  // ── Tour controls ────────────────────────────────────────────────────────

  /**
   * Build the flat tour list: independent first within each category, then others.
   * @param {Array} places
   * @returns {Array}
   */
  function buildTourList(places) {
    const groups = groupByCategory(places);
    const result = [];
    groups.forEach(list => list.forEach(p => result.push(p)));
    return result;
  }

  function startTour(places) {
    _tourList  = buildTourList(places);
    _tourIndex = 0;
    showTourControls(true);
    if (_tourList.length) {
      speakPlaceBasic(_tourList[0]);
    }
  }

  function nextPlace() {
    if (!_tourList.length) return;
    _tourIndex = (_tourIndex + 1) % _tourList.length;
    speakPlaceBasic(_tourList[_tourIndex]);
  }

  function repeatPlace() {
    if (!_tourList.length) return;
    speakPlaceBasic(_tourList[_tourIndex]);
  }

  function speakPlaceDetail(place) {
    if (!place) return;
    const msg = [
      place.name + '.',
      place.shortDescription,
      `About ${place.approxWalkMinutes} minute${place.approxWalkMinutes === 1 ? '' : 's'} walk.`,
      place.independent ? 'This is an independent local business.' : '',
      place.accessibilityNotes ? `Accessibility: ${place.accessibilityNotes}` : '',
    ].filter(Boolean).join(' ');
    Voice.speak(msg);
  }

  function speakPlaceBasic(place) {
    if (!place) return;
    const label = CATEGORY_LABELS[place.category] || place.category;
    const msg = `${place.name}. ${label}. ${place.approxWalkMinutes} minute${place.approxWalkMinutes === 1 ? '' : 's'} walk.` +
      (place.independent ? ' Independent.' : '');
    Voice.speak(msg);
  }

  function stopTour() {
    _tourList  = [];
    _tourIndex = 0;
    showTourControls(false);
    Voice.speak('Tour finished.');
  }

  // ── DOM helpers ──────────────────────────────────────────────────────────

  function showTourControls(visible) {
    const controls = document.getElementById('tour-controls');
    if (!controls) return;
    if (visible) {
      controls.classList.remove('visually-hidden');
    } else {
      controls.classList.add('visually-hidden');
    }
  }

  /**
   * Render a visual list of places grouped by category.
   * @param {Array} places
   */
  function renderPlacesList(places) {
    const container = document.getElementById('places-list');
    if (!container) return;

    const groups = groupByCategory(places);
    container.innerHTML = '';

    groups.forEach((list, cat) => {
      if (!list.length) return;
      const label = CATEGORY_LABELS[cat] || cat;

      const heading = document.createElement('h3');
      heading.textContent = label;
      heading.style.marginTop = '1rem';
      heading.style.marginBottom = '0.5rem';
      container.appendChild(heading);

      list.forEach(place => {
        const card = document.createElement('article');
        card.className = 'place-card';
        card.innerHTML = `
          <div class="place-card-header">
            <span class="place-name">${escHtml(place.name)}</span>
            ${place.independent ? '<span class="place-badge">Independent</span>' : ''}
          </div>
          <div class="place-meta">
            ${escHtml(CATEGORY_LABELS[place.category] || place.category)} ·
            ~${place.approxWalkMinutes} min walk
          </div>
          <p>${escHtml(place.shortDescription)}</p>
          ${place.accessibilityNotes
            ? `<p class="hint-text">♿ ${escHtml(place.accessibilityNotes)}</p>`
            : ''}
        `;
        container.appendChild(card);
      });
    });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Init ────────────────────────────────────────────────────────────────

  async function init() {
    const btnNear    = document.getElementById('btn-whats-near');
    const btnNext    = document.getElementById('btn-next-place');
    const btnRepeat  = document.getElementById('btn-repeat-place');
    const btnDetails = document.getElementById('btn-details-place');
    const btnStop    = document.getElementById('btn-stop-tour');

    if (btnNear) {
      btnNear.addEventListener('click', async () => {
        Voice.speak('Loading nearby places…');
        const places = await loadPlaces();
        renderPlacesList(places);
        speakSummary(places);
        startTour(places);
      });
    }

    if (btnNext)    btnNext.addEventListener('click',    () => nextPlace());
    if (btnRepeat)  btnRepeat.addEventListener('click',  () => repeatPlace());
    if (btnDetails) btnDetails.addEventListener('click', () => {
      if (_tourList[_tourIndex]) speakPlaceDetail(_tourList[_tourIndex]);
    });
    if (btnStop)    btnStop.addEventListener('click',    () => stopTour());
  }

  return { init, loadPlaces, speakSummary, startTour, nextPlace, repeatPlace, speakPlaceDetail, stopTour };
})();
