import { Category } from "../services/api/admin/adminProductService";

/**
 * Build hierarchical tree structure from flat category array
 */
export function buildCategoryTree(
  categories: Category[],
  parentId: string | null = null
): Category[] {
  return categories
    .filter((cat) => {
      // Normalize parentId - handle both string and object (populated) cases
      let catParentId: string | null = null;
      if (cat.parentId) {
        if (typeof cat.parentId === "string") {
          catParentId = cat.parentId;
        } else if (typeof cat.parentId === "object" && cat.parentId !== null) {
          // It's populated, extract the _id
          catParentId = (cat.parentId as { _id?: string })._id || null;
        }
      }

      // Compare normalized parentId with the target parentId
      const parentIdStr = parentId ? parentId.toString() : null;
      const catParentIdStr = catParentId ? catParentId.toString() : null;
      return catParentIdStr === parentIdStr;
    })
    .map((category) => ({
      ...category,
      children: buildCategoryTree(categories, category._id),
    }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Get all root categories (categories with no parent)
 */
export function getRootCategories(categories: Category[]): Category[] {
  return categories
    .filter((cat) => !cat.parentId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Get direct children of a category
 */
export function getCategoryChildren(
  categoryId: string,
  categories: Category[]
): Category[] {
  return categories
    .filter((cat) => cat.parentId === categoryId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Get all descendants of a category (recursive)
 */
export function getAllDescendants(
  categoryId: string,
  categories: Category[]
): Category[] {
  const descendants: Category[] = [];
  const children = getCategoryChildren(categoryId, categories);

  for (const child of children) {
    descendants.push(child);
    descendants.push(...getAllDescendants(child._id, categories));
  }

  return descendants;
}

/**
 * Validate parent change to prevent circular references
 */
export function validateParentChange(
  categoryId: string,
  newParentId: string | null,
  categories: Category[]
): { valid: boolean; error?: string } {
  // Can always set to null (root category)
  if (!newParentId) {
    return { valid: true };
  }

  // Cannot set parent to self
  if (categoryId === newParentId) {
    return {
      valid: false,
      error: "Cannot set category as its own parent",
    };
  }

  // Check if new parent exists
  const newParent = categories.find((cat) => cat._id === newParentId);
  if (!newParent) {
    return {
      valid: false,
      error: "Parent category not found",
    };
  }

  // Check if new parent is active
  if (newParent.status !== "Active") {
    return {
      valid: false,
      error: "Parent category must be active",
    };
  }

  // Check for circular reference: new parent cannot be a descendant
  const descendants = getAllDescendants(categoryId, categories);
  const isDescendant = descendants.some((desc) => desc._id === newParentId);
  if (isDescendant) {
    return {
      valid: false,
      error: "Cannot create circular reference: parent cannot be a descendant",
    };
  }

  return { valid: true };
}

/**
 * Flatten category tree to list
 */
export function flattenCategoryTree(tree: Category[]): Category[] {
  const result: Category[] = [];

  function traverse(categories: Category[]) {
    for (const category of categories) {
      result.push(category);
      if (category.children && category.children.length > 0) {
        traverse(category.children);
      }
    }
  }

  traverse(tree);
  return result;
}

/**
 * Get path from root to category
 */
export function getCategoryPath(
  categoryId: string,
  categories: Category[]
): Category[] {
  const path: Category[] = [];
  let currentId: string | null | undefined = categoryId;

  while (currentId) {
    const category = categories.find((cat) => cat._id === currentId);
    if (!category) break;

    path.unshift(category);
    currentId = category.parentId || null;
  }

  return path;
}

/**
 * Get all active categories (for dropdowns, etc.)
 */
export function getActiveCategories(categories: Category[]): Category[] {
  return categories.filter((cat) => cat.status === "Active");
}

/**
 * Get categories available as parents (excludes self and descendants)
 */
export function getAvailableParents(
  categoryId: string | null,
  categories: Category[]
): Category[] {
  if (!categoryId) {
    // For new categories, return all active root categories
    return getActiveCategories(getRootCategories(categories));
  }

  // For existing categories, exclude self and all descendants
  const descendants = getAllDescendants(categoryId, categories);
  const excludeIds = new Set([categoryId, ...descendants.map((d) => d._id)]);

  return getActiveCategories(categories).filter(
    (cat) => !excludeIds.has(cat._id)
  );
}

/**
 * Search categories by name (case-insensitive)
 */
export function searchCategories(
  categories: Category[],
  searchQuery: string
): Category[] {
  if (!searchQuery.trim()) {
    return categories;
  }

  const query = searchQuery.toLowerCase();
  return categories.filter((cat) => cat.name.toLowerCase().includes(query));
}

/**
 * Filter categories by status
 */
export function filterCategoriesByStatus(
  categories: Category[],
  status: "All" | "Active" | "Inactive"
): Category[] {
  if (status === "All") {
    return categories;
  }
  return categories.filter((cat) => cat.status === status);
}

/**
 * Get all categories under a specific header category
 */
export function getCategoriesByHeaderCategory(
  headerCategoryId: string,
  categories: Category[]
): Category[] {
  const result: Category[] = [];

  function collectCategories(cats: Category[]) {
    for (const cat of cats) {
      if (cat.headerCategoryId === headerCategoryId) {
        result.push(cat);
      }
      if (cat.children && cat.children.length > 0) {
        collectCategories(cat.children);
      }
    }
  }

  collectCategories(categories);
  return result;
}

/**
 * Get header category ID for a category (including inherited from parent)
 */
export function getHeaderCategoryForCategory(
  categoryId: string,
  categories: Category[]
): string | null {
  const category = categories.find((cat) => cat._id === categoryId);
  if (!category) {
    return null;
  }

  // If category has headerCategoryId, return it
  if (category.headerCategoryId) {
    return category.headerCategoryId;
  }

  // If category has parent, get header category from parent recursively
  if (category.parentId) {
    const parent = categories.find((cat) => cat._id === category.parentId);
    if (parent) {
      return getHeaderCategoryForCategory(parent._id, categories);
    }
  }

  return null;
}
