/**
 * scan.js — Camera capture and AI label-reading.
 *
 * ⚠️  DEMO / PROTOTYPE ONLY.
 * The Gemini API key is stored in localStorage and sent from the browser.
 * A production product MUST proxy all AI calls through a secure server so
 * the key is never exposed to the client. Do not ship this pattern live.
 *
 * Dependency load order: voice.js → tips.js → settings.js → scan.js
 */

const Scan = (() => {

  // ── Demo results for 3 canonical items ──────────────────────────────────
  // Used when there is no API key or the network request fails.
  const DEMO_RESULTS = {
    milk: {
      kind:       'food',
      name:       'Semi-skimmed milk (1 litre)',
      summary:    'Tesco semi-skimmed milk, 1 litre carton.',
      date:       (() => {
        const d = new Date();
        d.setDate(d.getDate() + 2);
        return d.toISOString().split('T')[0];
      })(),
      dateType:   'use_by',
      storageTip: 'Keep refrigerated below 5°C. Once opened, use within 3 days.',
      disposal:   'Rinse the carton and put it in your paper or cardboard recycling bin.',
      confidence: 'high',
    },
    letter: {
      kind:       'post',
      name:       'University letter',
      summary:    'A letter from the university student services office addressed to you.',
      date:       null,
      dateType:   null,
      storageTip: '',
      disposal:   'If you no longer need it, shred any personal details before recycling as paper.',
      confidence: 'high',
    },
    readymeal: {
      kind:       'food',
      name:       'Chicken tikka masala ready meal',
      summary:    'Tesco Finest chicken tikka masala, 400g. Serves one.',
      date:       (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);      // yesterday → expired
        return d.toISOString().split('T')[0];
      })(),
      dateType:   'use_by',
      storageTip: 'Store in the fridge. Do not refreeze once opened.',
      disposal:   'Empty the tray into food waste, then rinse and place the plastic tray in recycling if your council accepts it.',
      confidence: 'high',
    },
  };

  // Round-robin index for cycling demo results when there is no image hint
  let _demoIndex = 0;
  const _demoKeys = ['milk', 'letter', 'readymeal'];

  /**
   * Return a demo result. Cycles through milk → letter → readymeal.
   * @returns {object}
   */
  function getDemoResult() {
    const key = _demoKeys[_demoIndex % _demoKeys.length];
    _demoIndex++;
    return Object.assign({}, DEMO_RESULTS[key]);
  }

  // ── Gemini API ────────────────────────────────────────────────────────────

  const GEMINI_ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  /**
   * Build the Gemini request body.
   * @param {string} base64  - Base64-encoded image data (no prefix).
   * @param {string} mime    - MIME type, e.g. 'image/jpeg'.
   * @returns {object}
   */
  function buildRequestBody(base64, mime) {
    const promptText = `You are an accessibility assistant helping a visually impaired person.
Examine this image and respond with a SINGLE valid JSON object — no markdown, no extra text.

JSON schema:
{
  "kind": "food|post|sign|other",
  "name": "short product or document name",
  "summary": "1-2 sentence plain description",
  "date": "YYYY-MM-DD or null",
  "dateType": "use_by|best_before|expiry|unknown|null",
  "storageTip": "one sentence on how to store it, or empty string",
  "disposal": "one sentence on how to dispose or recycle it",
  "confidence": "high|medium|low"
}

Rules:
- Extract any visible date. If multiple dates exist, use the earliest.
- date must be ISO format YYYY-MM-DD or null.
- disposal must be exactly one short sentence.
- confidence is low if the image is blurry or the label is partly hidden.`;

    return {
      contents: [{
        parts: [
          { text: promptText },
          { inline_data: { mime_type: mime, data: base64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
    };
  }

  /**
   * Call the Gemini Vision API.
   * @param {string} base64
   * @param {string} mime
   * @param {string} apiKey
   * @returns {Promise<object>} Parsed scan result.
   */
  async function callGemini(base64, mime, apiKey) {
    const url  = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
    const body = buildRequestBody(base64, mime);

    const response = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseAIResponse(rawText);
  }

  /**
   * Attempt to parse the AI's JSON response.
   * Strips any accidental markdown code fences.
   * @param {string} raw
   * @returns {object}
   */
  function parseAIResponse(raw) {
    const cleaned = raw.replace(/```json|```/gi, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // If we can't parse, return a low-confidence fallback
      return {
        kind:       'other',
        name:       'Unknown item',
        summary:    raw.slice(0, 200) || 'Could not read the label.',
        date:       null,
        dateType:   null,
        storageTip: '',
        disposal:   'Check the label manually or ask for assistance.',
        confidence: 'low',
      };
    }
  }

  // ── File → base64 helper ─────────────────────────────────────────────────

  /**
   * Convert a File object to a base64 string.
   * @param {File} file
   * @returns {Promise<{base64: string, mime: string}>}
   */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // result is "data:<mime>;base64,<data>"
        const [header, data] = reader.result.split(',');
        const mime = header.replace('data:', '').replace(';base64', '');
        resolve({ base64: data, mime });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Main scan flow ────────────────────────────────────────────────────────

  /**
   * Process a photo: call AI or fall back to demo.
   * @param {File} file
   * @returns {Promise<object>} Scan result.
   */
  async function processPhoto(file) {
    const settings = Settings.load();
    const apiKey   = settings.apiKey || '';

    if (!apiKey) {
      // No key → demo mode
      return getDemoResult();
    }

    try {
      const { base64, mime } = await fileToBase64(file);
      return await callGemini(base64, mime, apiKey);
    } catch (err) {
      console.warn('Scan: AI call failed, using demo result.', err);
      return getDemoResult();
    }
  }

  // ── Spoken result builder ────────────────────────────────────────────────

  /**
   * Turn a scan result object into a plain-English spoken message.
   * @param {object} result
   * @param {string} detailLevel - 'brief' | 'detailed'
   * @returns {string}
   */
  function buildSpokenMessage(result, detailLevel) {
    const parts = [];

    // Name & summary
    parts.push(result.name + '.');
    if (detailLevel === 'detailed' && result.summary) {
      parts.push(result.summary);
    }

    // Date handling
    if (result.date) {
      const dateMsg = Tips.explainDate(result.date, result.dateType);
      parts.push(dateMsg);
    } else if (result.kind === 'food') {
      parts.push('No date found on the label.');
    }

    // Storage tip (detailed only)
    if (detailLevel === 'detailed' && result.storageTip) {
      parts.push(result.storageTip);
    }

    // Disposal
    if (result.disposal) {
      parts.push(result.disposal);
    }

    // Low confidence warning
    if (result.confidence === 'low') {
      parts.push('I am not fully confident in this reading. Please try scanning again in better light.');
    }

    return parts.join(' ');
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  function showLoading(visible) {
    const el = document.getElementById('scan-loading');
    const btn = document.getElementById('btn-scan');
    if (!el) return;
    if (visible) {
      el.classList.remove('visually-hidden');
      el.removeAttribute('aria-hidden');
      if (btn) btn.disabled = true;
    } else {
      el.classList.add('visually-hidden');
      el.setAttribute('aria-hidden', 'true');
      if (btn) btn.disabled = false;
    }
  }

  function showResult(result) {
    const card = document.getElementById('scan-result');
    if (!card) return;

    document.getElementById('result-name').textContent     = result.name || '';
    document.getElementById('result-summary').textContent  = result.summary || '';
    document.getElementById('result-date').textContent     = result.date
      ? `${result.date} (${result.dateType || 'unknown'})`
      : 'None found';
    document.getElementById('result-storage').textContent  = result.storageTip || '—';
    document.getElementById('result-disposal').textContent = result.disposal || '—';
    document.getElementById('result-confidence').textContent = result.confidence || '—';

    card.classList.remove('visually-hidden');

    // Show "Save to kitchen" only for food
    const btnSave = document.getElementById('btn-save-kitchen');
    if (btnSave) {
      if (result.kind === 'food') {
        btnSave.classList.remove('visually-hidden');
        btnSave.dataset.result = JSON.stringify(result);
      } else {
        btnSave.classList.add('visually-hidden');
      }
    }
  }

  // ── Live camera ──────────────────────────────────────────────────────────
  // Runs the camera inside the page so a photo is read the moment it is
  // taken, with no "Use Photo" confirmation step from the phone's camera app.
  // Needs a secure context (https:// or localhost); otherwise falls back to
  // the native camera via the file input.

  const MAX_PHOTO_SIDE = 1600;   // px – keeps the upload small and fast
  let _stream = null;

  function cameraSupported() {
    return window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
  }

  /**
   * Start the rear camera and show the live preview.
   * @returns {Promise<boolean>} false if the camera could not be started.
   */
  async function openCamera() {
    if (!cameraSupported()) return false;

    try {
      _stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:      { ideal: 1920 },
          height:     { ideal: 1080 },
        },
        audio: false,
      });
    } catch (err) {
      console.warn('Scan: could not start live camera.', err);
      return false;
    }

    const video = document.getElementById('camera-video');
    video.srcObject = _stream;
    await video.play().catch(() => {});

    document.getElementById('scan-result').classList.add('visually-hidden');
    document.getElementById('btn-scan').hidden = true;
    document.getElementById('scan-hint').hidden = true;
    document.getElementById('camera-view').hidden = false;
    document.getElementById('btn-shutter').focus();

    Voice.speak('Camera on. Hold the label in front of your phone, then tap the screen to take the photo.');
    return true;
  }

  /** Stop the camera and hide the live preview. */
  function closeCamera() {
    if (_stream) {
      _stream.getTracks().forEach(track => track.stop());
      _stream = null;
    }
    const video = document.getElementById('camera-video');
    if (video) video.srcObject = null;

    const view = document.getElementById('camera-view');
    if (view) view.hidden = true;
    const btnScan = document.getElementById('btn-scan');
    if (btnScan) btnScan.hidden = false;
    const hint = document.getElementById('scan-hint');
    if (hint) hint.hidden = false;
  }

  /**
   * Grab the current video frame as a JPEG.
   * @returns {Promise<Blob|null>}
   */
  function captureFrame() {
    const video = document.getElementById('camera-video');
    if (!video.videoWidth) return Promise.resolve(null);

    const scale  = Math.min(1, MAX_PHOTO_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  }

  // ── Photo handling ───────────────────────────────────────────────────────

  /**
   * Read a photo aloud and show the result card.
   * @param {Blob} photo
   */
  async function handlePhoto(photo) {
    showLoading(true);
    Voice.speak('Reading the label… please wait.', false);

    try {
      const result = await processPhoto(photo);
      showLoading(false);
      showResult(result);

      const settings = Settings.load();
      const msg = buildSpokenMessage(result, settings.detailLevel);
      Voice.speak(msg);

      // Expose result for app.js to use (e.g. kitchen save)
      Scan._lastResult = result;
    } catch (err) {
      showLoading(false);
      Voice.speak('Something went wrong while reading the label. Please try again.');
      console.error('Scan error:', err);
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    const cameraInput = document.getElementById('camera-input');
    const btnScan     = document.getElementById('btn-scan');
    const btnRescan   = document.getElementById('btn-rescan');
    const btnSave     = document.getElementById('btn-save-kitchen');
    const video       = document.getElementById('camera-video');
    const btnShutter  = document.getElementById('btn-shutter');
    const btnCancel   = document.getElementById('btn-camera-cancel');

    if (!cameraInput || !btnScan) return;

    // Big scan button opens the live camera, or the native camera as a fallback
    // (If the camera is already open – e.g. the "take photo" voice command – take the picture.)
    btnScan.addEventListener('click', async () => {
      if (_stream) return takePhoto();
      const opened = await openCamera();
      if (!opened) cameraInput.click();
    });

    // Shutter: capture and read straight away – no confirmation step
    async function takePhoto() {
      if (!_stream) return;
      const photo = await captureFrame();
      closeCamera();
      if (!photo) {
        Voice.speak('The camera was not ready. Please try again.');
        return;
      }
      handlePhoto(photo);
    }
    if (btnShutter) btnShutter.addEventListener('click', takePhoto);
    if (video)      video.addEventListener('click', takePhoto);   // tap anywhere on the preview

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        closeCamera();
        Voice.speak('Camera closed.');
        btnScan.focus();
      });
    }

    // Don't leave the camera running in the background
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) closeCamera();
    });

    // Fallback: file selected from the native camera → process
    cameraInput.addEventListener('change', () => {
      const file = cameraInput.files[0];
      if (!file) return;

      // Reset for next scan
      cameraInput.value = '';
      handlePhoto(file);
    });

    // Rescan
    if (btnRescan) {
      btnRescan.addEventListener('click', () => {
        document.getElementById('scan-result').classList.add('visually-hidden');
        Scan._lastResult = null;
        Voice.speak('Ready to scan. Press the Scan button.');
      });
    }

    // Save to kitchen
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        if (Scan._lastResult) {
          Kitchen.saveItem(Scan._lastResult);
          btnSave.classList.add('visually-hidden');
          Voice.speak(`${Scan._lastResult.name} saved to your kitchen.`);
        }
      });
    }
  }

  return { init, processPhoto, buildSpokenMessage, getDemoResult, closeCamera, _lastResult: null };
})();
