import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { getSellerNotifications, markSellerNotificationRead, SellerNotification } from "../../../services/api/sellerNotificationService";

export default function SellerNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<SellerNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const data = await getSellerNotifications();
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch seller notifications", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markSellerNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const handleNotificationClick = async (notification: SellerNotification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification._id);
    }
    if (notification.link && typeof notification.link === "string" && notification.link.startsWith("/")) {
      navigate(notification.link);
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="px-3 sm:px-4 md:px-6 py-4 md:py-6">
        <h2 className="text-neutral-900 text-xl font-semibold mb-4">Notifications</h2>

        {loading ? (
          <div className="text-center py-10 text-neutral-500">Loading...</div>
        ) : notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification._id}
                onClick={() => handleNotificationClick(notification)}
                className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer hover:shadow-md transition-all ${
                  notification.isRead ? "border-neutral-200" : "border-orange-200 bg-orange-50"
                }`}
              >
                <div className="flex gap-3 items-start">
                  <div className="mt-1">
                    <span className={`inline-block w-2 h-2 rounded-full ${notification.isRead ? "bg-neutral-300" : "bg-orange-500"}`} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-neutral-900 text-sm">{notification.title}</div>
                    <div className="text-neutral-600 text-xs mt-1 line-clamp-3">{notification.message}</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-neutral-400 text-[10px]">{formatTime(notification.createdAt)}</span>
                      {notification.link && (
                        <span className="text-xs text-orange-600 font-medium hover:underline inline-flex items-center gap-1">
                          {notification.actionLabel || "View"} →
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-8 min-h-[200px] flex items-center justify-center shadow-sm border border-neutral-200">
            <p className="text-neutral-500 text-sm">No notifications</p>
          </div>
        )}
      </div>
    </div>
  );
}

