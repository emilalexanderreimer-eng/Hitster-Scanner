/**
 * Spotify-Anbindung für die statische Web-Seite — komplett ohne Backend:
 * - Authorization Code Flow MIT PKCE (kein Client-Secret nötig, dafür
 *   gedacht für genau diesen Fall: Single-Page-App ohne Server)
 * - Web Playback SDK für die eigentliche Wiedergabe direkt im Browser-Tab
 *
 * Der alte "Implicit Grant Flow" ist von Spotify offiziell deprecated
 * und wird entfernt — PKCE ist der aktuell empfohlene Weg ohne Backend.
 */

const SPOTIFY_AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const SPOTIFY_SCOPES = "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state";

const STORAGE_KEYS = {
  clientId: "hitster_spotify_client_id",
  verifier: "hitster_spotify_code_verifier",
  accessToken: "hitster_spotify_access_token",
  expiresAt: "hitster_spotify_expires_at",
  refreshToken: "hitster_spotify_refresh_token"
};

let player = null;
let deviceId = null;

/* ---------- Helpers ---------- */

function getRedirectUri() {
  return window.location.origin + window.location.pathname;
}

function getClientId() {
  return localStorage.getItem(STORAGE_KEYS.clientId) || "";
}

function setClientId(id) {
  localStorage.setItem(STORAGE_KEYS.clientId, id.trim());
}

function generateRandomString(length) {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  let text = "";
  values.forEach((v) => { text += possible[v % possible.length]; });
  return text;
}

async function sha256(plain) {
  const data = new TextEncoder().encode(plain);
  return crypto.subtle.digest("SHA-256", data);
}

function base64UrlEncode(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let str = "";
  bytes.forEach((b) => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateCodeChallenge(verifier) {
  return base64UrlEncode(await sha256(verifier));
}

function saveTokens(data) {
  const expiresAt = Date.now() + (data.expires_in - 30) * 1000;
  localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
  localStorage.setItem(STORAGE_KEYS.expiresAt, String(expiresAt));
  if (data.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
  }
}

/* ---------- PKCE Auth Flow ---------- */

async function startLogin() {
  const clientId = getClientId();
  if (!clientId) throw new Error("Bitte zuerst deine Spotify Client-ID eintragen und speichern.");

  const verifier = generateRandomString(64);
  localStorage.setItem(STORAGE_KEYS.verifier, verifier);
  const challenge = await generateCodeChallenge(verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: SPOTIFY_SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge
  });

  window.location.href = `${SPOTIFY_AUTH_ENDPOINT}?${params.toString()}`;
}

// Wird beim Laden der Seite aufgerufen, falls wir gerade von Spotify zurückkommen.
async function handleRedirectCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const error = params.get("error");

  if (error) {
    history.replaceState({}, document.title, window.location.pathname);
    throw new Error(`Spotify hat die Anfrage abgelehnt: ${error}`);
  }
  if (!code) return false;

  const verifier = localStorage.getItem(STORAGE_KEYS.verifier);
  const clientId = getClientId();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    client_id: clientId,
    code_verifier: verifier
  });

  const res = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await res.json().catch(() => null);

  history.replaceState({}, document.title, window.location.pathname);

  if (!res.ok || !data) {
    throw new Error((data && data.error_description) || "Token-Austausch fehlgeschlagen.");
  }

  saveTokens(data);
  return true;
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
  const clientId = getClientId();
  if (!refreshToken) throw new Error("Keine gültige Sitzung — bitte neu verbinden.");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId
  });

  const res = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new Error((data && data.error_description) || "Sitzung erneuern fehlgeschlagen — bitte neu verbinden.");
  }
  saveTokens(data);
  return data.access_token;
}

async function getValidAccessToken() {
  const token = localStorage.getItem(STORAGE_KEYS.accessToken);
  const expiresAt = Number(localStorage.getItem(STORAGE_KEYS.expiresAt) || 0);
  if (token && Date.now() < expiresAt) return token;
  return refreshAccessToken();
}

function isLoggedIn() {
  return !!localStorage.getItem(STORAGE_KEYS.refreshToken);
}

function logout() {
  Object.values(STORAGE_KEYS)
    .filter((k) => k !== STORAGE_KEYS.clientId) // Client-ID merken wir uns
    .forEach((k) => localStorage.removeItem(k));
  if (player) {
    player.disconnect();
    player = null;
    deviceId = null;
  }
}

/* ---------- Web Playback SDK ---------- */

function loadSpotifySdkScript() {
  return new Promise((resolve) => {
    if (window.Spotify) { resolve(); return; }
    window.onSpotifyWebPlaybackSDKReady = resolve;
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    document.head.appendChild(script);
  });
}

async function initPlayer() {
  await loadSpotifySdkScript();

  return new Promise((resolve, reject) => {
    player = new Spotify.Player({
      name: "Hitster Scanner (Web)",
      getOAuthToken: (cb) => { getValidAccessToken().then(cb).catch(() => cb(null)); },
      volume: 0.8
    });

    player.addListener("ready", ({ device_id }) => {
      deviceId = device_id;
      resolve(device_id);
    });
    player.addListener("not_ready", () => { deviceId = null; });
    player.addListener("initialization_error", ({ message }) => reject(new Error(message)));
    player.addListener("authentication_error", ({ message }) => reject(new Error(message)));
    player.addListener("account_error", ({ message }) =>
      reject(new Error("Spotify Premium wird benötigt: " + message))
    );

    player.connect();
  });
}

async function playTrackUri(uri) {
  if (!deviceId) throw new Error("Noch nicht mit dem Player verbunden.");
  const token = await getValidAccessToken();
  const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ uris: [uri] })
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => null);
    throw new Error((data && data.error && data.error.message) || `Wiedergabe-Fehler (HTTP ${res.status})`);
  }
}

async function togglePlayPause() {
  if (!player) return;
  const state = await player.getCurrentState();
  if (!state) return;
  if (state.paused) await player.resume();
  else await player.pause();
}
