/**
 * sms.service.js — Fast2SMS integration (Global, env-key based)
 *
 * Uses axios GET to https://www.fast2sms.com/dev/bulkV2
 * Route 'q' = Quick Transactional (no DLT needed under 1000/day)
 * API key is read from process.env.FAST2SMS_API_KEY
 */

const axios = require('axios');

const FAST2SMS_URL = 'https://www.fast2sms.com/dev/bulkV2';

/**
 * Normalise any phone input to last 10 digits
 * Strips country code (+91, 0) and non-digits
 */
const normalisePhone = (phone) =>
  String(phone || '').replace(/\D/g, '').slice(-10);

/**
 * Send SMS to one or multiple numbers via Fast2SMS
 *
 * @param {string | string[]} phones  — single number or array of numbers
 * @param {string}            message — SMS body (max 160 chars for single SMS)
 * @returns {Promise<{success: boolean, sent?: number, error?: string}>}
 */
const sendSms = async (phones, message) => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    console.error('[SMS] FAST2SMS_API_KEY not configured');
    return { success: false, error: 'SMS service not configured' };
  }

  const phoneArr = Array.isArray(phones) ? phones : [phones];
  const numbers  = phoneArr
    .map(normalisePhone)
    .filter((n) => n.length === 10)
    .join(',');

  if (!numbers) {
    return { success: false, error: 'No valid 10-digit phone numbers' };
  }

  try {
    const { data } = await axios.get(FAST2SMS_URL, {
      headers: { authorization: apiKey },
      params: {
        route:    'q',
        message,
        numbers,
        language: 'english',
        flash:    0,
      },
      timeout: 12000,
    });

    if (data?.return === true) {
      return { success: true, sent: phoneArr.length };
    }

    const errMsg = Array.isArray(data?.message) ? data.message[0] : (data?.message || 'SMS API error');
    console.error('[SMS] API rejected:', errMsg);
    return { success: false, error: errMsg };
  } catch (err) {
    const msg =
      err.response?.data?.message?.[0] ||
      err.response?.data?.message      ||
      err.message                       ||
      'SMS send failed';
    console.error('[SMS] Request error:', msg);
    return { success: false, error: msg };
  }
};

module.exports = { sendSms, normalisePhone };
