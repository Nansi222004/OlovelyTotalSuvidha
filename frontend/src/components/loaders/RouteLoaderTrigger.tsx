import React from 'react';
import useRouteLoader from '../../hooks/useRouteLoader';

/**
 * Component to trigger route loading animation
 * Must be placed inside BrowserRouter
 */
const RouteLoaderTrigger: React.FC = () => {
  useRouteLoader();
  return null;
};

export default RouteLoaderTrigger;
