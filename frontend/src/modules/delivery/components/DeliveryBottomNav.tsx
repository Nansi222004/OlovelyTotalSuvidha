import { Link, useLocation } from 'react-router-dom';

export default function DeliveryBottomNav() {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    {
      path: '/delivery',
      label: 'Home',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Grid of 9 squares */}
          <rect x="3" y="3" width="6" height="6" fill={isActive('/delivery') ? '#f97316' : '#9ca3af'} />
          <rect x="11" y="3" width="6" height="6" fill={isActive('/delivery') ? '#f97316' : '#9ca3af'} />
          <rect x="19" y="3" width="2" height="6" fill={isActive('/delivery') ? '#f97316' : '#9ca3af'} />
          <rect x="3" y="11" width="6" height="6" fill={isActive('/delivery') ? '#f97316' : '#9ca3af'} />
          <rect x="11" y="11" width="6" height="6" fill={isActive('/delivery') ? '#f97316' : '#9ca3af'} />
          <rect x="19" y="11" width="2" height="6" fill={isActive('/delivery') ? '#f97316' : '#9ca3af'} />
          <rect x="3" y="19" width="6" height="2" fill={isActive('/delivery') ? '#f97316' : '#9ca3af'} />
          <rect x="11" y="19" width="6" height="2" fill={isActive('/delivery') ? '#f97316' : '#9ca3af'} />
          <rect x="19" y="19" width="2" height="2" fill={isActive('/delivery') ? '#f97316' : '#9ca3af'} />
        </svg>
      ),
    },
    {
      path: '/delivery/orders',
      label: 'Orders',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Delivery truck with speed lines */}
          <path
            d="M2 17H4L5 12H19L20 17H22M2 17C2 18.1046 2.89543 19 4 19C5.10457 19 6 18.1046 6 17M2 17C2 15.8954 2.89543 15 4 15C5.10457 15 6 15.8954 6 17M22 17C22 18.1046 21.1046 19 20 19C18.8954 19 18 18.1046 18 17M22 17C22 15.8954 21.1046 15 20 15C18.8954 15 18 15.8954 18 17M6 17H18M5 12L4 7H2M20 12L21 7H22"
            stroke={isActive('/delivery/orders') ? '#f97316' : '#9ca3af'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Speed lines */}
          <path d="M8 10H10M12 10H14" stroke={isActive('/delivery/orders') ? '#f97316' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      ),
    },
    {
      path: '/delivery/notifications',
      label: 'Notification',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M18 8A6 6 0 0 0 6 8C6 11.3137 4 14 4 14H20C20 14 18 11.3137 18 8Z"
            stroke={isActive('/delivery/notifications') ? '#f97316' : '#9ca3af'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"
            stroke={isActive('/delivery/notifications') ? '#f97316' : '#9ca3af'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      ),
    },
    {
      path: '/delivery/menu',
      label: 'Menu',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M3 12H21M3 6H21M3 18H21"
            stroke={isActive('/delivery/menu') ? '#f97316' : '#9ca3af'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200/10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="flex flex-col items-center justify-center flex-1 h-full"
          >
            <div className={`${isActive(item.path) ? 'text-neutral-700' : 'text-neutral-500'}`}>
              {item.icon}
            </div>
            <span
              className={`text-xs mt-0.5 ${
                isActive(item.path) ? 'text-neutral-700 font-medium' : 'text-neutral-500 font-medium'
              }`}
            >
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

