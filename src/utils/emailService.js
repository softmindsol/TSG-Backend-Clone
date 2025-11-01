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

export const sendSubAgentInviteEmail = async (to, captainName, subAgentName) => {
  const mailOptions = {
    from: `"Saxon Finder" <${process.env.FROM_EMAIL}>`,
    to,
    subject: "Invitation to Join Saxon Finder Team 🚀",
    html: `
      <h2>Hello ${subAgentName || "there"},</h2>
      <p>You’ve been invited by <strong>${captainName}</strong> to join their team on <strong>Saxon Finder</strong>.</p>
      <p>As part of the team, you'll have access to your personalized dashboard to manage clients and listings.</p>
      <br/>
      <p><a href="${process.env.FRONTEND_URL}/register?email=${encodeURIComponent(to)}" 
            style="background-color:#4159D8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
        Accept Invitation
      </a></p>
      <br/>
      <p>If you didn’t expect this invitation, you can ignore this email.</p>
      <p>Best regards,<br/>Saxon Finder Support Team</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Invitation email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Failed to send invitation email:", error);
    throw new Error("Email sending failed");
  }
};

