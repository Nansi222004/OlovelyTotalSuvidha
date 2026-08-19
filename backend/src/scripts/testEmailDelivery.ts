import dotenv from 'dotenv';
dotenv.config();

import { sendSupportEmail } from '../services/emailService';

async function testEmail() {
  console.log("=== TESTING ACTUAL EMAIL DELIVERY TO OLOVELYTOTALSUVIDHA@GMAIL.COM ===");
  console.log("SMTP Config:", {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    hasPass: !!process.env.SMTP_PASS,
  });

  const res = await sendSupportEmail({
    name: "Ritik Tiwari (Test)",
    email: "customer@gmail.com",
    subject: "Issue with my return",
    message: "Hello Olovely Support Team,\n\nThis is a test support message submitted from the Olovely Customer Application.\nPlease verify that the Reply-To header is set to customer@gmail.com.\n\nThank you!",
    customerId: "6a7e05ddd9341125c8a8dea9",
    submittedAt: new Date(),
  });

  console.log("Result:", res);
}

testEmail().catch(console.error);
