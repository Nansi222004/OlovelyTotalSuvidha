import dotenv from "dotenv";
import Delivery from "../models/Delivery";
import connectDB from "../config/db";

dotenv.config();

async function seedDelivery() {
  try {
    await connectDB();

    const mobile = "9876543210";
    const existing = await Delivery.findOne({ mobile });

    if (existing) {
      console.log(`Delivery partner with mobile ${mobile} already exists.`);
      process.exit(0);
    }

    await Delivery.create({
      name: "Demo Delivery Partner",
      mobile: mobile,
      email: "delivery@Dhakad Snazzy.com",
      password: "password123",
      status: "Active",
      balance: 100,
      cashCollected: 0,
    });

    console.log(`✓ Delivery partner created successfully.`);
    console.log(`  Mobile: ${mobile}`);
    console.log(`  Password: password123`);

    process.exit(0);
  } catch (error) {
    console.error("Error seeding delivery partner:", error);
    process.exit(1);
  }
}

seedDelivery();

