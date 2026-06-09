import fs from 'fs';

fs.copyFileSync('test_prod.png', 'public/logo.png');
fs.copyFileSync('test_prod.png', 'public/icon-192x192.png');
fs.copyFileSync('test_prod.png', 'public/icon-512x512.png');

