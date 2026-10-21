/**
 * kitchen.js — Saved food items, expiry checking, and sustainability impact.
 *
 * Data shape in localStorage ('h2u_kitchen'):
 *   Array of: { id, name, summary, date, dateType, storageTip, disposal, savedAt }
 *
 * Impact data in localStorage ('h2u_impact'):
 *   { usedBeforeExpiry: number, recycledCorrectly: number }
 */

const Kitchen = (() => {
  const KITCHEN_KEY = 'h2u_kitchen';
  const IMPACT_KEY  = 'h2u_impact';

  // ── Demo items ──────────────────────────────────────────────────────────

  /** Three demo items loaded via Settings → "Load demo data". */
  const DEMO_ITEMS = [
    {
      name:       'Semi-skimmed milk (1 litre)',
      summary:    'Tesco semi-skimmed milk, 1 litre carton.',
      date:       offsetDate(2),
      dateType:   'use_by',
      storageTip: 'Keep refrigerated below 5°C.',
      disposal:   'Rinse the carton and put it in paper/cardboard recycling.',
    },
    {
      name:       'Chicken tikka masala ready meal',
      summary:    'Tesco Finest chicken tikka masala, 400g.',
      date:       offsetDate(-1),   // already expired
      dateType:   'use_by',
      storageTip: 'Store in the fridge. Do not refreeze.',
      disposal:   'Empty food waste, rinse tray, place in recycling if your council accepts plastic trays.',
    },
    {
      name:       'Cheddar cheese (200g)',
      summary:    'Medium cheddar, pre-sliced.',
      date:       offsetDate(7),
      dateType:   'best_before',
      storageTip: 'Keep refrigerated, wrap tightly after opening.',
      disposal:   'Put the plastic wrapper in general waste; recycle the card box.',
    },
  ];

  /** Helper: today + offsetDays as YYYY-MM-DD. */
  function offsetDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }

  // ── Storage helpers ─────────────────────────────────────────────────────

  /** @returns {Array} All saved kitchen items. */
  function getItems() {
    try {
      return JSON.parse(localStorage.getItem(KITCHEN_KEY)) || [];
    } catch {
      return [];
    }
  }

  /** @param {Array} items */
  function setItems(items) {
    localStorage.setItem(KITCHEN_KEY, JSON.stringify(items));
  }

  /** @returns {object} Impact counters. */
  function getImpact() {
    try {
      return JSON.parse(localStorage.getItem(IMPACT_KEY)) || { usedBeforeExpiry: 0, recycledCorrectly: 0 };
    } catch {
      return { usedBeforeExpiry: 0, recycledCorrectly: 0 };
    }
  }

  /** @param {object} impact */
  function setImpact(impact) {
    localStorage.setItem(IMPACT_KEY, JSON.stringify(impact));
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Save a scan result as a kitchen item.
   * @param {object} result - From scan.js
   */
  function saveItem(result) {
    const items = getItems();
    const item = {
      id:         Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name:       result.name       || 'Unknown item',
      summary:    result.summary    || '',
      date:       result.date       || null,
      dateType:   result.dateType   || null,
      storageTip: result.storageTip || '',
      disposal:   result.disposal   || '',
      savedAt:    new Date().toISOString(),
    };
    items.push(item);
    setItems(items);
    renderKitchen();
  }

  /**
   * Delete an item by id. Prompts for which impact counter to increment.
   * @param {string} id
   * @param {'used'|'recycled'|null} impactType
   */
  function deleteItem(id, impactType) {
    const items = getItems().filter(i => i.id !== id);
    setItems(items);

    if (impactType) {
      const impact = getImpact();
      if (impactType === 'used')     impact.usedBeforeExpiry++;
      if (impactType === 'recycled') impact.recycledCorrectly++;
      setImpact(impact);
      renderImpact();
    }

    renderKitchen();
  }

  /**
   * Get items expiring within the next N days (and not yet expired).
   * @param {number} days
   * @returns {Array}
   */
  function getExpiringItems(days) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + days);

    return getItems().filter(item => {
      if (!item.date) return false;
      const d = new Date(item.date);
      return d >= today && d <= cutoff;
    });
  }

  /**
   * Speak all items expiring within N days.
   * @param {number} days
   */
  function speakExpiring(days) {
    const items = getExpiringItems(days);
    if (!items.length) {
      Voice.speak(`Nothing is expiring within the next ${days} day${days === 1 ? '' : 's'}.`);
      return;
    }

    // Also include already-expired
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expired = getItems().filter(item => {
      if (!item.date) return false;
      return new Date(item.date) < today;
    });

    const parts = [];
    if (expired.length) {
      parts.push(`${expired.length} item${expired.length > 1 ? 's' : ''} already expired: ` +
        expired.map(i => i.name).join(', ') + '.');
    }
    if (items.length) {
      parts.push(`${items.length} item${items.length > 1 ? 's' : ''} expiring within ${days} day${days === 1 ? '' : 's'}: ` +
        items.map(i => {
          const d = new Date(i.date);
          const diff = Math.ceil((d - today) / 86400000);
          return `${i.name}, ${diff === 0 ? 'today' : `in ${diff} day${diff > 1 ? 's' : ''}`}`;
        }).join('. ') + '.');
    }
    Voice.speak(parts.join(' '));
  }

  /**
   * Increment an impact counter by name.
   * @param {'usedBeforeExpiry'|'recycledCorrectly'} key
   */
  function incrementImpact(key) {
    const impact = getImpact();
    impact[key] = (impact[key] || 0) + 1;
    setImpact(impact);
    renderImpact();
  }

  /** Load the three demo items into the kitchen. */
  function loadDemoItems() {
    const existing = getItems();
    DEMO_ITEMS.forEach(d => {
      // Avoid duplicating if already present
      if (!existing.find(e => e.name === d.name)) {
        saveItem(d);
      }
    });
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  /**
   * Render the impact counters to the DOM.
   */
  function renderImpact() {
    const impact = getImpact();
    const used     = document.getElementById('impact-used');
    const recycled = document.getElementById('impact-recycled');
    if (used)     used.textContent     = impact.usedBeforeExpiry;
    if (recycled) recycled.textContent = impact.recycledCorrectly;
  }

  /**
   * Render the full kitchen list, sorted soonest expiry first.
   */
  function renderKitchen() {
    const container = document.getElementById('kitchen-list');
    if (!container) return;

    const items = getItems();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const warningDays = Settings.load().warningDays || 2;

    if (!items.length) {
      container.innerHTML = '<p class="empty-message">No items saved yet. Scan a food label to get started.</p>';
      return;
    }

    // Sort: expired first, then by date asc, then no-date at end
    const sorted = [...items].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    });

    container.innerHTML = '';
    sorted.forEach(item => {
      const card = document.createElement('article');
      card.className = 'kitchen-item';
      card.setAttribute('aria-label', item.name);

      let statusClass = '';
      let badgeClass  = 'badge-ok';
      let badgeText   = '';
      let dateDisplay = '';

      if (item.date) {
        const d    = new Date(item.date);
        const diff = Math.ceil((d - today) / 86400000);

        if (diff < 0) {
          statusClass = 'expired';
          badgeClass  = 'badge-expired';
          badgeText   = 'Expired';
          dateDisplay = `${item.dateType || 'date'}: ${item.date} — expired ${Math.abs(diff)} day${Math.abs(diff) > 1 ? 's' : ''} ago`;
        } else if (diff <= warningDays) {
          statusClass = 'expiring-soon';
          badgeClass  = 'badge-soon';
          badgeText   = diff === 0 ? 'Expires today' : `Expires in ${diff} day${diff > 1 ? 's' : ''}`;
          dateDisplay = `${item.dateType || 'date'}: ${item.date}`;
        } else {
          badgeText   = `OK — ${diff} days left`;
          dateDisplay = `${item.dateType || 'date'}: ${item.date}`;
        }
      }

      if (statusClass) card.classList.add(statusClass);

      card.innerHTML = `
        <div class="kitchen-item-info">
          <div class="kitchen-item-name">${escHtml(item.name)}</div>
          ${dateDisplay ? `<div class="kitchen-item-date">${escHtml(dateDisplay)}</div>` : ''}
          ${badgeText   ? `<span class="kitchen-item-badge ${badgeClass}">${escHtml(badgeText)}</span>` : ''}
          ${item.storageTip ? `<div class="hint-text">${escHtml(item.storageTip)}</div>` : ''}
        </div>
        <button
          class="btn-delete"
          aria-label="Delete ${escHtml(item.name)}"
          data-id="${escHtml(item.id)}"
          data-name="${escHtml(item.name)}"
        >🗑</button>
      `;

      container.appendChild(card);
    });

    // Wire up delete buttons
    container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id   = btn.dataset.id;
        const name = btn.dataset.name;
        // Ask whether used before expiry (simple confirm for prototype)
        const used = confirm(`Did you use "${name}" before it expired?\n\nOK = Yes (counts towards your impact)\nCancel = No`);
        deleteItem(id, used ? 'used' : null);
        if (used) {
          Voice.speak(`${name} removed. Great job using it before it expired!`);
        } else {
          Voice.speak(`${name} removed from your kitchen.`);
        }
      });
    });

    renderImpact();
  }

  // ── Tiny XSS helper ──────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    const btnExpiring = document.getElementById('btn-whats-expiring');
    if (btnExpiring) {
      btnExpiring.addEventListener('click', () => {
        const days = Settings.load().warningDays || 2;
        speakExpiring(days);
      });
    }
    renderKitchen();
    renderImpact();
  }

  return {
    init,
    saveItem,
    deleteItem,
    getItems,
    getExpiringItems,
    speakExpiring,
    incrementImpact,
    loadDemoItems,
    renderKitchen,
    renderImpact,
  };
})();
