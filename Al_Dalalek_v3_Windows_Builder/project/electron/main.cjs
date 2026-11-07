"use strict";
const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('node:path');

// Bundled user interface: keep Node APIs out of all renderer windows.
function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 850,
    minWidth: 900,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f4f7fb',
    icon: path.join(__dirname, 'assets', 'app.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
  });

  // Attachments open in the operating system's default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  const htmlPath = path.join(__dirname, '..', 'dist', 'index.html');
  win.loadFile(htmlPath).then(() => {
    if (!win.isDestroyed()) win.show();
  }).catch((err) => {
    dialog.showErrorBox('Al Dalalek', `Could not open the app.\n${String(err)}`);
    if (!win.isDestroyed()) win.close();
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
