import { Request, Response } from "express";
import CustomerSupportRequest from "../../../models/CustomerSupportRequest";
import Customer from "../../../models/Customer";
import { sendSupportEmail } from "../../../services/emailService";

/**
 * Submit Customer Support / Contact Form
 * POST /api/customer/support/contact or POST /customer/support/contact
 */
export const submitCustomerSupport = async (req: Request, res: Response) => {
  try {
    let { name, email, subject, message } = req.body;

    // 1. Sanitize & trim inputs
    name = (name || "").trim().replace(/[\r\n]/g, " ");
    email = (email || "").trim().toLowerCase().replace(/[\r\n]/g, "");
    subject = (subject || "").trim().replace(/[\r\n]/g, " ");
    message = (message || "").trim();

    // 2. Validate fields
    if (!name || name.length < 2 || name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid name (2-100 characters).",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (!subject || subject.length < 3 || subject.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid subject (3-200 characters).",
      });
    }

    if (!message || message.length < 10 || message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Please describe your issue (10-2000 characters).",
      });
    }

    // 3. Extract authenticated customer ID if present
    let customerId: string | undefined = undefined;
    if (req.user?.userId) {
      customerId = req.user.userId;
      // Fetch customer profile to confirm identity if needed
      try {
        const custDoc = await Customer.findById(customerId).select("name email");
        if (custDoc) {
          // Verify customer identity
          if (!name) name = custDoc.name;
          if (!email) email = custDoc.email;
        }
      } catch (err) {
        console.warn("[SUPPORT CONTROLLER] Unable to fetch customer profile:", err);
      }
    }

    // 4. Save Customer Support Request to MongoDB
    const supportRequest = new CustomerSupportRequest({
      customer: customerId,
      name,
      email,
      subject,
      message,
      status: "Pending",
      emailSent: false,
    });
    await supportRequest.save();

    // 5. Send Support Email via Nodemailer
    console.log(`[SUPPORT CONTROLLER] Sending support email for Request ID: ${supportRequest._id}`);
    const emailResult = await sendSupportEmail({
      name,
      email,
      subject,
      message,
      customerId,
      submittedAt: supportRequest.createdAt,
    });

    if (emailResult.success) {
      supportRequest.emailSent = true;
      supportRequest.emailMessageId = emailResult.messageId;
      await supportRequest.save();

      return res.status(200).json({
        success: true,
        message: "Your support request has been sent successfully. Our support team will get back to you.",
        data: {
          requestId: supportRequest._id,
        },
      });
    } else {
      console.error(`[SUPPORT CONTROLLER ERROR] Email delivery failed for Request ID ${supportRequest._id}: ${emailResult.error}`);
      return res.status(500).json({
        success: false,
        message: "Unable to send your message right now. Please try again later.",
      });
    }
  } catch (error: any) {
    console.error("[SUPPORT CONTROLLER EXCEPTION]", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred while submitting your support request.",
    });
  }
};
