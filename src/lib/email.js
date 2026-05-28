const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendConfirmationEmail(email, token) {
  const confirmUrl = `${process.env.APP_URL}/api/auth/confirm-email?token=${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Confirm your email",
    html: `
      <h2>Confirm your email</h2>
      <p>Please click the link below to confirm your account:</p>
      <a href="${confirmUrl}">${confirmUrl}</a>
    `,
  });
}

module.exports = {
  sendConfirmationEmail,
};