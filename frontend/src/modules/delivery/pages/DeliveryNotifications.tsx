import { useEffect, useState } from 'react';
import DeliveryHeader from '../components/DeliveryHeader';
import { getNotifications, markNotificationRead } from '../../../services/api/delivery/deliveryService';

export default function DeliveryNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      // Update local state to show as read
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'Order':
      case 'order':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M5 8V6C5 4.34315 6.34315 3 8 3H16C17.6569 3 19 4.34315 19 6V8H21C21.5523 8 22 8.44772 22 9V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V9C2 8.44772 2.44772 8 3 8H5Z"
              stroke="#16a34a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M7 8V6C7 5.44772 7.44772 5 8 5H16C16.5523 5 17 5.44772 17 6V8"
              stroke="#16a34a"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="9" cy="13" r="1" fill="#16a34a" />
            <circle cx="15" cy="13" r="1" fill="#16a34a" />
          </svg>
        );
      default:
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2 12 2C11.17 2 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z" fill="#F97316" />
          </svg>
        );
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      <DeliveryHeader />
      <div className="px-4 py-4">
        <h2 className="text-neutral-900 text-xl font-semibold mb-4">Notifications</h2>
        {loading ? (
          <p className="text-center text-neutral-500">Loading...</p>
        ) : notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div key={notification._id}
                onClick={() => !notification.isRead && handleMarkAsRead(notification._id)}
                className={`bg-white rounded-xl p-4 shadow-sm border ${notification.isRead ? 'border-neutral-200' : 'border-orange-200 bg-orange-50'}`}>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-sm font-semibold ${notification.isRead ? 'text-neutral-900' : 'text-neutral-900'}`}>{notification.title}</h3>
                    <p className="text-neutral-600 text-xs mt-1 line-clamp-2">{notification.message}</p>
                    <p className="text-neutral-400 text-[10px] mt-2">{formatTime(notification.createdAt)}</p>
                  </div>
                  {!notification.isRead && (
                    <div className="w-2 h-2 rounded-full bg-orange-500 mt-2"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-8 min-h-[400px] flex items-center justify-center shadow-sm border border-neutral-200">
            <p className="text-neutral-500 text-sm">No notifications</p>
          </div>
        )}
      </div>
    </div>
  );
}




