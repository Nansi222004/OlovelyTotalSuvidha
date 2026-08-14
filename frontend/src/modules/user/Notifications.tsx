import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getCustomerNotifications, markCustomerNotificationRead, CustomerNotification } from "../../services/api/customerNotificationService";

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const data = await getCustomerNotifications();
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch customer notifications", error);
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
      await markCustomerNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    } catch (error) {
      console.error("Failed to mark notification as read", error);
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

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🔔</div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">Login required</h2>
          <p className="text-neutral-600 mb-6">Please login to view notifications.</p>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (user.userType !== "Customer") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">Access denied</h2>
          <p className="text-neutral-600 mb-6">Notifications are only available for customers.</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 pb-20">
      <div className="px-4 py-4">
        <h2 className="text-neutral-900 text-xl font-semibold mb-4">Notifications</h2>

        {loading ? (
          <p className="text-center text-neutral-500 py-10">Loading...</p>
        ) : notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification._id}
                onClick={() => !notification.isRead && handleMarkAsRead(notification._id)}
                className={`bg-white rounded-xl p-4 shadow-sm border ${
                  notification.isRead ? "border-neutral-200" : "border-orange-200 bg-orange-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        notification.isRead ? "bg-neutral-300" : "bg-orange-500"
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-neutral-900 text-sm">{notification.title}</div>
                    <div className="text-neutral-600 text-xs mt-1 line-clamp-3">{notification.message}</div>
                    <div className="text-neutral-400 text-[10px] mt-2">{formatTime(notification.createdAt)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-8 min-h-[250px] flex items-center justify-center shadow-sm border border-neutral-200">
            <p className="text-neutral-500 text-sm">No notifications</p>
          </div>
        )}
      </div>
    </div>
  );
}

