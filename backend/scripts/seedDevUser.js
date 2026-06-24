const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');

const DEFAULT_NAME = 'Test Patient';

const isProduction = process.env.NODE_ENV === 'production';
const allowProductionSeed = process.env.ALLOW_PRODUCTION_SEED === 'true';

const seedUser = async () => {
  if (isProduction && !allowProductionSeed) {
    throw new Error('Refusing to seed a login account in production.');
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required.');
  }

  const email = (process.env.DEV_SEED_EMAIL || '').trim().toLowerCase();
  const password = process.env.DEV_SEED_PASSWORD || '';
  const name = process.env.DEV_SEED_NAME || DEFAULT_NAME;
  const isAdmin = process.env.DEV_SEED_ADMIN === 'true' || email === 'admin@medimeet.com';

  if (!email || !password) {
    throw new Error('DEV_SEED_EMAIL and DEV_SEED_PASSWORD must not be empty.');
  }

  if (password.length < 6) {
    throw new Error('DEV_SEED_PASSWORD must be at least 6 characters.');
  }

  await mongoose.connect(process.env.MONGO_URI);

  let user = await User.findOne({ email });
  const action = user ? 'Updated' : 'Created';

  if (!user) {
    user = new User({
      name,
      email,
      gender: 'Other',
      age: 30,
    });
  }

  user.name = name;
  user.email = email;
  user.password = password;
  user.isAdmin = isAdmin;
  user.gender = user.gender || 'Other';
  user.age = Number.isInteger(user.age) ? user.age : 30;
  user.isTwoFactorEnabled = false;
  user.loginOtp = undefined;
  user.loginOtpExpire = undefined;

  await user.save();

  console.log(`${action} development login account:`);
  console.log(`  email: ${email}`);
  console.log(`  password: ${password}`);
  console.log(`  role: ${isAdmin ? 'admin' : 'patient'}`);
};

seedUser()
  .catch((error) => {
    console.error(`Seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
