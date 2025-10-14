import nodemailer from "nodemailer";

// Reusable transporter (Ethereal for now, later you can replace with real SMTP)
const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
        user: 'dustin.wintheiser50@ethereal.email',
        pass: 'JuubYJRabrJZbgqFWR'
    }
});

// Function to send approval email with random password
export const sendAgentApprovalEmail = async (to, firstName, password) => {
  const mailOptions = {
    from: '"Agent Platform" <no-reply@agent.com>',
    to,
    subject: "Your Agent Account has been Approved 🎉",
    html: `
      <h2>Welcome to Agent Platform, ${firstName}!</h2>
      <p>Your account has been approved by admin.</p>
      <p><strong>Temporary Password:</strong> ${password}</p>
      <p>Please log in using this password and change it from your profile settings immediately.</p>
      <br/>
      <p>Regards,<br/>Agent Platform Team</p>
    `,
  };

  const info = await transporter.sendMail(mailOptions);

  console.log("Preview URL: " + nodemailer.getTestMessageUrl(info));
  return info;
};
