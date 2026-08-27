import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '../../../context/LanguageContext';
import { getSellerNotifications } from '../../../services/api/sellerNotificationService';
import { useAuth } from '../../../context/AuthContext';

export default function SellerBottomNav() {
  const location = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const isActive = (path: string) => {
    if (path === '/seller') {
      return location.pathname === '/seller' || location.pathname === '/seller/';
    }
    if (path === '/seller/profile') {
      return (
        location.pathname.startsWith('/seller/profile') ||
        location.pathname.startsWith('/seller/account-settings')
      );
    }
    return location.pathname.startsWith(path);
  };

  useEffect(() => {
    let isMounted = true;

    const fetchUnreadCount = async () => {
      if (!user) return;
      try {
        const notifications = await getSellerNotifications();
        if (isMounted && Array.isArray(notifications)) {
          const unread = notifications.filter((n) => !n.isRead).length;
          setUnreadCount(unread);
        }
      } catch (err) {
        // Silently handle error
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

  const navItems = [
    {
      path: '/seller',
      label: t('common.home', 'Home'),
      icon: (active: boolean) => (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {active ? (
            <path
              d="M3 10.182V20a1 1 0 0 0 1 1h5v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6h5a1 1 0 0 0 1-1v-9.818a1 1 0 0 0-.379-.785l-8-6.222a1 1 0 0 0-1.242 0l-8 6.222A1 1 0 0 0 3 10.182Z"
              fill="#0d9488"
              stroke="#0d9488"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          ) : (
            <path
              d="M3 10.182V20a1 1 0 0 0 1 1h5v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6h5a1 1 0 0 0 1-1v-9.818a1 1 0 0 0-.379-.785l-8-6.222a1 1 0 0 0-1.242 0l-8 6.222A1 1 0 0 0 3 10.182Z"
              stroke="#6b7280"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      ),
    },
    {
      path: '/seller/orders',
      label: t('common.orders', 'Orders'),
      icon: (active: boolean) => (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {active ? (
            <>
              <path
                d="M4 7V17C4 18.1046 4.89543 19 6 19H18C19.1046 19 20 18.1046 20 17V7M4 7L12 12L20 7M4 7L12 2L20 7"
                fill="#ccfbf1"
                stroke="#0d9488"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 12V22"
                stroke="#0d9488"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <path
                d="M4 7V17C4 18.1046 4.89543 19 6 19H18C19.1046 19 20 18.1046 20 17V7M4 7L12 12L20 7M4 7L12 2L20 7"
                stroke="#6b7280"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 12V22"
                stroke="#6b7280"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </>
          )}
        </svg>
      ),
    },
    {
      path: '/seller/notifications',
      label: t('common.notifications', 'Alerts'),
      badge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : null,
      icon: (active: boolean) => (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {active ? (
            <>
              <path
                d="M18 8A6 6 0 0 0 6 8C6 11.3137 4 14 4 14H20C20 14 18 11.3137 18 8Z"
                fill="#ccfbf1"
                stroke="#0d9488"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13.73 21a2 2 0 0 1-3.46 0"
                stroke="#0d9488"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <path
                d="M18 8A6 6 0 0 0 6 8C6 11.3137 4 14 4 14H20C20 14 18 11.3137 18 8Z"
                stroke="#6b7280"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13.73 21a2 2 0 0 1-3.46 0"
                stroke="#6b7280"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </>
          )}
        </svg>
      ),
    },
    {
      path: '/seller/wallet',
      label: t('seller.wallet', 'Wallet'),
      icon: (active: boolean) => (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {active ? (
            <>
              <rect
                x="2"
                y="5"
                width="20"
                height="14"
                rx="3"
                fill="#ccfbf1"
                stroke="#0d9488"
                strokeWidth="1.8"
              />
              <path
                d="M16 12H19"
                stroke="#0d9488"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="16" cy="12" r="1" fill="#0d9488" />
            </>
          ) : (
            <>
              <rect
                x="2"
                y="5"
                width="20"
                height="14"
                rx="3"
                stroke="#6b7280"
                strokeWidth="1.8"
              />
              <path
                d="M16 12H19"
                stroke="#6b7280"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="16" cy="12" r="1" fill="#6b7280" />
            </>
          )}
        </svg>
      ),
    },
    {
      path: '/seller/profile',
      label: t('common.profile', 'Profile'),
      icon: (active: boolean) => (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {active ? (
            <>
              <circle
                cx="12"
                cy="7"
                r="4"
                fill="#ccfbf1"
                stroke="#0d9488"
                strokeWidth="1.8"
              />
              <path
                d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"
                fill="#ccfbf1"
                stroke="#0d9488"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : (
            <>
              <circle
                cx="12"
                cy="7"
                r="4"
                stroke="#6b7280"
                strokeWidth="1.8"
              />
              <path
                d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"
                stroke="#6b7280"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
        </svg>
      ),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200/80 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] z-50 lg:hidden select-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <motion.div
              key={item.path}
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.1 }}
              className="flex-1 h-full"
            >
              <Link
                to={item.path}
                className="flex flex-col items-center justify-center h-full w-full relative py-1"
              >
                <div className="relative flex items-center justify-center">
                  {item.icon(active)}

                  {/* Badge */}
                  {item.badge && (
                    <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] h-4 flex items-center justify-center shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </div>

                <span
                  className={`text-[11px] mt-1 tracking-tight transition-colors duration-150 ${
                    active
                      ? 'text-teal-700 font-semibold'
                      : 'text-neutral-500 font-medium'
                  }`}
                >
                  {item.label}
                </span>

                {/* Subtle active pill indicator */}
                {active && (
                  <motion.div
                    layoutId="seller-bottom-nav-active"
                    className="absolute bottom-1 w-5 h-0.5 bg-teal-600 rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </nav>
  );
}
