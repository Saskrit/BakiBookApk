import getTransporter from '../config/email.js';

const fromAddress = () =>
  process.env.EMAIL_FROM || `BakiBook <${process.env.EMAIL_USER}>`;

const baseTemplate = (title, content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Inter, Arial, sans-serif; background: #F5F5F5; margin: 0; padding: 24px; }
    .card { max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e8e0e0; }
    .header { background: #454040; color: #fff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; color: #C08552; }
    .body { padding: 28px 24px; color: #333; line-height: 1.6; }
    .btn { display: inline-block; margin-top: 20px; padding: 12px 28px; background: #C08552; color: #fff !important; text-decoration: none; border-radius: 8px; font-weight: 600; }
    .footer { padding: 16px 24px; text-align: center; font-size: 12px; color: #888; background: #FBF6F6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header"><h1>BakiBook</h1><p style="margin:8px 0 0;opacity:0.85;font-size:14px;">Digital Baki, Smart Pasal</p></div>
    <div class="body">
      <h2 style="margin-top:0;color:#454040;">${title}</h2>
      ${content}
    </div>
    <div class="footer">&copy; ${new Date().getFullYear()} BakiBook. All rights reserved.</div>
  </div>
</body>
</html>
`;

export const sendWelcomeEmail = async ({ fullName, email, role }) => {
  const roleLabel = role === 'shopkeeper' ? 'Shopkeeper' : 'Customer';

  const html = baseTemplate(
    `Welcome, ${fullName}!`,
    `<p>Your BakiBook account has been created as a <strong>${roleLabel}</strong>.</p>
     <p>You can now manage credit, track payments, and build trust with every transaction.</p>`
  );

  await getTransporter().sendMail({
    from: fromAddress(),
    to: email,
    subject: 'Welcome to BakiBook!',
    html,
  });
};

export const sendVerificationEmail = async ({ fullName, email }, rawTokenOrCode) => {
  const isCode = /^\d{6}$/.test(String(rawTokenOrCode || ''));

  const content = isCode
    ? `<p>Hi ${fullName},</p>
       <p>Enter this verification code in BakiBook to finish creating your account:</p>
       <div style="margin:24px 0;padding:16px;text-align:center;background:#FBF6F6;border-radius:8px;font-size:30px;font-weight:700;letter-spacing:8px;color:#454040;">${rawTokenOrCode}</div>
       <p style="font-size:13px;color:#666;">This code expires in 15 minutes.<br/>If you did not try to create an account, you can ignore this email.</p>`
    : (() => {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        const verifyUrl = `${clientUrl}/verify-email/${rawTokenOrCode}`;
        return `       <p>Hi ${fullName},</p>
       <p>Click the button below to verify your existing BakiBook account email (one-time link):</p>
       <a class="btn" href="${verifyUrl}">Verify Email</a>
       <p style="margin-top:24px;font-size:13px;color:#666;">This link expires in 24 hours.<br/>New signups use a 6-digit code instead of this link.</p>`;
      })();

  const html = baseTemplate('Verify Your Email', content);

  await getTransporter().sendMail({
    from: fromAddress(),
    to: email,
    subject: isCode ? 'Your BakiBook verification code' : 'Verify your BakiBook email',
    html,
  });
};

export const sendEmailChangeCode = async ({ fullName }, email, code) => {
  const html = baseTemplate(
    'Confirm Your New Email',
    `<p>Hi ${fullName},</p>
     <p>Enter this confirmation code in BakiBook to change your account email:</p>
     <div style="margin:24px 0;padding:16px;text-align:center;background:#FBF6F6;border-radius:8px;font-size:30px;font-weight:700;letter-spacing:8px;color:#454040;">${code}</div>
     <p style="font-size:13px;color:#666;">This code expires in 10 minutes. If you did not request this change, you can ignore this email and your current email will remain unchanged.</p>`
  );

  await getTransporter().sendMail({
    from: fromAddress(),
    to: email,
    subject: 'Confirm your new BakiBook email',
    html,
  });
};

export const sendPasswordResetEmail = async ({ fullName, email }, rawToken) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const resetUrl = `${clientUrl}/reset-password/${rawToken}`;

  const html = baseTemplate(
    'Reset Your Password',
    `<p>Hi ${fullName},</p>
     <p>We received a request to reset your password. Click below to set a new one:</p>
     <a class="btn" href="${resetUrl}">Reset Password</a>
     <p style="margin-top:24px;font-size:13px;color:#666;">This link expires in 1 hour.</p>`
  );

  await getTransporter().sendMail({
    from: fromAddress(),
    to: email,
    subject: 'Reset your BakiBook password',
    html,
  });
};
