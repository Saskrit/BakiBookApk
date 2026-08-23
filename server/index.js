import './config/env.js';
import express from 'express';
import http from 'http';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import User from './models/User.js';
import Customer from './models/Customer.js';
import Product from './models/Product.js';
import Expense from './models/Expense.js';
import { initSocket } from './config/socket.js';
import authRoutes from './routes/authRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import geocodeRoutes from './routes/geocodeRoutes.js';
import legalRoutes from './routes/legalRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import ledgerRoutes from './routes/ledgerRoutes.js';
import shopRoutes from './routes/shopRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import portalRoutes from './routes/portalRoutes.js';
import linkRoutes from './routes/linkRoutes.js';
import qrRoutes from './routes/qrRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import sharedRoutes from './routes/sharedRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import paymentSubmissionRoutes from './routes/paymentSubmissionRoutes.js';
import paymentVisibilityRoutes from './routes/paymentVisibilityRoutes.js';
import { seedLegalDocuments } from './utils/seedLegal.js';
import { verifyEmailConnection } from './config/email.js';
import { isCloudinaryConfigured, verifyCloudinaryConnection } from './config/cloudinary.js';
import { maintenanceGuard } from './middleware/maintenanceMiddleware.js';
import SystemSetting from './models/SystemSetting.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  try {
    await User.syncIndexes();
    await Customer.syncIndexes();
    await Product.syncIndexes();
    await Expense.syncIndexes();
  } catch (err) {
    console.warn('Index sync failed:', err.message);
  }

  seedLegalDocuments().catch((err) => {
    console.warn('Legal document seed failed:', err.message);
  });
  // Demo data is not seeded on startup. Run manually when needed:
  //   node utils/seedData.js
});

if (isCloudinaryConfigured()) {
  verifyCloudinaryConnection();
} else {
  console.warn('Cloudinary not configured — images will be stored locally in /uploads');
}

verifyEmailConnection().catch((err) => {
  console.warn('Email service not ready:', err.message);
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(maintenanceGuard);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/upload', uploadRoutes);
app.use('/api/geocode', geocodeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payment-submissions', paymentSubmissionRoutes);
app.use('/api/paid-entries', paymentVisibilityRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/links', linkRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/shared', sharedRoutes);

const clientBuild = path.join(__dirname, '../client/dist');
const serveWebApp =
  process.env.NODE_ENV === 'production' &&
  fs.existsSync(path.join(clientBuild, 'index.html'));

if (!serveWebApp) {
  app.get('/', (_req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>BakiBook API</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Inter, system-ui, sans-serif;
            background: #FBF6F6;
            color: #4C5C2D;
          }
          .card {
            text-align: center;
            padding: 48px 56px;
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(76, 92, 45, 0.12);
            border: 1px solid #e8e0e0;
          }
          h1 { font-size: 1.75rem; margin-bottom: 8px; }
          p { color: #666; font-size: 0.9375rem; }
          .dot {
            width: 12px;
            height: 12px;
            background: #6A7E3F;
            border-radius: 50%;
            display: inline-block;
            margin-right: 8px;
            animation: pulse 1.5s infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1><span class="dot"></span>Your Backend is connected</h1>
          <p>BakiBook API · Port ${PORT}</p>
        </div>
      </body>
    </html>
  `);
  });
}

app.get('/api/health', (_req, res) => {
  const emailConfigured = Boolean(
    process.env.EMAIL_USER?.trim() && process.env.EMAIL_APP_PASSWORD?.trim()
  );
  res.json({
    status: 'ok',
    message: 'BakiBook API is running',
    timestamp: new Date().toISOString(),
    emailConfigured,
  });
});

app.get('/api', (_req, res) => {
  const accept = String(_req.headers.accept || '');
  const payload = {
    status: 'ok',
    name: 'BakiBook API',
    message: 'BakiBook API is running',
    timestamp: new Date().toISOString(),
    docs: {
      health: '/api/health',
      maintenance: '/api/maintenance-status',
      auth: '/api/auth',
    },
  };

  if (accept.includes('text/html')) {
    return res.type('html').send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>BakiBook API</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Inter, system-ui, sans-serif;
            background: #FBF6F6;
            color: #4C5C2D;
          }
          .card {
            width: min(480px, 92vw);
            text-align: center;
            padding: 40px 32px;
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(76, 92, 45, 0.12);
            border: 1px solid #e8e0e0;
          }
          h1 { font-size: 1.5rem; margin-bottom: 8px; }
          p { color: #666; font-size: 0.95rem; margin-bottom: 20px; }
          a {
            display: inline-block;
            margin: 4px 6px;
            padding: 10px 14px;
            border-radius: 8px;
            background: #6A7E3F;
            color: #fff;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.875rem;
          }
          .dot {
            width: 10px;
            height: 10px;
            background: #6A7E3F;
            border-radius: 50%;
            display: inline-block;
            margin-right: 8px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1><span class="dot"></span>BakiBook API is running</h1>
          <p>Use the endpoints below. The mobile/web apps call these under <code>/api</code>.</p>
          <a href="/api/health">/api/health</a>
          <a href="/api/maintenance-status">/api/maintenance-status</a>
        </div>
      </body>
    </html>
  `);
  }

  return res.json(payload);
});

app.get('/api/maintenance-status', async (_req, res) => {
  try {
    const settings = await SystemSetting.getGlobal();
    res.json({
      success: true,
      maintenanceMode: Boolean(settings.maintenanceMode),
      message:
        settings.maintenanceMessage ||
        'BakiBook is temporarily unavailable. Please check back soon.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/stats', async (_req, res) => {
  try {
    const User = (await import('./models/User.js')).default;
    const Transaction = (await import('./models/Transaction.js')).default;

    const [shopkeepers, txCount, creditAgg] = await Promise.all([
      User.countDocuments({ role: 'shopkeeper' }),
      Transaction.countDocuments(),
      Transaction.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
    ]);

    const creditTotal = creditAgg[0]?.total || 0;

    res.json({
      shopkeepers: shopkeepers > 0 ? `${shopkeepers}+` : '1000+',
      transactions: txCount >= 1000 ? `${Math.floor(txCount / 1000)}K+` : `${txCount || 50}+`,
      creditManaged:
        creditTotal >= 10000000
          ? `Rs. ${(creditTotal / 10000000).toFixed(1)}Cr+`
          : creditTotal > 0
            ? `Rs. ${creditTotal.toLocaleString('en-NP')}+`
            : 'Rs. 2Cr+',
      satisfaction: '99%',
    });
  } catch {
    res.json({
      shopkeepers: '1000+',
      transactions: '50K+',
      creditManaged: 'Rs. 2Cr+',
      satisfaction: '99%',
    });
  }
});

if (serveWebApp) {
  app.use(express.static(clientBuild));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
} else if (process.env.NODE_ENV === 'production') {
  console.warn('client/dist not found — API-only mode (fine for mobile backend)');
}

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`BakiBook server running on port ${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or change PORT in .env`);
    process.exit(1);
  }
  throw error;
});
