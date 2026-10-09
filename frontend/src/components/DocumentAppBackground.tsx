import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const APP_ROUTE_CLASSES = [
  'customer-app-document',
  'seller-app-document',
  'delivery-app-document',
] as const;

export default function DocumentAppBackground() {
  const { pathname } = useLocation();

  useEffect(() => {
    const routeClass = pathname.startsWith('/seller')
      ? 'seller-app-document'
      : pathname.startsWith('/delivery')
        ? 'delivery-app-document'
        : 'customer-app-document';

    const background = routeClass === 'seller-app-document'
      ? '#fafafa'
      : routeClass === 'delivery-app-document'
        ? '#f5f5f5'
        : '#ffffff';

    const elements = [document.documentElement, document.body, document.getElementById('root')]
      .filter((element): element is HTMLElement => Boolean(element));

    elements.forEach((element) => {
      element.classList.remove(...APP_ROUTE_CLASSES);
      element.classList.add(routeClass);
      element.style.backgroundColor = background;
    });

    return () => {
      elements.forEach((element) => element.classList.remove(routeClass));
    };
  }, [pathname]);

  return null;
}
