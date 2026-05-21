const { app, BrowserWindow } = require('electron');
console.log('SUCCESS: app and BrowserWindow are available');
console.log('process.type:', process.type);
app.whenReady().then(() => {
  console.log('App ready!');
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: __dirname + '/out/preload/index.js',
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadURL('http://localhost:5173').catch(() => {
    win.loadFile(__dirname + '/out/renderer/index.html');
  });
  console.log('Window created!');
});
setTimeout(() => process.exit(0), 5000);
