/**
 * RouteXAI — Production Authentication & Role Authorization Test Suite
 *
 * Verifies all 13 Phase 5 requirements:
 * 1. Owner login with valid credentials
 * 2. Login with incorrect password
 * 3. Login with nonexistent email
 * 4. Email case normalization
 * 5. Missing email or password
 * 6. Correct JWT generation
 * 7. Invalid JWT rejection
 * 8. Owner role authorization
 * 9. Driver role authorization
 * 10. Customer role authorization
 * 11. Duplicate Owner seeding prevention
 * 12. Existing Owner account preservation
 * 13. Frontend/backend request-response compatibility
 */
const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const { loginUser } = require('./controllers/authController');
const { protect, authorize } = require('./middleware/authMiddleware');
const { seedProductionOwner } = require('./scripts/seed_production_owner');

async function runAuthTests() {
  console.log('====================================================');
  console.log('   ROUTEXAI PRODUCTION AUTHENTICATION TEST SUITE    ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}`);
      failed++;
    }
  }

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/routexai';
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
  }

  const JWT_SECRET = process.env.JWT_SECRET || 'routexai_super_secret_jwt_key_2026_capstone_project';

  // Helper mock invoker for loginUser controller
  const invokeLogin = async (body) => {
    let statusCode = 200;
    let responseData = null;
    const req = { body };
    const res = {
      status: (c) => {
        statusCode = c;
        return {
          json: (d) => { responseData = d; }
        };
      },
      json: (d) => { responseData = d; }
    };
    const next = (err) => {
      if (err) {
        statusCode = 500;
        responseData = { success: false, message: err.message };
      }
    };
    await loginUser(req, res, next);
    return { statusCode, responseData };
  };

  // --- Test 1: Owner login with valid credentials ---
  console.log('Test Group 1: Credential Validation & Normalization...');
  {
    const { statusCode, responseData } = await invokeLogin({
      email: 'owner@routexai.com',
      password: 'RouteXAI@123'
    });
    assert(statusCode === 200, 'Valid Owner login returns HTTP 200');
    assert(responseData?.success === true, 'Response indicates success: true');
    assert(responseData?.data?.role === 'OWNER', 'User data contains role: "OWNER"');
    assert(Boolean(responseData?.data?.token), 'User data contains JWT token');
  }

  // --- Test 2: Login with incorrect password ---
  {
    const { statusCode, responseData } = await invokeLogin({
      email: 'owner@routexai.com',
      password: 'WrongPassword@999'
    });
    assert(statusCode === 401, 'Incorrect password returns HTTP 401');
    assert(responseData?.success === false, 'Incorrect password returns success: false');
    assert(responseData?.message === 'Invalid email or password', 'Returns standard error message');
  }

  // --- Test 3: Login with nonexistent email ---
  {
    const { statusCode, responseData } = await invokeLogin({
      email: 'nonexistent.user.999@example.com',
      password: 'RouteXAI@123'
    });
    assert(statusCode === 401, 'Nonexistent email returns HTTP 401');
    assert(responseData?.message === 'Invalid email or password', 'Returns generic failure message for security');
  }

  // --- Test 4: Email case normalization ---
  {
    const { statusCode, responseData } = await invokeLogin({
      email: '  OWNER@RouteXAI.COM  ',
      password: 'RouteXAI@123'
    });
    assert(statusCode === 200, 'Uppercase & whitespace-padded email successfully normalizes and logs in');
    assert(responseData?.data?.email === 'owner@routexai.com', 'Resulting email in response is normalized lowercase');
  }

  // --- Test 5: Missing email or password ---
  {
    const missingPass = await invokeLogin({ email: 'owner@routexai.com' });
    const missingEmail = await invokeLogin({ password: 'RouteXAI@123' });
    assert(missingPass.statusCode === 400 && missingEmail.statusCode === 400, 'Missing email or password returns HTTP 400');
    assert(missingPass.responseData?.message === 'Please provide email and password', 'Missing fields message validated');
  }

  // --- Test 6: Correct JWT Generation ---
  console.log('\nTest Group 2: Token Generation & Verification...');
  let validToken = null;
  let ownerDoc = null;
  {
    ownerDoc = await User.findOne({ email: 'owner@routexai.com' });
    const { responseData } = await invokeLogin({ email: 'owner@routexai.com', password: 'RouteXAI@123' });
    validToken = responseData?.data?.token;

    const decoded = jwt.verify(validToken, JWT_SECRET);
    assert(decoded.id === String(ownerDoc._id), 'JWT payload id matches Owner document ID');
    assert(Boolean(decoded.exp), 'JWT contains valid expiration claim');
  }

  // --- Test 7: Invalid JWT Rejection ---
  {
    let statusCode = 200;
    let message = '';
    const req = { headers: { authorization: 'Bearer invalid.tampered.token' } };
    const res = {
      status: (c) => {
        statusCode = c;
        return { json: (d) => { message = d?.message; } };
      }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await protect(req, res, next);
    assert(statusCode === 401 && !nextCalled, 'Tampered/invalid JWT is rejected with HTTP 401');
  }

  // --- Test 8, 9, 10: Role-Based Authorization ---
  console.log('\nTest Group 3: Role-Based Authorization...');
  {
    const runAuthCheck = (rolesAllowed, userRole) => {
      let allowed = false;
      let statusCode = 200;
      const req = { user: { role: userRole } };
      const res = {
        status: (c) => {
          statusCode = c;
          return { json: () => {} };
        }
      };
      const next = () => { allowed = true; };
      authorize(...rolesAllowed)(req, res, next);
      return { allowed, statusCode };
    };

    // Owner checks
    const ownerAllowed = runAuthCheck(['OWNER'], 'OWNER');
    const ownerDeniedForDriverOnly = runAuthCheck(['DRIVER'], 'OWNER');
    assert(ownerAllowed.allowed && ownerAllowed.statusCode === 200, 'OWNER permitted on OWNER endpoint');
    assert(!ownerDeniedForDriverOnly.allowed && ownerDeniedForDriverOnly.statusCode === 403, 'OWNER denied on DRIVER-exclusive endpoint');

    // Driver checks
    const driverAllowed = runAuthCheck(['DRIVER'], 'DRIVER');
    const driverDeniedForOwnerOnly = runAuthCheck(['OWNER'], 'DRIVER');
    assert(driverAllowed.allowed && driverAllowed.statusCode === 200, 'DRIVER permitted on DRIVER endpoint');
    assert(!driverDeniedForOwnerOnly.allowed && driverDeniedForOwnerOnly.statusCode === 403, 'DRIVER denied on OWNER-exclusive endpoint');

    // Customer checks
    const customerAllowed = runAuthCheck(['CUSTOMER'], 'CUSTOMER');
    const customerDeniedForOwnerOnly = runAuthCheck(['OWNER'], 'CUSTOMER');
    assert(customerAllowed.allowed && customerAllowed.statusCode === 200, 'CUSTOMER permitted on CUSTOMER endpoint');
    assert(!customerDeniedForOwnerOnly.allowed && customerDeniedForOwnerOnly.statusCode === 403, 'CUSTOMER denied on OWNER-exclusive endpoint');
  }

  // --- Test 11 & 12: Production Seeding Safety & Preservation ---
  console.log('\nTest Group 4: Seeding Idempotency & Safety...');
  {
    const preSeedOwner = await User.findOne({ email: 'owner@routexai.com' });
    const seedResult = await seedProductionOwner();

    assert(seedResult.preserved === true, 'Seeding detects existing Owner and sets preserved = true');
    assert(seedResult.created === false, 'Seeding does NOT create a duplicate account');

    const postSeedOwner = await User.findOne({ email: 'owner@routexai.com' }).select('+password');
    assert(String(preSeedOwner._id) === String(postSeedOwner._id), 'Existing Owner ID is unchanged');
    assert(preSeedOwner.role === postSeedOwner.role, 'Existing Owner role is preserved');

    const passwordMatches = await postSeedOwner.matchPassword('RouteXAI@123');
    assert(passwordMatches === true, 'Existing Owner password remains valid and unmodified');
  }

  // --- Test 13: Frontend/Backend Compatibility ---
  console.log('\nTest Group 5: Frontend/Backend Contract Compatibility...');
  {
    const { responseData } = await invokeLogin({
      email: 'owner@routexai.com',
      password: 'RouteXAI@123'
    });

    // Check all fields that AuthContext.jsx and Login.jsx depend on
    const d = responseData?.data;
    assert(Boolean(d?._id), 'Response includes _id required by AuthContext');
    assert(Boolean(d?.name), 'Response includes name required by Navbar');
    assert(Boolean(d?.email), 'Response includes email');
    assert(d?.role === 'OWNER', 'Response includes role === "OWNER" required by Login role verification');
    assert(typeof d?.token === 'string' && d?.token.length > 20, 'Response includes valid token string');
  }

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================\n');

  await mongoose.disconnect();

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runAuthTests().catch((e) => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
