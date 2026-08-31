import mongoose from 'mongoose';

const shopMembershipSchema = new mongoose.Schema(
  {
    shopOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    teamRole: {
      type: String,
      enum: ['partner', 'staff'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true }
);

shopMembershipSchema.index({ shopOwner: 1, member: 1 }, { unique: true });
shopMembershipSchema.index({ member: 1, status: 1 });

const ShopMembership = mongoose.model('ShopMembership', shopMembershipSchema);

export default ShopMembership;
