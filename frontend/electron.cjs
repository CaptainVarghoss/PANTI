// electron.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      // It's a good practice to use a preload script for security reasons,
      // to expose specific Node.js APIs to your renderer process.
      // preload: path.join(__dirname, 'preload.js')
    }
  });

  // Your notes mention dev/debug modes. This is a common pattern for Electron:
  // In development, you load from your dev server to get hot-reloading.
  // In production, you load the built HTML file.
  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';
  
  mainWindow.loadURL(startUrl);

  // Open the DevTools automatically in development.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
