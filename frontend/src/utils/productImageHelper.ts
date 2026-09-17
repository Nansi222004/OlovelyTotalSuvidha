/**
 * Dynamic fallback image resolver based on product name and keywords.
 * If a product lacks an uploaded image from admin, this returns a curated,
 * high-quality product image matching the product's name and category.
 */
export function getProductImage(product?: any): string {
  if (!product) return "/assets/fallback-quick-commerce.jpg";

  const existingImg =
    product.imageUrl ||
    product.mainImage ||
    (Array.isArray(product.images) && product.images[0]) ||
    (Array.isArray(product.galleryImages) && product.galleryImages[0]);

  if (
    existingImg &&
    typeof existingImg === "string" &&
    existingImg.trim() !== "" &&
    existingImg !== "/placeholder.png"
  ) {
    return existingImg;
  }

  const name = (
    (product.productName || product.name || "") +
    " " +
    (product.categoryName || product.category?.name || "")
  ).toLowerCase();

  // Spices & Masala
  if (
    name.includes("masala") ||
    name.includes("spice") ||
    name.includes("chilli") ||
    name.includes("chili") ||
    name.includes("haldi") ||
    name.includes("mirch") ||
    name.includes("turmeric") ||
    name.includes("cumin") ||
    name.includes("jeera") ||
    name.includes("coriander")
  ) {
    return "/assets/product-bulk-masala.jpg";
  }

  // Electronics & Gadgets
  if (
    name.includes("electronic") ||
    name.includes("gadget") ||
    name.includes("smart") ||
    name.includes("watch") ||
    name.includes("earbud") ||
    name.includes("headphone") ||
    name.includes("mobile") ||
    name.includes("phone") ||
    name.includes("charger") ||
    name.includes("cable")
  ) {
    return "/assets/product-smart-electronics.jpg";
  }

  // Flour / Atta / Grains
  if (
    name.includes("flour") ||
    name.includes("atta") ||
    name.includes("wheat") ||
    name.includes("besan") ||
    name.includes("maida") ||
    name.includes("sooji") ||
    name.includes("grain")
  ) {
    return "/assets/product-organic-flour.jpg";
  }

  // Cookware & Kitchenware
  if (
    name.includes("cookware") ||
    name.includes("pan") ||
    name.includes("pot") ||
    name.includes("utensil") ||
    name.includes("kitchen") ||
    name.includes("kadai") ||
    name.includes("cooker") ||
    name.includes("tawa")
  ) {
    return "/assets/product-cookware-set.jpg";
  }

  // Milk & Dairy
  if (
    name.includes("milk") ||
    name.includes("dairy") ||
    name.includes("butter") ||
    name.includes("cheese") ||
    name.includes("ghee") ||
    name.includes("curd") ||
    name.includes("dahi") ||
    name.includes("paneer")
  ) {
    return "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=600";
  }

  // Tomatoes & Fresh Vegetables
  if (
    name.includes("tomato") ||
    name.includes("potato") ||
    name.includes("onion") ||
    name.includes("vegetable") ||
    name.includes("sabzi") ||
    name.includes("veggie")
  ) {
    return "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=600";
  }

  // Fruits
  if (
    name.includes("fruit") ||
    name.includes("mango") ||
    name.includes("apple") ||
    name.includes("banana") ||
    name.includes("orange")
  ) {
    return "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&q=80&w=600";
  }

  // Rice & Grains
  if (
    name.includes("rice") ||
    name.includes("chawal") ||
    name.includes("poha") ||
    name.includes("basmati")
  ) {
    return "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=600";
  }

  // Snacks & Namkeen
  if (
    name.includes("snack") ||
    name.includes("chip") ||
    name.includes("namkeen") ||
    name.includes("biscuit") ||
    name.includes("cookie") ||
    name.includes("rusk")
  ) {
    return "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=600";
  }

  // Beverages & Drinks
  if (
    name.includes("juice") ||
    name.includes("drink") ||
    name.includes("beverage") ||
    name.includes("soda") ||
    name.includes("cola")
  ) {
    return "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=600";
  }

  // Beauty & Personal Care
  if (
    name.includes("soap") ||
    name.includes("shampoo") ||
    name.includes("cream") ||
    name.includes("beauty") ||
    name.includes("skin") ||
    name.includes("hair") ||
    name.includes("lotion")
  ) {
    return "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=600";
  }

  // Detergent & Household Cleaning
  if (
    name.includes("detergent") ||
    name.includes("wash") ||
    name.includes("clean") ||
    name.includes("surf") ||
    name.includes("vim")
  ) {
    return "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&q=80&w=600";
  }

  // Default grocery & general products
  return "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600";
}
