import '../config/env.js';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import Payment from '../models/Payment.js';
import Notification from '../models/Notification.js';
import { computeCreditScore } from './customerBalance.js';

const DEMO_PASSWORD = 'Demo@123';
const SHOPKEEPER_EMAIL = 'shopkeeper@bakibook.demo';
const CUSTOMER_EMAIL = 'ram@email.com';

const seedCustomers = [
  {
    name: 'Ram Bahadur Thapa',
    phone: '9801111111',
    email: 'ram@email.com',
    address: 'Baneshwor, Kathmandu',
    status: 'active',
    notes: 'Regular customer, pays in installments.',
    balance: 45000,
    creditScore: 'Risky',
    daysAgoCredit: 15,
  },
  {
    name: 'Sita Devi Sharma',
    phone: '9802222222',
    email: 'sita@email.com',
    address: 'Patan, Lalitpur',
    status: 'active',
    notes: '',
    balance: 32500,
    creditScore: 'Good',
    daysAgoCredit: 10,
  },
  {
    name: 'Hari Prasad KC',
    phone: '9803333333',
    email: 'hari@email.com',
    address: 'Bhaktapur',
    status: 'active',
    notes: 'Prefers SMS reminders.',
    balance: 28000,
    creditScore: 'Average',
    daysAgoCredit: 7,
  },
  {
    name: 'Gita Kumari Rai',
    phone: '9804444444',
    email: 'gita@email.com',
    address: 'Kirtipur',
    status: 'inactive',
    notes: '',
    balance: 0,
    creditScore: 'Excellent',
    daysAgoCredit: 60,
  },
  {
    name: 'Mohan Singh Tamang',
    phone: '9805555555',
    email: 'mohan@email.com',
    address: 'Boudha, Kathmandu',
    status: 'active',
    notes: 'Overdue 45+ days.',
    balance: 18500,
    creditScore: 'Defaulter',
    daysAgoCredit: 45,
  },
];

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

async function upsertUser({ role, fullName, email, shopName, shopLocation, phone, password }) {
  let user = await User.findOne({ email, role }).select('+password');

  if (user) {
    user.fullName = fullName;
    user.password = password;
    user.isEmailVerified = true;
    if (phone) user.phone = phone;
    if (role === 'shopkeeper') {
      user.shopName = shopName;
      user.shopLocation = shopLocation;
      user.isShopVerified = true;
      user.shopVerificationStatus = 'verified';
    }
    await user.save();
    return user;
  }

  return User.create({
    role,
    fullName,
    email,
    password,
    phone: phone || undefined,
    isEmailVerified: true,
    shopName: shopName || '',
    shopLocation: shopLocation || '',
    isShopVerified: role === 'shopkeeper',
    shopVerificationStatus: role === 'shopkeeper' ? 'verified' : 'incomplete',
  });
}

/** Ensure Ram customer account is linked to Sharma Kirana for demo logins. */
async function ensureDemoCustomerLink(shopkeeper, customerUser) {
  let customer = await Customer.findOne({
    shopkeeper: shopkeeper._id,
    email: CUSTOMER_EMAIL,
  });

  if (!customer) {
    customer = await Customer.findOne({
      shopkeeper: shopkeeper._id,
      linkedUser: customerUser._id,
    });
  }

  if (!customer) {
    const createdAt = daysAgo(15);
    customer = await Customer.create({
      shopkeeper: shopkeeper._id,
      linkedUser: customerUser._id,
      linkStatus: 'linked',
      name: customerUser.fullName || 'Ram Bahadur Thapa',
      phone: customerUser.phone || '9801111111',
      email: CUSTOMER_EMAIL,
      address: 'New Road, Itahari, Sunsari',
      status: 'active',
      notes: 'Demo linked customer',
      balance: 5250,
      creditScore: 'Good',
      lastCreditDate: createdAt,
      lastPaymentDate: daysAgo(5),
    });

    const creditAt = daysAgo(3);
    await Transaction.create({
      shopkeeper: shopkeeper._id,
      customer: customer._id,
      items: [
        { name: 'Milk', qty: 2, price: 80 },
        { name: 'Bread', qty: 1, price: 55 },
        { name: 'Rice 5kg', qty: 1, price: 650 },
      ],
      total: 865,
      note: 'Demo credit',
      createdAt: creditAt,
      updatedAt: creditAt,
    });

    const payAt = daysAgo(5);
    await Payment.create({
      shopkeeper: shopkeeper._id,
      customer: customer._id,
      amount: 2000,
      method: 'eSewa',
      note: 'Demo payment',
      receiptNo: 'RCP-DEMO-0001',
      createdAt: payAt,
      updatedAt: payAt,
    });

    console.log('  Linked new demo customer record for portal use.');
  } else {
    customer.linkedUser = customerUser._id;
    customer.linkStatus = 'linked';
    customer.email = CUSTOMER_EMAIL;
    if (!customer.phone) customer.phone = customerUser.phone || '9801111111';
    if (!customer.name) customer.name = customerUser.fullName;
    await customer.save();
    console.log('  Ensured demo customer is linked to shopkeeper.');
  }

  return customer;
}

export async function seedDemoData({ force = false } = {}) {
  const existing = await User.findOne({ email: SHOPKEEPER_EMAIL });

  // Always keep demo login accounts in sync (password + verified flags),
  // and always ensure the customer portal is linked to the demo shop.
  if (existing && !force) {
    const shopkeeper = await upsertUser({
      role: 'shopkeeper',
      fullName: 'Ram Sharma',
      email: SHOPKEEPER_EMAIL,
      shopName: existing.shopName || 'Sharma Kirana Store',
      shopLocation: existing.shopLocation || 'New Road, Itahari, Sunsari',
      phone: existing.phone || '9801234567',
      password: DEMO_PASSWORD,
    });
    const customerUser = await upsertUser({
      role: 'customer',
      fullName: 'Ram Bahadur Thapa',
      email: CUSTOMER_EMAIL,
      phone: '9801111111',
      password: DEMO_PASSWORD,
    });
    await ensureDemoCustomerLink(shopkeeper, customerUser);

    console.log('\n✅ Demo accounts synced & linked\n');
    console.log('Shopkeeper:');
    console.log(`  Email:    ${SHOPKEEPER_EMAIL}`);
    console.log(`  Password: ${DEMO_PASSWORD}\n`);
    console.log('Customer:');
    console.log(`  Email:    ${CUSTOMER_EMAIL}`);
    console.log(`  Password: ${DEMO_PASSWORD}\n`);

    return { skipped: true, shopkeeper, customerUser };
  }

  if (force) {
    const shopkeeper = await User.findOne({ email: SHOPKEEPER_EMAIL, role: 'shopkeeper' });
    if (shopkeeper) {
      await Notification.deleteMany({ user: shopkeeper._id });
      await Payment.deleteMany({ shopkeeper: shopkeeper._id });
      await Transaction.deleteMany({ shopkeeper: shopkeeper._id });
      await Customer.deleteMany({ shopkeeper: shopkeeper._id });
    }
  }

  const shopkeeper = await upsertUser({
    role: 'shopkeeper',
    fullName: 'Ram Sharma',
    email: SHOPKEEPER_EMAIL,
    shopName: 'Sharma Kirana Store',
    shopLocation: 'New Road, Itahari, Sunsari',
    phone: '9801234567',
    password: DEMO_PASSWORD,
  });

  const customerUser = await upsertUser({
    role: 'customer',
    fullName: 'Ram Bahadur Thapa',
    email: CUSTOMER_EMAIL,
    phone: '9801111111',
    password: DEMO_PASSWORD,
  });

  const createdCustomers = [];

  for (const data of seedCustomers) {
    const lastCreditDate = daysAgo(data.daysAgoCredit);
    const customer = await Customer.create({
      shopkeeper: shopkeeper._id,
      linkedUser: data.email === CUSTOMER_EMAIL ? customerUser._id : null,
      linkStatus: data.email === CUSTOMER_EMAIL ? 'linked' : data.email ? 'pending' : 'unlinked',
      name: data.name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      status: data.status,
      notes: data.notes,
      balance: data.balance,
      creditScore: data.creditScore,
      lastCreditDate,
      lastPaymentDate: data.balance > 0 ? daysAgo(data.daysAgoCredit - 5) : daysAgo(2),
    });
    createdCustomers.push(customer);
  }

  // Extra safety if seedCustomers list changes
  await ensureDemoCustomerLink(shopkeeper, customerUser);

  const [ram, sita, hari, gita, mohan] = createdCustomers;

  const txData = [
    { customer: ram, items: [{ name: 'Rice 25kg', qty: 2, price: 1500 }], total: 5000, daysAgo: 0, note: 'Monthly groceries' },
    { customer: sita, items: [{ name: 'Cooking Oil', qty: 3, price: 450 }], total: 3500, daysAgo: 1, note: '' },
    { customer: hari, items: [{ name: 'Snacks bundle', qty: 1, price: 2500 }], total: 2500, daysAgo: 2, note: '' },
    { customer: ram, items: [{ name: 'Detergent', qty: 4, price: 180 }], total: 1200, daysAgo: 3, note: '' },
    { customer: mohan, items: [{ name: 'Mixed items', qty: 1, price: 4000 }], total: 4000, daysAgo: 4, note: 'Bulk purchase' },
  ];

  for (const tx of txData) {
    const createdAt = daysAgo(tx.daysAgo);
    await Transaction.create({
      shopkeeper: shopkeeper._id,
      customer: tx.customer._id,
      items: tx.items,
      total: tx.total,
      note: tx.note,
      createdAt,
      updatedAt: createdAt,
    });
  }

  const paymentData = [
    { customer: sita, amount: 3000, method: 'Cash', daysAgo: 0, note: 'Partial payment', receiptNo: 'RCP-2026-0001' },
    { customer: gita, amount: 1500, method: 'eSewa', daysAgo: 1, note: 'Full settlement', receiptNo: 'RCP-2026-0002' },
    { customer: ram, amount: 5000, method: 'Cash', daysAgo: 2, note: '', receiptNo: 'RCP-2026-0003' },
  ];

  for (const p of paymentData) {
    const createdAt = daysAgo(p.daysAgo);
    await Payment.create({
      shopkeeper: shopkeeper._id,
      customer: p.customer._id,
      amount: p.amount,
      method: p.method,
      note: p.note,
      receiptNo: p.receiptNo,
      createdAt,
      updatedAt: createdAt,
    });
  }

  for (const c of createdCustomers) {
    c.creditScore = computeCreditScore(c);
    await c.save();
  }

  await Notification.create([
    {
      user: shopkeeper._id,
      title: 'Large outstanding balance',
      body: `${ram.name} has Rs. 45,000 outstanding for 15+ days.`,
      type: 'warning',
      customer: ram._id,
    },
    {
      user: shopkeeper._id,
      title: 'Payment received',
      body: `${sita.name} paid Rs. 3,000.`,
      type: 'success',
      customer: sita._id,
    },
    {
      user: shopkeeper._id,
      title: 'New customer registered',
      body: 'A new customer was added to your shop.',
      type: 'info',
    },
    {
      user: customerUser._id,
      title: 'New credit added',
      body: 'Rs. 5,000 added to your account.',
      type: 'info',
      customer: ram._id,
    },
    {
      user: customerUser._id,
      title: 'Payment recorded',
      body: 'Rs. 5,000 payment confirmed.',
      type: 'success',
      customer: ram._id,
    },
  ]);

  console.log('\n✅ BakiBook demo data seeded successfully!\n');
  console.log('Shopkeeper login:');
  console.log(`  Email:    ${SHOPKEEPER_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}\n`);
  console.log('Customer portal login:');
  console.log(`  Email:    ${CUSTOMER_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}\n`);

  return { skipped: false, shopkeeper, customerUser };
}

async function run() {
  const force = process.argv.includes('--force');
  await connectDB();
  await seedDemoData({ force });
  await mongoose.disconnect();
  process.exit(0);
}

if (process.argv[1]?.includes('seedData')) {
  run().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

export default seedDemoData;
