const fs   = require('fs');
const path = require('path');
const appJsonPath = path.join(__dirname, '..', 'app.json');
const cfg = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
cfg.expo.web = cfg.expo.web || {};
cfg.expo.web.baseUrl = '/bisou-sucre-paques';
fs.writeFileSync(appJsonPath, JSON.stringify(cfg, null, 2));
console.log('baseUrl injected:', cfg.expo.web.baseUrl);
