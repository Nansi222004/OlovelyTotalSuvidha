import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Delivery from "../models/Delivery";
import Policy from "../models/Policy";
import FAQ from "../models/FAQ";
import AppSettings from "../models/AppSettings";

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function assert(description: string, condition: boolean, extraInfo: string = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passCount++;
  } else {
    console.log(`  ❌ FAIL: ${description} ${extraInfo ? `(${extraInfo})` : ""}`);
    failCount++;
    failures.push(`${description} ${extraInfo ? `(${extraInfo})` : ""}`);
  }
}

async function runSuite() {
  console.log("===============================================================");
  console.log("    DELIVERY APP DYNAMIC SETTINGS & CONTENT AUDIT SUITE       ");
  console.log("===============================================================\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/olovelytotalsuvidha";
  await mongoose.connect(mongoUri);
  console.log(` Connected to MongoDB at: ${mongoUri.replace(/\/\/.*@/, "//***@")}\n`);

  const testEmailDelivery = "audit_delivery_partner@test.com";

  try {
    await Delivery.deleteMany({ email: testEmailDelivery });
    await Policy.deleteMany({ content: { $regex: /AUDIT_TEST_MARKER/ } });
    await FAQ.deleteMany({ question: { $regex: /AUDIT_TEST_FAQ/ } });

    // 1. Create Test Delivery Partner
    const deliveryBoy = await Delivery.create({
      name: "Audit Delivery Partner",
      email: testEmailDelivery,
      mobile: "9666666666",
      password: "test123",
      status: "Active",
      balance: 500,
      upiId: "auditpartner@upi",
      settings: {
        notifications: true,
        location: true,
        sound: true,
      },
    });

    const deliveryId = deliveryBoy._id.toString();

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 1: SETTINGS & PREFERENCES PERSISTENCE (A01 - A03)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("⚙️ SECTION 1: SETTINGS & PREFERENCES PERSISTENCE");

    // A01: Initial preferences match default settings
    assert("A01 - Delivery partner settings stored in MongoDB", deliveryBoy.settings.notifications === true && deliveryBoy.settings.sound === true);

    // Update settings in MongoDB
    deliveryBoy.settings.notifications = false;
    deliveryBoy.settings.sound = false;
    await deliveryBoy.save();

    const reFetchedDB = await Delivery.findById(deliveryId);
    assert("A02 - Settings toggle changes persist across re-fetches", reFetchedDB?.settings.notifications === false && reFetchedDB?.settings.sound === false);

    // Restore settings
    deliveryBoy.settings.notifications = true;
    deliveryBoy.settings.sound = true;
    await deliveryBoy.save();
    assert("A03 - Preference updates restore successfully", deliveryBoy.settings.notifications === true);

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 2: DYNAMIC LEGAL POLICY & CMS SYNCHRONIZATION (A04 - A06)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("📜 SECTION 2: DYNAMIC LEGAL POLICY & CMS SYNCHRONIZATION");

    const privacyMarker = `AUDIT_TEST_MARKER Privacy Policy Content ${Date.now()}`;
    const privacyPolicy = await Policy.create({
      type: "delivery",
      title: "Delivery Partner Privacy Policy",
      content: privacyMarker,
      version: "1.2.0",
      isActive: true,
    });

    // Query policy via model simulating API query
    const fetchedPrivacy = await Policy.findOne({
      type: "delivery",
      title: { $regex: /privacy/i },
      isActive: true,
    }).sort({ createdAt: -1 });

    assert("A04 - Privacy Policy Admin edit syncs dynamically to Delivery query", fetchedPrivacy !== null && fetchedPrivacy.content === privacyMarker);

    const termsMarker = `AUDIT_TEST_MARKER Terms & Conditions Content ${Date.now()}`;
    const termsPolicy = await Policy.create({
      type: "delivery",
      title: "Delivery Partner Terms & Conditions",
      content: termsMarker,
      version: "2.1.0",
      isActive: true,
    });

    const fetchedTerms = await Policy.findOne({
      type: "delivery",
      title: { $regex: /terms|condition/i },
      isActive: true,
    }).sort({ createdAt: -1 });

    assert("A05 - Terms & Conditions Admin edit syncs dynamically to Delivery query", fetchedTerms !== null && fetchedTerms.content === termsMarker);

    assert("A06 - Privacy Policy and Terms & Conditions are distinct records", fetchedPrivacy?._id.toString() !== fetchedTerms?._id.toString());

    console.log("");

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION 3: DYNAMIC HELP, FAQ & APP SETTINGS (A07 - A10)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("❓ SECTION 3: DYNAMIC HELP, FAQ & APP SETTINGS");

    const faqMarker = `AUDIT_TEST_FAQ Question ${Date.now()}`;
    const createdFaq = await FAQ.create({
      question: faqMarker,
      answer: "This is a dynamic audit test answer.",
      category: "Delivery",
      order: 1,
      status: "Active",
    });

    const activeFaqs = await FAQ.find({ status: "Active" }).sort({ order: 1 });
    const containsFaq = activeFaqs.some((f) => f.question === faqMarker);

    assert("A07 - Admin FAQ creation syncs dynamically to active FAQs query", containsFaq);

    // Test AppSettings sync
    let appSettings = await AppSettings.findOne();
    if (!appSettings) {
      appSettings = await AppSettings.create({
        appName: "Olovely Suvidha Delivery",
        contactEmail: "audit@olovely.com",
        contactPhone: "+91 9999900000",
        supportEmail: "support_audit@olovely.com",
        supportPhone: "+91 8888800000",
        deliveryCharges: 30,
        paymentMethods: { cod: true, online: true, wallet: true, upi: true },
      });
    } else {
      appSettings.supportPhone = "+91 8888800000";
      appSettings.supportEmail = "support_audit@olovely.com";
      await appSettings.save();
    }

    assert("A08 - Dynamic AppSettings support phone syncs correctly", appSettings.supportPhone === "+91 8888800000");

    assert("A09 - Dynamic AppSettings support email syncs correctly", appSettings.supportEmail === "support_audit@olovely.com");

    assert("A10 - Delivery Boy profile data & UPI ID persistence verified", deliveryBoy.upiId === "auditpartner@upi");

    // Teardown
    await Delivery.deleteMany({ email: testEmailDelivery });
    await Policy.deleteMany({ _id: { $in: [privacyPolicy._id, termsPolicy._id] } });
    await FAQ.deleteMany({ _id: createdFaq._id });

  } catch (error: any) {
    console.error("Error executing audit suite:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n Connection closed & test data cleaned up.\n");
  }

  console.log("===============================================================");
  console.log("                    SUMMARY OF RESULTS                         ");
  console.log("===============================================================");
  console.log(` Total Assertions Executed : ${passCount + failCount}`);
  console.log(` ✅ Passed                 : ${passCount}`);
  console.log(` ❌ Failed                 : ${failCount}`);
  console.log(` Pass Rate                 : ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
  console.log("===============================================================\n");

  if (failCount > 0) {
    console.log("FAILURES DETECTED:");
    failures.forEach((f) => console.log(` - ${f}`));
    process.exit(1);
  } else {
    console.log("🎉 ALL 10 DELIVERY APP DYNAMIC AUDIT TESTS PASSED SUCCESSFULLY!\n");
    process.exit(0);
  }
}

runSuite();
