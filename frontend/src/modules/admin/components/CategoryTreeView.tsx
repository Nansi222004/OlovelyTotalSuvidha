import { Category } from "../../../services/api/admin/adminProductService";

interface CategoryTreeViewProps {
  categories: Category[];
  onAddSubcategory: (parent: Category) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onToggleStatus: (category: Category) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  level?: number;
}

export default function CategoryTreeView({
  categories,
  onAddSubcategory,
  onEdit,
  onDelete,
  onToggleStatus,
  expandedIds,
  onToggleExpand,
  level = 0,
}: CategoryTreeViewProps) {
  // Only show "No categories found" at root level (level 0)
  if (categories.length === 0 && level === 0) {
    return (
      <div className="text-center py-8 text-neutral-500">
        No categories found
      </div>
    );
  }

  // For nested levels, if there are no categories, don't render anything
  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {categories.map((category) => {
        const hasChildren =
          (category.children && category.children.length > 0) ||
          (category.childrenCount && category.childrenCount > 0);
        const isExpanded = expandedIds.has(category._id);
        const indentLevel = level * 24; // 24px per level
        const isSubcategory =
          level > 0 ||
          (category.parentId !== null && category.parentId !== undefined);

        return (
          <div key={category._id} className="relative">
            {/* Category Card */}
            <div
              className={`${
                isSubcategory
                  ? "bg-blue-50 border-l-4 border-l-blue-400 border border-blue-200 rounded-r-lg p-3"
                  : "bg-white border border-neutral-200 rounded-lg p-4"
              } hover:shadow-md transition-all ${
                isSubcategory ? "hover:bg-blue-100" : ""
              }`}
              style={{ marginLeft: `${indentLevel}px` }}>
              <div className="flex items-start gap-3">
                {/* Expand/Collapse Icon or Subcategory Indicator */}
                {hasChildren ? (
                  <button
                    onClick={() => onToggleExpand(category._id)}
                    className={`flex-shrink-0 mt-1 transition-colors ${
                      isSubcategory
                        ? "text-blue-400 hover:text-blue-600"
                        : "text-neutral-400 hover:text-neutral-600"
                    }`}>
                    <svg
                      width={isSubcategory ? "16" : "20"}
                      height={isSubcategory ? "16" : "20"}
                      viewBox="0 0 24 24"
                      fill="none"
                      className={`transform transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}>
                      <path
                        d="M9 18l6-6-6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                ) : isSubcategory ? (
                  <div className="flex-shrink-0 mt-1">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-blue-400">
                      <path
                        d="M9 18l6-6-6-6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                ) : (
                  <div className="w-5" /> // Spacer for alignment
                )}

                {/* Category Image */}
                <div className="flex-shrink-0">
                  {category.image ? (
                    <img
                      src={category.image}
                      alt={category.name}
                      className={`${
                        isSubcategory ? "w-12 h-12" : "w-16 h-16"
                      } rounded-lg object-cover`}
                      onError={(e) => {
                        // Hide broken image and show fallback
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          const size = isSubcategory ? "w-12 h-12" : "w-16 h-16";
                          parent.innerHTML = `<div class="${size} rounded-lg bg-neutral-100 flex items-center justify-center"><span class="text-lg font-semibold text-neutral-400">${category.name.charAt(0).toUpperCase()}</span></div>`;
                        }
                      }}
                    />
                  ) : (
                    <div
                      className={`${
                        isSubcategory ? "w-12 h-12" : "w-16 h-16"
                      } rounded-lg ${
                        isSubcategory ? "bg-blue-100" : "bg-neutral-100"
                      } flex items-center justify-center`}>
                      <span
                        className={`${
                          isSubcategory ? "text-lg" : "text-2xl"
                        } font-semibold ${
                          isSubcategory ? "text-blue-600" : "text-neutral-400"
                        }`}>
                        {category.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Category Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`${
                            isSubcategory
                              ? "text-sm font-medium text-blue-900"
                              : "text-base font-semibold text-neutral-900"
                          } truncate`}>
                          {category.name}
                        </h3>
                        {isSubcategory && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-200 text-blue-800">
                            Subcategory
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {/* Status Badge */}
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            category.status === "Active"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                          {category.status}
                        </span>

                        {/* Header Category Badge */}
                        {category.headerCategory ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {typeof category.headerCategory === "string"
                              ? category.headerCategory
                              : category.headerCategory.name}
                          </span>
                        ) : category.headerCategoryId ? (
                          (() => {
                            // Handle headerCategoryId - could be string, object (populated), or null
                            let headerName = "Unknown";
                            if (
                              typeof category.headerCategoryId === "object" &&
                              category.headerCategoryId !== null
                            ) {
                              // It's populated, get the name
                              headerName =
                                (category.headerCategoryId as { name?: string })
                                  .name || "Unknown";
                            } else if (
                              typeof category.headerCategoryId === "string"
                            ) {
                              // It's just an ID, show last 6 chars
                              headerName = category.headerCategoryId.slice(-6);
                            }
                            return (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Header: {headerName}
                              </span>
                            );
                          })()
                        ) : null}

                        {/* Children Count Badge */}
                        {hasChildren && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {category.childrenCount ||
                              category.children?.length ||
                              0}{" "}
                            {category.childrenCount === 1 ||
                            category.children?.length === 1
                              ? "subcategory"
                              : "subcategories"}
                          </span>
                        )}

                        {/* Order Badge */}
                        <span className="text-xs text-neutral-500">
                          Order: {category.order || 0}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Add Subcategory Button - Available for all categories (supports nested subcategories) */}
                      <button
                        onClick={() => onAddSubcategory(category)}
                        className={`${
                          isSubcategory ? "px-2 py-1" : "px-3 py-1.5"
                        } text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded transition-colors`}
                        title="Add Subcategory">
                        {isSubcategory ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                        ) : (
                          <>
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="inline-block mr-1">
                              <line x1="12" y1="5" x2="12" y2="19"></line>
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Add Subcategory
                          </>
                        )}
                      </button>

                      {/* Toggle Status Button */}
                      <button
                        onClick={() => onToggleStatus(category)}
                        className={`${
                          isSubcategory ? "px-2 py-1" : "px-3 py-1.5"
                        } text-xs font-medium rounded transition-colors ${
                          category.status === "Active"
                            ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                            : "bg-green-100 text-green-800 hover:bg-green-200"
                        }`}
                        title={
                          category.status === "Active"
                            ? "Deactivate"
                            : "Activate"
                        }>
                        {isSubcategory ? (
                          category.status === "Active" ? (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          ) : (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )
                        ) : category.status === "Active" ? (
                          "Deactivate"
                        ) : (
                          "Activate"
                        )}
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => onEdit(category)}
                        className={`${
                          isSubcategory ? "px-2 py-1" : "px-3 py-1.5"
                        } text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors`}
                        title="Edit">
                        <svg
                          width={isSubcategory ? "14" : "16"}
                          height={isSubcategory ? "14" : "16"}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => onDelete(category)}
                        className={`${
                          isSubcategory ? "px-2 py-1" : "px-3 py-1.5"
                        } text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors`}
                        title="Delete">
                        <svg
                          width={isSubcategory ? "14" : "16"}
                          height={isSubcategory ? "14" : "16"}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Children (Recursive) */}
            {hasChildren &&
              isExpanded &&
              category.children &&
              category.children.length > 0 && (
                <div className="mt-2">
                  <CategoryTreeView
                    categories={category.children}
                    onAddSubcategory={onAddSubcategory}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleStatus={onToggleStatus}
                    expandedIds={expandedIds}
                    onToggleExpand={onToggleExpand}
                    level={level + 1}
                  />
                </div>
              )}
          </div>
        );
      })}
    </div>
  );
}
