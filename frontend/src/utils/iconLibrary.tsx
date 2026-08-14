import React from 'react';

export interface IconDef {
    name: string;
    label: string;
    tags: string[];
    svg: React.ReactNode;
}

export const ICON_LIBRARY: IconDef[] = [
    // --- GROCERY & FOOD ---
    {
        name: 'grocery-basket',
        label: 'Grocery Basket',
        tags: ['grocery', 'food', 'basket', 'buy', 'shop', 'market', 'vegetable'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.29 2.29a1 1 0 0 0 .7 1.71h14M17 13v1" />
                <circle cx="9" cy="20" r="1" />
                <circle cx="17" cy="20" r="1" />
            </svg>
        )
    },
    {
        name: 'fast-food',
        label: 'Fast Food',
        tags: ['fast', 'food', 'burger', 'drink', 'meal', 'lunch', 'dinner'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5l2.5-2.5h-5L12 5zm-6 4c0-2 2-3 6-3s6 1 6 3v2H6V9zm0 4h12v1.5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 14.5V13zm0-2h12v1H6v-1z" />
                <path d="M7 21h10" strokeLinecap="round" />
                <path d="M12 5v4" strokeLinecap="round" />
            </svg>
        )
    },
    {
        name: 'vegetables',
        label: 'Vegetables',
        tags: ['vegetable', 'tomato', 'food', 'grocery', 'farm', 'fresh', 'healthy'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21c4.4 0 8-3.6 8-8 0-4.4-3.6-8-8-8-4.4 0-8 3.6-8 8 0 4.4 3.6 8 8 8z" />
                <path d="M12 5c-1.5 0-3 1.5-3 3" />
                <path d="M12 5c1.5 0 3 1.5 3 3" />
                <path d="M12 2v3" />
            </svg>
        )
    },
    {
        name: 'fruits',
        label: 'Fruits',
        tags: ['fruit', 'apple', 'healthy', 'food', 'grocery', 'fresh', 'juice'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
                <path d="M12 4c0-2 2-3 2-3" />
                <path d="M12 4c-1.5-1-4-1-4-1" />
            </svg>
        )
    },
    {
        name: 'bakery',
        label: 'Bakery',
        tags: ['bakery', 'bread', 'cake', 'food', 'breakfast', 'toast'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14.5V8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v6.5" />
                <path d="M20 20H4a2 2 0 0 1-2-2v-3.5h20V18a2 2 0 0 1-2 2z" />
                <path d="M8 8v2" />
                <path d="M12 8v2" />
                <path d="M16 8v2" />
            </svg>
        )
    },
    {
        name: 'coffee-tea',
        label: 'Tea & Coffee',
        tags: ['coffee', 'tea', 'drink', 'beverage', 'cup', 'mug', 'cafe', 'breakfast'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
        )
    },
    {
        name: 'meat-fish',
        label: 'Meat & Fish',
        tags: ['meat', 'fish', 'seafood', 'non-veg', 'protein', 'chicken'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 7c0-3.3-2.7-6-6-6-1.7 0-3.2.7-4.2 1.8-.6.7-1.8 1.2-1.8 3.2 0 3.3 2.7 6 6 6 1.7 0 3.2-.7 4.2-1.8.6-.7 1.8-1.2 1.8-3.2z" />
                <path d="M6 12l-3 3 3 3" />
                <path d="M18 12c-3.3 0-6 2.7-6 6 0 2.2 1.8 4 4 4s4-1.8 4-4-2.7-6-6-6z" />
                <circle cx="18" cy="18" r="1.5" />
            </svg>
        )
    },
    {
        name: 'ice-cream',
        label: 'Ice Cream',
        tags: ['ice', 'cream', 'dessert', 'summer', 'sweet', 'cone', 'cold'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 11c0-4 2.5-6 5-6s5 2 5 6v1H7v-1z" />
                <path d="M12 22l-5-10h10l-5 10z" />
            </svg>
        )
    },
    {
        name: 'pizza',
        label: 'Pizza',
        tags: ['pizza', 'fast', 'food', 'italian', 'dinner', 'snack', 'slice'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 22h20L12 2z" />
                <path d="M12 2v20" />
                <circle cx="12" cy="10" r="1.5" />
                <circle cx="9" cy="16" r="1.5" />
                <circle cx="15" cy="16" r="1.5" />
            </svg>
        )
    },

    // --- FASHION ---
    {
        name: 'fashion',
        label: 'Fashion',
        tags: ['fashion', 'clothes', 'style', 'dress', 'apparel', 'wear'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
            </svg>
        )
    },
    {
        name: 'mens-wear',
        label: 'Mens Wear',
        tags: ['men', 'wear', 'shirt', 'tshirt', 'clothes', 'fashion', 'boy'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6l3-4h12l3 4v16H3V6z" />
                <path d="M8 2v4" />
                <path d="M16 2v4" />
                <path d="M12 6v14" />
            </svg>
        )
    },
    {
        name: 'womens-wear',
        label: 'Womens Wear',
        tags: ['women', 'wear', 'dress', 'frock', 'clothes', 'fashion', 'girl', 'lady'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l-7 4v16h14V6l-7-4z" />
                <path d="M12 7v15" />
                <path d="M8 12h8" />
            </svg>
        )
    },
    {
        name: 'footwear',
        label: 'Footwear',
        tags: ['footwear', 'shoes', 'sneakers', 'boots', 'sandals', 'running', 'sports'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 16v-5a5 5 0 0 1 5-5h6a3 3 0 0 1 3 3v2" />
                <path d="M4 16h17a2 2 0 0 1 0 4H5a1 1 0 0 1-1-1z" />
                <path d="M13 11l4 5" />
            </svg>
        )
    },
    {
        name: 'watches',
        label: 'Watches',
        tags: ['watch', 'time', 'wrist', 'accessories', 'luxury', 'fashion'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="7" />
                <path d="M12 9v3l1.5 1.5" />
                <path d="M12 5V3m0 18v-2" />
                <path d="M16.24 16.24L19.07 19.07M4.93 4.93L7.76 7.76" />
            </svg>
        )
    },
    {
        name: 'jewelry',
        label: 'Jewelry',
        tags: ['jewelry', 'ring', 'necklace', 'diamond', 'gold', 'luxury', 'wedding'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h12l4 6-10 13L2 9z" />
                <path d="M11 3v6" />
                <path d="M13 3v6" />
                <path d="M2 9h20" />
            </svg>
        )
    },
    {
        name: 'bags',
        label: 'Bags',
        tags: ['bag', 'handbag', 'purse', 'travel', 'fashion', 'accessories'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="8" width="16" height="14" rx="2" />
                <path d="M8 8V6a4 4 0 0 1 8 0v2" />
            </svg>
        )
    },

    // --- ELECTRONICS ---
    {
        name: 'electronics',
        label: 'Electronics',
        tags: ['electronics', 'gadget', 'tech', 'device', 'plug', 'power', 'socket'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="4" />
                <circle cx="12" cy="12" r="2" />
                <path d="M12 2v4" />
                <path d="M12 18v4" />
                <path d="M2 12h4" />
                <path d="M18 12h4" />
            </svg>
        )
    },
    {
        name: 'mobiles',
        label: 'Mobiles',
        tags: ['mobile', 'phone', 'smartphone', 'call', 'device', 'tech'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="3" />
                <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" />
            </svg>
        )
    },
    {
        name: 'laptops',
        label: 'Laptops',
        tags: ['laptop', 'computer', 'pc', 'macbook', 'work', 'tech'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="12" rx="2" />
                <path d="M2 20h20" />
                <path d="M22 20l-1-4H3l-1 4" />
            </svg>
        )
    },
    {
        name: 'headphones',
        label: 'Headphones',
        tags: ['headphone', 'audio', 'music', 'sound', 'ears', 'tech', 'gadget'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14v4a2 2 0 0 0 2 2h2v-8H6a2 2 0 0 0-2 2z" />
                <path d="M16 12h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2v-8z" />
                <path d="M6 12V7a6 6 0 1 1 12 0v5" />
            </svg>
        )
    },
    {
        name: 'camera',
        label: 'Cameras',
        tags: ['camera', 'photo', 'video', 'lens', 'photography', 'shoot'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="7" width="18" height="14" rx="2" />
                <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
                <circle cx="12" cy="14" r="4" />
                <line x1="17" y1="10" x2="17.01" y2="10" strokeWidth="2" />
            </svg>
        )
    },

    // --- HOME & LIVING ---
    {
        name: 'home',
        label: 'Home & Living',
        tags: ['home', 'house', 'furniture', 'decor', 'living', 'room'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5" />
                <path d="M19 10v11a1 1 0 0 1-1 1h-4v-6h-4v6H6a1 1 0 0 1-1-1V10" />
            </svg>
        )
    },
    {
        name: 'furniture',
        label: 'Furniture',
        tags: ['furniture', 'sofa', 'chair', 'table', 'wood', 'home', 'decor'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 10h12" />
                <path d="M6 10v6a3 3 0 0 0 6 0v-6" />
                <path d="M18 10v6a3 3 0 0 1-6 0" />
                <path d="M4 20h16" />
            </svg>
        )
    },
    {
        name: 'clean',
        label: 'Cleaning',
        tags: ['clean', 'wash', 'soap', 'hygiene', 'sweep', 'vacuum', 'brush', 'spray'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 11a4 4 0 1 1-6.8-4.2l5-9 1.7 1z" />
                <path d="M5 19h14M8 19v-4m8 4v-4" />
            </svg>
        )
    },
    {
        name: 'kitchen',
        label: 'Kitchen',
        tags: ['kitchen', 'cook', 'pot', 'pan', 'utensils', 'chef', 'food'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12h20" />
                <path d="M20 12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-6" />
                <path d="M5 8v4" />
                <path d="M12 5v7" />
                <path d="M19 8v4" />
            </svg>
        )
    },

    // --- OTHERS ---
    {
        name: 'beauty',
        label: 'Beauty',
        tags: ['beauty', 'makeup', 'lipstick', 'salon', 'care', 'cosmetics', 'face'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 4L6 8V18C6 19.1046 6.89543 20 8 20H16C17.1046 20 18 19.1046 18 18V8L16 4H8Z" />
                <path d="M8 4H16" />
                <path d="M10 12L12 14L14 12" />
                <path d="M9 8H15" />
            </svg>
        )
    },
    {
        name: 'medicine',
        label: 'Medicine',
        tags: ['medicine', 'health', 'doctor', 'pill', 'hospital', 'care', 'pharmacy'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <path d="M12 8v8" />
                <path d="M8 12h8" />
            </svg>
        )
    },
    {
        name: 'baby',
        label: 'Baby Care',
        tags: ['baby', 'child', 'kid', 'toy', 'diaper', 'care', 'infant', 'pram'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="16" cy="18" r="2" />
                <circle cx="9" cy="18" r="2" />
                <path d="M19 16V6a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h10" />
                <path d="M5 14h14" />
                <path d="M7 6h10" />
                <path d="M22 6h-3" />
            </svg>
        )
    },
    {
        name: 'pet',
        label: 'Pet Care',
        tags: ['pet', 'dog', 'cat', 'animal', 'food', 'care', 'vet', 'paw'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 14c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4z" />
                <path d="M7 6.5c0 1.4-1.1 2.5-2.5 2.5S2 7.9 2 6.5 3.1 4 4.5 4 7 5.1 7 6.5z" />
                <path d="M12.5 3c0 1.4-1.1 2.5-2.5 2.5S7.5 4.4 7.5 3 8.6 0.5 10 0.5 12.5 1.6 12.5 3z" />
                <path d="M17 6.5c0 1.4-1.1 2.5-2.5 2.5S12 7.9 12 6.5 13.1 4 14.5 4 17 5.1 17 6.5z" />
                <path d="M22 6.5c0 1.4-1.1 2.5-2.5 2.5S17 7.9 17 6.5 18.1 4 19.5 4 22 5.1 22 6.5z" />
            </svg>
        )
    },
    {
        name: 'sports',
        label: 'Sports',
        tags: ['sports', 'game', 'play', 'fitness', 'gym', 'active', 'ball'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
            </svg>
        )
    },
    {
        name: 'fitness',
        label: 'Fitness',
        tags: ['fitness', 'gym', 'dumbbell', 'weight', 'workout', 'muscle', 'health'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 4h12" />
                <path d="M6 20h12" />
                <path d="M9 4v16" />
                <path d="M15 4v16" />
            </svg>
        )
    },
    {
        name: 'books',
        label: 'Books',
        tags: ['book', 'read', 'study', 'learn', 'education', 'library', 'paper'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
        )
    },
    {
        name: 'toys',
        label: 'Toys',
        tags: ['toys', 'game', 'puzzle', 'kid', 'child', 'play', 'block'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="6" width="12" height="12" rx="2" />
                <circle cx="12" cy="12" r="3" />
                <path d="M6 6l4 4" />
                <path d="M18 6l-4 4" />
                <path d="M6 18l4-4" />
                <path d="M18 18l-4-4" />
            </svg>
        )
    },
    {
        name: 'automotive',
        label: 'Automotive',
        tags: ['auto', 'car', 'vehicle', 'drive', 'transport', 'bike', 'motor'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 16H9m10 0h3v-3.15M17 16h6M3 16h6m-9 0v-5a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v5" style={{ stroke: 'currentColor' }} />
                <circle cx="6" cy="16" r="2" />
                <circle cx="18" cy="16" r="2" />
            </svg>
        )
    },
    {
        name: 'wedding',
        label: 'Wedding',
        tags: ['wedding', 'marriage', 'love', 'couple', 'gift', 'celebrate', 'event'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
        )
    },
    {
        name: 'party',
        label: 'Party Needs',
        tags: ['party', 'celebrate', 'balloon', 'confetti', 'event', 'birthday', 'gift'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="10" r="5" />
                <line x1="12" y1="15" x2="12" y2="22" />
                <path d="M9 18s1-1 3-1 3 1 3 1" />
            </svg>
        )
    },
    {
        name: 'winter',
        label: 'Winter',
        tags: ['winter', 'snow', 'cold', 'weather', 'ice', 'season'],
        svg: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" />
            </svg>
        )
    }
];

export const getIconByName = (name: string): React.ReactNode => {
    const found = ICON_LIBRARY.find(icon => icon.name === name);
    return found ? found.svg : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
    );
};
