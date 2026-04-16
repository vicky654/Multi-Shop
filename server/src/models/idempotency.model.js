const mongoose = require('mongoose');

/**
 * Idempotency — stores the response body of a completed mutating request.
 *
 * When a client sends X-Idempotency-Key and we have a stored response,
 * we return it immediately without re-processing — preventing duplicate
 * sales, double GRNs, or double payments on network retries.
 *
 * TTL index auto-deletes records after 24 hours (keys are single-use).
 */
const idempotencySchema = new mongoose.Schema({
  key:      { type: String, required: true, unique: true },
  response: { type: mongoose.Schema.Types.Mixed, required: true },
  path:     { type: String },             // e.g. POST /api/sales
  userId:   { type: mongoose.Schema.Types.ObjectId },
  createdAt: { type: Date, default: Date.now, expires: 86400 }, // TTL: 24 h
});

module.exports = mongoose.model('Idempotency', idempotencySchema);
