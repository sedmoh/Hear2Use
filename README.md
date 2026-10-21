# Hear2Use

> **A voice-first web app helping blind and partially sighted students live independently.**
> Point at a label, hear what it says and what to do with it.

Project Made by: fariahxkhan, hayden-manu, JohannsSatheesh, vanesa-eliza, wasulajesse and sedmoh

---

## Contents
1. [How to run on a phone](#1-how-to-run-on-a-phone)
2. [File structure](#2-file-structure)
3. [How to switch AI provider](#3-how-to-switch-ai-provider)
4. [Two-minute demo script](#4-two-minute-demo-script)
5. [Screen-reader test checklist](#5-screen-reader-test-checklist)

---

## 1. How to run on a phone

The camera API requires HTTPS or localhost. Three options, easiest first.

### Option A — GitHub Pages (recommended for demo)

1. Fork or push this folder to a GitHub repository.
2. Go to **Settings → Pages → Deploy from branch** and select `main` / `root`.
3. GitHub gives you a URL like `https://yourusername.github.io/hear2use/`.
4. Open that URL on your phone. Done.

### Option B — Local server + Cloudflare Tunnel (no account needed)

```bash
# 1. Start a local web server on port 8080
#    Python 3 (macOS / Linux / Windows WSL)
python3 -m http.server 8080

# 2. In a second terminal, create a public HTTPS tunnel
npx cloudflared tunnel --url http://localhost:8080
# or, if you have cloudflared installed:
cloudflared tunnel --url http://localhost:8080
```

Cloudflare prints a URL like `https://random-words.trycloudflare.com`.
Open it on your phone. The HTTPS tunnel satisfies the camera requirement.

### Option C — ngrok

```bash
python3 -m http.server 8080
# in another terminal:
ngrok http 8080
```

Open the `https://` URL ngrok provides on your phone.

### Option D — VS Code Live Server extension

1. Install the **Live Server** extension in VS Code.
2. Open the `hear2use` folder in VS Code.
3. Right-click `index.html` → **Open with Live Server**.
4. On your phone, connect to the same Wi-Fi network and visit  
   `http://<your-computer-ip>:5500`.  
   ⚠️ This is HTTP, not HTTPS, so the camera may be blocked on iOS Safari.  
   Use Option A or B for iOS.

---

## 2. File structure

```
hear2use/
├── index.html          Single-page shell — tabs, sections, aria-live regions
├── styles.css          Mobile-first, WCAG 7:1 high-contrast, 64px touch targets
├── data/
│   └── places.json     15 demo places for a London campus area
└── js/
    ├── voice.js        speechSynthesis wrapper (speak, setRate, setLang)
    ├── tips.js         Date explanations, storage/disposal fallback text
    ├── settings.js     Load/save settings, high-contrast toggle, demo/clear buttons
    ├── scan.js         Camera, Gemini Vision API, demo mode, spoken result
    ├── kitchen.js      Saved items, expiry list, impact counters
    ├── places.js       Load places.json, group by category, spoken tour
    └── app.js          Boot, tab navigation, Repeat button, voice commands
```

---

## 3. How to switch AI provider

All AI code is in **`js/scan.js`**. There are two things to change.

### Current: Gemini 1.5 Flash

```js
// scan.js, top of file
const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
```

### Switch to GPT-4o (OpenAI)

1. Replace `callGemini(base64, mime, apiKey)` with:

```js
async function callOpenAI(base64, mime, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: buildPromptText() },    // extract prompt to a function
          { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
        ],
      }],
      max_tokens: 512,
    }),
  });
  const data = await response.json();
  return parseAIResponse(data.choices[0].message.content);
}
```

2. In `processPhoto`, call `callOpenAI` instead of `callGemini`.
3. Update the Settings label from "Gemini API key" to "OpenAI API key".

### ⚠️ Security warning (in the code too)

> This prototype sends the API key directly from the browser.  
> **A production product must proxy all AI calls through a server** so the key is never exposed to the client.

---

## 4. Two-minute demo script

Run through this with a sighted helper who presses the buttons.
The app must be open in a phone browser.

| Step | Action | Expected output |
|------|--------|----------------|
| **1. Welcome** | Open the app | App speaks: *"Welcome to Hear2Use. Use the tabs…"* |
| **2. Scan milk** | Tap **Scan** tab → tap **Scan label or letter** → choose any food photo (or allow demo) | App says *"Reading the label…"* then speaks the name, use-by date, whether it has passed, what use-by means, and how to recycle the bottle |
| **3. Save** | Tap **Save to my kitchen** | App says *"[Item] saved to your kitchen"* |
| **4. Kitchen** | Tap **Kitchen** tab | Saved item appears in the list with date badge |
| **5. What's expiring?** | Tap **What's expiring?** | App speaks any items expiring within the warning period |
| **6. Load demo data** | Tap **Settings** → **Load demo data** | Three items added; one is already expired |
| **7. Back to Kitchen** | Tap **Kitchen** tab | Expired item shows red badge; near-expiry shows amber |
| **8. Near me** | Tap **Places** tab → **What's near me?** | App speaks a grouped summary: campus services, groceries, pharmacies… |
| **9. Tour** | Tap **Next place** twice | App announces two places with walk time |
| **10. Details** | Tap **Details** | Full description + accessibility notes spoken |
| **11. Repeat** | Tap **Repeat last message** (always visible) | Last spoken message repeated |

**No API key needed** — the demo mode runs entirely offline with pre-written results.

---

## 5. Screen-reader test checklist

Run this with **VoiceOver (iOS)** or **TalkBack (Android)**, and also with a desktop keyboard only.

### Navigation

- [ ] Skip link appears on first Tab key press and moves focus to main content
- [ ] Tab through the four tab buttons — each reads its label and selected state
- [ ] After switching tab, focus moves to the section heading
- [ ] All buttons are reachable by Tab and activated by Enter / Space

### Scan section

- [ ] "Scan label or letter" button reads its label and hint text
- [ ] While loading, screen reader announces "Reading the label… please wait"
- [ ] Result card is announced with item name, date, storage, disposal and confidence
- [ ] "Save to my kitchen" button only appears for food items
- [ ] "Repeat last message" button is always reachable and works

### Kitchen section

- [ ] Each kitchen item reads: name, date, badge (expired / expiring soon / OK)
- [ ] Delete button reads "Delete [item name]"
- [ ] Impact counter numbers are announced with their labels
- [ ] "What's expiring?" speaks a complete sentence with item names and days

### Places section

- [ ] "What's near me?" speaks grouped summary
- [ ] Tour controls (Next, Repeat, Details, Stop) are all reachable
- [ ] Place cards in the visual list have readable headings and descriptions
- [ ] Independent badge is included in the reading

### Settings section

- [ ] All labels are associated with their controls (for="" matches id="")
- [ ] Toggle switches have visible labels and announce on/off state
- [ ] "Save settings", "Load demo data" and "Clear all data" buttons are reachable
- [ ] Confirm dialog for "Clear all data" is accessible

### High contrast / display

- [ ] High contrast is on by default — background is black, text is white
- [ ] No meaning is carried by colour alone (expired items have "Expired" text badge)
- [ ] All touch targets are visually large (≥ 64px tall)
- [ ] Focus outline is clearly visible in all sections

### Status / live regions

- [ ] Status bar updates are read by screen reader without double-speaking
- [ ] Error messages are announced immediately (assertive region)
- [ ] "Use app voice" off → screen reader still reads the aria-live status bar
