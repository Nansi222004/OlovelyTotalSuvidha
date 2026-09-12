import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type CustomerChannel = 'ALL' | 'QUICK_COMMERCE' | 'ECOMMERCE';

export const CUSTOMER_CHANNEL_STORAGE_KEY = 'olovely_customer_active_channel';

interface CustomerChannelContextType {
  activeChannel: CustomerChannel;
  setActiveChannel: (channel: CustomerChannel) => void;
}

const CustomerChannelContext = createContext<CustomerChannelContextType | undefined>(undefined);

export const CustomerChannelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeChannel, setActiveChannelState] = useState<CustomerChannel>(() => {
    try {
      const stored = localStorage.getItem(CUSTOMER_CHANNEL_STORAGE_KEY);
      if (stored === 'QUICK_COMMERCE' || stored === 'ECOMMERCE' || stored === 'ALL') {
        return stored;
      }
    } catch (e) {
      console.warn('Failed to read customer channel from localStorage:', e);
    }
    return 'ALL';
  });

  const setActiveChannel = (channel: CustomerChannel) => {
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
        if (
          event.newValue === 'QUICK_COMMERCE' ||
          event.newValue === 'ECOMMERCE' ||
          event.newValue === 'ALL'
        ) {
          setActiveChannelState(event.newValue as CustomerChannel);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <CustomerChannelContext.Provider value={{ activeChannel, setActiveChannel }}>
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
