import { useState } from 'react';

interface Subcategory {
    id: number;
    name: string;
    order: number;
}

const CATEGORIES = [
    'Select category',
    'Organic & Premium',
    'Instant Food',
    'Masala Oil',
    'Pet Care',
    'Sweet Tooth',
    'Tea Coffee',
    'Cleaning Essentials',
    'Personal Care',
    'Paan Corner',
    'Pharma And Wellness',
    'Bakery Biscuits',
    'Sauces Spreads',
    'Home Office',
];

// Mock subcategories data - in real app, this would come from API based on selected category
const SUBCATEGORIES_BY_CATEGORY: Record<string, Subcategory[]> = {
    'Instant Food': [
        { id: 1, name: 'Frozen Veg', order: 1 },
        { id: 2, name: 'Energy Bar', order: 2 },
        { id: 3, name: 'Noodles', order: 3 },
    ],
    'Organic & Premium': [
        { id: 4, name: 'Organic Grains', order: 1 },
        { id: 5, name: 'Organic Spices', order: 2 },
        { id: 6, name: 'Organic Oils', order: 3 },
    ],
    'Masala Oil': [
        { id: 7, name: 'Spices', order: 1 },
        { id: 8, name: 'Masalas', order: 2 },
        { id: 9, name: 'Cooking Oils', order: 3 },
    ],
    'Pet Care': [
        { id: 10, name: 'Dog Food', order: 1 },
        { id: 11, name: 'Cat Food', order: 2 },
        { id: 12, name: 'Pet Accessories', order: 3 },
    ],
    'Sweet Tooth': [
        { id: 13, name: 'Chocolates', order: 1 },
        { id: 14, name: 'Biscuits', order: 2 },
        { id: 15, name: 'Candies', order: 3 },
    ],
};

export default function AdminSubcategoryOrder() {
    const [selectedCategory, setSelectedCategory] = useState('Select category');
    const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
    const [draggedItem, setDraggedItem] = useState<number | null>(null);
    const [originalOrder, setOriginalOrder] = useState<Subcategory[]>([]);

    const handleCategoryChange = (category: string) => {
        setSelectedCategory(category);
        if (category !== 'Select category' && SUBCATEGORIES_BY_CATEGORY[category]) {
            const categorySubcategories = [...SUBCATEGORIES_BY_CATEGORY[category]];
            setSubcategories(categorySubcategories);
            setOriginalOrder(categorySubcategories);
        } else {
            setSubcategories([]);
            setOriginalOrder([]);
        }
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedItem(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('border-teal-500', 'border-2');
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.currentTarget.classList.remove('border-teal-500', 'border-2');
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedItem === null) return;

        const newSubcategories = [...subcategories];
        const draggedSubcategory = newSubcategories[draggedItem];
        
        // Remove dragged item
        newSubcategories.splice(draggedItem, 1);
        
        // Insert at new position
        newSubcategories.splice(dropIndex, 0, draggedSubcategory);
        
        // Update order numbers
        const reorderedSubcategories = newSubcategories.map((subcategory, index) => ({
            ...subcategory,
            order: index + 1,
        }));

        setSubcategories(reorderedSubcategories);
        setDraggedItem(null);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
    };

    const handleUpdateOrder = () => {
        if (selectedCategory === 'Select category') {
            alert('Please select a category');
            return;
        }
        
        if (subcategories.length === 0) {
            alert('No subcategories to update');
            return;
        }

        // In real app, this would make an API call to update the order
        console.log('Updating subcategory order:', subcategories);
        alert('Subcategory order updated successfully!');
        
        // Update original order to match current order
        setOriginalOrder([...subcategories]);
    };

    const handleResetOrder = () => {
        if (originalOrder.length > 0) {
            setSubcategories([...originalOrder]);
            alert('Order reset to original');
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Page Content */}
            <div className="flex-1 p-6">
                <div className="max-w-4xl mx-auto">
                    {/* Main Panel */}
                    <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
                        {/* Header */}
                        <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg">
                            <h2 className="text-lg font-semibold">Update Subcategory Order</h2>
                        </div>

                        {/* Form Content */}
                        <div className="p-6">
                            {/* Category Selection */}
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-neutral-800 mb-2">
                                    Select category
                                </label>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => handleCategoryChange(e.target.value)}
                                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                >
                                    {CATEGORIES.map((category) => (
                                        <option key={category} value={category}>
                                            {category}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Subcategory List */}
                            {subcategories.length > 0 && (
                                <div className="mb-6">
                                    <div className="space-y-3">
                                        {subcategories.map((subcategory, index) => (
                                            <div
                                                key={subcategory.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, index)}
                                                onDragOver={handleDragOver}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => {
                                                    handleDragLeave(e);
                                                    handleDrop(e, index);
                                                }}
                                                onDragEnd={handleDragEnd}
                                                className={`flex items-center justify-between p-4 bg-gray-100 rounded-lg cursor-move transition-all border-2 border-transparent ${
                                                    draggedItem === index ? 'opacity-50' : 'hover:bg-gray-200'
                                                }`}
                                            >
                                                <span className="text-sm font-medium text-neutral-800 flex-1">
                                                    {subcategory.name}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-neutral-500">#{subcategory.order}</span>
                                                    <svg
                                                        width="20"
                                                        height="20"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        className="text-neutral-400"
                                                    >
                                                        <line x1="3" y1="12" x2="21" y2="12"></line>
                                                        <line x1="3" y1="6" x2="21" y2="6"></line>
                                                        <line x1="3" y1="18" x2="21" y2="18"></line>
                                                    </svg>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {selectedCategory !== 'Select category' && subcategories.length === 0 && (
                                <div className="mb-6 text-center py-8 text-neutral-400">
                                    No subcategories found for this category.
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="bg-teal-50 px-4 py-3 rounded-lg flex gap-3">
                                <button
                                    onClick={handleUpdateOrder}
                                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded font-medium transition-colors"
                                >
                                    Update Subcategory Order
                                </button>
                                <button
                                    onClick={handleResetOrder}
                                    className="flex-1 bg-white border-2 border-red-500 text-red-500 hover:bg-red-50 px-4 py-2 rounded font-medium transition-colors"
                                >
                                    Reset Order
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="text-center py-4 text-sm text-neutral-600 border-t border-neutral-200 bg-white">
                Copyright © 2025. Developed By{' '}
                <a href="#" className="text-blue-600 hover:underline">Olovely Total Suvidha</a>
            </footer>
        </div>
    );
}


