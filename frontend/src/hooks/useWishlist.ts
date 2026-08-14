import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocation } from './useLocation'; // Import useLocation
import { useToast } from '../context/ToastContext'; // Import useToast
import { useWishlistContext } from '../context/WishlistContext';

/**
 * Custom hook for managing wishlist state and toggle functionality
 * @param productId - The product ID to check/manage in wishlist
 * @returns Object with isWishlisted state and toggleWishlist function
 */
export function useWishlist(productId?: string) {
  const { isAuthenticated } = useAuth();
  const { location } = useLocation(); // Get location from context
  const { showToast } = useToast(); // Get toast function
  const navigate = useNavigate();
  const { isWishlisted: checkIsWishlisted, addWishlistProduct, removeWishlistProduct } =
    useWishlistContext();

  const isWishlisted = isAuthenticated && productId
    ? checkIsWishlisted(productId)
    : false;

  const toggleWishlist = async (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      if ('preventDefault' in e) e.preventDefault();
      if ('stopPropagation' in e) e.stopPropagation();
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!productId) {
      console.error('Product ID is required to toggle wishlist');
      return;
    }

    try {
      if (isWishlisted) {
        await removeWishlistProduct(productId);
        showToast('Removed from wishlist');
      } else {
        // Check for location availability before adding
        if (!location?.latitude || !location?.longitude) {
             showToast('Location is required to add items to wishlist', 'error');
             return;
        }

        await addWishlistProduct(productId);
        showToast('Added to wishlist');
      }
    } catch (error: any) {
      console.error('Failed to toggle wishlist:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update wishlist';
      showToast(errorMessage, 'error');
    }
  };

  return { isWishlisted, toggleWishlist };
}

