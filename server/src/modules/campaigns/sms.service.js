/**
 * sms.service.js — Fast2SMS integration (India)
 *
 * Docs: https://docs.fast2sms.com
 * Required shop setting: smsApiKey, smsSenderId (optional)
 *
 * Route 'q' = Quick Transactional (no DLT needed for promotional < 1000/day)
 * Route 'dlt' = DLT registered template (required for large volumes)
 *
 * Uses Node.js built-in https module (no axios dependency).
 */

const https = require('https');

const FAST2SMS_HOST = 'www.fast2sms.com';
const FAST2SMS_PATH = '/dev/bulkV2';

/**
 * Send a single SMS via Fast2SMS
 * @param {string}  apiKey   — Fast2SMS API key
 * @param {string}  phone    — 10-digit Indian mobile number
 * @param {string}  message  — SMS body (max 160 chars for single SMS)
 * @param {string}  senderId — optional 6-char sender ID (default: FSTSMS)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const sendSms = (apiKey, phone, message, senderId = 'FSTSMS') => {
  return new Promise((resolve) => {
    // Normalise: strip country code, keep last 10 digits
    const digits = String(phone).replace(/\D/g, '');
    const mobile = digits.slice(-10);
    if (mobile.length !== 10) {
      return resolve({ success: false, error: 'Invalid phone number' });
    }

    const body = JSON.stringify({
      route:     'q',
      message,
      language:  'english',
      flash:     0,
      numbers:   mobile,
      sender_id: senderId,
    });

    const options = {
      hostname: FAST2SMS_HOST,
      path:     FAST2SMS_PATH,
      method:   'POST',
      headers: {
        authorization:  apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (data?.return === true) return resolve({ success: true });
          resolve({ success: false, error: data?.message?.[0] || 'SMS API error' });
        } catch {
          resolve({ success: false, error: 'Invalid response from SMS API' });
        }
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ success: false, error: 'SMS request timed out' });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message || 'SMS send failed' });
    });

    req.write(body);
    req.end();
  });
};

module.exports = { sendSms };
