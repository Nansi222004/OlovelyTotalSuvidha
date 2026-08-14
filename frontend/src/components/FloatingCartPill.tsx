import AddToCartAnimation from './AddToCartAnimation';

/**
 * FloatingCartPill Component
 * 
 * This is a wrapper component that uses AddToCartAnimation.
 * It maintains backward compatibility with the existing implementation.
 * 
 * For new implementations, use AddToCartAnimation directly.
 */
export default function FloatingCartPill() {
  return <AddToCartAnimation />;
}
