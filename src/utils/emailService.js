import nodemailer from "nodemailer";

// Create transporter for one.com
const transporter = nodemailer.createTransport({
  host: "send.one.com", // SMTP server
  port: 465, // SSL port
  secure: true, // true for port 465
  auth: {
    user: process.env.SMTP_USER, // support@saxonfinder.com
    pass: process.env.SMTP_PASS, // hexrib-jyjmoc-8powpA
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
  console.log("Email sent successfully:", info.messageId);
  return info;
};
