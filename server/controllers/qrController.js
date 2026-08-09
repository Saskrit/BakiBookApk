import crypto from 'crypto';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import { formatCustomer } from '../utils/formatters.js';
import { createNotification } from '../utils/notify.js';

const PAYLOAD_PREFIX = 'bakibook://qr/';

/** Ensure user has an account QR; persist if missing (legacy users). */
export async function ensureUserQr(user) {
  if (user.qrCode) return user.qrCode;
  const prefix = user.role === 'shopkeeper' ? 'BBS' : 'BBC';
  user.qrCode = `${prefix}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  await user.save();
  return user.qrCode;
}

function buildPayload(role, qrCode) {
  return `${PAYLOAD_PREFIX}${role}/${qrCode}`;
}

function parseScannedToken(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let token = raw.trim();

  try {
    if (token.startsWith('http://') || token.startsWith('https://') || token.startsWith('bakibook://')) {
      const withoutQuery = token.split('?')[0].replace(/\/+$/, '');
      const parts = withoutQuery.split('/');
      token = parts[parts.length - 1] || token;
      // bakibook://qr/customer/BBC-XXX or bakibook://qr/shopkeeper/BBS-XXX
      const qrIdx = parts.findIndex((p) => p === 'qr');
      if (qrIdx >= 0 && parts[qrIdx + 2]) {
        return {
          roleHint: parts[qrIdx + 1] === 'shopkeeper' ? 'shopkeeper' : parts[qrIdx + 1] === 'customer' ? 'customer' : null,
          qrCode: parts[qrIdx + 2],
        };
      }
    }
  } catch {
    /* fall through */
  }

  // Strip trailing path noise
  if (token.includes('/')) {
    token = token.split('/').pop() || token;
  }

  token = token.trim();
  if (!token) return null;

  let roleHint = null;
  if (token.startsWith('BBS-')) roleHint = 'shopkeeper';
  else if (token.startsWith('BBC-')) roleHint = 'customer';
  else if (token.startsWith('BB-')) roleHint = 'legacy-customer';

  return { roleHint, qrCode: token };
}

function safeShopPreview(user) {
  return {
    kind: 'shopkeeper',
    userId: user._id.toString(),
    qrCode: user.qrCode,
    name: user.fullName,
    shopName: user.shopName || user.fullName,
    location: user.shopLocation || '',
    phone: user.phone || '',
    shopImage: user.shopImage || '',
    verified: !!user.isShopVerified,
  };
}

function safeCustomerPreview(user) {
  return {
    kind: 'customer',
    userId: user._id.toString(),
    qrCode: user.qrCode,
    name: user.fullName,
    email: user.email || '',
    phone: user.phone || '',
    profileImage: user.profileImage || '',
  };
}

async function resolveTargetFromToken(parsed) {
  if (!parsed?.qrCode) return null;

  // Legacy per-shop Customer.qrCode (BB-...)
  if (parsed.roleHint === 'legacy-customer' || parsed.qrCode.startsWith('BB-')) {
    const customer = await Customer.findOne({ qrCode: parsed.qrCode }).populate(
      'linkedUser',
      'fullName email phone profileImage qrCode role'
    );
    if (!customer) return null;
    if (customer.linkedUser && customer.linkStatus === 'linked') {
      return {
        source: 'legacy-customer',
        user: customer.linkedUser,
        customerRecord: customer,
      };
    }
    // Unlinked legacy QR — shopkeeper already owns this record; preview as ledger customer
    return {
      source: 'legacy-customer-record',
      customerRecord: customer,
      user: null,
    };
  }

  const user = await User.findOne({ qrCode: parsed.qrCode });
  if (!user) return null;
  return { source: 'account', user, customerRecord: null };
}

async function findOrCreateLink({ shopkeeper, customerUser }) {
  const email = customerUser.email?.toLowerCase() || '';

  // Already linked to this shop
  let existing = await Customer.findOne({
    shopkeeper: shopkeeper._id,
    linkedUser: customerUser._id,
    linkStatus: 'linked',
  });
  if (existing) {
    return { customer: existing, created: false, alreadyLinked: true };
  }

  // Pending invitation by email
  if (email) {
    existing = await Customer.findOne({
      shopkeeper: shopkeeper._id,
      email,
      linkStatus: { $in: ['pending', 'unlinked', 'rejected'] },
      $or: [{ linkedUser: null }, { linkedUser: customerUser._id }],
    });
  }

  // Orphan record already pointing at this user but not linked
  if (!existing) {
    existing = await Customer.findOne({
      shopkeeper: shopkeeper._id,
      linkedUser: customerUser._id,
    });
  }

  if (existing) {
    if (existing.linkedUser && existing.linkedUser.toString() !== customerUser._id.toString()) {
      const err = new Error('This customer record is linked to another account');
      err.status = 409;
      throw err;
    }
    existing.linkedUser = customerUser._id;
    existing.linkStatus = 'linked';
    if (!existing.email && email) existing.email = email;
    if (!existing.phone && customerUser.phone) existing.phone = customerUser.phone;
    if (!existing.name) existing.name = customerUser.fullName;
    await existing.save();
    return { customer: existing, created: false, alreadyLinked: false };
  }

  const customer = await Customer.create({
    shopkeeper: shopkeeper._id,
    linkedUser: customerUser._id,
    linkStatus: 'linked',
    name: customerUser.fullName,
    email,
    phone: customerUser.phone || '',
    status: 'active',
  });

  return { customer, created: true, alreadyLinked: false };
}

export const getMyQr = async (req, res) => {
  try {
    const qrCode = await ensureUserQr(req.user);
    const role = req.user.role;
    const payload = buildPayload(role, qrCode);

    res.json({
      success: true,
      qr: {
        qrCode,
        payload,
        role,
        label:
          role === 'shopkeeper'
            ? req.user.shopName || req.user.fullName
            : req.user.fullName,
        subtitle:
          role === 'shopkeeper'
            ? req.user.shopLocation || req.user.email
            : req.user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const previewQr = async (req, res) => {
  try {
    const parsed = parseScannedToken(req.body.token || req.body.qrCode || '');
    if (!parsed) {
      return res.status(400).json({ success: false, message: 'Invalid QR code' });
    }

    const resolved = await resolveTargetFromToken(parsed);
    if (!resolved) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }

    const scanner = req.user;

    // Legacy customer record belonging to another shop / this shop without linked user
    if (resolved.source === 'legacy-customer-record') {
      const record = resolved.customerRecord;
      if (scanner.role !== 'shopkeeper') {
        return res.status(400).json({
          success: false,
          message: 'This QR belongs to a shop customer ledger, not a customer account',
        });
      }
      if (record.shopkeeper.toString() !== scanner._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'This customer QR belongs to another shop',
        });
      }
      return res.json({
        success: true,
        canConnect: false,
        alreadyLinked: false,
        message: 'Open this customer in your ledger (not linked to an app account yet)',
        target: {
          kind: 'ledger-customer',
          customerId: record._id.toString(),
          name: record.name,
          phone: record.phone || '',
          email: record.email || '',
          qrCode: record.qrCode,
        },
      });
    }

    const targetUser = resolved.user;
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }

    if (targetUser._id.toString() === scanner._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot connect with your own QR code',
      });
    }

    if (targetUser.role === scanner.role) {
      return res.status(400).json({
        success: false,
        message:
          scanner.role === 'shopkeeper'
            ? 'Scan a customer QR code to connect'
            : 'Scan a shop QR code to connect',
      });
    }

    const shopkeeper = scanner.role === 'shopkeeper' ? scanner : targetUser;
    const customerUser = scanner.role === 'customer' ? scanner : targetUser;

    const already = await Customer.findOne({
      shopkeeper: shopkeeper._id,
      linkedUser: customerUser._id,
      linkStatus: 'linked',
    });

    const target =
      targetUser.role === 'shopkeeper'
        ? safeShopPreview(targetUser)
        : safeCustomerPreview(targetUser);

    res.json({
      success: true,
      canConnect: !already,
      alreadyLinked: !!already,
      customerId: already?._id?.toString() || null,
      message: already
        ? 'Already connected'
        : 'Confirm to connect this shop and customer',
      target,
      token: targetUser.qrCode,
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

export const connectQr = async (req, res) => {
  try {
    const parsed = parseScannedToken(req.body.token || req.body.qrCode || '');
    if (!parsed) {
      return res.status(400).json({ success: false, message: 'Invalid QR code' });
    }

    const resolved = await resolveTargetFromToken(parsed);
    if (!resolved?.user) {
      return res.status(404).json({
        success: false,
        message: 'QR code not found or not linked to an account',
      });
    }

    const scanner = req.user;
    const targetUser = resolved.user;

    if (targetUser._id.toString() === scanner._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot connect with your own QR code',
      });
    }

    if (targetUser.role === scanner.role) {
      return res.status(400).json({
        success: false,
        message: 'QR connection requires one shopkeeper and one customer',
      });
    }

    const shopkeeper = scanner.role === 'shopkeeper' ? scanner : targetUser;
    const customerUser = scanner.role === 'customer' ? scanner : targetUser;

    // Reload full shopkeeper/customer docs
    const shopDoc =
      shopkeeper._id.toString() === scanner._id.toString()
        ? scanner
        : await User.findById(shopkeeper._id);
    const customerDoc =
      customerUser._id.toString() === scanner._id.toString()
        ? scanner
        : await User.findById(customerUser._id);

    if (!shopDoc || !customerDoc) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    const { customer, created, alreadyLinked } = await findOrCreateLink({
      shopkeeper: shopDoc,
      customerUser: customerDoc,
    });

    if (!alreadyLinked) {
      await createNotification({
        userId: shopDoc._id,
        title: 'Customer linked',
        body: `${customerDoc.fullName} connected via QR code.`,
        type: 'success',
        customerId: customer._id,
        linkPath: `/shop/customers/${customer._id}`,
      });

      await createNotification({
        userId: customerDoc._id,
        title: 'Shop linked',
        body: `${shopDoc.shopName || shopDoc.fullName} connected via QR code.`,
        type: 'success',
        customerId: customer._id,
        linkPath: `/portal/shops/${customer._id}`,
      });
    }

    res.json({
      success: true,
      alreadyLinked,
      created,
      message: alreadyLinked
        ? 'Already connected'
        : 'Shop and customer connected successfully',
      customer: formatCustomer(customer),
      shop: {
        customerId: customer._id.toString(),
        shopName: shopDoc.shopName || shopDoc.fullName,
        shopkeeper: shopDoc.fullName,
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};
