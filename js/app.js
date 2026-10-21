/**
 * app.js — Top-level wiring.
 * Initialises all modules, handles tab navigation,
 * and wires the Repeat button and optional Voice Commands (Chrome only).
 *
 * Load order in index.html:
 *   voice.js → tips.js → settings.js → scan.js → kitchen.js → places.js → app.js
 */

(function () {
  'use strict';

  // ── Tab navigation ───────────────────────────────────────────────────────

  const TABS = ['scan', 'kitchen', 'places', 'settings'];

  /**
   * Switch the visible section and update aria-selected on tab buttons.
   * @param {string} tabId - One of TABS.
   */
  function showSection(tabId) {
    // Turn the live camera off when leaving the Scan tab
    if (tabId !== 'scan') Scan.closeCamera();

    TABS.forEach(id => {
      const section = document.getElementById(`section-${id}`);
      const tabBtn  = document.getElementById(`tab-${id}`);
      if (!section || !tabBtn) return;

      const isActive = id === tabId;
      section.classList.toggle('active', isActive);
      section.setAttribute('aria-hidden', String(!isActive));
      tabBtn.classList.toggle('active', isActive);
      tabBtn.setAttribute('aria-selected', String(isActive));
    });

    // Move focus into the heading of the new section for keyboard / screen reader users
    const heading = document.querySelector(`#section-${tabId} h2`);
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
  }

  function initTabs() {
    TABS.forEach(id => {
      const btn = document.getElementById(`tab-${id}`);
      if (btn) {
        btn.addEventListener('click', () => {
          showSection(id);
          // Announce section name for screen readers that don't read role=tabpanel automatically
          updateStatus(`Showing ${btn.textContent.trim()} section.`);
        });
      }
    });
  }

  // ── Status helper ─────────────────────────────────────────────────────────

  /**
   * Update the on-screen status bar WITHOUT speaking.
   * Voice.speak() also updates the status bar when speaking.
   * @param {string} msg
   */
  function updateStatus(msg) {
    const bar = document.getElementById('status-bar');
    if (bar) bar.textContent = msg;
  }

  // ── Repeat button ─────────────────────────────────────────────────────────

  function initRepeatButton() {
    const btn = document.getElementById('btn-repeat');
    if (btn) {
      btn.addEventListener('click', () => Voice.repeatLast());
    }
  }

  // ── Voice commands (Chrome / Android only) ────────────────────────────────
  //
  // The SpeechRecognition API is only available in Chrome-based browsers.
  // The voice command button is hidden everywhere else so VoiceOver / TalkBack
  // users on iOS are not confused by a non-functional control.

  function initVoiceCommands() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    const hintEl = document.getElementById('voice-cmd-hint');
    if (!SpeechRecognition || !hintEl) return;

    // Inject the button only when the API is supported
    hintEl.innerHTML = `
      <button id="btn-voice-cmd" class="btn-secondary" aria-label="Start listening for a voice command">
        🎤 Voice command
      </button>
      <p class="hint-text" id="voice-cmd-status"></p>
    `;

    const btn    = document.getElementById('btn-voice-cmd');
    const status = document.getElementById('voice-cmd-status');

    const recognition = new SpeechRecognition();
    recognition.lang        = Settings.load().voiceLang || 'en-GB';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = event => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      status.textContent = `Heard: "${transcript}"`;
      handleVoiceCommand(transcript);
    };

    recognition.onerror = event => {
      status.textContent = `Voice command error: ${event.error}`;
    };

    recognition.onend = () => {
      btn.textContent = '🎤 Voice command';
      btn.setAttribute('aria-label', 'Start listening for a voice command');
    };

    btn.addEventListener('click', () => {
      recognition.lang = Settings.load().voiceLang || 'en-GB';
      recognition.start();
      btn.textContent = '🎤 Listening…';
      btn.setAttribute('aria-label', 'Listening — speak your command now');
      status.textContent = 'Listening…';
    });
  }

  /**
   * Map a recognised phrase to an action.
   * @param {string} transcript
   */
  function handleVoiceCommand(transcript) {
    if (contains(transcript, ['scan', 'read label', 'open camera', 'take photo'])) {
      showSection('scan');
      document.getElementById('btn-scan').click();
    } else if (contains(transcript, ['what', 'expir', 'kitchen'])) {
      showSection('kitchen');
      document.getElementById('btn-whats-expiring').click();
    } else if (contains(transcript, ['near me', 'nearby', 'places', 'shops'])) {
      showSection('places');
      document.getElementById('btn-whats-near').click();
    } else if (contains(transcript, ['settings', 'setting'])) {
      showSection('settings');
    } else if (contains(transcript, ['repeat', 'say again', 'again'])) {
      Voice.repeatLast();
    } else {
      Voice.speak('Sorry, I did not understand that command. Try: scan, kitchen, near me, settings, or repeat.');
    }
  }

  /** Check if a string contains any of the given substrings. */
  function contains(str, terms) {
    return terms.some(t => str.includes(t));
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  function init() {
    // 1. Settings first — applies high-contrast and speech preferences
    Settings.init();

    // 2. Core modules
    Scan.init();
    Kitchen.init();
    Places.init();

    // 3. Navigation
    initTabs();
    initRepeatButton();

    // 4. Optional voice commands
    initVoiceCommands();

    // 5. Welcome message
    Voice.speak(
      'Welcome to Hear2Use. ' +
      'Use the tabs at the top to navigate: Scan, Kitchen, Places, or Settings. ' +
      'Press Scan to read a food label or letter.'
    );
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
