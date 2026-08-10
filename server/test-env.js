// Preload hook: forces test mode for CLI scripts (seed, migrations).
//   node -r ./test-env.js seed.js
process.env.NODE_ENV = 'test';
