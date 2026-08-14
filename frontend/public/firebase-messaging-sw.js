// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Parse Firebase configuration from URL query params
const params = new URLSearchParams(self.location.search);
const firebaseConfig = {
    apiKey: params.get('apiKey') || '',
    authDomain: params.get('authDomain') || '',
    projectId: params.get('projectId') || '',
    storageBucket: params.get('storageBucket') || '',
    messagingSenderId: params.get('messagingSenderId') || '',
    appId: params.get('appId') || '',
    measurementId: params.get('measurementId') || ''
};

// Initialize Firebase in service worker if credentials are present
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    try {
        firebase.initializeApp(firebaseConfig);
        const messaging = firebase.messaging();

        // Handle background messages
        messaging.onBackgroundMessage((payload) => {
            console.log('[firebase-messaging-sw.js] Received background message', payload);

            const isOrderAlert = payload.data?.type === 'NEW_ORDER_REQUEST';
            const notificationTitle = payload.notification?.title || 'New Notification';
            const notificationOptions = {
                body: payload.notification?.body || '',
                icon: payload.notification?.icon || '/favicon.png',
                badge: '/favicon.png',
                data: payload.data || {},
                tag: payload.data?.type || 'default',
                requireInteraction: isOrderAlert,
                silent: !isOrderAlert
            };
            // Custom sound for order alerts (Chrome/Edge); other browsers use system sound or ignore
            if (isOrderAlert) {
                notificationOptions.sound = '/assets/sound/delivery-alert.mp3';
            }

            self.registration.showNotification(notificationTitle, notificationOptions);
        });
    } catch (err) {
        console.warn('[firebase-messaging-sw.js] Firebase SW initialization error:', err);
    }
}


// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification clicked', event);

    event.notification.close();

    const data = event.notification.data;
    const urlToOpen = data?.link || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if app is already open
            for (const client of clientList) {
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Open new window if app is not already open
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Service worker activation
self.addEventListener('activate', (event) => {
    console.log('[firebase-messaging-sw.js] Service worker activated');
});
