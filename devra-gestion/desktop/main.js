// Application de bureau (Windows, macOS) : ouvre l'outil de gestion dans sa
// propre fenêtre et affiche ses notifications dans celles du système.
//
// - L'adresse du serveur est demandée au premier lancement (aucune adresse,
//   aucun nom d'entreprise n'est écrit dans l'application).
// - Toutes les 20 secondes, l'application lit GET /api/notifications avec la
//   session de l'utilisateur connecté dans la fenêtre.
// - Fermer la fenêtre la cache seulement : l'application reste dans la barre
//   des tâches (Windows) ou la barre des menus (macOS) pour les notifications.
"use strict";

const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  ipcMain,
  nativeImage,
  net,
  session,
  shell,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");

/** Identique à « appId » dans package.json (exigé par les notifications Windows). */
const APP_ID = "ch.gestion.bureau";
const PARTITION = "persist:gestion";
const POLL_MS = 20_000;
const IS_MAC = process.platform === "darwin";
const IS_WINDOWS = process.platform === "win32";
const STARTED_HIDDEN = process.argv.includes("--cache");

let mainWindow = null;
let setupWindow = null;
let tray = null;
let quitting = false;
let pollTimer = null;
/** Les notifications doivent rester référencées pour que le clic fonctionne. */
const shown = new Set();

// ---------------------------------------------------------------------------
// Réglages (adresse du serveur, dernière notification vue)
// ---------------------------------------------------------------------------

const configFile = () => path.join(app.getPath("userData"), "reglages.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configFile(), "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(next, null, 2));
  return next;
}

/** « gestion.exemple.ch » → « https://gestion.exemple.ch », ou null si invalide. */
function normalizeServerUrl(input) {
  const value = String(input ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function serverUrl() {
  return normalizeServerUrl(readConfig().serverUrl);
}

function sameOrigin(target) {
  const server = serverUrl();
  try {
    return server !== null && new URL(target).origin === server;
  } catch {
    return false;
  }
}

function openExternal(target) {
  try {
    const url = new URL(target);
    if (["http:", "https:", "mailto:", "tel:"].includes(url.protocol))
      void shell.openExternal(url.href);
  } catch {
    // Adresse invalide : ignorée.
  }
}

// ---------------------------------------------------------------------------
// Fenêtres
// ---------------------------------------------------------------------------

function appSession() {
  return session.fromPartition(PARTITION);
}

function showMainWindow(target) {
  const server = serverUrl();
  if (!server) {
    openSetupWindow();
    return;
  }
  if (!mainWindow) createMainWindow(server);
  if (target) {
    const url = new URL(target, server);
    if (url.origin === server) void mainWindow.loadURL(url.href);
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow(server, { hidden = false } = {}) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 500,
    show: false,
    title: "Gestion",
    icon: path.join(__dirname, "assets", "icon.png"),
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0a",
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (!hidden) mainWindow.show();
  });

  // Liens vers d'autres sites (sites des clients, e-banking…) : navigateur habituel.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (sameOrigin(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          icon: path.join(__dirname, "assets", "icon.png"),
          webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true },
        },
      };
    }
    openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!sameOrigin(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  // Fermer = cacher : l'application reste active pour les notifications.
  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.on("focus", () => mainWindow?.flashFrame(false));

  void mainWindow.loadURL(server);
}

function openSetupWindow() {
  if (setupWindow) {
    setupWindow.show();
    setupWindow.focus();
    return;
  }
  setupWindow = new BrowserWindow({
    width: 520,
    height: 460,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: "Gestion · Adresse du serveur",
    icon: path.join(__dirname, "assets", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  setupWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  setupWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  setupWindow.on("closed", () => {
    setupWindow = null;
  });
  void setupWindow.loadFile(path.join(__dirname, "setup.html"));
}

// Page « Adresse du serveur » : vérifie que l'outil répond avant d'enregistrer.
ipcMain.handle("reglages:lire", () => ({ serverUrl: readConfig().serverUrl ?? "" }));
ipcMain.handle("reglages:enregistrer", async (_event, input) => {
  const server = normalizeServerUrl(input);
  if (!server)
    return { ok: false, error: "Adresse invalide. Exemple : https://gestion.exemple.ch" };
  try {
    const response = await net.fetch(`${server}/connexion`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return { ok: false, error: `Le serveur répond avec une erreur (${response.status}).` };
    }
  } catch {
    return {
      ok: false,
      error: "Serveur injoignable. Vérifiez l'adresse et votre connexion à internet.",
    };
  }
  const changed = server !== serverUrl();
  writeConfig({ serverUrl: server, ...(changed ? { cursor: null } : {}) });
  if (changed && mainWindow) {
    mainWindow.destroy();
    mainWindow = null;
  }
  setupWindow?.close();
  showMainWindow();
  startPolling();
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/** GET avec les cookies de la session de la fenêtre (utilisateur connecté). */
function getJson(url) {
  return new Promise((done) => {
    const request = net.request({ url, session: appSession(), useSessionCookies: true });
    request.setHeader("Accept", "application/json");
    const timer = setTimeout(() => {
      request.abort();
      resolve(null);
    }, 15_000);
    let settled = false;
    function resolve(value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done(value);
    }
    let body = "";
    request.on("response", (response) => {
      response.on("data", (chunk) => {
        body += chunk.toString("utf8");
      });
      response.on("end", () => {
        if (response.statusCode !== 200) return resolve(null);
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
      response.on("error", () => resolve(null));
    });
    request.on("error", () => resolve(null));
    request.end();
  });
}

function notify(title, body, target) {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title, body, silent: false });
  shown.add(notification);
  const forget = () => shown.delete(notification);
  notification.on("click", () => {
    forget();
    showMainWindow(target);
  });
  notification.on("close", forget);
  notification.show();
  if (IS_WINDOWS && mainWindow && !mainWindow.isFocused()) mainWindow.flashFrame(true);
}

/** La page indiquée est-elle déjà affichée dans la fenêtre au premier plan ? */
function alreadyVisible(target) {
  if (!mainWindow || !mainWindow.isVisible() || !mainWindow.isFocused()) return false;
  try {
    const current = new URL(mainWindow.webContents.getURL());
    return current.pathname === new URL(target, current.origin).pathname;
  } catch {
    return false;
  }
}

function updateBadge(count) {
  const label =
    count > 0 ? `${count} message${count > 1 ? "s" : ""} non lu${count > 1 ? "s" : ""}` : "";
  if (IS_MAC) app.setBadgeCount(count);
  if (IS_WINDOWS && mainWindow) {
    mainWindow.setOverlayIcon(
      count > 0 ? nativeImage.createFromPath(path.join(__dirname, "assets", "badge.png")) : null,
      label,
    );
  }
  tray?.setToolTip(label ? `Gestion · ${label}` : "Gestion");
}

async function poll() {
  const server = serverUrl();
  if (!server) return;
  const config = readConfig();
  const cursor = Number.isInteger(config.cursor) ? config.cursor : null;
  const url = new URL("/api/notifications", server);
  if (cursor !== null) url.searchParams.set("apres", String(cursor));
  const data = await getJson(url.href);
  if (!data) return; // pas connecté, ou serveur injoignable : on réessaiera.

  if (typeof data.unread === "number") updateBadge(data.unread);
  const items = Array.isArray(data.notifications) ? data.notifications : [];
  // Après une longue absence (ordinateur éteint), un seul résumé.
  if (items.length > 3) {
    notify("Gestion", `${items.length} nouvelles notifications`, items.at(-1).url);
  } else {
    for (const item of items) {
      if (!alreadyVisible(item.url)) notify(item.title, item.body, item.url);
    }
  }
  if (typeof data.latest === "number" && data.latest !== cursor)
    writeConfig({ cursor: data.latest });
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  void poll();
  pollTimer = setInterval(() => void poll(), POLL_MS);
}

// ---------------------------------------------------------------------------
// Barre des tâches / des menus, menu de l'application
// ---------------------------------------------------------------------------

function openAtLogin() {
  return app.getLoginItemSettings(IS_WINDOWS ? { args: ["--cache"] } : undefined).openAtLogin;
}

function setOpenAtLogin(enabled) {
  app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true, args: ["--cache"] });
  writeConfig({ openAtLogin: enabled });
  refreshTrayMenu();
}

function refreshTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Ouvrir", click: () => showMainWindow() },
      { label: "Discussions", click: () => showMainWindow("/discussions") },
      { type: "separator" },
      {
        label: "Lancer au démarrage de l'ordinateur",
        type: "checkbox",
        checked: openAtLogin(),
        click: (item) => setOpenAtLogin(item.checked),
      },
      { label: "Changer l'adresse du serveur…", click: () => openSetupWindow() },
      { type: "separator" },
      { label: "Quitter", click: () => app.quit() },
    ]),
  );
}

function createTray() {
  const icon = IS_MAC
    ? nativeImage.createFromPath(path.join(__dirname, "assets", "trayTemplate.png"))
    : nativeImage.createFromPath(path.join(__dirname, "assets", "tray.png"));
  if (IS_MAC) icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip("Gestion");
  tray.on("click", () => showMainWindow());
  refreshTrayMenu();
}

/** Menu de l'application : indispensable sur macOS pour copier-coller (⌘C, ⌘V). */
function createAppMenu() {
  const back = () => mainWindow?.webContents.navigationHistory.goBack();
  const forward = () => mainWindow?.webContents.navigationHistory.goForward();
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(IS_MAC
        ? [
            {
              label: app.name,
              submenu: [
                { role: "about", label: "À propos de Gestion" },
                { type: "separator" },
                { label: "Adresse du serveur…", click: () => openSetupWindow() },
                { type: "separator" },
                { role: "hide", label: "Masquer Gestion" },
                { role: "hideOthers", label: "Masquer les autres" },
                { role: "unhide", label: "Tout afficher" },
                { type: "separator" },
                { role: "quit", label: "Quitter Gestion" },
              ],
            },
          ]
        : [
            {
              label: "Fichier",
              submenu: [
                { label: "Adresse du serveur…", click: () => openSetupWindow() },
                { type: "separator" },
                { role: "quit", label: "Quitter" },
              ],
            },
          ]),
      {
        label: "Édition",
        submenu: [
          { role: "undo", label: "Annuler" },
          { role: "redo", label: "Rétablir" },
          { type: "separator" },
          { role: "cut", label: "Couper" },
          { role: "copy", label: "Copier" },
          { role: "paste", label: "Coller" },
          { role: "selectAll", label: "Tout sélectionner" },
        ],
      },
      {
        label: "Affichage",
        submenu: [
          { label: "Précédent", accelerator: IS_MAC ? "Cmd+[" : "Alt+Left", click: back },
          { label: "Suivant", accelerator: IS_MAC ? "Cmd+]" : "Alt+Right", click: forward },
          { role: "reload", label: "Actualiser" },
          { type: "separator" },
          { role: "resetZoom", label: "Taille réelle" },
          { role: "zoomIn", label: "Zoom avant" },
          { role: "zoomOut", label: "Zoom arrière" },
          { type: "separator" },
          { role: "togglefullscreen", label: "Plein écran" },
        ],
      },
      { role: "windowMenu", label: "Fenêtre" },
    ]),
  );
}

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => showMainWindow());

  app.whenReady().then(() => {
    if (IS_WINDOWS) app.setAppUserModelId(APP_ID);
    const windowSession = appSession();
    // Permet à l'outil de reconnaître l'application (notifications gérées ici).
    windowSession.setUserAgent(`${windowSession.getUserAgent()} GestionBureau/${app.getVersion()}`);
    // Seule la copie dans le presse-papiers est autorisée aux pages.
    windowSession.setPermissionRequestHandler((_wc, permission, callback) =>
      callback(permission === "clipboard-sanitized-write"),
    );

    createAppMenu();
    createTray();
    // Premier lancement : démarrage avec l'ordinateur activé (modifiable dans le menu).
    if (readConfig().openAtLogin === undefined) setOpenAtLogin(true);

    const server = serverUrl();
    const hidden = STARTED_HIDDEN || (IS_MAC && app.getLoginItemSettings().wasOpenedAtLogin);
    if (server) {
      createMainWindow(server, { hidden });
      startPolling();
    } else {
      openSetupWindow();
    }
  });

  app.on("activate", () => showMainWindow());
  app.on("before-quit", () => {
    quitting = true;
  });
  // L'application reste active sans fenêtre (barre des tâches / des menus).
  app.on("window-all-closed", () => {});
}
