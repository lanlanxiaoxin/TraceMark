const e = require('electron');
console.log('typeof e:', typeof e);
if (typeof e === 'string') {
  console.log('e is a string (path):', e);
} else if (e && typeof e === 'object') {
  console.log('e is an object, keys:', Object.keys(e).slice(0, 10));
  console.log('has app:', 'app' in e);
  console.log('app type:', typeof e.app);
} else {
  console.log('e is something else:', e);
}
