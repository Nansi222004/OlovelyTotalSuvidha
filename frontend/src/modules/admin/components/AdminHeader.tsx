import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import olovelyLogo from '@assets/olovelylogo.jpeg';
import LanguageSelector from '../../../components/LanguageSelector';
import { getNotifications, type Notification as AdminNotificationItem } from '../../../services/api/admin/adminNotificationService';

const BELL_SEEN_KEY = 'admin_notifications_last_seen';
const readLastSeen = () => {
  try { return Number(localStorage.getItem(BELL_SEEN_KEY) || 0); } catch { return 0; }
};
const writeLastSeen = (ts: number) => {
  try { localStorage.setItem(BELL_SEEN_KEY, String(ts)); } catch { /* storage unavailable */ }
};
const timeAgo = (iso?: string) => {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const RECIPIENT_BADGE: Record<string, string> = {
  Admin: 'bg-teal-50 text-teal-700 border-teal-200',
  Seller: 'bg-amber-50 text-amber-700 border-amber-200',
  Customer: 'bg-blue-50 text-blue-700 border-blue-200',
  Delivery: 'bg-purple-50 text-purple-700 border-purple-200',
  All: 'bg-neutral-100 text-neutral-700 border-neutral-200',
};

interface AdminHeaderProps {
  onMenuClick: () => void;
  isSidebarOpen: boolean;
}

export default function AdminHeader({ onMenuClick, isSidebarOpen }: AdminHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { t } = useLanguage();
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  // Bell: latest notifications across the platform (was a static "No new notifications").
  const [recentNotifications, setRecentNotifications] = useState<AdminNotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(readLastSeen);

  const loadRecentNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const res = await getNotifications({ page: 1, limit: 8 });
      if (res?.success && Array.isArray(res.data)) setRecentNotifications(res.data);
    } catch {
      // Keep the last list; the bell is not critical.
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    loadRecentNotifications();
    const timer = setInterval(loadRecentNotifications, 60000);
    return () => clearInterval(timer);
  }, []);

  const newestTs = recentNotifications.reduce(
    (max, n) => Math.max(max, n.createdAt ? new Date(n.createdAt).getTime() : 0), 0);
  const hasUnseen = newestTs > lastSeen;

  const isActive = (path: string) => location.pathname.includes(path);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotificationsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const handleLogoClick = () => {
    navigate('/admin');
  };

  return (
    <header className="bg-white shadow-sm border-b border-neutral-200 sticky top-0 z-30">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-4 md:px-6 py-3 sm:py-4 gap-3 sm:gap-0">
        {/* Logo and Hamburger Menu */}
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
          {/* Hamburger Menu Button */}
          <button
            onClick={onMenuClick}
            className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors flex-shrink-0"
            aria-label="Toggle menu"
          >
            {isSidebarOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M4 6H20M4 12H20M4 18H20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          {/* Olovely Logo */}
          <button
            onClick={handleLogoClick}
            className="hover:opacity-80 transition-opacity"
          >
            <img
              src={olovelyLogo}
              alt="Olovely Total Suvidha"
              className="h-10 sm:h-12 w-auto object-contain cursor-pointer"
              style={{ maxWidth: '200px' }}
            />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="hidden md:flex items-center gap-4 lg:gap-6">
          <button
            onClick={() => navigate('/admin/orders')}
            className={`relative px-3 lg:px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${isActive('/admin/orders') ? 'text-neutral-900' : 'text-neutral-600 hover:text-neutral-900'
              }`}
          >
            {t("common.orders", "Orders")}
          </button>
          <button
            onClick={() => navigate('/admin/customers')}
            className={`px-3 lg:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${isActive('/admin/customers') ? 'text-neutral-900' : 'text-neutral-600 hover:text-neutral-900'
              }`}
          >
            {t("admin.manageCustomer", "Manage Customer")}
          </button>
          <button
            onClick={() => navigate('/admin/collect-cash')}
            className={`px-3 lg:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${isActive('/admin/collect-cash') ? 'text-neutral-900' : 'text-neutral-600 hover:text-neutral-900'
              }`}
          >
            {t("admin.collectCash", "Collect Cash")}
          </button>
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-2 md:gap-4 relative">
          {/* Notifications Button */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => {
                const opening = !showNotificationsDropdown;
                setShowNotificationsDropdown(opening);
                if (opening) {
                  loadRecentNotifications();
                  if (newestTs) { setLastSeen(newestTs); writeLastSeen(newestTs); }
                }
              }}
              className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors relative"
              aria-label="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 8A6 6 0 0 0 6 8C6 11.3137 4 14 4 17H20C20 14 18 11.3137 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {hasUnseen && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>}
            </button>
            {showNotificationsDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-neutral-200 py-2 z-50 max-h-96 overflow-y-auto">
                <div className="px-4 py-2 border-b border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900">Notifications</h3>
                </div>
                {recentNotifications.length === 0 ? (
                  <div className="py-4 px-4 text-center text-sm text-neutral-500">
                    <p>{notificationsLoading ? 'Loading…' : 'No notifications yet'}</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {recentNotifications.map((n) => (
                      <li key={n._id}>
                        <button
                          type="button"
                          onClick={() => {
                            navigate('/admin/notification');
                            setShowNotificationsDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${RECIPIENT_BADGE[n.recipientType] || RECIPIENT_BADGE.All}`}>
                              {n.recipientType}
                            </span>
                            <span className="text-[11px] text-neutral-400 whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                          </div>
                          <p className="text-sm font-medium text-neutral-900 truncate">{n.title}</p>
                          <p className="text-xs text-neutral-500 line-clamp-2">{n.message}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="px-4 py-2 border-t border-neutral-200">
                  <button
                    onClick={() => {
                      navigate('/admin/notification');
                      setShowNotificationsDropdown(false);
                    }}
                    className="w-full text-center text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    View All Notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Language Selector */}
          <LanguageSelector variant="dropdown" />

          {/* Profile Button */}
          <button
            onClick={() => navigate('/admin/profile')}
            className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors"
            aria-label="Profile"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors"
            aria-label="Logout"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9M16 17L21 12M21 12L16 7M21 12H9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}


