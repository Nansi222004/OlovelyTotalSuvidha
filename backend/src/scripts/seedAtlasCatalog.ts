import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const HEADER_CATEGORIES = [
  { name: 'All', slug: 'all', icon: '✨', order: 0, status: 'Published' },
  { name: 'Grocery', slug: 'grocery', icon: '🛒', order: 1, status: 'Published' },
  { name: 'Fruits & Vegetables', slug: 'fruits-vegetables', icon: '🍎', order: 2, status: 'Published' },
  { name: 'Dairy & Breakfast', slug: 'dairy-breakfast', icon: '🥛', order: 3, status: 'Published' },
  { name: 'Snacks & Drinks', slug: 'snacks-drinks', icon: '🍿', order: 4, status: 'Published' },
  { name: 'Personal Care', slug: 'personal-care', icon: '🧴', order: 5, status: 'Published' },
  { name: 'Household', slug: 'household', icon: '🧹', order: 6, status: 'Published' },
  { name: 'Electronics', slug: 'electronics', icon: '📱', order: 7, status: 'Published' },
  { name: 'Beauty', slug: 'beauty', icon: '💄', order: 8, status: 'Published' },
  { name: 'Fashion', slug: 'fashion', icon: '👗', order: 9, status: 'Published' },
  { name: 'Sports', slug: 'sports', icon: '⚽', order: 10, status: 'Published' },
];

const CATEGORIES_DATA = [
  {
    name: 'Atta, Rice & Dal',
    slug: 'atta-rice-dal',
    headerSlug: 'grocery',
    image: '/assets/category-atta-rice.png',
    order: 1,
    subcategories: ['Chakki Atta', 'Basmati Rice', 'Pulses & Dals', 'Poha & Grains']
  },
  {
    name: 'Dairy, Bread & Eggs',
    slug: 'dairy-bread-eggs',
    headerSlug: 'dairy-breakfast',
    image: '/assets/category-dairy.png',
    order: 2,
    subcategories: ['Fresh Milk', 'Butter & Cheese', 'Curd & Paneer', 'Bread & Pav', 'Farm Fresh Eggs']
  },
  {
    name: 'Fruits & Vegetables',
    slug: 'fruits-vegetables',
    headerSlug: 'fruits-vegetables',
    image: '/assets/category-fruits-veg.png',
    order: 3,
    subcategories: ['Daily Vegetables', 'Fresh Fruits', 'Leafy Greens', 'Exotic Vegetables']
  },
  {
    name: 'Snacks & Munchies',
    slug: 'snacks-munchies',
    headerSlug: 'snacks-drinks',
    image: '/assets/category-snacks.png',
    order: 4,
    subcategories: ['Potato Chips', 'Namkeen & Sev', 'Popcorn & Nachos', 'Traditional Snacks']
  },
  {
    name: 'Cold Drinks & Juices',
    slug: 'cold-drinks-juices',
    headerSlug: 'snacks-drinks',
    image: '/assets/category-drinks.png',
    order: 5,
    subcategories: ['Soft Drinks & Sodas', 'Juices & Fruit Drinks', 'Energy Drinks', 'Flavoured Water']
  },
  {
    name: 'Bakery & Biscuits',
    slug: 'bakery-biscuits',
    headerSlug: 'dairy-breakfast',
    image: '/assets/category-biscuits.png',
    order: 6,
    subcategories: ['Cookies & Biscuits', 'Rusk & Khari', 'Cakes & Muffins']
  },
  {
    name: 'Breakfast & Instant Food',
    slug: 'breakfast-instant-food',
    headerSlug: 'dairy-breakfast',
    image: '/assets/category-breakfast.png',
    order: 7,
    subcategories: ['Instant Noodles & Pasta', 'Oats & Muesli', 'Breakfast Ready Mixes', 'Cereals']
  },
  {
    name: 'Tea, Coffee & Health Drink',
    slug: 'tea-coffee-health-drink',
    headerSlug: 'grocery',
    image: '/assets/category-tea,-coffe-&-health-drink.png',
    order: 8,
    subcategories: ['Leaf Tea & Tea Bags', 'Instant & Filter Coffee', 'Health Drink Powders']
  },
  {
    name: 'Masala, Oil & More',
    slug: 'masala-oil-more',
    headerSlug: 'grocery',
    image: '/assets/category-masala.png',
    order: 9,
    subcategories: ['Cooking Oils', 'Pure Desi Ghee', 'Whole Spices', 'Blended Masalas', 'Salt & Sugar']
  },
  {
    name: 'Sweet Tooth',
    slug: 'sweet-tooth',
    headerSlug: 'snacks-drinks',
    image: '/assets/category-sweet-tooth.png',
    order: 10,
    subcategories: ['Premium Chocolates', 'Indian Sweets & Mithai', 'Candies & Candied Fruits']
  },
  {
    name: 'Cleaning Essentials',
    slug: 'cleaning-essentials',
    headerSlug: 'household',
    image: '/assets/category-cleaning.png',
    order: 11,
    subcategories: ['Detergents & Laundry', 'Floor & Surface Cleaners', 'Dishwashing Bars & Liquids']
  },
  {
    name: 'Personal Care',
    slug: 'personal-care',
    headerSlug: 'personal-care',
    image: '/assets/category-personal-care.png',
    order: 12,
    subcategories: ['Soaps & Body Wash', 'Shampoos & Conditioners', 'Oral Care & Toothpastes', 'Skin Care & Lotions']
  },
  {
    name: 'Baby Care',
    slug: 'baby-care',
    headerSlug: 'personal-care',
    image: '/assets/category-baby-care.png',
    order: 13,
    subcategories: ['Diapers & Wipes', 'Baby Food & Formula', 'Baby Bath & Hygiene']
  },
  {
    name: 'Pet Care',
    slug: 'pet-care',
    headerSlug: 'grocery',
    image: '/assets/category-pet-care.png',
    order: 14,
    subcategories: ['Dog Food & Treats', 'Cat Food', 'Pet Grooming & Care']
  },
  {
    name: 'Pharma & Wellness',
    slug: 'pharma-wellness',
    headerSlug: 'personal-care',
    image: '/assets/category-pharma-&-wellness.png',
    order: 15,
    subcategories: ['First Aid & Antiseptics', 'Vitamins & Supplements', 'Pain Relief & Balms']
  },
  {
    name: 'Sauces & Spreads',
    slug: 'sauces-spreads',
    headerSlug: 'grocery',
    image: '/assets/category-sauces-&-spreads.png',
    order: 16,
    subcategories: ['Tomato Ketchup & Sauces', 'Jams & Honey', 'Mayonnaise & Dips', 'Pickles & Chutneys']
  },
  {
    name: 'Organic & Healthy Living',
    slug: 'organic-healthy-living',
    headerSlug: 'grocery',
    image: '/assets/category-organic-&-healthy-living.png',
    order: 17,
    subcategories: ['Organic Atta & Grains', 'Organic Pulses', 'Cold Pressed Oils', 'Superfoods & Seeds']
  },
  {
    name: 'Home & Office',
    slug: 'home-office',
    headerSlug: 'household',
    image: '/assets/category-home-&-office.png',
    order: 18,
    subcategories: ['Stationery & Notebooks', 'Batteries & Bulbs', 'Pooja Essentials', 'Party Disposables']
  },
  {
    name: 'Chicken, Meat & Fish',
    slug: 'chicken-meat-fish',
    headerSlug: 'grocery',
    image: '/assets/category-chicken,-meat-&-fish.png',
    order: 19,
    subcategories: ['Fresh Chicken', 'Mutton Cuts', 'Fish & Seafood', 'Eggs']
  },
  {
    name: 'Paan Corner',
    slug: 'paan-corner',
    headerSlug: 'snacks-drinks',
    image: '/assets/category-paan-corner.png',
    order: 20,
    subcategories: ['Mouth Fresheners', 'Flavoured Supari', 'Meetha Paan Essentials']
  }
];

const PRODUCTS_DATA = [
  // 1. Atta, Rice & Dal
  {
    productName: "Aashirvaad Superior MP Whole Wheat Atta 5kg",
    category: "Atta, Rice & Dal",
    subcategory: "Chakki Atta",
    headerSlug: "grocery",
    price: 245,
    compareAtPrice: 265,
    pack: "5 kg",
    mainImage: "/assets/product-aashirvaad-atta.jpg",
    tags: ["atta", "wheat", "flour", "grocery", "staples", "aashirvaad"],
    smallDescription: "100% pure whole wheat grain chakki fresh flour for soft rotis",
    rating: 4.9,
    reviewsCount: 128
  },
  {
    productName: "Fortune Chakki Fresh Atta 5kg",
    category: "Atta, Rice & Dal",
    subcategory: "Chakki Atta",
    headerSlug: "grocery",
    price: 235,
    compareAtPrice: 255,
    pack: "5 kg",
    mainImage: "/assets/product-fortune-atta.jpg",
    tags: ["atta", "fortune", "flour", "wheat", "staples"],
    smallDescription: "Traditional chakki ground 100% whole wheat atta with natural dietary fibres",
    rating: 4.8,
    reviewsCount: 86
  },
  {
    productName: "Daawat Pulav Basmati Rice 1kg",
    category: "Atta, Rice & Dal",
    subcategory: "Basmati Rice",
    headerSlug: "grocery",
    price: 135,
    compareAtPrice: 160,
    pack: "1 kg",
    mainImage: "/assets/product-daawat-rice.jpg",
    tags: ["rice", "basmati", "pulav", "daawat", "staples"],
    smallDescription: "Long and slender grains aged to perfection for royal aromatic biryanis and pulav",
    rating: 4.8,
    reviewsCount: 94
  },
  {
    productName: "India Gate Kolam Premium Rice 1kg",
    category: "Atta, Rice & Dal",
    subcategory: "Basmati Rice",
    headerSlug: "grocery",
    price: 98,
    compareAtPrice: 115,
    pack: "1 kg",
    mainImage: "/assets/product-india-gate-rice.jpg",
    tags: ["rice", "kolam", "india gate", "daily rice"],
    smallDescription: "Lightweight silky everyday rice, easy to digest and perfect with dals and curries",
    rating: 4.7,
    reviewsCount: 65
  },
  {
    productName: "Tata Sampann Unpolished Yellow Moong Dal 1kg",
    category: "Atta, Rice & Dal",
    subcategory: "Pulses & Dals",
    headerSlug: "grocery",
    price: 155,
    compareAtPrice: 175,
    pack: "1 kg",
    mainImage: "/assets/product-tata-moong.jpg",
    tags: ["dal", "moong", "tata sampann", "pulses", "protein"],
    smallDescription: "Unpolished dal retaining natural wholesome nutrients and rich aroma",
    rating: 4.9,
    reviewsCount: 112
  },
  {
    productName: "Fortune Indori Thick Poha 500g",
    category: "Atta, Rice & Dal",
    subcategory: "Poha & Grains",
    headerSlug: "grocery",
    price: 38,
    compareAtPrice: 45,
    pack: "500 g",
    mainImage: "/assets/product-fortune-poha.jpg",
    tags: ["poha", "breakfast", "indori", "grains"],
    smallDescription: "Authentic thick flattened rice flakes ideal for fluffy Indori Poha",
    rating: 4.8,
    reviewsCount: 78
  },
  {
    productName: "Rajdhani Besan Fine Gram Flour 1kg",
    category: "Atta, Rice & Dal",
    subcategory: "Pulses & Dals",
    headerSlug: "grocery",
    price: 95,
    compareAtPrice: 110,
    pack: "1 kg",
    mainImage: "/assets/product-rajdhani-besan.jpg",
    tags: ["besan", "gram flour", "rajdhani", "pakoda", "sweets"],
    smallDescription: "Finely milled pure chana dal flour for crispy snacks and delicious sweets",
    rating: 4.7,
    reviewsCount: 52
  },

  // 2. Dairy, Bread & Eggs
  {
    productName: "Amul Pasteurised Salted Butter 500g",
    category: "Dairy, Bread & Eggs",
    subcategory: "Butter & Cheese",
    headerSlug: "dairy-breakfast",
    price: 265,
    compareAtPrice: 275,
    pack: "500 g",
    mainImage: "/assets/product-amul-butter.jpg",
    tags: ["butter", "amul", "dairy", "breakfast", "bread butter"],
    smallDescription: "The iconic Utterly Butterly Delicious rich salted table butter",
    rating: 4.9,
    reviewsCount: 215
  },
  {
    productName: "Amul Blend Diced Cheese 200g",
    category: "Dairy, Bread & Eggs",
    subcategory: "Butter & Cheese",
    headerSlug: "dairy-breakfast",
    price: 125,
    compareAtPrice: 140,
    pack: "200 g",
    mainImage: "/assets/product-amul-cheese.jpg",
    tags: ["cheese", "amul", "pizza cheese", "dairy"],
    smallDescription: "Gooey melting mozzarella and cheddar diced blend for pizzas and sandwiches",
    rating: 4.8,
    reviewsCount: 79
  },
  {
    productName: "Amul Masti Dahi Curd Tub 400g",
    category: "Dairy, Bread & Eggs",
    subcategory: "Curd & Paneer",
    headerSlug: "dairy-breakfast",
    price: 40,
    compareAtPrice: 42,
    pack: "400 g",
    mainImage: "/assets/product-amul-curd.jpg",
    tags: ["curd", "dahi", "amul", "dairy", "probiotic"],
    smallDescription: "Thick, creamy, and mildly sweet pasteurized fresh probiotic curd",
    rating: 4.8,
    reviewsCount: 140
  },
  {
    productName: "Mother Dairy Classic Dahi 400g",
    category: "Dairy, Bread & Eggs",
    subcategory: "Curd & Paneer",
    headerSlug: "dairy-breakfast",
    price: 38,
    compareAtPrice: 40,
    pack: "400 g",
    mainImage: "/assets/product-mother-dairy-curd.jpg",
    tags: ["curd", "mother dairy", "dahi", "dairy"],
    smallDescription: "Fresh wholesome homestyle curd made with pure pasteurized milk",
    rating: 4.7,
    reviewsCount: 62
  },
  {
    productName: "Britannia 100% Whole Wheat Brown Bread 400g",
    category: "Dairy, Bread & Eggs",
    subcategory: "Bread & Pav",
    headerSlug: "dairy-breakfast",
    price: 45,
    compareAtPrice: 50,
    pack: "400 g",
    mainImage: "/assets/product-britannia-bread.jpg",
    tags: ["bread", "brown bread", "wheat bread", "britannia", "breakfast"],
    smallDescription: "Nutritious fiber-packed whole wheat bread slices for healthy daily breakfast",
    rating: 4.8,
    reviewsCount: 92
  },
  {
    productName: "Table White Fresh Farm Eggs 6 pcs",
    category: "Dairy, Bread & Eggs",
    subcategory: "Farm Fresh Eggs",
    headerSlug: "dairy-breakfast",
    price: 48,
    compareAtPrice: 55,
    pack: "6 pcs",
    mainImage: "/assets/product-eggs.jpg",
    tags: ["eggs", "farm eggs", "protein", "breakfast", "dairy"],
    smallDescription: "Farm fresh hygienic quality graded protein rich white eggs",
    rating: 4.8,
    reviewsCount: 165
  },

  // 3. Snacks & Munchies
  {
    productName: "Lay's India's Magic Masala Potato Chips 50g",
    category: "Snacks & Munchies",
    subcategory: "Potato Chips",
    headerSlug: "snacks-drinks",
    price: 18,
    compareAtPrice: 20,
    pack: "50 g",
    mainImage: "/assets/product-lays-magic-masala.jpg",
    tags: ["lays", "chips", "masala", "snacks", "crisps"],
    smallDescription: "Crispy ripple cut potato chips dusted with authentic Indian spice mix",
    rating: 4.9,
    reviewsCount: 320
  },
  {
    productName: "Lay's American Style Cream & Onion Chips 50g",
    category: "Snacks & Munchies",
    subcategory: "Potato Chips",
    headerSlug: "snacks-drinks",
    price: 18,
    compareAtPrice: 20,
    pack: "50 g",
    mainImage: "/assets/product-lays-cream-onion.jpg",
    tags: ["lays", "cream onion", "chips", "snacks"],
    smallDescription: "Crunchy potato crisps loaded with rich velvety cream and green herb seasoning",
    rating: 4.9,
    reviewsCount: 290
  },
  {
    productName: "Kurkure Solid Masti Masala Twisteez 85g",
    category: "Snacks & Munchies",
    subcategory: "Traditional Snacks",
    headerSlug: "snacks-drinks",
    price: 20,
    compareAtPrice: 20,
    pack: "85 g",
    mainImage: "/assets/product-kurkure.jpg",
    tags: ["kurkure", "namkeen", "masala", "crunchy"],
    smallDescription: "Chatpata crunchy corn puff curls bursting with bold spices",
    rating: 4.8,
    reviewsCount: 184
  },
  {
    productName: "Haldiram's Nagpur Spicy Sev Bhujia 400g",
    category: "Snacks & Munchies",
    subcategory: "Namkeen & Sev",
    headerSlug: "snacks-drinks",
    price: 105,
    compareAtPrice: 120,
    pack: "400 g",
    mainImage: "/assets/product-haldiram-sev.jpg",
    tags: ["haldiram", "bhujia", "sev", "namkeen", "snack"],
    smallDescription: "Crispy golden spiced gram flour noodle snack seasoned with authentic mint & cloves",
    rating: 4.9,
    reviewsCount: 210
  },
  {
    productName: "Balaji Ratlami Sev Spicy Namkeen 400g",
    category: "Snacks & Munchies",
    subcategory: "Namkeen & Sev",
    headerSlug: "snacks-drinks",
    price: 95,
    compareAtPrice: 110,
    pack: "400 g",
    mainImage: "/assets/product-balaji-sev.jpg",
    tags: ["balaji", "ratlami sev", "sev", "namkeen", "spicy"],
    smallDescription: "Classic Malwa style pepper & clove spiced crunchy sev namkeen",
    rating: 4.8,
    reviewsCount: 145
  },
  {
    productName: "Doritos Nacho Cheese Tortilla Chips 75g",
    category: "Snacks & Munchies",
    subcategory: "Popcorn & Nachos",
    headerSlug: "snacks-drinks",
    price: 35,
    compareAtPrice: 40,
    pack: "75 g",
    mainImage: "/assets/product-doritos.jpg",
    tags: ["doritos", "nachos", "tortilla", "cheese", "snack"],
    smallDescription: "Triangle crispy corn tortilla chips blasted with bold cheesy goodness",
    rating: 4.8,
    reviewsCount: 115
  },
  {
    productName: "Act II Classic Salted Instant Butter Popcorn 120g",
    category: "Snacks & Munchies",
    subcategory: "Popcorn & Nachos",
    headerSlug: "snacks-drinks",
    price: 45,
    compareAtPrice: 50,
    pack: "120 g",
    mainImage: "/assets/product-act2-popcorn.jpg",
    tags: ["act2", "popcorn", "movie snack", "butter popcorn"],
    smallDescription: "Hot and fluffy 3-minute pressure cooker golden butter popcorn",
    rating: 4.9,
    reviewsCount: 130
  },
  {
    productName: "Parle Real Elaichi Premium Crunchy Rusk 300g",
    category: "Bakery & Biscuits",
    subcategory: "Rusk & Khari",
    headerSlug: "dairy-breakfast",
    price: 45,
    compareAtPrice: 50,
    pack: "300 g",
    mainImage: "/assets/product-parle-rusk.jpg",
    tags: ["rusk", "parle", "elaichi", "chai snack", "bakery"],
    smallDescription: "Double baked crunchy wheat toast infused with real cardamom flavor",
    rating: 4.8,
    reviewsCount: 98
  },

  // 4. Breakfast & Instant Food
  {
    productName: "MTR 3 Minute Khatta Meetha Poha 60g",
    category: "Breakfast & Instant Food",
    subcategory: "Breakfast Ready Mixes",
    headerSlug: "dairy-breakfast",
    price: 25,
    compareAtPrice: 30,
    pack: "60 g",
    mainImage: "/assets/product-mtr-poha.jpg",
    tags: ["mtr", "instant poha", "breakfast", "ready to eat"],
    smallDescription: "Instant tasty wholesome breakfast poha ready just with boiling water",
    rating: 4.7,
    reviewsCount: 88
  },
  {
    productName: "MTR Instant Rava Upma Mix 500g",
    category: "Breakfast & Instant Food",
    subcategory: "Breakfast Ready Mixes",
    headerSlug: "dairy-breakfast",
    price: 75,
    compareAtPrice: 85,
    pack: "500 g",
    mainImage: "/assets/product-mtr-upma.jpg",
    tags: ["mtr", "upma", "breakfast", "instant mix"],
    smallDescription: "Authentic South Indian savory semolina breakfast mix with mustard seeds and curry leaves",
    rating: 4.8,
    reviewsCount: 76
  },

  // 5. Fresh Produce & Vegetables
  {
    productName: "Fresh Red Local Hybrid Tomatoes 1kg",
    category: "Fruits & Vegetables",
    subcategory: "Daily Vegetables",
    headerSlug: "fruits-vegetables",
    price: 28,
    compareAtPrice: 40,
    pack: "1 kg",
    mainImage: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=600",
    tags: ["tomatoes", "fresh", "vegetables", "salad", "gravy"],
    smallDescription: "Juicy farm-picked ripe red tomatoes ideal for curries and salads",
    rating: 4.8,
    reviewsCount: 154
  },
  {
    productName: "Fresh Golden Jyoti Potatoes 1kg",
    category: "Fruits & Vegetables",
    subcategory: "Daily Vegetables",
    headerSlug: "fruits-vegetables",
    price: 24,
    compareAtPrice: 30,
    pack: "1 kg",
    mainImage: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&q=80&w=600",
    tags: ["potatoes", "fresh", "aloo", "vegetables"],
    smallDescription: "Naturally grown firm golden potatoes for daily cooking and roasting",
    rating: 4.9,
    reviewsCount: 180
  },
  {
    productName: "Fresh Crisp Red Onions 1kg",
    category: "Fruits & Vegetables",
    subcategory: "Daily Vegetables",
    headerSlug: "fruits-vegetables",
    price: 32,
    compareAtPrice: 45,
    pack: "1 kg",
    mainImage: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&q=80&w=600",
    tags: ["onions", "pyaz", "fresh", "vegetables"],
    smallDescription: "High pungency crisp red Indian onions for wholesome tadkas",
    rating: 4.8,
    reviewsCount: 142
  },
  {
    productName: "Fresh Green Coriander / Dhaniya 100g",
    category: "Fruits & Vegetables",
    subcategory: "Leafy Greens",
    headerSlug: "fruits-vegetables",
    price: 12,
    compareAtPrice: 20,
    pack: "100 g",
    mainImage: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=600",
    tags: ["coriander", "dhaniya", "greens", "fresh herbs"],
    smallDescription: "Crisp aromatic green coriander leaves picked fresh every morning",
    rating: 4.9,
    reviewsCount: 95
  },
  {
    productName: "Royal Gala Crisp Red Apples 4 pcs",
    category: "Fruits & Vegetables",
    subcategory: "Fresh Fruits",
    headerSlug: "fruits-vegetables",
    price: 140,
    compareAtPrice: 170,
    pack: "4 pcs (~600g)",
    mainImage: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=600",
    tags: ["apple", "fruits", "fresh", "healthy"],
    smallDescription: "Sweet crunchy premium orchard-picked apples rich in vitamins and dietary fibre",
    rating: 4.9,
    reviewsCount: 110
  },
  {
    productName: "Fresh Robusta Bananas 1 Dozen",
    category: "Fruits & Vegetables",
    subcategory: "Fresh Fruits",
    headerSlug: "fruits-vegetables",
    price: 45,
    compareAtPrice: 60,
    pack: "12 pcs",
    mainImage: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&q=80&w=600",
    tags: ["banana", "fruits", "potassium", "energy"],
    smallDescription: "Naturally ripened sweet bananas packed with instant energy and potassium",
    rating: 4.8,
    reviewsCount: 165
  },

  // 6. Cold Drinks & Juices
  {
    productName: "Coca-Cola Original Taste Soft Drink 750ml",
    category: "Cold Drinks & Juices",
    subcategory: "Soft Drinks & Sodas",
    headerSlug: "snacks-drinks",
    price: 38,
    compareAtPrice: 40,
    pack: "750 ml",
    mainImage: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=600",
    tags: ["coke", "coca cola", "cold drink", "soda", "party"],
    smallDescription: "The world's favorite refreshing sparkling carbonated beverage",
    rating: 4.9,
    reviewsCount: 240
  },
  {
    productName: "Real Fruit Power Mixed Fruit Juice 1L",
    category: "Cold Drinks & Juices",
    subcategory: "Juices & Fruit Drinks",
    headerSlug: "snacks-drinks",
    price: 110,
    compareAtPrice: 130,
    pack: "1 L",
    mainImage: "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&q=80&w=600",
    tags: ["juice", "real juice", "fruit power", "beverage"],
    smallDescription: "Delicious goodness of 9 farm fresh fruits packed with Vitamin C and natural fruit energy",
    rating: 4.8,
    reviewsCount: 118
  },

  // 7. Personal Care & Household
  {
    productName: "Dettol Original Germ Protection Bath Soap 125g (Pack of 4)",
    category: "Personal Care",
    subcategory: "Soaps & Body Wash",
    headerSlug: "personal-care",
    price: 165,
    compareAtPrice: 190,
    pack: "4 x 125g",
    mainImage: "https://images.unsplash.com/photo-1607006314392-e4210d32e5ce?auto=format&fit=crop&q=80&w=600",
    tags: ["dettol", "soap", "hygiene", "germ protection", "bath"],
    smallDescription: "100% better germ defense with pine fragrance for clean, healthy skin",
    rating: 4.9,
    reviewsCount: 175
  },
  {
    productName: "Surf Excel Easy Wash Detergent Powder 1kg",
    category: "Cleaning Essentials",
    subcategory: "Detergents & Laundry",
    headerSlug: "household",
    price: 135,
    compareAtPrice: 155,
    pack: "1 kg",
    mainImage: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&q=80&w=600",
    tags: ["surf excel", "detergent", "laundry", "cleaner", "washing"],
    smallDescription: "Superior stain removal formulation that tackles tough oil and dirt stains effortlessly",
    rating: 4.9,
    reviewsCount: 160
  },
  {
    productName: "Vim Lemon Dishwash Gel Bottle 500ml",
    category: "Cleaning Essentials",
    subcategory: "Dishwashing Bars & Liquids",
    headerSlug: "household",
    price: 115,
    compareAtPrice: 130,
    pack: "500 ml",
    mainImage: "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&q=80&w=600",
    tags: ["vim", "dishwash", "kitchen cleaner", "lemon"],
    smallDescription: "Power of 100 lemons removing tough grease from stainless steel and glassware",
    rating: 4.8,
    reviewsCount: 132
  },
  {
    productName: "Cadbury Dairy Milk Silk Hazelnut Chocolate 58g",
    category: "Sweet Tooth",
    subcategory: "Premium Chocolates",
    headerSlug: "snacks-drinks",
    price: 75,
    compareAtPrice: 85,
    pack: "58 g",
    mainImage: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&q=80&w=600",
    tags: ["chocolate", "cadbury", "silk", "hazelnut", "dessert"],
    smallDescription: "Velvety smooth milk chocolate loaded with whole roasted crunchy Turkish hazelnuts",
    rating: 4.9,
    reviewsCount: 220
  }
];

async function seedAtlasCatalog() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri!);
  const db = mongoose.connection.db;

  // 1. Approved Seller
  const sellerId = new mongoose.Types.ObjectId('6a7d5b02259ec525f6753de4');
  await db.collection('sellers').updateOne(
    { _id: sellerId },
    {
      $set: {
        sellerName: 'Olovely Supermart',
        storeName: 'Olovely Supermart',
        email: 'seller@olovely.com',
        mobile: '9999999999',
        category: 'Grocery',
        categories: ['Grocery', 'Dairy, Bread & Eggs', 'Snacks & Munchies', 'Fruits & Vegetables', 'Personal Care', 'Cleaning Essentials'],
        city: 'Indore',
        address: 'Indore City, Madhya Pradesh, 452001',
        status: 'Approved',
        isShopOpen: true,
        serviceRadiusKm: 500,
        latitude: '22.717650',
        longitude: '75.871860',
        location: {
          type: 'Point',
          coordinates: [75.871860, 22.717650]
        },
        requireProductApproval: false,
        viewCustomerDetails: true,
        commission: 0,
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );
  console.log('✅ Approved Seller:', sellerId);

  // 2. Header Categories
  const headerMap: Record<string, mongoose.Types.ObjectId> = {};
  for (const h of HEADER_CATEGORIES) {
    const existing = await db.collection('headercategories').findOne({ slug: h.slug });
    if (existing) {
      await db.collection('headercategories').updateOne({ _id: existing._id }, { $set: { ...h, updatedAt: new Date() } });
      headerMap[h.slug] = existing._id;
    } else {
      const res = await db.collection('headercategories').insertOne({ ...h, createdAt: new Date(), updatedAt: new Date() });
      headerMap[h.slug] = res.insertedId;
    }
  }
  console.log('✅ Header Categories:', Object.keys(headerMap).length);

  // 3. Categories & Subcategories
  const categoryMap: Record<string, mongoose.Types.ObjectId> = {};
  const subcategoryMap: Record<string, mongoose.Types.ObjectId> = {};

  for (const catData of CATEGORIES_DATA) {
    const headerId = headerMap[catData.headerSlug] || headerMap['grocery'];
    let cat = await db.collection('categories').findOne({ name: catData.name });

    const catDoc = {
      name: catData.name,
      slug: catData.slug,
      image: catData.image,
      headerCategoryId: headerId,
      parentId: null,
      status: 'Active',
      order: catData.order,
      isBestseller: true,
      hasWarning: false,
      updatedAt: new Date(),
    };

    if (cat) {
      await db.collection('categories').updateOne({ _id: cat._id }, { $set: catDoc });
      categoryMap[catData.name] = cat._id;
    } else {
      const res = await db.collection('categories').insertOne({ ...catDoc, createdAt: new Date() });
      categoryMap[catData.name] = res.insertedId;
      cat = { _id: res.insertedId };
    }

    if (catData.subcategories && catData.subcategories.length > 0) {
      for (let sIdx = 0; sIdx < catData.subcategories.length; sIdx++) {
        const subName = catData.subcategories[sIdx];
        const subSlug = subName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        let sub = await db.collection('categories').findOne({ name: subName, parentId: cat._id });

        const subDoc = {
          name: subName,
          slug: subSlug,
          image: catData.image,
          headerCategoryId: headerId,
          parentId: cat._id,
          status: 'Active',
          order: sIdx + 1,
          updatedAt: new Date(),
        };

        if (sub) {
          await db.collection('categories').updateOne({ _id: sub._id }, { $set: subDoc });
          subcategoryMap[`${catData.name}__${subName}`] = sub._id;
        } else {
          const res = await db.collection('categories').insertOne({ ...subDoc, createdAt: new Date() });
          subcategoryMap[`${catData.name}__${subName}`] = res.insertedId;
        }
      }
    }
  }
  console.log('✅ Categories mapped:', Object.keys(categoryMap).length);

  // 4. Products
  const createdProdIds: mongoose.Types.ObjectId[] = [];
  for (const p of PRODUCTS_DATA) {
    const catId = categoryMap[p.category];
    const subcatId = subcategoryMap[`${p.category}__${p.subcategory}`] || catId;
    const headerId = headerMap[p.headerSlug] || headerMap['grocery'];
    const discount = Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100);

    const productDoc = {
      productName: p.productName,
      smallDescription: p.smallDescription,
      description: p.smallDescription,
      category: catId,
      subcategory: subcatId,
      headerCategoryId: headerId,
      seller: sellerId,
      price: p.price,
      discPrice: p.price,
      compareAtPrice: p.compareAtPrice,
      mrp: p.compareAtPrice,
      discount: discount,
      stock: 150,
      mainImage: p.mainImage,
      galleryImages: [p.mainImage],
      pack: p.pack,
      status: 'Active',
      publish: true,
      popular: true,
      dealOfDay: true,
      rating: p.rating,
      reviewsCount: p.reviewsCount,
      isReturnable: true,
      maxReturnDays: 7,
      totalAllowedQuantity: 10,
      tags: p.tags,
      requiresApproval: false,
      isShopByStoreOnly: false,
      variations: [
        {
          name: 'Standard Pack',
          value: p.pack,
          price: p.price,
          discPrice: p.price,
          stock: 150,
          status: 'Available',
        }
      ],
      updatedAt: new Date(),
    };

    let existing = await db.collection('products').findOne({ productName: p.productName });
    if (existing) {
      await db.collection('products').updateOne({ _id: existing._id }, { $set: productDoc });
      createdProdIds.push(existing._id);
    } else {
      const res = await db.collection('products').insertOne({ ...productDoc, createdAt: new Date() });
      createdProdIds.push(res.insertedId);
    }
  }
  console.log('✅ Products seeded in Atlas:', createdProdIds.length);

  // 5. Bestseller Cards
  await db.collection('bestsellercards').deleteMany({});
  const bestsellerCategoryNames = [
    'Atta, Rice & Dal',
    'Dairy, Bread & Eggs',
    'Snacks & Munchies',
    'Fruits & Vegetables',
    'Cold Drinks & Juices',
    'Bakery & Biscuits'
  ];

  const bsDocs = bestsellerCategoryNames.map((cName, idx) => {
    const cId = categoryMap[cName];
    return {
      name: cName,
      category: cId,
      order: idx + 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }).filter(b => b.category);

  if (bsDocs.length > 0) {
    await db.collection('bestsellercards').insertMany(bsDocs);
    console.log('✅ BestsellerCards in Atlas:', bsDocs.length);
  }

  // 6. Lowest Prices Ever
  await db.collection('lowestpricesproducts').deleteMany({});
  const lpDocs = createdProdIds.slice(0, 8).map((pId, idx) => ({
    product: pId,
    order: idx + 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  await db.collection('lowestpricesproducts').insertMany(lpDocs);
  console.log('✅ LowestPricesProducts in Atlas:', lpDocs.length);

  // 7. Shops / Stores
  await db.collection('shops').deleteMany({});
  const SHOPS_DATA = [
    { storeId: 'supermarket-essentials', name: 'Olovely Supermart', image: '/assets/shopbystore/fashion.jpg', order: 1 },
    { storeId: 'dairy-farm-fresh', name: 'Daily Dairy & Bakery', image: '/assets/shopbystore/pet.jpg', order: 2 },
    { storeId: 'snack-refreshment', name: 'Snack & Munchies Hub', image: '/assets/shopbystore/sports.jpg', order: 3 },
    { storeId: 'organic-green', name: 'Farm Fresh Organic', image: '/assets/shopbystore/pharma.jpg', order: 4 },
    { storeId: 'home-cleaning', name: 'Clean Home & Care', image: '/assets/shopbystore/toy.jpg', order: 5 },
    { storeId: 'spiritual-store', name: 'Pooja & Spiritual Needs', image: '/assets/shopbystore/spiritual.jpg', order: 6 },
  ];

  const shopDocs = SHOPS_DATA.map((s, idx) => ({
    ...s,
    products: createdProdIds.slice(idx * 4, (idx + 1) * 4),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  await db.collection('shops').insertMany(shopDocs);
  console.log('✅ Shops in Atlas:', shopDocs.length);

  // 8. PromoStrip
  await db.collection('promostrips').deleteMany({});
  const promoCatCards = [
    { categoryId: categoryMap['Atta, Rice & Dal'], title: 'Atta & Staples', badge: 'Up to 25% OFF', order: 1 },
    { categoryId: categoryMap['Dairy, Bread & Eggs'], title: 'Dairy & Farm', badge: 'Up to 20% OFF', order: 2 },
    { categoryId: categoryMap['Snacks & Munchies'], title: 'Munchies & Snacks', badge: 'Up to 30% OFF', order: 3 },
    { categoryId: categoryMap['Fruits & Vegetables'], title: 'Fresh Produce', badge: 'Up to 40% OFF', order: 4 },
  ].filter(c => c.categoryId);

  await db.collection('promostrips').insertOne({
    headerCategorySlug: 'all',
    heading: 'HOUSEFULL',
    saleText: 'SUPER SAVER SALE',
    crazyDealsTitle: 'CRAZY DEALS',
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    categoryCards: promoCatCards,
    featuredProducts: createdProdIds.slice(0, 6),
    isActive: true,
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log('✅ PromoStrip in Atlas for header "all"');

  console.log('\n🎉 ALL CATALOG DATA COMMITTED TO ATLAS DB!');
  await mongoose.disconnect();
}

seedAtlasCatalog().catch(console.error);
