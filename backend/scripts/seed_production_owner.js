/**
 * RouteXAI — Production Owner Initialization Script
 *
 * Requirements:
 * - Uses environment variables (OWNER_EMAIL, OWNER_PASSWORD, OWNER_NAME, OWNER_PHONE)
 * - Safe idempotent operation: if account already exists, preserves it without modifying password/role
 * - Employs User model bcrypt hashing hook
 * - Never prints passwords, hashes, tokens, or credentials to logs
 * - Strictly sets role to OWNER and isActive to true
 */
const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');

const seedProductionOwner = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('[Seed Error] MONGO_URI environment variable is missing.');
    throw new Error('MONGO_URI is required');
  }

  // 1. Read configuration from environment variables
  const rawEmail = process.env.OWNER_EMAIL || 'owner@routexai.com';
  const rawPassword = process.env.OWNER_PASSWORD || 'RouteXAI@123';
  const name = process.env.OWNER_NAME || 'Vikramaditya Rao';
  const phone = process.env.OWNER_PHONE || '+91 90000 00001';

  // 2. Normalize email address (lowercase and trimmed)
  const normalizedEmail = rawEmail.toLowerCase().trim();

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
    }

    // 3. Idempotent check: Never overwrite an existing account's password or role
    const existingOwner = await User.findOne({ email: normalizedEmail });
    if (existingOwner) {
      console.log(`[Seed Production Owner] Owner account '${normalizedEmail}' already exists in database.`);
      console.log(`[Seed Production Owner] Existing account preserved safely without modifications. Role: ${existingOwner.role}.`);
      return { created: false, preserved: true, userId: existingOwner._id };
    }

    // 4. Create new Owner account using User model (which triggers bcrypt pre('save') hashing)
    const newOwner = await User.create({
      name,
      email: normalizedEmail,
      password: rawPassword,
      role: 'OWNER',
      phone,
      isActive: true
    });

    console.log(`[Seed Production Owner] Initial Owner account '${normalizedEmail}' successfully provisioned with role OWNER.`);
    return { created: true, preserved: false, userId: newOwner._id };
  } catch (error) {
    console.error('[Seed Production Owner Error]:', error.message);
    throw error;
  }
};

if (require.main === module) {
  seedProductionOwner()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async () => {
      if (mongoose.connection.readyState === 1) await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { seedProductionOwner };
