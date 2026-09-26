import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAppSettings } from './AppSettingsContext';

export type CustomerChannel = 'ALL' | 'QUICK_COMMERCE' | 'ECOMMERCE' | 'WHOLESALE';

export const CUSTOMER_CHANNEL_STORAGE_KEY = 'olovely_customer_active_channel';

interface CustomerChannelContextType {
  activeChannel: CustomerChannel;
  setActiveChannel: (channel: CustomerChannel) => void;
  isWholesale: boolean;
  isQuickCommerce: boolean;
  isEcommerce: boolean;
  isAll: boolean;
  quickCommerceEnabled: boolean;
  ecommerceEnabled: boolean;
}

const CustomerChannelContext = createContext<CustomerChannelContextType | undefined>(undefined);

export const CustomerChannelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { settings } = useAppSettings();
  const quickCommerceEnabled = settings.commerceChannels?.quickCommerceEnabled !== false;
  const ecommerceEnabled = settings.commerceChannels?.ecommerceEnabled === true;

  const [activeChannel, setActiveChannelState] = useState<CustomerChannel>(() => {
    try {
      const stored = localStorage.getItem(CUSTOMER_CHANNEL_STORAGE_KEY);
      if (
        stored === 'QUICK_COMMERCE' ||
        stored === 'ECOMMERCE' ||
        stored === 'WHOLESALE' ||
        stored === 'ALL'
      ) {
        return stored;
      }
    } catch (e) {
      console.warn('Failed to read customer channel from localStorage:', e);
    }
    return 'ALL';
  });

  // Auto-switch customer away from a globally disabled channel
  useEffect(() => {
    if (!quickCommerceEnabled && activeChannel === 'QUICK_COMMERCE') {
      setActiveChannelState('ECOMMERCE');
      try {
        localStorage.setItem(CUSTOMER_CHANNEL_STORAGE_KEY, 'ECOMMERCE');
      } catch (e) {
        // ignore
      }
    } else if (!ecommerceEnabled && activeChannel === 'ECOMMERCE') {
      setActiveChannelState('QUICK_COMMERCE');
      try {
        localStorage.setItem(CUSTOMER_CHANNEL_STORAGE_KEY, 'QUICK_COMMERCE');
      } catch (e) {
        // ignore
      }
    }
  }, [quickCommerceEnabled, ecommerceEnabled, activeChannel]);

  const setActiveChannel = (channel: CustomerChannel) => {
    if (channel === 'QUICK_COMMERCE' && !quickCommerceEnabled) {
      console.warn('Quick Commerce is globally disabled');
      return;
    }
    if (channel === 'ECOMMERCE' && !ecommerceEnabled) {
      console.warn('E-Commerce is globally disabled');
      return;
    }
    setActiveChannelState(channel);
    try {
      localStorage.setItem(CUSTOMER_CHANNEL_STORAGE_KEY, channel);
    } catch (e) {
      console.warn('Failed to persist customer channel to localStorage:', e);
    }
  };

  // Sync across tabs/windows if storage event fires
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === CUSTOMER_CHANNEL_STORAGE_KEY && event.newValue) {
        const val = event.newValue as CustomerChannel;
        if (
          val === 'WHOLESALE' ||
          val === 'ALL' ||
          (val === 'QUICK_COMMERCE' && quickCommerceEnabled) ||
          (val === 'ECOMMERCE' && ecommerceEnabled)
        ) {
          setActiveChannelState(val);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [quickCommerceEnabled, ecommerceEnabled]);

  const isWholesale = activeChannel === 'WHOLESALE';
  const isQuickCommerce = activeChannel === 'QUICK_COMMERCE';
  const isEcommerce = activeChannel === 'ECOMMERCE';
  const isAll = activeChannel === 'ALL';

  return (
    <CustomerChannelContext.Provider
      value={{
        activeChannel,
        setActiveChannel,
        isWholesale,
        isQuickCommerce,
        isEcommerce,
        isAll,
        quickCommerceEnabled,
        ecommerceEnabled,
      }}
    >
      {children}
    </CustomerChannelContext.Provider>
  );
};

export const useCustomerChannel = (): CustomerChannelContextType => {
  const context = useContext(CustomerChannelContext);
  if (!context) {
    throw new Error('useCustomerChannel must be used within a CustomerChannelProvider');
  }
  return context;
};

export default CustomerChannelContext;
