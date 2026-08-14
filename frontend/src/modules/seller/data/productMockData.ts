/**
 * Mock Product Data
 * This file contains mock data that was previously used in product pages.
 * Kept for reference and potential future use (testing, development, etc.)
 */

export interface ProductVariationMock {
    variationId: number;
    productName: string;
    sellerName: string;
    productImage: string;
    brandName: string;
    category: string;
    subCategory: string;
    price: number;
    discPrice: number;
    variation: string;
    isPopular?: boolean;
}

export interface ProductMock {
    productId: number;
    variations: ProductVariationMock[];
}

export const PRODUCTS_MOCK: ProductMock[] = [
    {
        productId: 2,
        variations: [
            {
                variationId: 16,
                productName: 'Maggi Masala 2 Minutes Instant Noodles',
                sellerName: 'Olovely Store',
                productImage: '/assets/product-mtr-poha.jpg',
                brandName: 'Amul',
                category: 'Instant Food',
                subCategory: 'Noodles',
                price: 60.00,
                discPrice: 55.00,
                variation: '100g',
                isPopular: true
            },
            {
                variationId: 18,
                productName: 'Maggi Masala 2 Minutes Instant Noodles',
                sellerName: 'Olovely Store',
                productImage: '/assets/product-mtr-poha.jpg',
                brandName: 'Amul',
                category: 'Instant Food',
                subCategory: 'Noodles',
                price: 120.00,
                discPrice: 110.00,
                variation: '200g',
                isPopular: true
            }
        ]
    },
    {
        productId: 3,
        variations: [
            {
                variationId: 3,
                productName: 'Maggi 2 - Minute Instant Noodles (Pack of 12)',
                sellerName: 'Olovely Store',
                productImage: '/assets/product-mtr-poha.jpg',
                brandName: 'Amul',
                category: 'Instant Food',
                subCategory: 'Noodles',
                price: 180.00,
                discPrice: 160.00,
                variation: '840 g (12 x 70 g)'
            }
        ]
    },
    {
        productId: 5,
        variations: [
            {
                variationId: 39,
                productName: 'Safal Frozen Green Peas',
                sellerName: 'Olovely Store',
                productImage: '/assets/category-fruits-veg.png',
                brandName: '',
                category: 'Instant Food',
                subCategory: 'Frozen Veg',
                price: 50.00,
                discPrice: 0,
                variation: '250g'
            }
        ]
    },
    {
        productId: 11,
        variations: [
            {
                variationId: 14,
                productName: 'Sumeru Grated Coconut',
                sellerName: 'Olovely Store',
                productImage: '/assets/category-fruits-veg.png',
                brandName: 'Amul',
                category: 'Instant Food',
                subCategory: 'Frozen Veg',
                price: 108.00,
                discPrice: 0,
                variation: '200 g'
            }
        ]
    }
];

export interface StockItemMock {
    variationId: number;
    name: string;
    seller: string;
    image: string;
    variation: string;
    stock: number | 'Unlimited';
    status: 'Published' | 'Unpublished';
    category: string;
}

export const STOCK_ITEMS_MOCK: StockItemMock[] = [
    {
        variationId: 3,
        name: 'Maggi 2 - Minute Instant Noodles (Pack of 12)',
        seller: 'Olovely Store',
        image: '/assets/product-mtr-poha.jpg',
        variation: '840 g (12 x 70 g)',
        stock: 134,
        status: 'Published',
        category: 'Instant Food'
    },
    {
        variationId: 14,
        name: 'Sumeru Grated Coconut (Frozen)',
        seller: 'Olovely Store',
        image: '/assets/category-fruits-veg.png',
        variation: '200 g',
        stock: 67,
        status: 'Published',
        category: 'Instant Food'
    },
    {
        variationId: 16,
        name: 'Maggi Masala 2 Minutes Instant Noodles',
        seller: 'Olovely Store',
        image: '/assets/product-mtr-poha.jpg',
        variation: '100g',
        stock: 'Unlimited',
        status: 'Published',
        category: 'Instant Food'
    },
    {
        variationId: 17,
        name: "Abbie's Pure Maple Syrup",
        seller: 'Olovely Store',
        image: '/assets/category-sweet-tooth.png',
        variation: '250 ml',
        stock: 47,
        status: 'Published',
        category: 'Sweet Tooth'
    },
    {
        variationId: 18,
        name: 'Maggi Masala 2 Minutes Instant Noodles',
        seller: 'Olovely Store',
        image: '/assets/product-mtr-poha.jpg',
        variation: '200g',
        stock: 47,
        status: 'Published',
        category: 'Instant Food'
    },
    {
        variationId: 21,
        name: 'Yoga Bar Chocolate Chunk Nut Multigrain Protein Bar (35 g)',
        seller: 'Olovely Store',
        image: '/assets/category-snacks.png',
        variation: '35 g',
        stock: 6,
        status: 'Published',
        category: 'Snacks'
    }
];


