/**
 * settings.js — Loads, saves and applies user settings.
 * All settings are persisted to localStorage under the key 'h2u_settings'.
 */

const Settings = (() => {
  const STORAGE_KEY = 'h2u_settings';

  const DEFAULTS = {
    apiKey:       '',
    speechRate:   1.0,
    detailLevel:  'detailed',
    voiceLang:    'en-GB',
    warningDays:  2,
    highContrast: true,
    useAppVoice:  true,
  };

  /** @returns {object} Current settings merged with defaults. */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? Object.assign({}, DEFAULTS, JSON.parse(raw)) : Object.assign({}, DEFAULTS);
    } catch {
      return Object.assign({}, DEFAULTS);
    }
  }

  /** @param {object} settings */
  function save(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  /** Apply high-contrast class to <body>. */
  function applyHighContrast(enabled) {
    document.body.classList.toggle('high-contrast', !!enabled);
  }

  /** Populate the settings form with stored values. */
  function renderForm() {
    const s = load();
    const $ = id => document.getElementById(id);

    const apiKey = $('input-api-key');
    if (apiKey) apiKey.value = s.apiKey || '';

    const rate = $('input-speech-rate');
    if (rate) rate.value = String(s.speechRate);

    const lang = $('input-voice-lang');
    if (lang) lang.value = s.voiceLang;

    const detail = $('input-detail-level');
    if (detail) detail.value = s.detailLevel;

    const warnDays = $('input-warning-days');
    if (warnDays) warnDays.value = s.warningDays;

    const contrast = $('toggle-high-contrast');
    if (contrast) contrast.checked = s.highContrast;

    const appVoice = $('toggle-app-voice');
    if (appVoice) appVoice.checked = s.useAppVoice;
  }

  /** Read form values and persist them. Also updates Voice module live. */
  function saveFromForm() {
    const $ = id => document.getElementById(id);
    const s = {
      apiKey:       ($('input-api-key')       || {}).value || '',
      speechRate:   parseFloat(($('input-speech-rate')    || {}).value) || 1.0,
      detailLevel:  ($('input-detail-level')  || {}).value || 'detailed',
      voiceLang:    ($('input-voice-lang')    || {}).value || 'en-GB',
      warningDays:  parseInt(($('input-warning-days')     || {}).value) || 2,
      highContrast: !!($('toggle-high-contrast') || {}).checked,
      useAppVoice:  !!($('toggle-app-voice')    || {}).checked,
    };
    save(s);
    applySettings(s);
    return s;
  }

  /** Apply settings to Voice module and body class. */
  function applySettings(s) {
    Voice.setRate(s.speechRate);
    Voice.setLang(s.voiceLang);
    Voice.setEnabled(s.useAppVoice);
    applyHighContrast(s.highContrast);
  }

  /** Load demo data: add 3 sample kitchen items and load demo places. */
  function loadDemoData() {
    Kitchen.loadDemoItems();
    Voice.speak('Demo data loaded. Three sample items have been added to your kitchen.');
  }

  /** Wipe all localStorage keys used by this app. */
  function clearAllData() {
    ['h2u_settings', 'h2u_kitchen', 'h2u_impact'].forEach(k => localStorage.removeItem(k));
    Voice.speak('All data cleared.');
    // Re-apply defaults
    applySettings(Object.assign({}, DEFAULTS));
    renderForm();
    if (typeof Kitchen !== 'undefined') Kitchen.renderKitchen();
    if (typeof Kitchen !== 'undefined') Kitchen.renderImpact();
  }

  /** Wire up the settings form and action buttons. */
  function init() {
    renderForm();
    applySettings(load());

    const form = document.getElementById('settings-form');
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        saveFromForm();
        Voice.speak('Settings saved.');
      });
    }

    const btnDemo = document.getElementById('btn-load-demo');
    if (btnDemo) btnDemo.addEventListener('click', loadDemoData);

    const btnClear = document.getElementById('btn-clear-data');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (confirm('This will delete all your saved items and settings. Are you sure?')) {
          clearAllData();
        }
      });
    }
  }

  return { load, save, applySettings, init, loadDemoData, clearAllData };
})();
