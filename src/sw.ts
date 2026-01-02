/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    console.log('Push event received', event);
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        console.warn('Push event contain non-JSON data', event.data?.text());
        data = { title: 'Jornify', body: event.data?.text() || '¡Es hora de fichar!' };
    }

    const title = data.title || 'Jornify';
    const options = {
        body: data.body || '¡Es hora de fichar!',
        icon: '/pwa-192x192.png',
        badge: '/favicon.ico',
        vibrate: [200, 100, 200],
        tag: data.tag, // Permite que notificaciones con distinto tag no se pisen
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.openWindow(event.notification.data.url)
    );
});
