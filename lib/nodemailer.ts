import nodemailer from 'nodemailer';

export const summitMailer = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SUMMIT_GMAIL_USER,
    pass: process.env.SUMMIT_GMAIL_APP_PASSWORD,
  },
});
