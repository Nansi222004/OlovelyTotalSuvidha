import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getHeaderCategoriesPublic, HeaderCategory } from "../../services/api/headerCategoryService";
import { getCategories, Category as ApiCategory } from "../../services/api/customerProductService";
import { getIconByName } from "../../utils/iconLibrary";
import IconLoader from "../../components/loaders/IconLoader";
import { motion, AnimatePresence } from "framer-motion";
import "./styles/Categories.css";

export default function Categories() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>([]);
  const [allCategories, setAllCategories] = useState<ApiCategory[]>([]);

  // Fetch all necessary data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch headers and all categories in parallel
        const [headers, catRes] = await Promise.all([
          getHeaderCategoriesPublic(true),
          getCategories(false) // Flat list of categories
        ]);
        
        setHeaderCategories(headers);
        setAllCategories(catRes.data || []);
      } catch (err) {
        console.error("Failed to fetch categories data:", err);
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Group categories by Header Category ID
  const groupedCategories = useMemo(() => {
    if (!headerCategories.length || !allCategories.length) return [];
    
    return headerCategories
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(header => {
        const matchingCategories = allCategories.filter(cat => {
          // Only show top-level categories (no parentId) under headers
          if (cat.parentId) return false;

          // headerCategoryId might be an object or a string
          const headerId = typeof cat.headerCategoryId === 'object' 
            ? cat.headerCategoryId?._id 
            : cat.headerCategoryId;
            
          return headerId?.toString() === header._id.toString();
        });
        
        return {
          ...header,
          categories: matchingCategories.sort((a, b) => (a.order || 0) - (b.order || 0))
        };
      })
      .filter(group => group.categories.length > 0);
  }, [headerCategories, allCategories]);

  if (loading) return <IconLoader forceShow />;

  if (error && !groupedCategories.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center bg-white">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Oops!</h3>
        <p className="text-gray-600 mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-8 py-3 bg-green-600 text-white rounded-2xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="categories-container font-sans">
      {/* Premium Hero Section */}
      <div className="categories-hero">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-1"
        >
          Categories
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[9px] md:text-[10px]"
        >
          Discover products by category
        </motion.p>
      </div>

      <div className="categories-scroll-area pb-32">
        <AnimatePresence>
          {groupedCategories.map((group, groupIndex) => (
            <motion.section 
              key={group._id} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: groupIndex * 0.1 }}
              className="header-category-section"
            >
              {/* Sticky Header Category Name */}
              <div className="header-category-title-container">
                <div className="header-category-icon">
                  {getIconByName(group.iconName)}
                </div>
                <h2 className="header-category-name">{group.name}</h2>
              </div>

              {/* Grid of Categories */}
              <div className="category-grid">
                {group.categories.map((category) => (
                  <motion.div
                    key={category._id}
                    className="category-card"
                    whileHover={{ y: -5 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => navigate(`/category/${category._id}`)}
                  >
                    <div className="category-image-container">
                      {category.image ? (
                        <img 
                          src={category.image} 
                          alt={category.name} 
                          className="category-image"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-3xl filter grayscale group-hover:grayscale-0 transition-all">
                          {category.icon || "📦"}
                        </span>
                      )}
                    </div>
                    <span className="category-label">{category.name}</span>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ))}
        </AnimatePresence>

        {/* Empty State */}
        {!loading && groupedCategories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-slate-900 font-bold text-lg mb-1">No Categories Found</h3>
            <p className="text-slate-400 text-sm">We couldn't find any registered categories at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
