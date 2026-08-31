import fs from 'fs/promises';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';

const CLOUDINARY_FOLDERS = {
  profiles: 'bakibook/profiles',
  shops: 'bakibook/shops',
  payments: 'bakibook/payments',
};

const LOCAL_HOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/i;

function publicBaseUrl() {
  return String(process.env.SERVER_URL || '').replace(/\/+$/, '');
}

/** Convert stored paths into a URL the app/web can load (never localhost). */
export const toPublicImageUrl = (value) => {
  if (!value || typeof value !== 'string') return '';
  let trimmed = value.trim();
  if (!trimmed) return '';

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  if (trimmed.startsWith('data:')) return trimmed;

  // Always serve Cloudinary over https (mobile release blocks cleartext HTTP).
  if (/cloudinary\.com/i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }

  const base = publicBaseUrl();
  if (trimmed.startsWith('/')) {
    return base ? `${base}${trimmed}` : trimmed;
  }
  if (LOCAL_HOST_RE.test(trimmed)) {
    const path = trimmed.replace(/^https?:\/\/[^/]+/i, '');
    return base ? `${base}${path}` : trimmed;
  }
  return trimmed;
};

export const uploadLocalFileToCloudinary = async (filePath, type = 'profiles') => {
  const folder = CLOUDINARY_FOLDERS[type] || CLOUDINARY_FOLDERS.profiles;

  if (!isCloudinaryConfigured()) {
    return null;
  }

  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: 'image',
  });

  return result.secure_url;
};

export const uploadRemoteImageToCloudinary = async (imageUrl, type = 'profiles') => {
  if (!imageUrl || !isCloudinaryConfigured()) {
    return imageUrl || '';
  }

  if (imageUrl.includes('res.cloudinary.com')) {
    return imageUrl;
  }

  const folder = CLOUDINARY_FOLDERS[type] || CLOUDINARY_FOLDERS.profiles;

  const result = await cloudinary.uploader.upload(imageUrl, {
    folder,
    resource_type: 'image',
  });

  return result.secure_url;
};

export const processUploadedFile = async (file, type = 'profiles') => {
  const folderName = type === 'shop' ? 'shops' : type === 'payment' ? 'payments' : 'profiles';
  const localUrl = toPublicImageUrl(`/uploads/${folderName}/${file.filename}`);

  let cloudinaryUrl = null;

  try {
    cloudinaryUrl = await uploadLocalFileToCloudinary(file.path, folderName);
  } catch (error) {
    console.error('Cloudinary upload failed, using local file:', error.message);
  }

  return {
    url: cloudinaryUrl || localUrl,
    localUrl,
    cloudinaryUrl,
    filename: file.filename,
  };
};

export const resolveImageUrl = async (value, type = 'profiles') => {
  if (!value) return '';

  if (value.includes('res.cloudinary.com') || /cloudinary\.com/i.test(value)) {
    return value.replace(/^http:\/\//i, 'https://');
  }

  if (value.startsWith('data:image/')) {
    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary is not configured for image uploads');
    }

    const folder = CLOUDINARY_FOLDERS[type] || CLOUDINARY_FOLDERS.profiles;
    const result = await cloudinary.uploader.upload(value, {
      folder,
      resource_type: 'image',
    });
    return result.secure_url;
  }

  if (LOCAL_HOST_RE.test(value) || value.startsWith('/')) {
    return toPublicImageUrl(value);
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    if (isCloudinaryConfigured()) {
      try {
        return await uploadRemoteImageToCloudinary(value, type);
      } catch (error) {
        console.error('Remote image Cloudinary upload failed:', error.message);
        return toPublicImageUrl(value);
      }
    }
    return toPublicImageUrl(value);
  }

  return toPublicImageUrl(value);
};

export const removeLocalFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore missing temp files.
  }
};
