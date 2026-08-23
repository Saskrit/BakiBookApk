import nodemailer from 'nodemailer';

let transporter;

/** Gmail from Render often stalls without short timeouts — keep auth APIs responsive. */
const SMTP_TIMEOUT_MS = 10000;

const getTransporter = () => {
  if (transporter) return transporter;

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASSWORD?.replace(/\s/g, '');

  if (!user || !pass) {
    throw new Error('Email credentials not configured in .env');
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
    // Avoid a stuck pooled connection blocking later signups.
    pool: false,
  });

  return transporter;
};

export const resetTransporter = () => {
  if (transporter) {
    try {
      transporter.close();
    } catch {
      // ignore
    }
  }
  transporter = undefined;
};

export const verifyEmailConnection = async () => {
  const transport = getTransporter();
  await transport.verify();
  console.log(`Email service ready — sending from ${process.env.EMAIL_USER}`);
};

export { SMTP_TIMEOUT_MS };
export default getTransporter;
