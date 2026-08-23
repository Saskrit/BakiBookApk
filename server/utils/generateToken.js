import jwt from 'jsonwebtoken';

const generateToken = (userId, role) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  // Keep users signed in for 30 days unless overridden by env.
  const expiresIn = process.env.JWT_EXPIRES_IN || '30d';

  return jwt.sign({ id: userId, role }, secret, { expiresIn });
};

export default generateToken;
