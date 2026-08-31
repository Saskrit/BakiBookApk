import Product from '../models/Product.js';
import {
  backfillProductsFromTransactions,
  formatProduct,
} from '../utils/productCatalog.js';

import { getShopkeeperId } from '../utils/shopContext.js';

export const listProducts = async (req, res) => {
  try {
    const shopkeeperId = getShopkeeperId(req);
    const search = req.query.search?.trim();
    const all = req.query.all === 'true';
    const limit = all ? 500 : Math.min(Number(req.query.limit) || 15, 50);

    let count = await Product.countDocuments({ shopkeeper: shopkeeperId });
    if (count === 0) {
      await backfillProductsFromTransactions(shopkeeperId);
      count = await Product.countDocuments({ shopkeeper: shopkeeperId });
    }

    const filter = { shopkeeper: shopkeeperId };
    if (search) {
      filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const query = Product.find(filter).sort({ usageCount: -1, lastUsedAt: -1, name: 1 });
    if (!all) query.limit(limit);
    const products = await query;

    res.json({
      success: true,
      products: products.map(formatProduct),
      total: count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const shopkeeperId = getShopkeeperId(req);
    const name = String(req.body.name || '').trim();
    const lastPrice = Number(req.body.lastPrice) || 0;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }

    const normalizedName = name.toLowerCase();
    const existing = await Product.findOne({ shopkeeper: shopkeeperId, normalizedName });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Product already exists in your catalog',
        product: formatProduct(existing),
      });
    }

    const product = await Product.create({
      shopkeeper: shopkeeperId,
      name,
      normalizedName,
      lastPrice,
      usageCount: 0,
      lastUsedAt: null,
    });

    res.status(201).json({ success: true, product: formatProduct(product) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Product already exists in your catalog',
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const shopkeeperId = getShopkeeperId(req);
    const product = await Product.findOne({
      _id: req.params.id,
      shopkeeper: shopkeeperId,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const { name, lastPrice } = req.body;

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        return res.status(400).json({ success: false, message: 'Product name is required' });
      }

      const normalizedName = trimmed.toLowerCase();
      const duplicate = await Product.findOne({
        shopkeeper: shopkeeperId,
        normalizedName,
        _id: { $ne: product._id },
      });

      if (duplicate) {
        return res.status(409).json({ success: false, message: 'Another product with this name exists' });
      }

      product.name = trimmed;
      product.normalizedName = normalizedName;
    }

    if (lastPrice !== undefined && lastPrice !== null && lastPrice !== '') {
      const price = Number(lastPrice);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ success: false, message: 'Enter a valid price or leave it blank' });
      }
      product.lastPrice = price;
    }

    await product.save();
    res.json({ success: true, product: formatProduct(product) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      shopkeeper: getShopkeeperId(req),
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product removed from catalog' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
