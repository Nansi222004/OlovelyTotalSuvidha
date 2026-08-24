import { getAuthToken } from './api/config';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

type FirebaseMessagingModule = typeof import('./firebase');

let firebaseMessagingModulePromise: Promise<FirebaseMessagingModule> | null = null;

async function loadFirebaseMessagingModule(): Promise<FirebaseMessagingModule> {
    if (!firebaseMessagingModulePromise) {
        firebaseMessagingModulePromise = import('./firebase');
    }

    return firebaseMessagingModulePromise;
}

/**
 * Register service worker for Firebase messaging
 */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if ('serviceWorker' in navigator) {
        try {
            const params = new URLSearchParams({
                apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
                authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
                projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
                storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
                messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
                appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
                measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
            });
            const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);
            console.log('Service Worker registered:', registration);
            return registration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            return null;
        }
    } else {
        console.warn('Service Workers are not supported in this browser');
        return null;
    }
}

/**
 * Request notification permission from user
 */
async function requestNotificationPermission(): Promise<boolean> {
    if ('Notification' in window) {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('Notification permission granted');
                return true;
            } else {
                console.log('Notification permission denied');
                return false;
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
        }
    }
    console.warn('Notifications are not supported in this browser');
    return false;
}

/**
 * Get FCM token from Firebase
 */
async function getFCMToken(): Promise<string | null> {
    const { messaging, getToken } = await loadFirebaseMessagingModule();

    if (!messaging) {
        console.warn('Firebase Messaging not initialized');
        return null;
    }

    try {
        const registration = await registerServiceWorker();
        if (!registration) {
            console.error('Service Worker not registered');
            return null;
        }

        await registration.update();

        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration,
        });

        if (token) {
            console.log('FCM Token obtained:', token);
            return token;
        } else {
            console.log('No FCM token available');
            return null;
        }
    } catch (error: any) {
        console.error('Error getting FCM token:', error);
        return null;
    }
}

/**
 * Register FCM token with backend
 */
export async function registerFCMToken(
    forceUpdate: boolean = false,
    panelOrUserType?: string,
): Promise<string | null> {
    try {
        const hasPermission = await requestNotificationPermission();
        if (!hasPermission) {
            console.warn('Notification permission not granted');
            return null;
        }

        let token = localStorage.getItem('fcm_token_web');
        if (!token || forceUpdate) {
            const freshToken = await getFCMToken();
            if (freshToken) {
                token = freshToken;
            }
        }

        if (!token) {
            console.error('Failed to get FCM token');
            return null;
        }

        const authToken = getAuthToken(panelOrUserType);
        if (!authToken) {
            console.warn('User not authenticated, skipping token registration');
            return null;
        }

        const response = await fetch(`${API_BASE_URL}/fcm-tokens/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                token,
                platform: 'web',
            }),
        });

        if (response.ok) {
            localStorage.setItem('fcm_token_web', token);
            console.log('✅ FCM token registered with backend successfully');
            return token;
        } else {
            const error = await response.json().catch(() => ({}));
            console.error('Failed to register token with backend:', error);
            return null;
        }
    } catch (error: any) {
        console.error('Error registering FCM token:', error);
        return null;
    }
}

/**
 * Setup foreground notification handler
 */
export async function setupForegroundNotificationHandler(
    handler?: (payload: any) => void,
): Promise<(() => void) | void> {
    const { messaging, onMessage } = await loadFirebaseMessagingModule();

    if (!messaging) {
        console.warn('Firebase Messaging not initialized');
        return;
    }

    return onMessage(messaging, (payload) => {
        console.log('Foreground message received:', payload);

        if ('Notification' in window && Notification.permission === 'granted') {
            const orderId = payload.data?.orderId || payload.data?.id || payload.data?.orderNumber;
            const notificationTag = orderId ? `order-${orderId}` : (payload.data?.tag || `notif-${Date.now()}`);

            const notification = new Notification(payload.notification?.title || 'New Notification', {
                body: payload.notification?.body || '',
                icon: payload.notification?.icon || payload.data?.icon || '/logo192.png',
                badge: '/logo192.png',
                tag: notificationTag,
                requireInteraction: false,
                silent: false,
                data: payload.data,
            });

            notification.onclick = (event) => {
                event.preventDefault();
                const link = payload.data?.link || '/';
                window.focus();
                window.location.href = link;
                notification.close();
            };

            console.log('Foreground notification displayed');
        }

        if (handler) {
            handler(payload);
        }
    });
}

/**
 * Initialize push notifications
 */
export async function initializePushNotifications(): Promise<void> {
    try {
        await registerServiceWorker();
        console.log('Push notifications initialized');
    } catch (error) {
        console.error('Error initializing push notifications:', error);
    }
}

/**
 * Remove FCM token from backend
 */
export async function removeFCMToken(panelOrUserType?: string): Promise<void> {
    try {
        const savedToken = localStorage.getItem('fcm_token_web');
        if (!savedToken) {
            return;
        }

        const authToken = getAuthToken(panelOrUserType);
        if (!authToken) {
            return;
        }

        await fetch(`${API_BASE_URL}/fcm-tokens/remove`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                token: savedToken,
                platform: 'web',
            }),
        });

        localStorage.removeItem('fcm_token_web');
        console.log('FCM token removed');
    } catch (error) {
        console.error('Error removing FCM token:', error);
    }
}
