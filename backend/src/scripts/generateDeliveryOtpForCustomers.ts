import dotenv from "dotenv";
import mongoose from "mongoose";
import Customer from "../models/Customer";
import connectDB from "../config/db";

dotenv.config();

/**
 * Generate random 4-digit OTP (1000-9999)
 */
function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Main script to generate delivery OTPs for existing customers who don't have one
 */
async function generateDeliveryOtpForCustomers() {
  const isDryRun = process.argv.includes("--dry-run");

  if (isDryRun) {
    console.log("\n🔍 DRY RUN MODE - No changes will be made\n");
  }

  try {
    await connectDB();

    // Find all customers without a deliveryOtp
    const customersWithoutOtp = await Customer.find({
      $or: [
        { deliveryOtp: { $exists: false } },
        { deliveryOtp: null },
        { deliveryOtp: "" },
      ],
    }).select("_id name phone");

    const totalCustomers = await Customer.countDocuments();
    const customersNeedingOtp = customersWithoutOtp.length;

    console.log(`📊 Total customers in database: ${totalCustomers}`);
    console.log(`📋 Customers without delivery OTP: ${customersNeedingOtp}`);

    if (customersNeedingOtp === 0) {
      console.log("\n✅ All customers already have delivery OTPs. Nothing to do.\n");
      process.exit(0);
    }

    if (isDryRun) {
      console.log("\n📝 Customers that would be updated:");
      customersWithoutOtp.slice(0, 10).forEach((c) => {
        console.log(`   - ${c.name} (${c.phone})`);
      });
      if (customersWithoutOtp.length > 10) {
        console.log(`   ... and ${customersWithoutOtp.length - 10} more`);
      }
      console.log("\n🔍 Dry run complete. Run without --dry-run to apply changes.\n");
      process.exit(0);
    }

    // Generate OTPs and prepare bulk operations
    console.log("\n⏳ Generating delivery OTPs...\n");

    const bulkOps = customersWithoutOtp.map((customer) => ({
      updateOne: {
        filter: { _id: customer._id },
        update: { $set: { deliveryOtp: generateOtp() } },
      },
    }));

    // Execute bulk update
    const result = await Customer.bulkWrite(bulkOps);

    console.log("✅ Delivery OTP generation complete!");
    console.log(`   📊 Modified: ${result.modifiedCount} customers`);
    console.log(`   📊 Matched: ${result.matchedCount} customers\n`);

    // Verify by showing a few examples
    const updatedSamples = await Customer.find({
      _id: { $in: customersWithoutOtp.slice(0, 3).map((c) => c._id) },
    }).select("name phone deliveryOtp");

    if (updatedSamples.length > 0) {
      console.log("📌 Sample updated customers:");
      updatedSamples.forEach((c) => {
        console.log(`   - ${c.name} (${c.phone}): OTP = ${c.deliveryOtp}`);
      });
      console.log("");
    }

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error generating delivery OTPs:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

generateDeliveryOtpForCustomers();

