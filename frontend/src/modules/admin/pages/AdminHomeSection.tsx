import { useState, useEffect } from "react";
import {
    getHomeSections,
    createHomeSection,
    updateHomeSection,
    deleteHomeSection,
    type HomeSection,
    type HomeSectionFormData,
} from "../../../services/api/admin/adminHomeSectionService";
import { getCategories, getSubcategories, type Category, type SubCategory } from "../../../services/api/categoryService";
import { getHeaderCategoriesAdmin, type HeaderCategory } from "../../../services/api/headerCategoryService";
import ConfirmationModal from "../../../components/ConfirmationModal";

const DISPLAY_TYPE_OPTIONS = [
    { value: "subcategories", label: "Subcategories" },
    { value: "products", label: "Products" },
    { value: "categories", label: "Categories" },
];

const COLUMNS_OPTIONS = [2, 3, 4, 6, 8];

export default function AdminHomeSection() {
    // Form state
    const [title, setTitle] = useState("");
    const [slug, setSlug] = useState("");
    const [selectedHeaderCategory, setSelectedHeaderCategory] = useState<string>("");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
    const [displayType, setDisplayType] = useState<"subcategories" | "products" | "categories">("subcategories");
    const [columns, setColumns] = useState(4);
    const [limit, setLimit] = useState(8);
    const [isActive, setIsActive] = useState(true);
    const [pageLocation, setPageLocation] = useState<"Home Page" | "Header Category Page">("Home Page");
    const [targetPageHeaderCategory, setTargetPageHeaderCategory] = useState<string>("");

    const limitMax = 100;

    // Data state
    const [sections, setSections] = useState<HomeSection[]>([]);
    const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

    // UI state
    const [loading, setLoading] = useState(false);
    const [loadingSections, setLoadingSections] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Pagination
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // Fetch initial data
    useEffect(() => {
        fetchSections();
        fetchHeaderCategories();
        fetchCategories();
    }, []);

    // Filter categories by header category when header category or display type changes
    useEffect(() => {
        if (displayType === "categories" && selectedHeaderCategory) {
            const filtered = categories.filter((cat) => {
                const headerId = typeof cat.headerCategoryId === 'string'
                    ? cat.headerCategoryId
                    : cat.headerCategoryId?._id || cat.headerCategoryId;
                return headerId === selectedHeaderCategory && !cat.parentId; // Only root categories
            });
            setFilteredCategories(filtered);
            // Clear selected categories if they don't belong to the new header category
            setSelectedCategories((prev) =>
                prev.filter((id) => filtered.some((cat) => cat._id === id))
            );
        } else {
            // For other display types, show all root categories
            setFilteredCategories(categories.filter((cat) => !cat.parentId));
        }
    }, [selectedHeaderCategory, displayType, categories]);

    // Clamp the limit when display type changes
    useEffect(() => {
        setLimit((prev) => Math.min(Math.max(prev, 1), limitMax));
    }, [limitMax]);

    // When editing and categories are loaded, try to set header category from selected categories
    useEffect(() => {
        if (editingId && displayType === "categories" && selectedCategories.length > 0 && categories.length > 0 && !selectedHeaderCategory) {
            const firstSelectedCategory = categories.find(c => selectedCategories.includes(c._id));
            if (firstSelectedCategory) {
                const headerId = typeof firstSelectedCategory.headerCategoryId === 'string'
                    ? firstSelectedCategory.headerCategoryId
                    : firstSelectedCategory.headerCategoryId?._id || firstSelectedCategory.headerCategoryId;
                if (headerId) {
                    setSelectedHeaderCategory(headerId);
                }
            }
        }
    }, [editingId, displayType, selectedCategories, categories, selectedHeaderCategory]);

    // Fetch subcategories when category changes (only for subcategories display type)
    useEffect(() => {
        if (displayType === "subcategories" && selectedCategories.length > 0) {
            fetchSubCategories(selectedCategories);
        } else {
            setSubCategories([]);
            setSelectedSubCategories([]);
        }
    }, [selectedCategories, displayType]);

    // Auto-generate slug from title
    useEffect(() => {
        if (title && !editingId) {
            const generatedSlug = title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");
            setSlug(generatedSlug);
        }
    }, [title, editingId]);

    const fetchSections = async () => {
        try {
            setLoadingSections(true);
            const response = await getHomeSections();
            if (response.success && Array.isArray(response.data)) {
                setSections(response.data);
            }
        } catch (err) {
            console.error("Error fetching sections:", err);
            setError("Failed to load sections");
        } finally {
            setLoadingSections(false);
        }
    };

    const fetchHeaderCategories = async () => {
        try {
            const data = await getHeaderCategoriesAdmin();
            setHeaderCategories(data);
        } catch (err) {
            console.error("Error fetching header categories:", err);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await getCategories();
            if (response.success) {
                setCategories(response.data);
            }
        } catch (err) {
            console.error("Error fetching categories:", err);
        }
    };

    const fetchSubCategories = async (categoryIds: string[]) => {
        try {
            const promises = categoryIds.map((id) => getSubcategories(id));
            const results = await Promise.all(promises);
            const allSubs: SubCategory[] = [];

            results.forEach((response) => {
                if (response.success && response.data) {
                    allSubs.push(...response.data);
                }
            });

            // Remove duplicates based on ID
            const uniqueSubs = Array.from(new Map(allSubs.map((item) => [item._id || item.id, item])).values());
            setSubCategories(uniqueSubs as SubCategory[]);
        } catch (err) {
            console.error("Error fetching subcategories:", err);
            setSubCategories([]);
        }
    };

    const handleSubmit = async () => {
        setError("");
        setSuccess("");

        // Validation
        if (!title.trim()) {
            setError("Please enter a section title");
            return;
        }
        if (!slug.trim()) {
            setError("Please enter a slug");
            return;
        }
        if (displayType === "categories") {
            if (!selectedHeaderCategory) {
                setError("Please select a header category");
                return;
            }
            if (selectedCategories.length === 0) {
                setError("Please select at least one category");
                return;
            }
        }

        if (pageLocation === "Header Category Page" && !targetPageHeaderCategory) {
            setError("Please select a target header category");
            return;
        }

        const formData: HomeSectionFormData = {
            title: title.trim(),
            slug: slug.trim(),
            categories: selectedCategories.length > 0 ? selectedCategories : undefined,
            // Only include subcategories if displayType is not "categories"
            subCategories: displayType !== "categories" && selectedSubCategories.length > 0 ? selectedSubCategories : undefined,
            displayType,
            columns,
            limit,
            isActive,
            pageLocation,
            targetHeaderCategory: pageLocation === "Header Category Page" ? targetPageHeaderCategory : undefined,
        };

        try {
            setLoading(true);

            if (editingId) {
                const response = await updateHomeSection(editingId, formData);
                if (response.success) {
                    setSuccess("Section updated successfully!");
                    resetForm();
                    fetchSections();
                }
            } else {
                const response = await createHomeSection(formData);
                if (response.success) {
                    setSuccess("Section created successfully!");
                    resetForm();
                    fetchSections();
                }
            }
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to save section");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (section: HomeSection) => {
        setTitle(section.title);
        setSlug(section.slug);
        setDisplayType(section.displayType);

        // Try to determine header category from selected categories (only if displayType is "categories")
        if (section.displayType === "categories") {
            const firstCategory = section.categories?.[0];
            if (firstCategory) {
                // We need to find the category in our categories list
                // Since categories might not be loaded yet, we'll set it after categories are loaded
                // For now, we'll try to find it
                const category = categories.find(c => c._id === firstCategory._id);
                if (category) {
                    const headerId = typeof category.headerCategoryId === 'string'
                        ? category.headerCategoryId
                        : category.headerCategoryId?._id || category.headerCategoryId;
                    if (headerId) {
                        setSelectedHeaderCategory(headerId);
                    }
                } else {
                    // If category not found yet, we'll set it in a useEffect
                    // For now, clear it and let the useEffect handle it
                    setSelectedHeaderCategory("");
                }
            } else {
                setSelectedHeaderCategory("");
            }
        } else {
            setSelectedHeaderCategory("");
        }

        setSelectedCategories(section.categories?.map(c => c._id) || []);
        setSelectedSubCategories(section.subCategories?.map(s => s._id) || []);
        setColumns(section.columns);
        setLimit(section.limit);
        setIsActive(section.isActive);
        setPageLocation(section.pageLocation || "Home Page");
        setTargetPageHeaderCategory(
            typeof section.targetHeaderCategory === 'object'
                ? section.targetHeaderCategory?._id || ""
                : section.targetHeaderCategory || ""
        );
        setEditingId(section._id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        const id = deleteId;

        try {
            const response = await deleteHomeSection(id);
            if (response.success) {
                setSuccess("Section deleted successfully!");
                setDeleteId(null);
                fetchSections();
                if (editingId === id) {
                    resetForm();
                }
            } else {
                setDeleteId(null);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to delete section");
            setDeleteId(null);
        }
    };

    const resetForm = () => {
        setTitle("");
        setSlug("");
        setSelectedHeaderCategory("");
        setSelectedCategories([]);
        setSelectedSubCategories([]);
        setDisplayType("subcategories");
        setColumns(4);
        setLimit(8);
        setIsActive(true);
        setPageLocation("Home Page");
        setTargetPageHeaderCategory("");
        setEditingId(null);
    };

    // Pagination
    const totalPages = Math.ceil(sections.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const displayedSections = sections.slice(startIndex, endIndex);

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Page Header */}
            <div className="p-6 pb-0">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-semibold text-neutral-800">
                        Home Sections
                    </h1>
                    <div className="text-sm text-blue-500">
                        <span className="text-blue-500 hover:underline cursor-pointer">
                            Home
                        </span>{" "}
                        <span className="text-neutral-400">/</span> Home Sections
                    </div>
                </div>
            </div>

            {/* Success/Error Messages */}
            {(success || error) && (
                <div className="px-6">
                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
                            {success}
                        </div>
                    )}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                            {error}
                        </div>
                    )}
                </div>
            )}

            {/* Page Content */}
            <div className="flex-1 px-6 pb-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                    {/* Left Sidebar: Add/Edit Form */}
                    <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6 flex flex-col">
                        <h2 className="text-lg font-semibold text-neutral-800 mb-4">
                            {editingId ? "Edit Section" : "Add Section"}
                        </h2>

                        <div className="space-y-4 flex-1 overflow-y-auto">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                    Section Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g., Grocery & Kitchen"
                                    className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                />
                            </div>

                            {/* Page Location */}
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                    Page Location <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            name="pageLocation"
                                            checked={pageLocation === "Home Page"}
                                            onChange={() => setPageLocation("Home Page")}
                                            className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300"
                                        />
                                        <span className="ml-2 text-sm text-neutral-700">Home Page</span>
                                    </label>
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            name="pageLocation"
                                            checked={pageLocation === "Header Category Page"}
                                            onChange={() => setPageLocation("Header Category Page")}
                                            className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300"
                                        />
                                        <span className="ml-2 text-sm text-neutral-700">Header Category Page</span>
                                    </label>
                                </div>
                            </div>

                            {/* Target Header Category - Only show when pageLocation is "Header Category Page" */}
                            {pageLocation === "Header Category Page" && (
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                                        Target Header Category <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={targetPageHeaderCategory}
                                        onChange={(e) => setTargetPageHeaderCategory(e.target.value)}
                                        className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                    >
                                        <option value="">Select target page</option>
                                        {headerCategories
                                            .filter((hc) => hc.status === "Published")
                                            .map((hc) => (
                                                <option key={hc._id} value={hc._id}>
                                                    {hc.name}
                                                </option>
                                            ))}
                                    </select>
                                    <p className="text-xs text-neutral-500 mt-1">
                                        Section will only appear on this header category page
                                    </p>
                                </div>
                            )}

                            {/* Slug */}
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                    Slug <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    placeholder="grocery-kitchen"
                                    className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                />
                                <p className="text-xs text-neutral-500 mt-1">
                                    URL-friendly identifier (lowercase, hyphens only)
                                </p>
                            </div>

                            {/* Display Type */}
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                    Display Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={displayType}
                                    onChange={(e) => {
                                        const newDisplayType = e.target.value as "subcategories" | "products" | "categories";
                                        setDisplayType(newDisplayType);
                                        // Clear selections when switching display types
                                        if (newDisplayType === "categories") {
                                            setSelectedSubCategories([]);
                                        } else {
                                            setSelectedHeaderCategory("");
                                        }
                                    }}
                                    className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                >
                                    {DISPLAY_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Header Category - Only show when displayType is "categories" */}
                            {displayType === "categories" && (
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                                        Header Category <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={selectedHeaderCategory}
                                        onChange={(e) => {
                                            setSelectedHeaderCategory(e.target.value);
                                            setSelectedCategories([]); // Clear selected categories when header category changes
                                        }}
                                        className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                    >
                                        <option value="">Select a header category</option>
                                        {headerCategories
                                            .filter((hc) => hc.status === "Published")
                                            .map((hc) => (
                                                <option key={hc._id} value={hc._id}>
                                                    {hc.name}
                                                </option>
                                            ))}
                                    </select>
                                    <p className="text-xs text-neutral-500 mt-1">
                                        Select a header category to filter categories
                                    </p>
                                </div>
                            )}

                            {/* Categories - Checkbox List */}
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                    Categories
                                    {displayType === "categories" && (
                                        <span className="text-red-500 ml-1">*</span>
                                    )}
                                </label>
                                <div className={`border border-neutral-300 rounded max-h-40 overflow-y-auto p-2 ${displayType === "categories" && !selectedHeaderCategory ? 'bg-gray-100' : 'bg-white'
                                    }`}>
                                    {displayType === "categories" && !selectedHeaderCategory ? (
                                        <p className="text-sm text-neutral-400 p-2">Please select a header category first</p>
                                    ) : filteredCategories.length === 0 ? (
                                        <p className="text-sm text-neutral-400 p-2">
                                            {displayType === "categories"
                                                ? "No categories found for selected header category"
                                                : "Loading categories..."}
                                        </p>
                                    ) : (
                                        filteredCategories.map((cat) => (
                                            <label
                                                key={cat._id}
                                                className="flex items-center p-2 hover:bg-neutral-50 rounded cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCategories.includes(cat._id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedCategories([...selectedCategories, cat._id]);
                                                        } else {
                                                            setSelectedCategories(
                                                                selectedCategories.filter((id) => id !== cat._id)
                                                            );
                                                        }
                                                    }}
                                                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                                                />
                                                <span className="ml-2 text-sm text-neutral-700">{cat.name}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                                <p className="text-xs text-neutral-500 mt-1">
                                    {selectedCategories.length} selected
                                </p>
                            </div>

                            {/* SubCategories - Checkbox List - Only show when displayType is NOT "categories" */}
                            {displayType !== "categories" && (
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                                        SubCategories
                                    </label>
                                    <div className={`border border-neutral-300 rounded max-h-40 overflow-y-auto p-2 ${selectedCategories.length === 0 ? 'bg-gray-100' : 'bg-white'
                                        }`}>
                                        {selectedCategories.length === 0 ? (
                                            <p className="text-sm text-neutral-400 p-2">Select categories first</p>
                                        ) : subCategories.length === 0 ? (
                                            <p className="text-sm text-neutral-400 p-2">No subcategories available</p>
                                        ) : (
                                            subCategories.map((sub) => (
                                                <label
                                                    key={sub._id || sub.id}
                                                    className="flex items-center p-2 hover:bg-neutral-50 rounded cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSubCategories.includes(sub._id || sub.id || '')}
                                                        onChange={(e) => {
                                                            const subId = sub._id || sub.id || '';
                                                            if (e.target.checked) {
                                                                setSelectedSubCategories([...selectedSubCategories, subId]);
                                                            } else {
                                                                setSelectedSubCategories(
                                                                    selectedSubCategories.filter((id) => id !== subId)
                                                                );
                                                            }
                                                        }}
                                                        className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                                                    />
                                                    <span className="ml-2 text-sm text-neutral-700">{sub.subcategoryName}</span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                    <p className="text-xs text-neutral-500 mt-1">
                                        {selectedSubCategories.length} selected
                                    </p>
                                </div>
                            )}

                            {/* Columns */}
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                    Number of Columns <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={columns}
                                    onChange={(e) => setColumns(Number(e.target.value))}
                                    className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                >
                                    {COLUMNS_OPTIONS.map((col) => (
                                        <option key={col} value={col}>
                                            {col} Columns
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Limit */}
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                    Item Limit <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={limit}
                                    onChange={(e) => {
                                        const next = Number(e.target.value);
                                        setLimit(Math.min(Math.max(next, 1), limitMax));
                                    }}
                                    min="1"
                                    max={limitMax}
                                    className="w-full px-3 py-2 border border-neutral-300 rounded bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                />
                            </div>

                            {/* Active Status */}
                            <div>
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                                    />
                                    <span className="ml-2 text-sm font-medium text-neutral-700">
                                        Active (Show on home page)
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-6 space-y-2">
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className={`w-full px-4 py-2 rounded font-medium transition-colors ${loading
                                    ? "bg-gray-400 cursor-not-allowed text-white"
                                    : "bg-teal-600 hover:bg-teal-700 text-white"
                                    }`}
                            >
                                {loading
                                    ? "Saving..."
                                    : editingId
                                        ? "Update Section"
                                        : "Create Section"}
                            </button>
                            {editingId && (
                                <button
                                    onClick={resetForm}
                                    className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right Section: View Sections Table */}
                    <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-neutral-200 flex flex-col">
                        <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg">
                            <h2 className="text-lg font-semibold">View Sections</h2>
                        </div>

                        {/* Controls */}
                        <div className="p-4 border-b border-neutral-100">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-neutral-600">Show</span>
                                <input
                                    type="number"
                                    value={rowsPerPage}
                                    onChange={(e) => {
                                        setRowsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="w-16 px-2 py-1.5 border border-neutral-300 rounded text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none"
                                />
                                <span className="text-sm text-neutral-600">entries</span>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-neutral-50 text-xs font-bold text-neutral-800 border-b border-neutral-200">
                                        <th className="p-4">Order</th>
                                        <th className="p-4">Title</th>
                                        <th className="p-4">Type</th>
                                        <th className="p-4">Categories</th>
                                        <th className="p-4">Columns</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingSections ? (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="p-8 text-center text-neutral-400"
                                            >
                                                Loading sections...
                                            </td>
                                        </tr>
                                    ) : displayedSections.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="p-8 text-center text-neutral-400"
                                            >
                                                No sections found. Create your first section!
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedSections.map((section, index) => (
                                            <tr
                                                key={section._id}
                                                className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700 border-b border-neutral-200"
                                            >
                                                <td className="p-4">{startIndex + index + 1}</td>
                                                <td className="p-4 font-medium">{section.title}</td>
                                                <td className="p-4 capitalize">{section.displayType}</td>
                                                <td className="p-4">
                                                    {section.categories && section.categories.length > 0
                                                        ? section.categories.map((c: any) => c.name).join(", ")
                                                        : "All"}
                                                </td>
                                                <td className="p-4">{section.columns}</td>
                                                <td className="p-4">
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${section.isActive
                                                            ? "bg-green-100 text-green-800"
                                                            : "bg-gray-100 text-gray-800"
                                                            }`}
                                                    >
                                                        {section.isActive ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleEdit(section)}
                                                            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                                            title="Edit"
                                                        >
                                                            <svg
                                                                width="14"
                                                                height="14"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            >
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteId(section._id)}
                                                            className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                                                            title="Delete"
                                                        >
                                                            <svg
                                                                width="14"
                                                                height="14"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            >
                                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
                            <div className="text-xs sm:text-sm text-neutral-700">
                                Showing {startIndex + 1} to{" "}
                                {Math.min(endIndex, sections.length)} of {sections.length}{" "}
                                entries
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className={`p-2 border border-teal-600 rounded ${currentPage === 1
                                        ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                                        : "text-teal-600 hover:bg-teal-50"
                                        }`}
                                    aria-label="Previous page"
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M15 18L9 12L15 6"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </button>
                                <button className="px-3 py-1.5 border border-teal-600 bg-teal-600 text-white rounded font-medium text-sm">
                                    {currentPage}
                                </button>
                                <button
                                    onClick={() =>
                                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                                    }
                                    disabled={currentPage === totalPages}
                                    className={`p-2 border border-teal-600 rounded ${currentPage === totalPages
                                        ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                                        : "text-teal-600 hover:bg-teal-50"
                                        }`}
                                    aria-label="Next page"
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M9 18L15 12L9 6"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="text-center py-4 text-sm text-neutral-600 border-t border-neutral-200 bg-white">
                Copyright © 2025. Developed By{" "}
                <a href="#" className="text-blue-600 hover:underline">
                    Olovely Total Suvidha
                </a>
            </footer>

            <ConfirmationModal
                isOpen={!!deleteId}
                title="Delete Home Section"
                message="Are you sure you want to delete this section?"
                confirmText="Delete"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteId(null)}
            />
        </div >
    );
}
