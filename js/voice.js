/**
 * voice.js — Speech output module
 * Uses the browser's built-in Web Speech API (speechSynthesis).
 * Reads every message aloud AND puts it in the on-screen status bar.
 */

const Voice = (() => {
  let _rate     = 1.0;
  let _lang     = 'en-GB';
  let _enabled  = true;   // "Use app voice" switch
  let _lastMsg  = '';

  /**
   * Speak a message and display it in the status bar.
   * @param {string} text        - The message to speak.
   * @param {boolean} [interrupt=true] - Cancel any current speech first.
   */
  function speak(text, interrupt = true) {
    _lastMsg = text;

    // Always update on-screen status so screen readers and visual users see it
    const bar = document.getElementById('status-bar');
    if (bar) bar.textContent = text;

    if (!_enabled) return;
    if (!window.speechSynthesis) return;

    if (interrupt) window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = _rate;
    utterance.lang = _lang;

    // Pick a voice matching the requested language if available
    const voices = window.speechSynthesis.getVoices();
    const match  = voices.find(v => v.lang.startsWith(_lang));
    if (match) utterance.voice = match;

    window.speechSynthesis.speak(utterance);
  }

  /** Stop any ongoing speech immediately. */
  function stop() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  /** @param {number} rate - e.g. 0.7, 1.0, 1.3, 1.6 */
  function setRate(rate) {
    _rate = parseFloat(rate) || 1.0;
  }

  /** @param {string} lang - BCP-47 code, e.g. 'en-GB' */
  function setLang(lang) {
    _lang = lang || 'en-GB';
  }

  /** @param {boolean} enabled */
  function setEnabled(enabled) {
    _enabled = !!enabled;
  }

  /** @returns {string} The last message spoken/displayed. */
  function getLastMessage() {
    return _lastMsg;
  }

  /** Repeat the last spoken message. */
  function repeatLast() {
    if (_lastMsg) speak(_lastMsg);
  }

  // Voices load asynchronously on some browsers; re-try on change
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {};
  }

  return { speak, stop, setRate, setLang, setEnabled, getLastMessage, repeatLast };
})();
