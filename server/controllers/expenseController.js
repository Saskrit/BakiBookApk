import Expense, { EXPENSE_CATEGORIES } from '../models/Expense.js';

import { getShopkeeperId } from '../utils/shopContext.js';

const formatExpense = (expense) => ({
  id: expense._id.toString(),
  title: expense.title,
  amount: expense.amount,
  category: expense.category,
  note: expense.note || '',
  expenseDate: expense.expenseDate,
  createdAt: expense.createdAt,
});

export const listExpenses = async (req, res) => {
  try {
    const shopkeeperId = getShopkeeperId(req);
    const filter = { shopkeeper: shopkeeperId };

    if (req.query.category && req.query.category !== 'all') {
      filter.category = req.query.category;
    }

    if (req.query.month) {
      const [year, month] = String(req.query.month).split('-').map(Number);
      if (year && month) {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 1);
        filter.expenseDate = { $gte: start, $lt: end };
      }
    }

    const expenses = await Expense.find(filter).sort({ expenseDate: -1, createdAt: -1 });
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({
      success: true,
      expenses: expenses.map(formatExpense),
      total,
      categories: EXPENSE_CATEGORIES,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      shopkeeper: getShopkeeperId(req),
    });

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    res.json({ success: true, expense: formatExpense(expense) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createExpense = async (req, res) => {
  try {
    const { title, amount, category, note, expenseDate } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    const expense = await Expense.create({
      shopkeeper: getShopkeeperId(req),
      title: title.trim(),
      amount: parsedAmount,
      category: EXPENSE_CATEGORIES.includes(category) ? category : 'Other',
      note: note?.trim() || '',
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
    });

    res.status(201).json({ success: true, expense: formatExpense(expense) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      shopkeeper: getShopkeeperId(req),
    });

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    const { title, amount, category, note, expenseDate } = req.body;

    if (title !== undefined) {
      if (!String(title).trim()) {
        return res.status(400).json({ success: false, message: 'Title is required' });
      }
      expense.title = String(title).trim();
    }

    if (amount !== undefined) {
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
        return res.status(400).json({ success: false, message: 'Valid amount is required' });
      }
      expense.amount = parsedAmount;
    }

    if (category !== undefined && EXPENSE_CATEGORIES.includes(category)) {
      expense.category = category;
    }

    if (note !== undefined) expense.note = String(note).trim();
    if (expenseDate !== undefined) expense.expenseDate = new Date(expenseDate);

    await expense.save();
    res.json({ success: true, expense: formatExpense(expense) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      shopkeeper: getShopkeeperId(req),
    });

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    res.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
