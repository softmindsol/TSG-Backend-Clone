import nodemailer from "nodemailer";
import dotenv from "dotenv";
// Create transporter for one.com using env variables
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // e.g. send.one.com
  port: Number(process.env.SMTP_PORT), // e.g. 465
  secure: Number(process.env.SMTP_PORT) === 465, // true for SSL (465), false for STARTTLS (587)
  auth: {
    user: process.env.SMTP_USER, // e.g. support@saxonfinder.com
    pass: process.env.SMTP_PASS, // your SMTP password
  },
  logger: true,
  debug: true,
});

// Function to send approval email with random password
export const sendAgentApprovalEmail = async (to, firstName, password) => {
  const mailOptions = {
    from: `"Saxon Finder" <${process.env.FROM_EMAIL}>`,
    to,
    subject: "Your Agent Account has been Approved 🎉",
    html: `
      <h2>Welcome to Saxon Finder, ${firstName}!</h2>
      <p>Your account has been approved by the admin.</p>
      <p><strong>Temporary Password:</strong> ${password}</p>
      <p>Please log in using this password and change it from your profile settings immediately.</p>
      <br/>
      <p>Best regards,<br/>Saxon Finder Support Team</p>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("✅ Email sent successfully:", info.messageId);
  return info;
};
