import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminOrders() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to all orders page
    navigate('/admin/orders/all', { replace: true });
  }, [navigate]);

  return null;
}

