import nodemailer from 'nodemailer';

let transporter = null;

const getEmailConfig = () => ({
  host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || process.env.SMTP_USER,
    pass: process.env.EMAIL_PASSWORD || process.env.SMTP_PASS,
  },
});

export const isEmailConfigured = () => {
  const cfg = getEmailConfig();
  return Boolean(cfg.auth.user && cfg.auth.pass);
};

export const getEmailTransporter = () => {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport(getEmailConfig());
  transporter.verify((error) => {
    if (error) {
      console.error('SMTP verification failed:', error.message);
    }
  });

  return transporter;
};

export const getDefaultFrom = () => {
  return process.env.EMAIL_FROM || process.env.EMAIL_USER || process.env.SMTP_USER || 'noreply@localhost';
};