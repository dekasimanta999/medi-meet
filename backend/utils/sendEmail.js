const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  try {
    const senderEmail = process.env.EMAIL_USER || "medimeet.support@gmail.com";
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: senderEmail,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: options.from || `"Medi Meet Support" <${senderEmail}>`,
      to: options.email,
      subject: options.subject,
      html: options.html || `<p>${options.message}</p>`,
    };

    if (options.attachments) {
      mailOptions.attachments = options.attachments;
    }

    const info = await transporter.sendMail(mailOptions);

    console.log(`Email successfully sent to ${options.email}`);
    console.log("Message ID:", info.messageId);

    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Email could not be sent");
  }
};

module.exports = sendEmail;
