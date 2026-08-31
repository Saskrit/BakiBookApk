import mongoose from 'mongoose';

const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global',
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: {
      type: String,
      trim: true,
      default: 'BakiBook is temporarily unavailable. Please check back soon.',
    },
    supportEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'saskreetking@gmail.com',
    },
    supportPhone: {
      type: String,
      trim: true,
      default: '+977 9703649841',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

/** In-memory cache — avoids a MongoDB round-trip on every API request. */
let cachedSettings = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

systemSettingSchema.statics.invalidateCache = function invalidateCache() {
  cachedSettings = null;
  cachedAt = 0;
};

systemSettingSchema.statics.getGlobal = async function getGlobal(options = {}) {
  const forceRefresh = Boolean(options.forceRefresh);
  const now = Date.now();

  if (!forceRefresh && cachedSettings && now - cachedAt < CACHE_TTL_MS) {
    return cachedSettings;
  }

  let settings = await this.findOne({ key: 'global' }).lean(false);
  if (!settings) {
    settings = await this.create({ key: 'global' });
  }

  cachedSettings = settings;
  cachedAt = now;
  return settings;
};

const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);

export default SystemSetting;
