import { useState, useCallback, useEffect, useRef, ReactNode, Suspense } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { useAdminSocket, AdminOrderAlertNotification, AdminSupportEvent, ADMIN_SUPPORT_BROWSER_EVENT } from '../hooks/useAdminSocket';
import AdminNotificationAlert from './AdminNotificationAlert';
import { getPendingOrderAlerts } from '../../../services/api/admin/adminOrderService';
import { useRingtoneAlert } from '../../../hooks/useRingtoneAlert';

interface AdminLayoutProps {
  children: ReactNode;
}

const DISMISSED_ALERTS_KEY = 'admin_dismissed_order_alerts';

function getDismissedOrderIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_ALERTS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function rememberDismissedOrderId(orderId: string) {
  const dismissed = getDismissedOrderIds();
  dismissed.add(orderId);
  sessionStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify([...dismissed]));
}

function clearDismissedOrderId(orderId: string) {
  const dismissed = getDismissedOrderIds();
  if (!dismissed.delete(orderId)) return;
  sessionStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify([...dismissed]));
}

function filterAlerts(alerts: AdminOrderAlertNotification[]): AdminOrderAlertNotification[] {
  const dismissed = getDismissedOrderIds();
  return alerts.filter(
    (alert) => !dismissed.has(alert.orderId),
  );
}

function mergeUniqueNotifications(
  existing: AdminOrderAlertNotification[],
  incoming: AdminOrderAlertNotification[],
): AdminOrderAlertNotification[] {
  const seen = new Set(existing.map((n) => n.orderId));
  const merged = [...existing];

  for (const notification of incoming) {
    if (!seen.has(notification.orderId)) {
      seen.add(notification.orderId);
      merged.push(notification);
    }
  }

  return merged;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default to open on desktop
  const [activeNotification, setActiveNotification] = useState<AdminOrderAlertNotification | null>(null);
  const [notificationQueue, setNotificationQueue] = useState<AdminOrderAlertNotification[]>([]);
  const hasRehydratedRef = useRef(false);

  // Count total actionable pending orders
  const actionableCount = (activeNotification ? 1 : 0) + notificationQueue.length;
  const { autoplayBlocked, enableAndPlaySound } = useRingtoneAlert('/assets/sound/seller_alert.mp3', actionableCount > 0);

  const showNextNotification = useCallback((queue: AdminOrderAlertNotification[]) => {
    const [next, ...rest] = queue;
    setActiveNotification(next ?? null);
    setNotificationQueue(rest);
  }, []);

  const enqueueNotification = useCallback((notification: AdminOrderAlertNotification) => {
    if (
      notification.type !== 'NEW_ORDER' ||
      notification.ownerType !== 'PLATFORM' ||
      notification.items.length === 0 ||
      notification.items.some((item) => item.ownerType !== 'PLATFORM' || item.productType !== 'QUICK_COMMERCE')
    ) return;
    clearDismissedOrderId(notification.orderId);

    setActiveNotification((current) => {
      if (current?.orderId === notification.orderId) {
        return current;
      }
      if (!current) {
        return notification;
      }

      setNotificationQueue((queue) => mergeUniqueNotifications(queue, [notification]));
      return current;
    });
  }, []);

  const handleNotificationReceived = useCallback((notification: AdminOrderAlertNotification) => {
    enqueueNotification(notification);
  }, [enqueueNotification]);

  const handleSupportEvent = useCallback((event: AdminSupportEvent) => {
    window.dispatchEvent(new CustomEvent<AdminSupportEvent>(ADMIN_SUPPORT_BROWSER_EVENT, { detail: event }));
  }, []);

  const rehydratePendingAlerts = useCallback(async () => {
    try {
      const response = await getPendingOrderAlerts();
      const alerts = filterAlerts(response.data ?? []);

      if (alerts.length === 0) {
        return;
      }

      setActiveNotification((current) => {
        if (current) {
          setNotificationQueue((queue) => mergeUniqueNotifications(queue, alerts));
          return current;
        }

        const [first, ...rest] = alerts;
        setNotificationQueue(rest);
        return first;
      });
    } catch (error) {
      console.error('Failed to rehydrate admin order alerts:', error);
    }
  }, []);

  // Rehydrate after every successful room join. This closes the short gap between
  // a disconnect and Socket.IO's automatic reconnect without replacing realtime.
  useAdminSocket(handleNotificationReceived, rehydratePendingAlerts, handleSupportEvent);

  useEffect(() => {
    if (hasRehydratedRef.current) {
      return;
    }
    hasRehydratedRef.current = true;
    rehydratePendingAlerts();
  }, [rehydratePendingAlerts]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeNotification = () => {
    if (activeNotification?.orderId) {
      rememberDismissedOrderId(activeNotification.orderId);
    }
    showNextNotification(notificationQueue);
  };

  const handleAlertResolved = () => {
    if (activeNotification?.orderId) {
      rememberDismissedOrderId(activeNotification.orderId);
    }
    showNextNotification(notificationQueue);
  };

  return (
    <div className="flex min-h-screen bg-neutral-50 overflow-x-hidden">
      {/* Autoplay banner if browser blocked audio */}
      {autoplayBlocked && actionableCount > 0 && (
        <div className="fixed top-4 right-4 z-[99999] bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <span className="text-xl">🔔</span>
          <div className="text-xs">
            <p className="font-bold">New Platform Order Pending!</p>
            <p className="opacity-90">Click to enable order sound alert</p>
          </div>
          <button
            onClick={enableAndPlaySound}
            className="px-3 py-1 bg-white text-emerald-800 rounded-lg font-bold text-xs hover:bg-neutral-100 transition-colors shadow-sm"
          >
            Enable Sound
          </button>
        </div>
      )}

      {/* Admin Incoming Order Alert Modal */}
      <AdminNotificationAlert
        notification={activeNotification}
        onClose={closeNotification}
        onResolved={handleAlertResolved}
      />

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar - Fixed */}
      <div
        className={`fixed left-0 top-0 h-screen z-50 transition-transform duration-300 ease-in-out w-64 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <AdminSidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 min-w-0 ${
          isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
        }`}
      >
        {/* Header */}
        <AdminHeader onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-neutral-50 min-w-0">
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
