import nodemailer from "nodemailer";

let customTransporter: nodemailer.Transporter | null = null;

export function setCustomTransporter(transporter: nodemailer.Transporter | null): void {
  customTransporter = transporter;
}

export function getTransporter(): nodemailer.Transporter {
  if (customTransporter) {
    return customTransporter;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true", // false for port 587
    auth: {
      user: process.env.SMTP_USER || "olovelytotalsuvidha@gmail.com",
      pass: process.env.SMTP_PASS || "",
    },
  });
}

export interface ISendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(options: ISendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Safety guard: if running in test environment and no mock transporter is injected, do NOT send real email!
    if (process.env.NODE_ENV === "test" && !customTransporter) {
      console.log(`[EMAIL SERVICE SAFETY] Test mode active without mock transporter. Skipping real email transmission to ${options.to}`);
      return { success: true, messageId: `mock-test-${Date.now()}` };
    }

    const transporter = getTransporter();
    const mailOptions = {
      from: `"${process.env.MAIL_FROM_NAME || 'Olovely Total Suvidha'}" <${process.env.MAIL_FROM || 'olovelytotalsuvidha@gmail.com'}>`,
      to: options.to,
      replyTo: options.replyTo,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SERVICE] Email "${options.subject}" sent to ${options.to}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[EMAIL SERVICE ERROR] Failed to send email "${options.subject}" to ${options.to}:`, error.message);
    return { success: false, error: error.message || "Failed to send email" };
  }
}

export interface ISupportEmailPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
  customerId?: string;
  submittedAt?: Date;
}

export async function sendSupportEmail(payload: ISupportEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = getTransporter();

    const mailOptions = {
      from: `"${process.env.MAIL_FROM_NAME || 'Olovely Total Suvidha'}" <${process.env.MAIL_FROM || 'olovelytotalsuvidha@gmail.com'}>`,
      to: "olovelytotalsuvidha@gmail.com",
      replyTo: payload.email,
      subject: `[Olovely Support] ${payload.subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #16a34a; color: #ffffff; padding: 16px 24px;">
            <h2 style="margin: 0; font-size: 20px;">Olovely Total Suvidha</h2>
            <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Customer Support Request</p>
          </div>
          <div style="padding: 24px; background-color: #ffffff;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px; width: 140px; font-weight: bold;">Customer Name:</td>
                <td style="padding: 8px 0; color: #111; font-size: 14px;">${escapeHtml(payload.name)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px; font-weight: bold;">Customer Email:</td>
                <td style="padding: 8px 0; color: #111; font-size: 14px;"><a href="mailto:${escapeHtml(payload.email)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(payload.email)}</a></td>
              </tr>
              ${payload.customerId ? `
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px; font-weight: bold;">Customer ID:</td>
                <td style="padding: 8px 0; color: #111; font-size: 14px; font-family: monospace;">${escapeHtml(payload.customerId)}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px; font-weight: bold;">Subject:</td>
                <td style="padding: 8px 0; color: #111; font-size: 14px; font-weight: bold;">${escapeHtml(payload.subject)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666; font-size: 14px; font-weight: bold;">Submitted At:</td>
                <td style="padding: 8px 0; color: #111; font-size: 14px;">${(payload.submittedAt || new Date()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
              </tr>
            </table>

            <div style="border-top: 1px solid #eee; margin-top: 16px; padding-top: 16px;">
              <h4 style="margin: 0 0 8px 0; color: #444; font-size: 14px;">Message:</h4>
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #1f2937;">
${escapeHtml(payload.message)}
              </div>
            </div>
          </div>
          <div style="background-color: #f3f4f6; color: #6b7280; padding: 12px 24px; font-size: 12px; text-align: center; border-top: 1px solid #e5e7eb;">
            This message was submitted through the Olovely customer application support form.
          </div>
        </div>
      `,
      text: `
Olovely Total Suvidha - Customer Support Request
------------------------------------------------
Customer Name: ${payload.name}
Customer Email: ${payload.email}
${payload.customerId ? `Customer ID: ${payload.customerId}\n` : ''}
Subject: ${payload.subject}
Submitted At: ${(payload.submittedAt || new Date()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

Message:
${payload.message}

------------------------------------------------
This message was submitted through the Olovely customer application.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SERVICE] Support email sent successfully. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("[EMAIL SERVICE ERROR] Failed to send support email:", error);
    return { success: false, error: error.message || "Failed to send email" };
  }
}

export function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
