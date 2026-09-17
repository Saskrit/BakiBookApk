import mongoose from 'mongoose';

/** MongoDB transactions require readPreference "primary" (not primaryPreferred). */
export const startTransactionSession = async () => {
  const session = await mongoose.startSession({
    defaultTransactionOptions: {
      readPreference: 'primary',
    },
  });
  session.startTransaction({ readPreference: 'primary' });
  return session;
};
