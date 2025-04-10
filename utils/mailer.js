const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,        
    pass: process.env.MAIL_PASSWORD     
  }
});

const sendEmail = async (to, subject, text) => {
  const mailOptions = {
    from: process.env.MAIL_USER,
    to,
    subject,
    text
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Correo enviado a: ${to}`);
  } catch (error) {
    console.error('❌ Error al enviar el correo:', error);
    throw error;
  }
};

module.exports = sendEmail;
