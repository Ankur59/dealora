// background.js — Manifest V3 Service Worker
// Minimal service worker required by the MV3 spec.

self.addEventListener('install', () => {
    console.log('[Dealora Cookie Sync] Installed.');
    self.skipWaiting();
});

self.addEventListener('activate', () => {
    console.log('[Dealora Cookie Sync] Service worker active.');
});
