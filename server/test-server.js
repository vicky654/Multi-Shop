/**
 * Test-mode entry point.
 *
 * Sets NODE_ENV=test before anything loads, which makes src/config/db.js
 * connect to TEST_DATABASE_URI (and refuse to start if that is missing, equal
 * to MONGODB_URI, or not obviously a test database) and makes app.js mount the
 * /api/test-utils routes the E2E runner needs.
 *
 * Cross-platform — no cross-env dependency needed.
 *
 *   Usage:  npm run dev:test
 */
process.env.NODE_ENV = 'test';
require('./server.js');
