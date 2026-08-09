import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
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
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ['Cash', 'eSewa', 'Khalti', 'Bank Transfer'],
      default: 'Cash',
    },
    note: { type: String, trim: true, default: '' },
    receiptNo: { type: String, required: true, trim: true },
    screenshotUrl: { type: String, trim: true, default: '' },
    payType: {
      type: String,
      enum: ['manual', 'custom', 'transaction', 'item'],
      default: 'manual',
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    itemIndex: { type: Number, default: null },
    itemName: { type: String, trim: true, default: '' },
    payLabel: { type: String, trim: true, default: '' },
    submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentSubmission',
      default: null,
      index: true,
    },
    customerArchived: { type: Boolean, default: false, index: true },
    shopkeeperHidden: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// One payment document per accepted submission (when linked).
paymentSchema.index(
  { submission: 1 },
  {
    unique: true,
    partialFilterExpression: { submission: { $type: 'objectId' } },
  }
);

export default mongoose.model('Payment', paymentSchema);
