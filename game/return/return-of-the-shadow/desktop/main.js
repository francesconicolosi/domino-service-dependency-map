'use strict';

// ============================================================================
//  Return of the Shadow — Electron desktop shell.
//
//  The game is the unmodified static web build (index.html + src/ + love-shim.js
//  + touch.js + battle-theme.mp3). This process just opens a window and serves
//  those files to it over a custom `app://` scheme. Using a registered scheme
//  (instead of file://) gives the page ONE stable, secure origin — so the
//  game's localStorage save progress survives restarts — and lets us resolve
//  requests by pathname only, which transparently ignores the `?v=` cache-bust
//  query on the <script>/<audio> URLs. `net.fetch` of the underlying file URL
//  streams and honours Range requests, so the mp3 soundtrack plays/seeks fine.
// ============================================================================

const { app, BrowserWindow, Menu, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// Where the game's static files live: unpacked to resources/game when packaged,
// or the parent directory (the game folder itself) in development.
const GAME_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'game')
  : path.join(__dirname, '..');

// Must be called before app is ready.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 640,
    minHeight: 360,
    backgroundColor: '#000000',
    title: 'Return of the Shadow',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL('app://app/index.html');
  return win;
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Game',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: (_i, w) => w && w.reload() },
        {
          label: 'Toggle Fullscreen',
          accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11',
          click: (_i, w) => w && w.setFullScreen(!w.isFullScreen()),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  // Serve the packaged game over app://. The path is taken from the URL pathname
  // only, so `foo.js?v=123` maps to `<GAME_ROOT>/foo.js`. A normalize + prefix
  // check blocks any `..` path traversal outside the game folder.
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    const file = path.join(GAME_ROOT, path.normalize(rel));
    if (file !== GAME_ROOT && !file.startsWith(GAME_ROOT + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });

  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
