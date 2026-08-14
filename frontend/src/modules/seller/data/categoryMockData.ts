/**
 * Mock Category and SubCategory Data
 * This file contains mock data that was previously used in category/subcategory pages.
 * Kept for reference and potential future use (testing, development, etc.)
 */

export interface CategoryMock {
    id: number;
    name: string;
    image: string;
    totalSubcategory: number;
}

export interface SubCategoryMock {
    id: number;
    categoryName: string;
    subcategoryName: string;
    subcategoryImage: string;
    totalProduct: number;
}

export const CATEGORIES_MOCK: CategoryMock[] = [
    {
        id: 2,
        name: 'Pet Care',
        image: '/assets/category-pet-care.png',
        totalSubcategory: 2
    },
    {
        id: 3,
        name: 'Sweet Tooth',
        image: '/assets/category-sweet-tooth.png',
        totalSubcategory: 3
    },
    {
        id: 4,
        name: 'Tea Coffee',
        image: '/assets/category-tea-coffee.png',
        totalSubcategory: 3
    },
    {
        id: 6,
        name: 'Instant Food',
        image: '/assets/category-instant-food.png',
        totalSubcategory: 3
    },
    {
        id: 7,
        name: 'Cleaning Essentials',
        image: '/assets/category-cleaning.png',
        totalSubcategory: 2
    }
];

export const SUBCATEGORIES_MOCK: SubCategoryMock[] = [
    {
        id: 5,
        categoryName: 'Pet Care',
        subcategoryName: 'Accessories & Other Supplies',
        subcategoryImage: '/assets/category-pet-care.png',
        totalProduct: 2
    },
    {
        id: 6,
        categoryName: 'Pet Care',
        subcategoryName: 'Dog Need',
        subcategoryImage: '/assets/category-pet-care.png',
        totalProduct: 8
    },
    {
        id: 7,
        categoryName: 'Sweet Tooth',
        subcategoryName: 'Indian Sweet',
        subcategoryImage: '/assets/category-sweet-tooth.png',
        totalProduct: 1
    },
    {
        id: 8,
        categoryName: 'Sweet Tooth',
        subcategoryName: 'Cake & Rolls',
        subcategoryImage: '/assets/category-sweet-tooth.png',
        totalProduct: 2
    },
    {
        id: 9,
        categoryName: 'Sweet Tooth',
        subcategoryName: 'Syrup',
        subcategoryImage: '/assets/category-sweet-tooth.png',
        totalProduct: 1
    },
    {
        id: 10,
        categoryName: 'Tea Coffee',
        subcategoryName: 'Tea',
        subcategoryImage: '/assets/category-tea-coffee.png',
        totalProduct: 1
    }
];

