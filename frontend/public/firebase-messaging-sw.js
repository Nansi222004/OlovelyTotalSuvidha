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

            const isOrderAlert = payload.data?.type === 'NEW_ORDER_REQUEST' || payload.data?.type === 'NEW_ORDER' || payload.data?.type === 'Order';
            const notificationTitle = payload.notification?.title || 'New Notification';

            // Unique notification tag per order prevents Chrome from replacing/overwriting previous order notifications
            const orderId = payload.data?.orderId || payload.data?.id || payload.data?.orderNumber;
            const notificationTag = orderId ? `order-${orderId}` : (payload.data?.tag || `notif-${Date.now()}`);

            const notificationOptions = {
                body: payload.notification?.body || '',
                icon: payload.notification?.icon || payload.data?.icon || '/logo192.png',
                badge: '/logo192.png',
                image: payload.notification?.image || payload.data?.image || undefined,
                data: payload.data || {},
                tag: notificationTag,
                requireInteraction: isOrderAlert,
                renotify: true,
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


// Service worker installation
self.addEventListener('install', (event) => {
    console.log('[firebase-messaging-sw.js] Service worker installing, skipping waiting');
    self.skipWaiting();
});

// Service worker activation
self.addEventListener('activate', (event) => {
    console.log('[firebase-messaging-sw.js] Service worker activated, claiming clients');
    event.waitUntil(
        (async () => {
            // Clean up stale Firebase IndexedDB entries to fix VersionError
            // This happens when an old SW version created an IndexedDB with a different schema version
            try {
                const dbNames = ['firebase-installations-database', 'firebase-messaging-database', 'firebase-heartbeat-database'];
                await Promise.allSettled(
                    dbNames.map(dbName => {
                        return new Promise((resolve) => {
                            const deleteReq = indexedDB.deleteDatabase(dbName);
                            deleteReq.onsuccess = () => { console.log(`[SW] Deleted stale DB: ${dbName}`); resolve(true); };
                            deleteReq.onerror = () => resolve(false);
                            deleteReq.onblocked = () => resolve(false);
                        });
                    })
                );
            } catch (err) {
                console.warn('[SW] Could not clean Firebase IndexedDB:', err);
            }
            await self.clients.claim();
        })()
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification clicked', event);

    event.notification.close();

    const data = event.notification.data || {};
    const link = data.link;
    const role = (data.role || data.panel || data.recipientType || '').toLowerCase();
    const orderId = data.orderId || data.id;

    // Determine target URL route
    let targetUrl = link;
    if (!targetUrl) {
        if (role === 'seller') {
            targetUrl = orderId ? `/seller/orders/${orderId}` : '/seller/orders';
        } else if (role === 'delivery') {
            targetUrl = orderId ? `/delivery/orders/${orderId}` : '/delivery/orders';
        } else if (role === 'admin') {
            targetUrl = '/admin';
        } else {
            targetUrl = '/';
        }
    }

    const fullTargetUrl = new URL(targetUrl, self.location.origin).href;
    const panelPrefix = role ? `/${role}` : '/';

    console.log('[SW CLICK DEBUG] Target URL:', fullTargetUrl);
    console.log('[SW CLICK DEBUG] Role:', role, '| Panel Prefix:', panelPrefix);

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
            console.log('[SW CLICK DEBUG] Total matching window clients found:', clientList.length);
            clientList.forEach((c, idx) => {
                console.log(`[SW CLICK DEBUG] Client ${idx}: url=${c.url}, focused=${c.focused}`);
            });

            // 1. Check if an exact tab matching fullTargetUrl is open
            for (const client of clientList) {
                if (client.url === fullTargetUrl && 'focus' in client) {
                    console.log('[SW CLICK DEBUG] Found exact matching client tab, focusing:', client.url);
                    return client.focus();
                }
            }

            // 2. Check if a tab matching the target panel (e.g., /seller or /delivery) is open
            for (const client of clientList) {
                const urlLower = client.url.toLowerCase();
                const isPanelTab = panelPrefix.length > 1 ? urlLower.includes(panelPrefix) : true;

                if (isPanelTab && 'focus' in client) {
                    console.log('[SW CLICK DEBUG] Found panel client tab, focusing and navigating:', client.url);
                    await client.focus();
                    if ('navigate' in client && client.url !== fullTargetUrl) {
                        try {
                            const navigatedClient = await client.navigate(fullTargetUrl);
                            if (navigatedClient && 'focus' in navigatedClient) {
                                await navigatedClient.focus();
                            }
                        } catch (navErr) {
                            console.warn('[SW CLICK DEBUG] client.navigate error:', navErr);
                        }
                    }
                    return;
                }
            }

            // 3. Otherwise, open a new window to the target URL
            console.log('[SW CLICK DEBUG] No open panel tab found. Opening new window:', fullTargetUrl);
            if (clients.openWindow) {
                return clients.openWindow(fullTargetUrl);
            }
        })
    );
});
