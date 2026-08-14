import { useContext } from 'react';
import { LocationContext } from '../context/locationContext.types';

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}

