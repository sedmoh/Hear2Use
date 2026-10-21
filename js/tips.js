/**
 * tips.js — Date-label explanations, storage and disposal advice.
 * Pure helper functions — no DOM access, no speech calls.
 * Imported early; called by scan.js and kitchen.js.
 */

const Tips = (() => {

  // ── Date helpers ────────────────────────────────────────────────────────

  /**
   * Return the number of whole calendar days between today and a date string.
   * Negative = already past.
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {number}
   */
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    return Math.ceil((target - today) / 86400000);
  }

  /**
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {boolean}
   */
  function isExpired(dateStr) {
    if (!dateStr) return false;
    return daysUntil(dateStr) < 0;
  }

  /**
   * Build a plain-English sentence about a date, explaining what it means.
   * @param {string} dateStr  - YYYY-MM-DD
   * @param {string} dateType - 'use_by' | 'best_before' | 'expiry' | 'unknown' | null
   * @returns {string}
   */
  function explainDate(dateStr, dateType) {
    if (!dateStr) return '';

    const days    = daysUntil(dateStr);
    const past    = days < 0;
    const absDays = Math.abs(days);

    // Human-readable date
    let humanDate;
    try {
      humanDate = new Date(dateStr).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch {
      humanDate = dateStr;
    }

    // Date-type explanation
    let typeExplain = '';
    if (dateType === 'use_by') {
      typeExplain = 'Use-by dates are about food safety. You should not eat this after the date, even if it looks and smells fine.';
    } else if (dateType === 'best_before') {
      typeExplain = 'Best-before dates are about quality, not safety. The food is usually still safe to eat after this date, but the taste or texture may not be at its best.';
    } else if (dateType === 'expiry') {
      typeExplain = 'This expiry date means the product should not be used after this date.';
    }

    // Status sentence
    let statusMsg;
    if (past) {
      statusMsg = `This date was ${absDays} day${absDays > 1 ? 's' : ''} ago, on ${humanDate}. The date has already passed.`;
    } else if (days === 0) {
      statusMsg = `This expires today, ${humanDate}. Use it as soon as possible.`;
    } else if (days === 1) {
      statusMsg = `This expires tomorrow, ${humanDate}.`;
    } else {
      statusMsg = `This expires in ${days} days, on ${humanDate}.`;
    }

    return [statusMsg, typeExplain].filter(Boolean).join(' ');
  }

  // ── Disposal advice ─────────────────────────────────────────────────────

  /**
   * Return a fallback disposal sentence when the AI hasn't provided one.
   * @param {string} kind - 'food' | 'post' | 'sign' | 'other'
   * @param {string} [name] - item name for context (unused in fallback)
   * @returns {string}
   */
  function getDisposalAdvice(kind, name) {
    switch (kind) {
      case 'food':
        return 'Check the packaging for recycling symbols. Rinse any containers and place them in your recycling bin.';
      case 'post':
        return 'If you no longer need this, shred any personal details and recycle the paper.';
      case 'sign':
        return 'Signs are usually permanent fixtures. No disposal needed.';
      default:
        return 'Check local council guidelines for how to dispose of this item.';
    }
  }

  // ── Storage tips ────────────────────────────────────────────────────────

  /**
   * Return a generic storage tip based on common food keywords.
   * Used as a fallback when the AI doesn't supply one.
   * @param {string} name
   * @returns {string}
   */
  function getStorageTip(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('milk') || n.includes('dairy') || n.includes('yogurt') || n.includes('cheese')) {
      return 'Keep refrigerated below 5°C.';
    }
    if (n.includes('bread')) {
      return 'Store in a cool, dry place. Freeze if not using within a couple of days.';
    }
    if (n.includes('fruit') || n.includes('vegetable') || n.includes('salad')) {
      return 'Store in the fridge unless stated otherwise on the label.';
    }
    if (n.includes('meat') || n.includes('chicken') || n.includes('fish') || n.includes('prawn')) {
      return 'Keep refrigerated and use before the use-by date. Do not wash raw meat.';
    }
    if (n.includes('tin') || n.includes('can') || n.includes('jar')) {
      return 'Store in a cool, dry cupboard. Once opened, refrigerate and use within a few days.';
    }
    return 'Follow the storage instructions on the label.';
  }

  return { daysUntil, isExpired, explainDate, getDisposalAdvice, getStorageTip };
})();
