import Customer from '../models/Customer.js';
import { formatCustomer } from '../utils/formatters.js';
import { notifyCustomerOnCreate } from './linkController.js';
import { parsePagination, buildPagination } from '../utils/pagination.js';
import { getShopkeeperId, isRequestShopVerified } from '../utils/shopContext.js';
import { emitShopDataSync } from '../utils/realtimeSync.js';

const SHOP_UNVERIFIED_EMAIL_MESSAGE =
  'Verify your shop before adding or editing a customer email';

export const listCustomers = async (req, res) => {
  try {
    const { search, status } = req.query;
    const filter = { shopkeeper: getShopkeeperId(req) };

    if (status && status !== 'all') filter.status = status;
    if (search?.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }

    if (req.query.all === 'true') {
      const allCustomers = await Customer.find(filter).sort({ name: 1 });
      return res.json({ success: true, customers: allCustomers.map(formatCustomer) });
    }

    const { page, limit, skip } = parsePagination(req.query);
    const [total, customers] = await Promise.all([
      Customer.countDocuments(filter),
      Customer.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    ]);

    res.json({
      success: true,
      customers: customers.map(formatCustomer),
      pagination: buildPagination(page, limit, total),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      shopkeeper: getShopkeeperId(req),
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ success: true, customer: formatCustomer(customer) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCustomerByQr = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      qrCode: req.params.qrCode,
      shopkeeper: getShopkeeperId(req),
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ success: true, customer: formatCustomer(customer) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address, status, notes } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }

    const normalizedPhone = phone?.trim() || '';
    const normalizedEmail = email?.trim().toLowerCase() || '';

    if (normalizedEmail) {
      const shopVerified = await isRequestShopVerified(req);
      if (!shopVerified) {
        return res.status(403).json({
          success: false,
          message: SHOP_UNVERIFIED_EMAIL_MESSAGE,
        });
      }
    }

    const linkStatus = normalizedEmail ? 'pending' : 'unlinked';

    const customer = await Customer.create({
      shopkeeper: getShopkeeperId(req),
      name: name.trim(),
      phone: normalizedPhone,
      email: normalizedEmail,
      address: address?.trim() || '',
      status: status || 'active',
      notes: notes?.trim() || '',
      linkStatus,
    });

    await notifyCustomerOnCreate(customer, req.user);

    await emitShopDataSync(getShopkeeperId(req), {
      scopes: ['dashboard', 'customers', 'all'],
      excludeUserId: req.user._id,
    });

    res.status(201).json({ success: true, customer: formatCustomer(customer) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Customer with this phone already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      shopkeeper: getShopkeeperId(req),
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const { name, phone, email, address, status, notes } = req.body;
    if (name?.trim()) customer.name = name.trim();
    if (phone !== undefined) customer.phone = phone?.trim() || '';
    if (email !== undefined) {
      const normalizedEmail = email?.trim().toLowerCase() || '';
      const currentEmail = (customer.email || '').trim().toLowerCase();
      if (normalizedEmail !== currentEmail) {
        const shopVerified = await isRequestShopVerified(req);
        if (!shopVerified) {
          return res.status(403).json({
            success: false,
            message: SHOP_UNVERIFIED_EMAIL_MESSAGE,
          });
        }
      }
      customer.email = normalizedEmail;
      if (normalizedEmail && !customer.linkedUser) {
        customer.linkStatus = 'pending';
      } else if (!normalizedEmail) {
        customer.linkStatus = 'unlinked';
      }
    }
    if (address !== undefined) customer.address = address?.trim() || '';
    if (status) customer.status = status;
    if (notes !== undefined) customer.notes = notes?.trim() || '';

    await customer.save();

    await emitShopDataSync(getShopkeeperId(req), {
      scopes: ['dashboard', 'customers', 'all'],
      excludeUserId: req.user._id,
    });

    res.json({ success: true, customer: formatCustomer(customer) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Customer with this phone already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOneAndDelete({
      _id: req.params.id,
      shopkeeper: getShopkeeperId(req),
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    await emitShopDataSync(getShopkeeperId(req), {
      scopes: ['dashboard', 'customers', 'all'],
      excludeUserId: req.user._id,
    });

    res.json({ success: true, message: 'Customer deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
