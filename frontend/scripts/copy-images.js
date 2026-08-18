import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.join(rootDir, 'assets');
// Copy to dist/assets for production builds (Vite will use these)
const publicAssetsDir = path.join(rootDir, 'dist', 'assets');

// Create target assets directory
if (!fs.existsSync(publicAssetsDir)) {
  fs.mkdirSync(publicAssetsDir, { recursive: true });
}

// Image mapping: product/category name -> simplified filename
const imageMap = {
  // Categories
  'Fruits & Vegetables': 'category-fruits-veg.png',
  'Dairy, Bread & Eggs': 'category-dairy.png',
  'Snacks & Munchies': 'category-snacks.png',
  'Cold Drinks & Juices': 'category-drinks.png',
  'Atta, Rice & Dal': 'category-atta-rice.png',
  'Masala, Oil & More': 'category-masala.png',
  'Bakery & Biscuits': 'category-biscuits.png',
  'Personal Care': 'category-personal-care.png',
  'Cleaning Essentials': 'category-cleaning.png',
  'Breakfast & Instant Food': 'category-breakfast.png',

  // Products - Snacks
  'Lay\'s India\'s Magic Masala': 'product-lays-magic-masala.jpg',
  'Lay\'s American Style Cream & Onion': 'product-lays-cream-onion.jpg',
  'Kurkure Solid Masti Masala': 'product-kurkure.jpg',
  'Haldiram\'s Nagpur Sev': 'product-haldiram-sev.jpg',
  'Balaji Ratlami Sev': 'product-balaji-sev.jpg',
  'Doritos Cheese Nachos': 'product-doritos.jpg',
  'Parle Real Elaichi Premium Rusk': 'product-parle-rusk.jpg',
  'Act II Butter Popcorn': 'product-act2-popcorn.jpg',

  // Products - Dairy
  'Amul Salted Butter': 'product-amul-butter.jpg',
  'Britannia Brown Bread': 'product-britannia-bread.jpg',
  'Amul Masti Curd': 'product-amul-curd.jpg',
  'Mother Dairy Classic Curd': 'product-mother-dairy-curd.jpg',
  'Amul Blend Diced Cheese': 'product-amul-cheese.jpg',
  'Table White White Eggs': 'product-eggs.jpg',
  'MTR 3 Minute Poha': 'product-mtr-poha.jpg',
  'MTR Upma Breakfast Mix': 'product-mtr-upma.jpg',

  // Products - Atta/Rice
  'Aashirvaad Superior MP Whole Wheat Atta': 'product-aashirvaad-atta.jpg',
  'Fortune Chakki Fresh': 'product-fortune-atta.jpg',
  'Daawat Pulav Basmati Rice': 'product-daawat-rice.jpg',
  'India Gate Kolam Rice': 'product-india-gate-rice.jpg',
  'Tata Sampann Unpolished Yellow Moong Dal': 'product-tata-moong.jpg',
  'Fortune Indori Thick Poha': 'product-fortune-poha.jpg',
  'Rajdhani Besan': 'product-rajdhani-besan.jpg',
  'Tata Sampann 100% Chana Dal Fine Besan': 'product-tata-besan.jpg',
};

// Copy category images
function copyCategoryImages() {
  const categoryDir = path.join(assetsDir, 'category');
  if (!fs.existsSync(categoryDir)) return;

  const files = fs.readdirSync(categoryDir);
  files.forEach((file) => {
    if (file.endsWith('.png')) {
      const srcPath = path.join(categoryDir, file);
      const categoryName = file.replace('.png', '');
      const destName = imageMap[categoryName] || `category-${file.toLowerCase().replace(/\s+/g, '-')}`;
      const destPath = path.join(publicAssetsDir, destName);
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied category: ${file} -> ${destName}`);
      }
    }
  });
}

// Copy product images (simplified - copy a few key ones)
function copyProductImages() {
  const productBaseDir = path.join(assetsDir, 'Image-20251130T081301Z-1-001', 'Image', 'product', 'product');
  if (!fs.existsSync(productBaseDir)) return;

  // Copy key product images based on our mapping
  const productMappings = [
    // Snacks
    { src: 'Snacks & Munchies/Chips & Crisps/Lay\'s India\'s Magic Masala Potato Chips (40 g)/240092a.jpg', dest: 'product-lays-magic-masala.jpg' },
    { src: 'Snacks & Munchies/Chips & Crisps/Lay\'s American Style Cream & Onion Potato Chips/578b.jpg', dest: 'product-lays-cream-onion.jpg' },
    { src: 'Snacks & Munchies/Chips & Crisps/Kurkure Solid Masti Masala Twisteez Crisps/132817a.jpg', dest: 'product-kurkure.jpg' },
    { src: 'Snacks & Munchies/Bhujia & Mixtures/Haldiram\'s Nagpur Sev Bhujia/Haldiram\'s Nagpur Sev Bhujia.jpg', dest: 'product-haldiram-sev.jpg' },
    { src: 'Snacks & Munchies/Bhujia & Mixtures/Balaji Ratlami Sev Bhujia/Balaji Ratlami Sev Bhujia.jpg', dest: 'product-balaji-sev.jpg' },
    { src: 'Snacks & Munchies/Nachos/Doritos Cheese Nachos - Pack of 2/Doritos Cheese Nachos - Pack of 2.jpg', dest: 'product-doritos.jpg' },
    { src: 'Snacks & Munchies/Rusks & Wafers/Parle Real Elaichi Premium Rusk/Parle Real Elaichi Premium Rusk.jpg', dest: 'product-parle-rusk.jpg' },
    { src: 'Snacks & Munchies/Popcorn/Act II Butter Popcorn/Act II Butter Popcorn.jpg', dest: 'product-act2-popcorn.jpg' },

    // Dairy
    { src: 'Dairy, Bread & Eggs/Butter & More/Amul Salted Butter/Amul Salted Butter.jpg', dest: 'product-amul-butter.jpg' },
    { src: 'Dairy, Bread & Eggs/Bread & Pav/Britannia Brown Bread/Britannia Brown Bread.jpg', dest: 'product-britannia-bread.jpg' },
    { src: 'Dairy, Bread & Eggs/Curd & Yogurt/Amul Masti Curd/Amul Masti Curd.jpg', dest: 'product-amul-curd.jpg' },
    { src: 'Dairy, Bread & Eggs/Curd & Yogurt/Mother Dairy Classic Curd/Mother Dairy Classic Curd.jpg', dest: 'product-mother-dairy-curd.jpg' },
    { src: 'Dairy, Bread & Eggs/cheese/Amul Blend Diced Cheese/Amul Blend Diced Cheese.jpg', dest: 'product-amul-cheese.jpg' },
    { src: 'Dairy, Bread & Eggs/Eggs/Table White White Eggs (10 pieces)/Table White White Eggs (10 pieces).jpg', dest: 'product-eggs.jpg' },
    { src: 'Dairy, Bread & Eggs/Breakfast Mixes/MTR 3 Minute Poha Breakfast Mix - Pack of 5/488706a.jpg', dest: 'product-mtr-poha.jpg' },
    { src: 'Dairy, Bread & Eggs/Breakfast Mixes/MTR Upma Breakfast Mix/MTR Upma Breakfast Mix.jpg', dest: 'product-mtr-upma.jpg' },

    // Atta/Rice
    { src: 'Atta, Rice & Dal/Atta/Aashirvaad Superior MP Whole Wheat Atta/Aashirvaad Superior MP Whole Wheat Atta.jpg', dest: 'product-aashirvaad-atta.jpg' },
    { src: 'Atta, Rice & Dal/Atta/Fortune Chakki Fresh (100% Atta, 0% Maida) Atta/380156b.jpg', dest: 'product-fortune-atta.jpg' },
    { src: 'Atta, Rice & Dal/Rice/Daawat Pulav Basmati Rice (Slender Grains)/Daawat Pulav Basmati Rice (Slender Grains).jpg', dest: 'product-daawat-rice.jpg' },
    { src: 'Atta, Rice & Dal/Rice/India Gate Kolam Rice/India Gate Kolam Rice.jpg', dest: 'product-india-gate-rice.jpg' },
    { src: 'Atta, Rice & Dal/Moong & Masoor/Tata Sampann Unpolished Yellow Moong Dal (Dhuli) Split/57903b.jpg', dest: 'product-tata-moong.jpg' },
    { src: 'Atta, Rice & Dal/Poha, Daliya & Other Grains/Fortune Indori Thick Poha/Fortune Indori Thick Poha.jpg', dest: 'product-fortune-poha.jpg' },
    { src: 'Atta, Rice & Dal/Besan, Sooji & Maida/Rajdhani Besan (1 kg)/Rajdhani Besan (1 kg).jpg', dest: 'product-rajdhani-besan.jpg' },
    { src: 'Atta, Rice & Dal/Besan, Sooji & Maida/Tata Sampann 100% Chana Dal Fine BesanGram Flour/309447b.jpg', dest: 'product-tata-besan.jpg' },
  ];

  productMappings.forEach(({ src, dest }) => {
    const srcPath = path.join(productBaseDir, src);
    const destPath = path.join(publicAssetsDir, dest);
    if (fs.existsSync(srcPath)) {
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied product: ${dest}`);
      }
    } else {
      console.warn(`Not found: ${srcPath}`);
    }
  });
}

// Copy banner image
function copyBannerImage() {
  const bannerPath = path.join(assetsDir, 'banner-mobile.jpg');
  if (fs.existsSync(bannerPath)) {
    const destPath = path.join(publicAssetsDir, 'banner-mobile.jpg');
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(bannerPath, destPath);
      console.log('Copied banner: banner-mobile.jpg');
    }
  }
}

// Copy login video
function copyLoginVideo() {
  const loginDir = path.join(assetsDir, 'login');
  if (!fs.existsSync(loginDir)) return;

  const publicLoginDir = path.join(publicAssetsDir, 'login');
  if (!fs.existsSync(publicLoginDir)) {
    fs.mkdirSync(publicLoginDir, { recursive: true });
  }

  const videoPath = path.join(loginDir, 'loginvideo.mp4');
  if (fs.existsSync(videoPath)) {
    const destPath = path.join(publicLoginDir, 'loginvideo.mp4');
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(videoPath, destPath);
      console.log('Copied login video: loginvideo.mp4');
    }
  }
}

// Copy shopbystore images
function copyShopByStoreImages() {
  const shopbystoreDir = path.join(assetsDir, 'shopbystore');
  if (!fs.existsSync(shopbystoreDir)) return;

  const publicShopbystoreDir = path.join(publicAssetsDir, 'shopbystore');
  if (!fs.existsSync(publicShopbystoreDir)) {
    fs.mkdirSync(publicShopbystoreDir, { recursive: true });
  }

  // Copy main shopbystore images
  const files = fs.readdirSync(shopbystoreDir);
  files.forEach((file) => {
    const filePath = path.join(shopbystoreDir, file);
    const stat = fs.statSync(filePath);

    if (stat.isFile() && (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png'))) {
      const destPath = path.join(publicShopbystoreDir, file);
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(filePath, destPath);
        console.log(`Copied shopbystore: ${file}`);
      }
    } else if (stat.isDirectory()) {
      // Copy subdirectories (like spiritual/)
      const subDir = file;
      const subDirPath = path.join(shopbystoreDir, subDir);
      const publicSubDirPath = path.join(publicShopbystoreDir, subDir);

      if (!fs.existsSync(publicSubDirPath)) {
        fs.mkdirSync(publicSubDirPath, { recursive: true });
      }

      const subFiles = fs.readdirSync(subDirPath);
      subFiles.forEach((subFile) => {
        if (subFile.endsWith('.jpg') || subFile.endsWith('.jpeg') || subFile.endsWith('.png')) {
          const srcPath = path.join(subDirPath, subFile);
          const destPath = path.join(publicSubDirPath, subFile);
          if (!fs.existsSync(destPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied shopbystore/${subDir}: ${subFile}`);
          }
        }
      });
    }
  });
}

// Copy olovely logo & background & manifest icons
function copyOlovelyLogo() {
  const files = ['olovelylogo.jpeg', 'olovelylogo.png', 'olovelylogo_transparent.png', 'login_background_mobile.jfif', 'favicon-circle.png', 'favicon-circle-192.png', 'favicon-circle-64.png', 'favicon-circle-32.png', 'favicon-squircle.png'];
  files.forEach((file) => {
    // Check public/assets first, then assetsDir
    const publicAssetPath = path.join(__dirname, '../public/assets', file);
    const srcPath = fs.existsSync(publicAssetPath) ? publicAssetPath : path.join(assetsDir, file);
    if (fs.existsSync(srcPath)) {
      const destPath = path.join(publicAssetsDir, file);
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied asset: ${file}`);
    }
  });

  // Ensure public/logo192.png, public/logo512.png, public/favicon.ico exist for manifest with white background
  const publicDir = path.join(__dirname, '../public');
  const sourceFavicon = path.join(publicDir, 'assets', 'favicon-circle.png');
  if (fs.existsSync(sourceFavicon)) {
    const manifestIcons = ['logo192.png', 'logo512.png', 'favicon.ico', 'favicon.png'];
    manifestIcons.forEach((iconName) => {
      const target = path.join(publicDir, iconName);
      fs.copyFileSync(sourceFavicon, target);
      console.log(`Created manifest icon: ${iconName}`);
    });
  }
}

// Copy delivery boy icon
function copyDeliveryIcon() {
  const deliveryboyDir = path.join(assetsDir, 'deliveryboy');
  if (!fs.existsSync(deliveryboyDir)) return;

  const publicDeliveryboyDir = path.join(publicAssetsDir, 'deliveryboy');
  if (!fs.existsSync(publicDeliveryboyDir)) {
    fs.mkdirSync(publicDeliveryboyDir, { recursive: true });
  }

  const iconPath = path.join(deliveryboyDir, 'deliveryIcon.png');
  if (fs.existsSync(iconPath)) {
    const destPath = path.join(publicDeliveryboyDir, 'deliveryIcon.png');
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(iconPath, destPath);
      console.log('Copied delivery icon: deliveryIcon.png');
    }
  }
}

// Main execution
console.log('Starting image copy process...');
copyCategoryImages();
copyProductImages();
copyBannerImage();
copyShopByStoreImages();
copyLoginVideo();
copyOlovelyLogo();
copyDeliveryIcon();
console.log('Image copy completed!');


