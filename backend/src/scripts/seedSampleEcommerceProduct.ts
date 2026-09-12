import mongoose from "mongoose";
import Product from "../models/Product";
import Seller from "../models/Seller";
import Category from "../models/Category";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const category = await Category.findOne({});

  let seller = await Seller.findOne({ vendorType: "ECOMMERCE" });
  if (!seller) {
    seller = await Seller.create({
      sellerName: "National Electronics Direct",
      storeName: "National Electronics Store",
      email: "national.seller@example.com",
      mobile: "9876500001",
      password: "password123",
      category: category ? category._id : undefined,
      vendorType: "ECOMMERCE",
      serviceRadiusKm: 50,
      pickupPincode: "110001",
      pickupAddress: "Warehouse 4A, Okhla Industrial Area, New Delhi",
      shippingConfig: {
        provider: "MockExpress",
        shippingFee: 40,
        freeShippingThreshold: 499,
      },
    });
    console.log("Created Ecommerce seller:", seller._id);
  }

  let product = await Product.findOne({ productType: "ECOMMERCE" });
  if (!product) {
    product = await Product.create({
      productName: "Premium Wireless Bluetooth Headphones",
      description: "High-fidelity sound, active noise cancellation, 30-hour battery life. Shipped via courier with tracking.",
      price: 899,
      mrp: 1499,
      stock: 50,
      productType: "ECOMMERCE",
      productSource: "LOCAL_VENDOR",
      category: category ? category._id : undefined,
      seller: seller._id,
      packageDetails: {
        weightKg: 0.85,
        dimensionsCm: {
          length: 22,
          width: 15,
          height: 10,
        },
      },
      variations: [
        {
          title: "Matte Black",
          value: "Matte Black",
          price: 899,
          discPrice: 899,
          stock: 30,
          status: "Available",
        },
      ],
      publish: true,
      status: "Active",
    });
    console.log("Created Ecommerce product:", product.productName, product._id);
  } else {
    console.log("Existing Ecommerce product found:", product.productName, product._id);
  }

  await mongoose.disconnect();
}

run();
