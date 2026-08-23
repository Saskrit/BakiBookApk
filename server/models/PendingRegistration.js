import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const pendingRegistrationSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['shopkeeper', 'customer'],
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    codeHash: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

pendingRegistrationSchema.index({ email: 1, role: 1 }, { unique: true });
pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

pendingRegistrationSchema.methods.matchPassword = async function matchPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

pendingRegistrationSchema.statics.hashPassword = async function hashPassword(password) {
  return bcrypt.hash(password, 12);
};

const PendingRegistration = mongoose.model('PendingRegistration', pendingRegistrationSchema);

export default PendingRegistration;
