import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api/config';

export interface AppSettingsData {
  appName: string;
  appLogo?: string;
  appFavicon?: string;
  estimatedDeliveryTime?: string;
  contactEmail?: string;
  contactPhone?: string;
  supportEmail?: string;
  supportPhone?: string;
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyCountry?: string;
  companyPincode?: string;
  platformFee?: number;
  deliveryCharges?: number;
  freeDeliveryThreshold?: number;
  minimumOrderValue?: number;
  deliveryConfig?: {
    isDistanceBased?: boolean;
    baseCharge?: number;
    baseDistance?: number;
    kmRate?: number;
    deliveryBoyKmRate?: number;
    googleMapsKey?: string;
  };
  features?: {
    showSellerDetails?: boolean;
    sellerRegistration?: boolean;
    productApproval?: boolean;
    orderTracking?: boolean;
    wallet?: boolean;
    coupons?: boolean;
  };
  aboutUs?: {
    missionText?: string;
    whatWeDoText?: string;
    stats?: Array<{
      label: string;
      value: string;
    }>;
    whyChooseUs?: Array<{
      title: string;
      description: string;
    }>;
  };
}

interface AppSettingsContextType {
  settings: AppSettingsData;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: AppSettingsData = {
  appName: 'Olovely Total Suvidha',
  appLogo: '/assets/olovelylogo.png',
  estimatedDeliveryTime: '12-15 mins',
  contactEmail: 'OLOVELYTOTALSUVIDHA@GMAIL.COM',
  contactPhone: '9601715367',
  supportEmail: 'OLOVELYTOTALSUVIDHA@GMAIL.COM',
  supportPhone: '9601715367',
  companyAddress: 'Indore City, Madhya Pradesh, 452001',
  companyCity: 'Indore',
  companyState: 'Madhya Pradesh',
  companyCountry: 'India',
  companyPincode: '452001',
  platformFee: 2,
  deliveryCharges: 0,
  freeDeliveryThreshold: 500,
};

const AppSettingsContext = createContext<AppSettingsContextType>({
  settings: defaultSettings,
  isLoading: false,
  refreshSettings: async () => {},
});

export const AppSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettingsData>(defaultSettings);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/customer/app-settings');
      if (response.data && response.data.success && response.data.data) {
        setSettings((prev) => ({
          ...prev,
          ...response.data.data,
          appName: response.data.data.appName || prev.appName,
          appLogo: response.data.data.appLogo || prev.appLogo,
          estimatedDeliveryTime: response.data.data.estimatedDeliveryTime || prev.estimatedDeliveryTime,
        }));
      }
    } catch (error) {
      console.warn('Failed to fetch public app settings, using defaults:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Sync favicon with website logo / custom favicon
  useEffect(() => {
    const faviconUrl = settings.appFavicon || '/assets/favicon-circle.png';
    const iconLinks: NodeListOf<HTMLLinkElement> = document.querySelectorAll("link[rel*='icon']");
    if (iconLinks.length > 0) {
      iconLinks.forEach((link) => {
        link.href = faviconUrl;
      });
    } else {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = faviconUrl;
      document.head.appendChild(link);
    }
  }, [settings.appFavicon]);

  return (
    <AppSettingsContext.Provider
      value={{
        settings,
        isLoading,
        refreshSettings: fetchSettings,
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => useContext(AppSettingsContext);
export default AppSettingsContext;
