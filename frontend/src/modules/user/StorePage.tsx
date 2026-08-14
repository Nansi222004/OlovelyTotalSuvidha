import { useNavigate, useParams, Link } from 'react-router-dom';
import { Product } from '../../types/domain';
import { useEffect, useState } from 'react';
import { getStoreProducts } from '../../services/api/customerHomeService';
import { useLocation } from '../../hooks/useLocation';
import ProductCard from './components/ProductCard';

export default function StorePage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { location } = useLocation();
    const [products, setProducts] = useState<Product[]>([]);
    const [shopData, setShopData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!slug) return;
            try {
                setLoading(true);

                // Fetch shop data and products using the shop API endpoint
                const response = await getStoreProducts(
                    slug,
                    location?.latitude,
                    location?.longitude
                );
                console.log(`[StorePage] Response for slug "${slug}":`, {
                    success: response.success,
                    productsCount: response.data?.length || 0,
                    shop: response.shop ? { name: response.shop.name, image: response.shop.image } : null,
                    message: response.message
                });
                if (response.success) {
                    setProducts(response.data || []);
                    setShopData(response.shop || null);
                } else {
                    setProducts([]);
                    setShopData(null);
                }
            } catch (error: any) {
                console.error('Failed to fetch store data:', error);
                console.error('Error details:', error.response?.data || error.message);
                setProducts([]);
                setShopData(null);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [slug, location]);

    const storeName = shopData?.name || (slug ? slug.charAt(0).toUpperCase() + slug.slice(1).replace('-', ' ') : 'Store');
    const [bannerImage, setBannerImage] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);

    // Determine banner image source
    useEffect(() => {
        if (shopData?.image) {
            setBannerImage(shopData.image);
            setImageError(false);
        } else if (slug) {
            // Try multiple possible image paths
            const possiblePaths = [
                `/assets/shopbystore/${slug}/${slug}header.png`,
                `/assets/shopbystore/${slug}/header.png`,
                `/assets/shopbystore/${slug}.png`,
                `/assets/shopbystore/${slug}.jpg`,
            ];
            setBannerImage(possiblePaths[0]);
            setImageError(false);
        } else {
            setBannerImage(null);
            setImageError(true);
        }
    }, [shopData, slug]);

    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const target = e.target as HTMLImageElement;
        const currentSrc = target.src;

        // Try fallback paths if current one fails
        if (slug && currentSrc.includes('/assets/shopbystore/')) {
            const fallbackPaths = [
                `/assets/shopbystore/${slug}/header.png`,
                `/assets/shopbystore/${slug}.png`,
                `/assets/shopbystore/${slug}.jpg`,
            ];
            const currentIndex = fallbackPaths.findIndex(path => currentSrc.includes(path));

            if (currentIndex < fallbackPaths.length - 1) {
                // Try next fallback path
                target.src = fallbackPaths[currentIndex + 1];
                return;
            }
        }

        // If all paths failed, show fallback
        setImageError(true);
        target.style.display = 'none';
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Store Banner */}
            <div className="relative w-full aspect-[2/1] bg-neutral-100 overflow-hidden">
                {bannerImage && !imageError ? (
                    <img
                        src={bannerImage}
                        alt={storeName}
                        className="w-full h-full object-cover"
                        onError={handleImageError}
                        loading="eager"
                    />
                ) : (
                    <div className="banner-fallback w-full h-full bg-gradient-to-br from-cyan-50 to-teal-100 flex items-center justify-center">
                        <div className="text-4xl font-bold text-neutral-400">
                            {storeName.charAt(0).toUpperCase()}
                        </div>
                    </div>
                )}

                {/* Header Overlay */}
                <header className="absolute top-0 left-0 right-0 z-10">
                    <div className="px-3 py-2 flex items-center justify-between gap-2">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-lg bg-white/70 shadow-sm hover:bg-white/80 transition-colors flex-shrink-0 border border-white/20"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M15 18L9 12L15 6" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>

                        <div className="flex-1 min-w-0 px-2">
                            <h1 className="text-sm font-bold text-neutral-900 drop-shadow-sm">{storeName}</h1>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                                onClick={() => navigate('/search')}
                                className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-lg bg-white/70 shadow-sm hover:bg-white/80 transition-colors border border-white/20"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <circle cx="11" cy="11" r="8" stroke="#000000" strokeWidth="2" />
                                    <path d="m21 21-4.35-4.35" stroke="#000000" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </header>

                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent" />
            </div>

            {/* Products Section */}
            <div className="px-4 py-4">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Top buys in {storeName}</h3>

                {loading ? (
                    <div className="flex justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    </div>
                ) : products.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
                        {products.map((product) => (
                            <ProductCard
                                key={product._id || product.id}
                                product={product}
                                categoryStyle={true}
                                showBadge={true}
                                showPackBadge={false}
                                showStockInfo={false}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-neutral-500">
                        <p>No products found in this store yet.</p>
                        <Link to="/" className="text-green-600 font-medium mt-2 inline-block">Explore other categories</Link>
                    </div>
                )}
            </div>
        </div>
    );
}
