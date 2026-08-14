import { ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import SellerHeader from './SellerHeader';
import SellerSidebar from './SellerSidebar';
import { useSellerSocket, SellerNotification } from '../hooks/useSellerSocket';
import SellerNotificationAlert from './SellerNotificationAlert';
import { getPendingOrderAlerts } from '../../../services/api/orderService';

interface SellerLayoutProps {
  children: ReactNode;
}

const DISMISSED_ALERTS_KEY = 'seller_dismissed_order_alerts';
const PENDING_ALERT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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

function isRecentAlert(notification: SellerNotification): boolean {
  if (!notification.timestamp) return true;
  const createdAt = new Date(notification.timestamp).getTime();
  if (Number.isNaN(createdAt)) return true;
  return Date.now() - createdAt <= PENDING_ALERT_MAX_AGE_MS;
}

function filterAlerts(alerts: SellerNotification[]): SellerNotification[] {
  const dismissed = getDismissedOrderIds();
  return alerts.filter(
    (alert) => isRecentAlert(alert) && !dismissed.has(alert.orderId),
  );
}

function mergeUniqueNotifications(
  existing: SellerNotification[],
  incoming: SellerNotification[],
): SellerNotification[] {
  const seen = new Set(existing.map((notification) => notification.orderId));
  const merged = [...existing];

  for (const notification of incoming) {
    if (!seen.has(notification.orderId)) {
      seen.add(notification.orderId);
      merged.push(notification);
    }
  }

  return merged;
}

export default function SellerLayout({ children }: SellerLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeNotification, setActiveNotification] = useState<SellerNotification | null>(null);
  const [notificationQueue, setNotificationQueue] = useState<SellerNotification[]>([]);
  const hasRehydratedRef = useRef(false);

  const showNextNotification = useCallback((queue: SellerNotification[]) => {
    const [next, ...rest] = queue;
    setActiveNotification(next ?? null);
    setNotificationQueue(rest);
  }, []);

  const enqueueNotification = useCallback((notification: SellerNotification) => {
    if (!isRecentAlert(notification)) return;
    clearDismissedOrderId(notification.orderId);

    setActiveNotification((current) => {
      if (!current) {
        return notification;
      }

      setNotificationQueue((queue) => mergeUniqueNotifications(queue, [notification]));
      return current;
    });
  }, []);

  const handleNotificationReceived = useCallback((notification: SellerNotification) => {
    enqueueNotification(notification);
  }, [enqueueNotification]);

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
      console.error('Failed to rehydrate seller order alerts:', error);
    }
  }, []);

  useSellerSocket(handleNotificationReceived);

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

  const handleNotificationResolved = () => {
    if (activeNotification?.orderId) {
      clearDismissedOrderId(activeNotification.orderId);
    }
    setActiveNotification(null);
    showNextNotification(notificationQueue);
    rehydratePendingAlerts();
  };

  return (
    <div className="flex min-h-screen bg-neutral-50">
      {/* Real-time Notification Alert */}
      <SellerNotificationAlert
        notification={activeNotification}
        onClose={closeNotification}
        onResolved={handleNotificationResolved}
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
        className={`fixed left-0 top-0 h-screen z-50 transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SellerSidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 w-full ${
          isSidebarOpen ? 'ml-64' : 'ml-0'
        }`}
      >
        {/* Header */}
        <SellerHeader onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-neutral-50">{children}</main>
      </div>
    </div>
  );
}
