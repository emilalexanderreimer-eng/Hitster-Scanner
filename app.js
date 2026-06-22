/**
 * Verbindet QR-Scanner (html5-qrcode) und Spotify-Wiedergabe (spotify.js).
 * Zeigt absichtlich nie Titel/Interpret an — das wäre die Antwort des
 * Rate-Spiels, genau wie beim echten Hitster.
 */

const RESCAN_COOLDOWN_MS = 3000;

let html5QrCode = null;
let lastScan = { data: null, time: 0 };

/* ---------- Parsing der gescannten QR-Inhalte ---------- */

function parseScannedContent(raw) {
  const trimmed = (raw || "").trim();

  const uriMatch = trimmed.match(/^spotify:track:([a-zA-Z0-9]+)$/);
  if (uriMatch) return { type: "track", uri: trimmed };

  const urlMatch = trimmed.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
  if (urlMatch) return { type: "track", uri: `spotify:track:${urlMatch[1]}` };

  if (/open\.spotify\.com\/search\//.test(trimmed)) {
    return { type: "search", url: trimmed };
  }

  return { type: "unknown", raw: trimmed };
}

/* ---------- UI Helpers ---------- */

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => { el.hidden = el.id !== id; });
}

function setLoginStatus(msg) {
  document.getElementById("login-status").textContent = msg || "";
}

function setConnectionState(connected, text) {
  document.getElementById("connection-dot").classList.toggle("on", connected);
  document.getElementById("connection-text").textContent = text;
}

function setFeedback(text, showFallbackUrl) {
  document.getElementById("feedback-text").textContent = text;
  const fallbackBtn = document.getElementById("search-fallback-btn");
  if (showFallbackUrl) {
    fallbackBtn.hidden = false;
    fallbackBtn.dataset.url = showFallbackUrl;
  } else {
    fallbackBtn.hidden = true;
    delete fallbackBtn.dataset.url;
  }
}

/* ---------- QR-Scanner ---------- */

async function startScanner() {
  html5QrCode = new Html5Qrcode("qr-reader");
  try {
    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 240 },
      onScanSuccess,
      () => {} // per-Frame-Fehler sind normal & sehr häufig — ignorieren
    );
  } catch (err) {
    setFeedback("Kamera konnte nicht gestartet werden: " + (err.message || err));
  }
}

async function stopScanner() {
  if (html5QrCode) {
    try { await html5QrCode.stop(); } catch (e) { /* ignore */ }
    html5QrCode = null;
  }
}

async function onScanSuccess(decodedText) {
  const now = Date.now();
  if (decodedText === lastScan.data && now - lastScan.time < RESCAN_COOLDOWN_MS) {
    return; // gleiche Karte noch im Bild
  }
  lastScan = { data: decodedText, time: now };

  const parsed = parseScannedContent(decodedText);

  if (parsed.type === "track") {
    setFeedback("Wird gestartet …");
    try {
      await playTrackUri(parsed.uri);
      setFeedback("▶ Wird abgespielt");
    } catch (err) {
      setFeedback("Wiedergabe fehlgeschlagen: " + err.message);
    }
    return;
  }

  if (parsed.type === "search") {
    setFeedback("Kein exakter Track-Link auf dieser Karte:", parsed.url);
    return;
  }

  setFeedback("QR-Code nicht erkannt (kein Spotify-Link).");
}

/* ---------- Player verbinden ---------- */

async function connectPlayerAndScan() {
  setConnectionState(false, "Verbinde mit Spotify …");
  try {
    await initPlayer();
    setConnectionState(true, "Mit Spotify verbunden");
    await startScanner();
  } catch (err) {
    setConnectionState(false, "Verbindung fehlgeschlagen: " + err.message);
  }
}

/* ---------- Init ---------- */

async function init() {
  const redirectUri = getRedirectUri();
  document.getElementById("redirect-uri-display").textContent = redirectUri;
  document.getElementById("client-id-input").value = getClientId();

  document.getElementById("copy-redirect-btn").addEventListener("click", () => {
    navigator.clipboard?.writeText(redirectUri);
    setLoginStatus("Redirect-URI kopiert.");
  });

  document.getElementById("save-client-id-btn").addEventListener("click", () => {
    setClientId(document.getElementById("client-id-input").value);
    setLoginStatus("Client-ID gespeichert.");
  });

  document.getElementById("login-btn").addEventListener("click", async () => {
    setClientId(document.getElementById("client-id-input").value);
    try {
      await startLogin();
    } catch (err) {
      setLoginStatus(err.message);
    }
  });

  document.getElementById("search-fallback-btn").addEventListener("click", (ev) => {
    const url = ev.target.dataset.url;
    if (url) window.open(url, "_blank", "noopener");
  });

  document.getElementById("play-pause-btn").addEventListener("click", async () => {
    await togglePlayPause();
    const btn = document.getElementById("play-pause-btn");
    btn.textContent = btn.textContent === "Pause" ? "Weiter" : "Pause";
  });

  document.getElementById("disconnect-btn").addEventListener("click", async () => {
    await stopScanner();
    logout();
    showScreen("login-screen");
    setLoginStatus("Getrennt.");
  });

  // Falls wir gerade von der Spotify-Login-Seite zurückkommen:
  try {
    const handled = await handleRedirectCallback();
    if (handled) setLoginStatus("Erfolgreich verbunden — starte Player …");
  } catch (err) {
    setLoginStatus(err.message);
  }

  if (isLoggedIn()) {
    showScreen("scanner-screen");
    await connectPlayerAndScan();
  } else {
    showScreen("login-screen");
  }
}

document.addEventListener("DOMContentLoaded", init);
