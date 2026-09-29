import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppSettings } from '../context/AppSettingsContext';

/**
 * Route-aware dynamic favicon switcher:
 * - Admin routes (/admin/*)       -> Existing Admin favicon (/assets/favicon-circle.png)
 * - Seller routes (/seller/*)     -> Seller logo favicon (/assets/favicon-seller-32.png)
 * - Delivery routes (/delivery/*) -> Delivery partner logo favicon (/assets/favicon-delivery-32.png)
 * - Customer / User routes        -> User logo favicon (/assets/favicon-user-32.png or custom appFavicon)
 */
export const FaviconManager: React.FC = () => {
  const location = useLocation();
  const { settings } = useAppSettings();

  useEffect(() => {
    const pathname = location.pathname;

    let appKey = 'user';
    let icon32 = '/assets/favicon-user-32.png';
    let icon16 = '/assets/favicon-user-16.png';
    let touchIcon = '/assets/favicon-user-192.png';

    if (pathname.startsWith('/admin')) {
      appKey = 'admin';
      // Admin: keep existing Admin favicon configuration unchanged
      icon32 = '/assets/favicon-circle.png';
      icon16 = '/assets/favicon-circle-32.png';
      touchIcon = '/assets/favicon-circle-192.png';
    } else if (pathname.startsWith('/seller')) {
      appKey = 'seller';
      // Seller / Vendor App
      icon32 = '/assets/favicon-seller-32.png';
      icon16 = '/assets/favicon-seller-16.png';
      touchIcon = '/assets/favicon-seller-192.png';
    } else if (pathname.startsWith('/delivery')) {
      appKey = 'delivery';
      // Delivery Partner App
      icon32 = '/assets/favicon-delivery-32.png';
      icon16 = '/assets/favicon-delivery-16.png';
      touchIcon = '/assets/favicon-delivery-192.png';
    } else {
      appKey = 'user';
      // Customer / User App
      // Only use settings.appFavicon if it is an explicit custom uploaded favicon, not the legacy default circle icon
      const customFavicon = settings?.appFavicon;
      const isLegacyDefault = !customFavicon || customFavicon === '/favicon.ico' || customFavicon === '/assets/favicon-circle.png';
      if (!isLegacyDefault) {
        icon32 = customFavicon;
        icon16 = customFavicon;
        touchIcon = customFavicon;
      }
    }

    const versioned32 = `${icon32}?v=${appKey}`;
    const versioned16 = `${icon16}?v=${appKey}`;
    const versionedTouch = `${touchIcon}?v=${appKey}`;

    // Remove existing link[rel*='icon'] and link[rel='apple-touch-icon'] elements to force browser tab refresh
    const oldIcons = document.querySelectorAll("link[rel*='icon'], link[rel='apple-touch-icon']");
    oldIcons.forEach((el) => el.remove());

    // Create fresh links and append to head
    const createLink = (rel: string, href: string, sizes?: string) => {
      const link = document.createElement('link');
      link.rel = rel;
      link.type = 'image/png';
      link.href = href;
      if (sizes) link.setAttribute('sizes', sizes);
      document.head.appendChild(link);
    };

    createLink('icon', versioned32, '32x32');
    createLink('icon', versioned16, '16x16');
    createLink('shortcut icon', versioned32);
    createLink('apple-touch-icon', versionedTouch);
  }, [location.pathname, settings?.appFavicon]);

  return null;
};

export default FaviconManager;
