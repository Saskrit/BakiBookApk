import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['shopkeeper', 'customer'],
      required: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    profileImage: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
    },
    shopName: {
      type: String,
      trim: true,
      default: '',
    },
    shopLocation: {
      type: String,
      trim: true,
      default: '',
    },
    shopImage: {
      type: String,
      default: '',
    },
    /** Account-level QR identity (independent of Customer.qrCode). */
    qrCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    isShopVerified: {
      type: Boolean,
      default: false,
    },
    shopVerificationStatus: {
      type: String,
      enum: ['incomplete', 'pending', 'verified', 'rejected'],
      default: 'incomplete',
    },
    phoneOtpHash: {
      type: String,
      select: false,
    },
    phoneOtpExpires: {
      type: Date,
      select: false,
    },
    phoneOtpPhone: {
      type: String,
      select: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    pendingEmail: {
      type: String,
      trim: true,
      lowercase: true,
      select: false,
    },
    emailChangeCodeHash: {
      type: String,
      select: false,
    },
    emailChangeExpires: {
      type: Date,
      select: false,
    },
    emailChangeRequestedAt: {
      type: Date,
      select: false,
    },
    emailChangePasswordAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    emailChangeLockedUntil: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    preferredLanguage: {
      type: String,
      enum: ['en', 'ne'],
      default: 'en',
    },
    tutorialProgress: {
      completedStepIds: {
        type: [String],
        default: [],
      },
      updatedAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

userSchema.index({ email: 1, role: 1 }, { unique: true });

userSchema.pre('validate', function validateRequiredFields(next) {
  if (this.isNew && !this.googleId && !this.password) {
    this.invalidate('password', 'Password is required');
  }
  next();
});

userSchema.pre('save', function generateAccountQr(next) {
  if (!this.qrCode) {
    const prefix = this.role === 'shopkeeper' ? 'BBS' : 'BBC';
    this.qrCode = `${prefix}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  }
  next();
});

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function matchPassword(enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
