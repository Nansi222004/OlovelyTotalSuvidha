import { useState, useEffect, useMemo } from "react";
import {
  Category,
  CreateCategoryData,
  UpdateCategoryData,
} from "../../../services/api/admin/adminProductService";
import { uploadImage } from "../../../services/api/uploadService";
import {
  validateImageFile,
  createImagePreview,
  compressImage,
} from "../../../utils/imageUpload";
import {
  getAvailableParents,
  validateParentChange,
  flattenCategoryTree,
} from "../../../utils/categoryUtils";
import {
  getHeaderCategoriesAdmin,
  HeaderCategory,
} from "../../../services/api/headerCategoryService";

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCategoryData | UpdateCategoryData) => Promise<void>;
  category?: Category;
  parentCategory?: Category;
  mode: "create" | "edit" | "create-subcategory";
  allCategories: Category[];
}

export default function CategoryFormModal({
  isOpen,
  onClose,
  onSubmit,
  category,
  parentCategory,
  mode,
  allCategories,
}: CategoryFormModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    image: "",
    order: 0,
    parentId: null as string | null,
    headerCategoryId: null as string | null,
    status: "Active" as "Active" | "Inactive",
    isBestseller: false,
    hasWarning: false,
    groupCategory: "",
    commissionRate: 0,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>(
    []
  );
  const [loadingHeaderCategories, setLoadingHeaderCategories] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Flatten categories for search and parent selection
  const flatCategories = useMemo(
    () => flattenCategoryTree(allCategories),
    [allCategories]
  );

  // Get available parent categories
  const availableParents = getAvailableParents(
    category?._id || null,
    flatCategories
  );

  // Fetch header categories when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchHeaderCategories();
    }
  }, [isOpen]);

  const fetchHeaderCategories = async () => {
    try {
      setLoadingHeaderCategories(true);
      const categories = await getHeaderCategoriesAdmin();
      // Filter only Published header categories
      const publishedCategories = categories.filter(
        (cat) => cat.status === "Published"
      );
      setHeaderCategories(publishedCategories);
    } catch (error) {
      console.error("Error fetching header categories:", error);
      setHeaderCategories([]);
    } finally {
      setLoadingHeaderCategories(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && category) {
        // Pre-fill form with category data
        setFormData({
          name: category.name || "",
          image: category.image || "",
          order: category.order || 0,
          parentId: category.parentId || null,
          headerCategoryId: category.headerCategoryId || null,
          status: category.status || "Active",
          isBestseller: category.isBestseller || false,
          hasWarning: category.hasWarning || false,
          groupCategory: category.groupCategory || "",
          commissionRate: category.commissionRate || 0,
        });
        if (category.image) {
          setImagePreview(category.image);
        }
      } else if (mode === "create-subcategory" && parentCategory) {
        // Pre-fill parent for subcategory and inherit header category
        // Handle both populated object and string ID
        let inheritedHeaderCategoryId: string | null = null;
        if (parentCategory.headerCategoryId) {
          if (typeof parentCategory.headerCategoryId === "string") {
            inheritedHeaderCategoryId = parentCategory.headerCategoryId;
          } else if (
            typeof parentCategory.headerCategoryId === "object" &&
            parentCategory.headerCategoryId !== null
          ) {
            // It's populated, extract the _id
            inheritedHeaderCategoryId =
              (parentCategory.headerCategoryId as { _id?: string })._id || null;
          }
        }
        // Also check headerCategory field (if it exists as separate field)
        if (!inheritedHeaderCategoryId && parentCategory.headerCategory) {
          if (typeof parentCategory.headerCategory === "string") {
            inheritedHeaderCategoryId = parentCategory.headerCategory;
          } else if (
            typeof parentCategory.headerCategory === "object" &&
            parentCategory.headerCategory !== null
          ) {
            inheritedHeaderCategoryId = parentCategory.headerCategory._id;
          }
        }
        setFormData({
          name: "",
          image: "",
          order: 0,
          parentId: parentCategory._id,
          headerCategoryId: inheritedHeaderCategoryId,
          status: "Active",
          isBestseller: false,
          hasWarning: false,
          groupCategory: "",
          commissionRate: 0,
        });
      } else {
        // Reset form for new category
        setFormData({
          name: "",
          image: "",
          order: 0,
          parentId: null,
          headerCategoryId: null,
          status: "Active",
          isBestseller: false,
          hasWarning: false,
          groupCategory: "",
          commissionRate: 0,
        });
      }
      setImageFile(null);
      setImagePreview(mode === "edit" && category?.image ? category.image : "");
      setErrors({});
      setShowAdvanced(false);
    }
  }, [isOpen, mode, category, parentCategory]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : type === "number"
            ? parseInt(value) || 0
            : value,
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrors((prev) => ({
        ...prev,
        image: validation.error || "Invalid image file",
      }));
      return;
    }

    setImageFile(file);
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.image;
      return newErrors;
    });

    try {
      const preview = await createImagePreview(file);
      setImagePreview(preview);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        image: "Failed to create image preview",
      }));
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Category name is required";
    }

    if (formData.order < 0) {
      newErrors.order = "Display order must be a positive number";
    }

    // Validate header category (required for root categories, inherited for subcategories)
    if (isSubcategoryMode) {
      // For subcategories, header category should be inherited from parent
      if (!formData.headerCategoryId) {
        if (parentCategory) {
          const parentHeaderCategoryId =
            parentCategory.headerCategoryId ||
            (parentCategory.headerCategory
              ? typeof parentCategory.headerCategory === "string"
                ? null
                : parentCategory.headerCategory._id
              : null);
          if (!parentHeaderCategoryId) {
            newErrors.headerCategoryId =
              "Parent category does not have a header category assigned. Please assign a header category to the parent category first.";
          }
        } else {
          newErrors.headerCategoryId =
            "Header category is required for subcategories";
        }
      }
    } else {
      // For root categories or when editing, header category is required
      if (!formData.headerCategoryId) {
        if (mode === "edit" && category && !category.headerCategoryId) {
          newErrors.headerCategoryId =
            "Header category is required. Please assign a header category to this category.";
        } else if (mode === "create") {
          newErrors.headerCategoryId = "Header category is required";
        }
      }
    }

    // Validate parent change if editing
    if (mode === "edit" && category) {
      const validation = validateParentChange(
        category._id,
        formData.parentId,
        flatCategories
      );
      if (!validation.valid) {
        newErrors.parentId = validation.error || "Invalid parent selection";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      setErrors({});

      let imageUrl = formData.image;

      // Upload image if a new file is selected
      if (imageFile) {
        setUploading(true);
        // Compress image before upload
        const compressedFile = await compressImage(imageFile);
        const imageResult = await uploadImage(compressedFile, "olovely/categories");
        imageUrl = imageResult.secureUrl;
        setUploading(false);
      }

      const submitData: CreateCategoryData | UpdateCategoryData = {
        name: formData.name.trim(),
        image: imageUrl,
        order: formData.order,
        parentId: formData.parentId,
        headerCategoryId: formData.headerCategoryId,
        status: formData.status,
        isBestseller: formData.isBestseller,
        hasWarning: formData.hasWarning,
        groupCategory: formData.groupCategory || undefined,
        commissionRate: formData.commissionRate,
      };

      await onSubmit(submitData);
      onClose();
    } catch (error: any) {
      setErrors({
        submit:
          error.response?.data?.message ||
          error.message ||
          "Failed to save category. Please try again.",
      });
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  const modalTitle =
    mode === "edit"
      ? "Edit Category"
      : mode === "create-subcategory"
        ? "Create Subcategory"
        : "Create Category";

  const isSubcategoryMode = mode === "create-subcategory";
  const isEditMode = mode === "edit";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}></div>

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">
            {modalTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
            disabled={submitting}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {/* Parent Category Info (for subcategory mode) */}
          {isSubcategoryMode && parentCategory && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-600">Parent Category</p>
              <p className="text-base font-semibold text-blue-900">
                {parentCategory.name}
              </p>
            </div>
          )}

          {/* Error Messages */}
          {errors.submit && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{errors.submit}</p>
            </div>
          )}

          {/* Category Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${errors.name ? "border-red-300" : "border-neutral-300"
                }`}
              placeholder="Enter category name"
              disabled={submitting}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Header Category */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Header Category{" "}
              {!isSubcategoryMode && <span className="text-red-500">*</span>}
            </label>
            {isSubcategoryMode ? (
              <div>
                <input
                  type="text"
                  value={(() => {
                    // First, try to get name from parentCategory.headerCategory (if populated as separate field)
                    if (parentCategory?.headerCategory) {
                      return typeof parentCategory.headerCategory === "string"
                        ? parentCategory.headerCategory
                        : parentCategory.headerCategory.name;
                    }

                    // Second, check if headerCategoryId is populated (object from backend)
                    if (parentCategory?.headerCategoryId) {
                      if (
                        typeof parentCategory.headerCategoryId === "object" &&
                        parentCategory.headerCategoryId !== null
                      ) {
                        // It's populated, get the name
                        return (
                          (parentCategory.headerCategoryId as { name?: string })
                            .name || "Unknown"
                        );
                      }
                    }

                    // Third, try to find in loaded headerCategories using formData.headerCategoryId
                    if (
                      formData.headerCategoryId &&
                      headerCategories.length > 0
                    ) {
                      const found = headerCategories.find(
                        (hc) => hc._id === formData.headerCategoryId
                      );
                      if (found) return found.name;
                    }

                    // If still loading and we have an ID, show loading
                    if (loadingHeaderCategories && formData.headerCategoryId) {
                      return "Loading...";
                    }

                    // Otherwise, show not assigned
                    return "Not assigned";
                  })()}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-600 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-blue-600">
                  Inherited from parent category
                </p>
                {errors.headerCategoryId && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.headerCategoryId}
                  </p>
                )}
              </div>
            ) : (
              <div>
                {loadingHeaderCategories ? (
                  <div className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-500 text-sm">
                    Loading header categories...
                  </div>
                ) : headerCategories.length === 0 ? (
                  <div className="w-full px-3 py-2 border border-yellow-300 rounded-lg bg-yellow-50 text-yellow-800 text-sm">
                    No Published header categories available. Please create a
                    header category first.
                  </div>
                ) : (
                  <>
                    {mode === "edit" &&
                      category &&
                      !category.headerCategoryId && (
                        <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                          This category does not have a header category
                          assigned. Please select one.
                        </div>
                      )}
                    <select
                      name="headerCategoryId"
                      value={formData.headerCategoryId || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          headerCategoryId: e.target.value || null,
                        }))
                      }
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${errors.headerCategoryId
                        ? "border-red-300"
                        : "border-neutral-300"
                        }`}
                      disabled={submitting}>
                      <option value="">
                        {mode === "edit" && !category?.headerCategoryId
                          ? "-- Select Header Category (Required) --"
                          : "-- Select Header Category --"}
                      </option>
                      {headerCategories.map((headerCat) => (
                        <option key={headerCat._id} value={headerCat._id}>
                          {headerCat.name}
                        </option>
                      ))}
                    </select>
                    {errors.headerCategoryId && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.headerCategoryId}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Category Image */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Category Image
            </label>
            <label
              className={`block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isDragging
                ? "border-teal-500 bg-teal-50"
                : "border-neutral-300 hover:border-teal-500"
                }`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}>
              {imagePreview ? (
                <div className="space-y-2">
                  <img
                    src={imagePreview}
                    alt="Category preview"
                    className="max-h-32 mx-auto rounded-lg object-cover"
                  />
                  <p className="text-xs text-neutral-600">
                    {imageFile?.name || "Current image"}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setImageFile(null);
                      setImagePreview("");
                      setFormData((prev) => ({ ...prev, image: "" }));
                    }}
                    className="text-xs text-red-600 hover:text-red-700">
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="mx-auto mb-2 text-neutral-400">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <p className="text-xs text-neutral-600">
                    {isDragging ? "Drop image here" : "Choose File or Drag & Drop"}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">Max 50MB</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={submitting || uploading}
              />
            </label>
            {errors.image && (
              <p className="mt-1 text-sm text-red-600">{errors.image}</p>
            )}
          </div>

          {/* Parent Category (only for create/edit, not subcategory mode) */}
          {!isSubcategoryMode && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Parent Category
              </label>
              <select
                name="parentId"
                value={formData.parentId || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    parentId: e.target.value || null,
                  }))
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${errors.parentId ? "border-red-300" : "border-neutral-300"
                  }`}
                disabled={submitting}>
                <option value="">None (Root Category)</option>
                {availableParents.map((parent) => (
                  <option key={parent._id} value={parent._id}>
                    {parent.name}
                  </option>
                ))}
              </select>
              {errors.parentId && (
                <p className="mt-1 text-sm text-red-600">{errors.parentId}</p>
              )}
            </div>
          )}

          {/* Display Order */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Display Order
            </label>
            <input
              type="number"
              name="order"
              value={formData.order}
              onChange={handleInputChange}
              min="0"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${errors.order ? "border-red-300" : "border-neutral-300"
                }`}
              disabled={submitting}
            />
            {errors.order && (
              <p className="mt-1 text-sm text-red-600">{errors.order}</p>
            )}
          </div>

          {/* Commission Rate - Only for SubSubCategories (Level 3) */}
          {(() => {
            // Logic to determine if we should show commission rate (Level 3+ only)

            // 1. If in subcategory creation mode
            if (isSubcategoryMode && parentCategory) {
              // Check if the parent ITSELF has a parent (meaning parent is L2, so new one is L3)
              // We need to check parentCategory.parentId or similar
              // parentCategory is type Category, so it has parentId
              // If parentCategory.parentId is truthy, then parent is NOT root.
              return parentCategory.parentId ? true : false;
            }

            // 2. If editing existing category
            if (mode === 'edit' && category) {
              // We need to know if category is L3.
              // We can check if parent exists, and if that parent has a parent.
              // However, we only have parentId string readily available in formData.
              // We can try to find the parent in flatCategories (which contains all levels).
              if (formData.parentId) {
                const parent = flatCategories.find(c => c._id === formData.parentId);
                // If parent exists and parent also has a parentId, then current is L3+
                if (parent && parent.parentId) {
                  return true;
                }
              }
              return false;
            }

            // 3. creating new category (not sub mode) but with parent selected
            if (mode === 'create' && formData.parentId) {
              const parent = flatCategories.find(c => c._id === formData.parentId);
              if (parent && parent.parentId) {
                return true;
              }
            }

            return false;
          })() && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  name="commissionRate"
                  value={formData.commissionRate}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                  step="0.01"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${errors.commissionRate
                    ? "border-red-300"
                    : "border-neutral-300"
                    }`}
                  disabled={submitting}
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Override default commission rate for this category (0 = use default)
                </p>
                {errors.commissionRate && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.commissionRate}
                  </p>
                )}
              </div>
            )}

          {/* Active Status */}
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="status"
                checked={formData.status === "Active"}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    status: e.target.checked ? "Active" : "Inactive",
                  }))
                }
                className="mr-2"
                disabled={submitting}
              />
              <span className="text-sm font-medium text-neutral-700">
                Active Status
              </span>
            </label>
          </div>

          {/* Advanced Fields (Collapsible) */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-neutral-700 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors">
              <span>Advanced Settings</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className={`transform transition-transform ${showAdvanced ? "rotate-180" : ""
                  }`}>
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {showAdvanced && (
              <div className="mt-2 p-4 bg-neutral-50 rounded-lg space-y-4">
                {/* Is Bestseller */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="isBestseller"
                      checked={formData.isBestseller}
                      onChange={handleInputChange}
                      className="mr-2"
                      disabled={submitting}
                    />
                    <span className="text-sm font-medium text-neutral-700">
                      Is Bestseller Category
                    </span>
                  </label>
                </div>

                {/* Has Warning */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="hasWarning"
                      checked={formData.hasWarning}
                      onChange={handleInputChange}
                      className="mr-2"
                      disabled={submitting}
                    />
                    <span className="text-sm font-medium text-neutral-700">
                      Has Warning
                    </span>
                  </label>
                </div>

                {/* Group Category */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Group Category
                  </label>
                  <input
                    type="text"
                    name="groupCategory"
                    value={formData.groupCategory}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Enter group category"
                    disabled={submitting}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
            disabled={submitting}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${submitting || uploading
              ? "bg-neutral-400 cursor-not-allowed"
              : "bg-teal-600 hover:bg-teal-700"
              }`}>
            {submitting
              ? "Saving..."
              : uploading
                ? "Uploading..."
                : isEditMode
                  ? "Update Category"
                  : "Create Category"}
          </button>
        </div>
      </div>
    </div>
  );
}
