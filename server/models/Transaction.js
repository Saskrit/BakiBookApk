import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: ['none', 'kg', 'ltr'], default: 'none' },
  },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    shopkeeper: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    type: { type: String, enum: ['credit'], default: 'credit' },
    items: { type: [itemSchema], default: [] },
    total: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Transaction', transactionSchema);
