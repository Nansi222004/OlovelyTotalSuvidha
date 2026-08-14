import { createContext, useContext, useState, ReactNode } from 'react';

interface DeliveryUserContextType {
  userName: string;
  setUserName: (name: string) => void;
}

const DeliveryUserContext = createContext<DeliveryUserContextType | undefined>(undefined);

export function DeliveryUserProvider({ children }: { children: ReactNode }) {
  // Initialize with 'Pratik' as default, or get from localStorage if available
  const [userName, setUserName] = useState(() => {
    const savedName = localStorage.getItem('delivery_user_name');
    return savedName || '';
  });

  const updateUserName = (name: string) => {
    setUserName(name);
    localStorage.setItem('delivery_user_name', name);
  };

  return (
    <DeliveryUserContext.Provider value={{ userName, setUserName: updateUserName }}>
      {children}
    </DeliveryUserContext.Provider>
  );
}

export function useDeliveryUser() {
  const context = useContext(DeliveryUserContext);
  if (context === undefined) {
    throw new Error('useDeliveryUser must be used within a DeliveryUserProvider');
  }
  return context;
}

