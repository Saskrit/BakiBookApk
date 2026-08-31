import Customer from '../models/Customer.js';
import Message from '../models/Message.js';
import { emitToCustomerRoom, emitToUser, isUserOnline } from '../config/socket.js';
import { createNotification } from '../utils/notify.js';
import { getShopkeeperId } from '../utils/shopContext.js';

const getShopkeeperUnreadCount = async (shopkeeperId) => {
  const customers = await Customer.find({
    shopkeeper: shopkeeperId,
    linkStatus: 'linked',
    chatHiddenAt: null,
  }).select('_id');

  if (!customers.length) return 0;

  return Message.countDocuments({
    customer: { $in: customers.map((c) => c._id) },
    readByShopkeeper: false,
    senderRole: 'customer',
  });
};

const emitShopkeeperUnreadCount = async (shopkeeperId) => {
  const count = await getShopkeeperUnreadCount(shopkeeperId);
  emitToUser(shopkeeperId.toString(), 'message:unread-count', { count });
  return count;
};

export const getUnreadMessageCount = async (req, res) => {
  try {
    if (req.user.role === 'shopkeeper') {
      const count = await getShopkeeperUnreadCount(getShopkeeperId(req));
      return res.json({ success: true, count });
    }

    const customers = await Customer.find({
      linkedUser: req.user._id,
      linkStatus: 'linked',
      customerChatHiddenAt: null,
      messagingBlocked: { $ne: true },
    }).select('_id');

    const count = customers.length
      ? await Message.countDocuments({
          customer: { $in: customers.map((c) => c._id) },
          readByCustomer: false,
          senderRole: 'shopkeeper',
        })
      : 0;

    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const canAccessCustomer = async (user, customerId, shopOwnerId = null) => {
  const customer = await Customer.findById(customerId).populate('shopkeeper', '_id fullName shopName');
  if (!customer) return null;

  const ownerId = (shopOwnerId || user._id).toString();
  if (user.role === 'shopkeeper' && customer.shopkeeper._id.toString() === ownerId) {
    return { customer, role: 'shopkeeper' };
  }

  if (
    user.role === 'customer' &&
    customer.linkStatus === 'linked' &&
    customer.linkedUser?.toString() === user._id.toString()
  ) {
    return { customer, role: 'customer' };
  }

  return null;
};

const formatMessage = (msg) => ({
  id: msg._id.toString(),
  customerId: msg.customer.toString(),
  senderId: msg.sender.toString(),
  senderRole: msg.senderRole,
  body: msg.body,
  createdAt: msg.createdAt,
  readByShopkeeper: msg.readByShopkeeper,
  readByCustomer: msg.readByCustomer,
  deliveredToShopkeeper: Boolean(msg.deliveredToShopkeeper),
  deliveredToCustomer: Boolean(msg.deliveredToCustomer),
});

const emitMessageStatus = (message) => {
  const payload = formatMessage(message);
  emitToCustomerRoom(message.customer.toString(), 'message:status', payload);
  if (message.shopkeeper) {
    emitToUser(message.shopkeeper.toString(), 'message:status', payload);
  }
};

export const listConversations = async (req, res) => {
  try {
    let customers = [];

    if (req.user.role === 'shopkeeper') {
      customers = await Customer.find({
        shopkeeper: getShopkeeperId(req),
        linkStatus: 'linked',
        chatHiddenAt: null,
      }).sort({ updatedAt: -1 });
    } else {
      customers = await Customer.find({
        linkedUser: req.user._id,
        linkStatus: 'linked',
        customerChatHiddenAt: null,
        messagingBlocked: { $ne: true },
      }).populate('shopkeeper', 'fullName shopName');
    }

    const conversations = await Promise.all(
      customers.map(async (c) => {
        const lastMessage = await Message.findOne({ customer: c._id }).sort({ createdAt: -1 });
        const unreadFilter =
          req.user.role === 'shopkeeper'
            ? { customer: c._id, readByShopkeeper: false, senderRole: 'customer' }
            : { customer: c._id, readByCustomer: false, senderRole: 'shopkeeper' };
        const unreadCount = await Message.countDocuments(unreadFilter);

        return {
          customerId: c._id.toString(),
          customerName: c.name,
          shopName: req.user.role === 'customer' ? c.shopkeeper?.shopName : undefined,
          linkStatus: c.linkStatus,
          messagingBlocked: Boolean(c.messagingBlocked),
          lastMessage: lastMessage ? formatMessage(lastMessage) : null,
          unreadCount,
        };
      })
    );

    res.json({ success: true, conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const access = await canAccessCustomer(req.user, req.params.customerId, getShopkeeperId(req));
    if (!access) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (access.customer.linkStatus !== 'linked') {
      return res.status(403).json({
        success: false,
        message: 'Customer must link their account before messaging',
      });
    }

    const messages = await Message.find({ customer: req.params.customerId })
      .sort({ createdAt: 1 })
      .limit(200);

    const readField = access.role === 'shopkeeper' ? 'readByShopkeeper' : 'readByCustomer';
    const deliveredField = access.role === 'shopkeeper' ? 'deliveredToShopkeeper' : 'deliveredToCustomer';
    const senderRole = access.role === 'shopkeeper' ? 'customer' : 'shopkeeper';

    const unreadIncoming = await Message.find({
      customer: req.params.customerId,
      senderRole,
      [readField]: false,
    });

    if (unreadIncoming.length) {
      await Message.updateMany(
        { customer: req.params.customerId, senderRole, [readField]: false },
        { [readField]: true, [deliveredField]: true }
      );

      unreadIncoming.forEach((msg) => {
        msg[readField] = true;
        msg[deliveredField] = true;
        emitMessageStatus(msg);
      });

      if (access.role === 'shopkeeper') {
        await emitShopkeeperUnreadCount(getShopkeeperId(req));
      }
    }

    const freshMessages = await Message.find({ customer: req.params.customerId })
      .sort({ createdAt: 1 })
      .limit(200);

    res.json({
      success: true,
      customer: {
        id: access.customer._id.toString(),
        name: access.customer.name,
        linkStatus: access.customer.linkStatus,
        messagingBlocked: Boolean(access.customer.messagingBlocked),
        shopName: access.customer.shopkeeper?.shopName,
      },
      messages: freshMessages.map(formatMessage),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const access = await canAccessCustomer(req.user, req.params.customerId, getShopkeeperId(req));
    if (!access) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (access.customer.linkStatus !== 'linked') {
      return res.status(403).json({
        success: false,
        message: 'Customer must link their account before messaging',
      });
    }

    if (access.customer.messagingBlocked && access.role === 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Messaging is blocked for this customer',
      });
    }

    const message = await Message.create({
      customer: access.customer._id,
      shopkeeper: access.customer.shopkeeper._id || access.customer.shopkeeper,
      sender: req.user._id,
      senderRole: access.role,
      body: body.trim(),
      readByShopkeeper: access.role === 'shopkeeper',
      readByCustomer: access.role === 'customer',
    });

    access.customer.chatHiddenAt = null;
    access.customer.customerChatHiddenAt = null;
    await access.customer.save();

    if (access.role === 'shopkeeper') {
      const customerUserId = access.customer.linkedUser?.toString();
      if (customerUserId && isUserOnline(customerUserId)) {
        message.deliveredToCustomer = true;
        await message.save();
      }
    } else {
      const shopkeeperId =
        access.customer.shopkeeper._id?.toString() || access.customer.shopkeeper?.toString();
      if (shopkeeperId && isUserOnline(shopkeeperId)) {
        message.deliveredToShopkeeper = true;
        await message.save();
      }
    }

    const payload = formatMessage(message);
    emitToCustomerRoom(access.customer._id.toString(), 'message:new', payload);

    if (access.role === 'shopkeeper') {
      const customerUserId = access.customer.linkedUser?.toString();
      if (customerUserId) {
        emitToUser(customerUserId, 'message:new', payload);
        if (message.deliveredToCustomer) {
          emitMessageStatus(message);
        }
        const shopLabel = access.customer.shopkeeper?.shopName || 'Your shop';
        const preview = body.trim().length > 120 ? `${body.trim().slice(0, 117)}...` : body.trim();
        await createNotification({
          userId: customerUserId,
          title: `Message from ${shopLabel}`,
          body: preview,
          type: 'info',
          customerId: access.customer._id,
        });
      }
    } else {
      const shopkeeperId =
        access.customer.shopkeeper._id?.toString() || access.customer.shopkeeper?.toString();
      if (shopkeeperId) {
        emitToUser(shopkeeperId, 'message:new', payload);
        if (message.deliveredToShopkeeper) {
          emitMessageStatus(message);
        }
        const preview = body.trim().length > 120 ? `${body.trim().slice(0, 117)}...` : body.trim();
        await createNotification({
          userId: shopkeeperId,
          title: `Message from ${access.customer.name}`,
          body: preview,
          type: 'info',
          customerId: access.customer._id,
          linkPath: `/shop/messages/${access.customer._id}`,
        });
        await emitShopkeeperUnreadCount(shopkeeperId);
      }
    }

    res.status(201).json({ success: true, message: payload });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const requireShopkeeperChatAccess = async (req, res) => {
  if (req.user.role !== 'shopkeeper') {
    res.status(403).json({ success: false, message: 'Shopkeepers only' });
    return null;
  }

  const access = await canAccessCustomer(req.user, req.params.customerId, getShopkeeperId(req));
  if (!access || access.role !== 'shopkeeper') {
    res.status(403).json({ success: false, message: 'Access denied' });
    return null;
  }

  if (access.customer.linkStatus !== 'linked') {
    res.status(403).json({ success: false, message: 'Customer must be linked' });
    return null;
  }

  return access;
};

const requireLinkedChatAccess = async (req, res) => {
  const access = await canAccessCustomer(req.user, req.params.customerId, getShopkeeperId(req));
  if (!access) {
    res.status(403).json({ success: false, message: 'Access denied' });
    return null;
  }

  if (access.customer.linkStatus !== 'linked') {
    res.status(403).json({ success: false, message: 'Account must be linked' });
    return null;
  }

  return access;
};

export const clearChat = async (req, res) => {
  try {
    const access = await requireLinkedChatAccess(req, res);
    if (!access) return;

    await Message.deleteMany({ customer: access.customer._id });

    res.json({ success: true, message: 'Chat cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteChat = async (req, res) => {
  try {
    const access = await requireLinkedChatAccess(req, res);
    if (!access) return;

    await Message.deleteMany({ customer: access.customer._id });

    if (access.role === 'shopkeeper') {
      access.customer.chatHiddenAt = new Date();
    } else {
      access.customer.customerChatHiddenAt = new Date();
    }

    await access.customer.save();

    res.json({ success: true, message: 'Chat deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const blockCustomerMessaging = async (req, res) => {
  try {
    const access = await requireShopkeeperChatAccess(req, res);
    if (!access) return;

    access.customer.messagingBlocked = true;
    await access.customer.save();

    res.json({ success: true, message: 'Customer blocked from messaging' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const unblockCustomerMessaging = async (req, res) => {
  try {
    const access = await requireShopkeeperChatAccess(req, res);
    if (!access) return;

    access.customer.messagingBlocked = false;
    await access.customer.save();

    res.json({ success: true, message: 'Customer unblocked' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
