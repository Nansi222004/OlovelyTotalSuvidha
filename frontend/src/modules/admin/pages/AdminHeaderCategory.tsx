import { useState, useEffect, useMemo } from 'react';
import {
  getHeaderCategoriesAdmin,
  createHeaderCategory,
  updateHeaderCategory,
  deleteHeaderCategory,
  HeaderCategory
} from '../../../services/api/headerCategoryService';
import { themes } from '../../../utils/themes';
import { ICON_LIBRARY, getIconByName, IconDef } from '../../../utils/iconLibrary';

export default function AdminHeaderCategory() {
  const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [headerCategoryName, setHeaderCategoryName] = useState('');
  const [selectedIconLibrary, setSelectedIconLibrary] = useState('Custom'); // Default to Custom for SVG
  const [headerCategoryIcon, setHeaderCategoryIcon] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(''); // This maps to relatedCategory
  const [selectedTheme, setSelectedTheme] = useState('all'); // This maps to slug
  const [selectedStatus, setSelectedStatus] = useState<'Published' | 'Unpublished'>('Published');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Icon search state
  const [iconSearchTerm, setIconSearchTerm] = useState('');

  // Table states
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const themeOptions = Object.keys(themes);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await getHeaderCategoriesAdmin();
      setHeaderCategories(data);
    } catch (error) {
      console.error('Failed to fetch header categories', error);
      alert('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  // Smart Icon Suggestions
  useEffect(() => {
    if (headerCategoryName && !editingId) {
      // Logic handled in useMemo
    }
  }, [headerCategoryName]);

  const filteredIcons = useMemo(() => {
    const term = iconSearchTerm || headerCategoryName || '';
    if (!term.trim()) return ICON_LIBRARY;

    const lowerTerm = term.toLowerCase();

    return [...ICON_LIBRARY].sort((a, b) => {
      const aScore = getMatchScore(a, lowerTerm);
      const bScore = getMatchScore(b, lowerTerm);
      return bScore - aScore;
    });
  }, [iconSearchTerm, headerCategoryName]);

  function getMatchScore(icon: IconDef, term: string) {
    let score = 0;
    const lowerTerm = String(term || "").toLowerCase();
    if (String(icon.name || "").toLowerCase().includes(lowerTerm)) score += 10;
    if (String(icon.label || "").toLowerCase().includes(lowerTerm)) score += 10;
    if (icon.tags && icon.tags.some(t => String(t || "").toLowerCase().includes(lowerTerm))) score += 5;
    if (icon.tags && icon.tags.some(t => lowerTerm.includes(String(t || "").toLowerCase()))) score += 5;
    return score;
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const q = String(searchTerm || "").toLowerCase();
  const filteredCategories = headerCategories.filter(category =>
    String(category.name || "").toLowerCase().includes(q) ||
    String(category.relatedCategory || "").toLowerCase().includes(q) ||
    String(category.slug || "").toLowerCase().includes(q)
  );

  const totalPages = Math.ceil(filteredCategories.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const displayedCategories = filteredCategories.slice(startIndex, endIndex);

  const resetForm = () => {
    setHeaderCategoryName('');
    setSelectedIconLibrary('Custom');
    setHeaderCategoryIcon('');
    setSelectedCategory('');
    setSelectedTheme('all');
    setSelectedStatus('Published');
    setEditingId(null);
    setIconSearchTerm('');
  };

  const handleAddOrUpdate = async () => {
    if (!headerCategoryName.trim()) return alert('Please enter a header category name');
    if (!headerCategoryIcon.trim()) return alert('Please select an icon. If your category is unique, try searching for a generic icon.');
    if (!selectedTheme) return alert('Please select a theme');

    try {
      const payload = {
        name: headerCategoryName,
        iconLibrary: selectedIconLibrary,
        iconName: headerCategoryIcon,
        slug: selectedTheme, // Use theme as slug for color mapping
        relatedCategory: selectedCategory,
        status: selectedStatus,
      };

      if (editingId) {
        await updateHeaderCategory(editingId, payload);
        alert('Header Category updated successfully!');
      } else {
        await createHeaderCategory(payload);
        alert('Header Category added successfully!');
      }

      fetchCategories();
      resetForm();
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleEdit = (category: HeaderCategory) => {
    setEditingId(category._id);
    setHeaderCategoryName(category.name);
    setSelectedIconLibrary(category.iconLibrary);
    setHeaderCategoryIcon(category.iconName);
    setSelectedCategory(category.relatedCategory || '');
    setSelectedTheme(category.slug);
    setSelectedStatus(category.status);
    setIconSearchTerm('');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this header category?')) {
      try {
        await deleteHeaderCategory(id);
        alert('Header Category deleted successfully!');
        fetchCategories();
      } catch (error) {
        console.error(error);
        alert('Failed to delete category');
      }
    }
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <h1 className="text-2xl font-semibold text-neutral-800">Header Category</h1>
        <div className="text-sm text-blue-500">
          <span className="text-blue-500 hover:underline cursor-pointer">Home</span>{' '}
          <span className="text-neutral-400">/</span> Dashboard
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Left Panel - Add Header Category */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
            <h2 className="text-base sm:text-lg font-semibold">
              {editingId ? 'Edit Header Category' : 'Add Header Category'}
            </h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            {/* Header Category Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Header Category Name:
              </label>
              <input
                type="text"
                value={headerCategoryName}
                onChange={(e) => setHeaderCategoryName(e.target.value)}
                placeholder="Enter Category Name (e.g. Dairy, Books)"
                className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Select Icon Visual Grid */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-neutral-700">
                  Select Icon:
                </label>
                <input
                  type="text"
                  placeholder="Auto-match or type..."
                  value={iconSearchTerm}
                  onChange={(e) => setIconSearchTerm(e.target.value)}
                  className="px-2 py-1 text-xs border rounded border-neutral-300 w-32 focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 bg-neutral-50 p-3 rounded border border-neutral-200 h-64 overflow-y-auto custom-scrollbar">
                {filteredIcons.length > 0 ? filteredIcons.map((option) => {
                  const isSelected = headerCategoryIcon === option.name;
                  return (
                    <div
                      key={option.name}
                      onClick={() => {
                        setHeaderCategoryIcon(option.name);
                        setSelectedIconLibrary('Custom');
                      }}
                      className={`
                        cursor-pointer flex flex-col items-center justify-center gap-2 p-3 rounded-lg border transition-all
                        ${isSelected
                          ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500 text-teal-700'
                          : 'bg-white border-neutral-200 hover:border-teal-300 hover:shadow-sm text-neutral-600'}
                      `}
                    >
                      <div className={`${isSelected ? 'text-teal-600' : 'text-neutral-500'}`}>
                        {option.svg}
                      </div>
                      <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                        {option.label}
                      </span>
                    </div>
                  );
                }) : (
                  <div className="col-span-full py-8 text-center text-neutral-500 text-sm">
                    No icons found matching "{iconSearchTerm || headerCategoryName}"
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Icons are automatically suggested based on category name.
              </p>
            </div>

            {/* Theme / Color Selection */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Select Theme Color:
              </label>
              <div className="grid grid-cols-4 gap-3 bg-neutral-50 p-3 rounded border border-neutral-200">
                {themeOptions.map(themeKey => {
                  const themeObj = themes[themeKey];
                  const color = themeObj.primary[0];
                  const isSelected = selectedTheme === themeKey;

                  // Map theme keys to user-friendly color names
                  const colorNames: Record<string, string> = {
                    all: 'Green',
                    wedding: 'Red',
                    winter: 'Sky Blue',
                    electronics: 'Yellow',
                    beauty: 'Pink',
                    grocery: 'Light Green',
                    fashion: 'Purple',
                    sports: 'Blue',
                    orange: 'Orange',
                    violet: 'Violet',
                    teal: 'Teal',
                    dark: 'Dark',
                    hotpink: 'Hot Pink',
                    gold: 'Gold'
                  };

                  const displayColor = colorNames[themeKey] || themeKey;

                  return (
                    <div
                      key={themeKey}
                      onClick={() => setSelectedTheme(themeKey)}
                      title={displayColor}
                      className={`
                                cursor-pointer flex flex-col items-center gap-1 p-2 rounded transition-all
                                ${isSelected ? 'ring-2 ring-teal-500 bg-white shadow-sm' : 'hover:bg-neutral-200'}
                            `}
                    >
                      <div
                        className="w-8 h-8 rounded-full shadow-sm border border-black/10"
                        style={{ background: color }}
                      />
                      <span className="text-[10px] text-neutral-600 font-medium capitalize text-center leading-tight">
                        {displayColor}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Related Category */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Related Category (Slug):
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">Select Category</option>
                <option value="fashion">Fashion</option>
                <option value="electronics">Electronics</option>
                <option value="home">Home</option>
                <option value="beauty">Beauty</option>
                <option value="mobiles">Mobiles</option>
                <option value="grocery">Grocery</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Status:
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="Published">Published</option>
                <option value="Unpublished">Unpublished</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAddOrUpdate}
                className="flex-1 bg-teal-600 text-white py-2 rounded text-sm font-medium hover:bg-teal-700 transition"
              >
                {editingId ? 'Update Category' : 'Add Category'}
              </button>
              {editingId && (
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 bg-neutral-200 text-neutral-700 py-2 rounded text-sm font-medium hover:bg-neutral-300 transition"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - List & Search */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 flex flex-col h-full">
          <div className="p-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
            <h3 className="font-semibold text-neutral-700">Category List</h3>

            <div className="relative">
              <input
                type="text"
                placeholder="Search category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-neutral-300 rounded-full w-48 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <svg
                className="w-4 h-4 text-neutral-400 absolute left-2.5 top-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-neutral-50 sticky top-0 z-10">
                <tr>
                  {['Name', 'Icon', 'Theme', 'Status', 'Actions'].map((header) => (
                    <th
                      key={header}
                      onClick={() => handleSort(header.toLowerCase())}
                      className="px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 transition-colors border-b border-neutral-200"
                    >
                      {header} {sortColumn === header.toLowerCase() && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {displayedCategories.length > 0 ? (
                  displayedCategories.map((category) => (
                    <tr key={category._id} className="hover:bg-neutral-50 transition-colors group">
                      <td className="px-4 py-3 text-sm font-medium text-neutral-800">
                        {category.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        <div className="flex items-center gap-2">
                          <div className="text-teal-600 w-5 h-5 flex items-center justify-center">
                            {getIconByName(category.iconName)}
                          </div>
                          <span className="text-xs text-neutral-400 font-mono hidden xl:inline">
                            {category.iconName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-800 capitalize border border-neutral-200">
                          <div
                            className="w-2 h-2 rounded-full mr-1.5"
                            style={{ background: themes[category.slug]?.primary[0] || '#ccc' }}
                          />
                          {category.slug}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`
                            px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                            ${category.status === 'Published'
                              ? 'bg-green-100 text-green-800 border border-green-200'
                              : 'bg-red-100 text-red-800 border border-red-200'}
                          `}
                        >
                          {category.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm flex gap-2">
                        <button
                          onClick={() => handleEdit(category)}
                          className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors"
                          title="Edit"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(category._id)}
                          className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-neutral-500">
                      <div className="flex flex-col items-center justify-center">
                        <svg className="w-10 h-10 text-neutral-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p>No categories found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-neutral-200 bg-neutral-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-neutral-600 hidden sm:block">
                Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredCategories.length)}</span> of <span className="font-medium">{filteredCategories.length}</span> results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-neutral-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="px-3 py-1 border border-neutral-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
