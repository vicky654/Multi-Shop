/**
 * notification.service.js — High-level SMS notification helpers
 *
 * All functions are fire-and-forget safe (never throw — always resolve).
 * Bulk sends batch numbers in groups of 100 (Fast2SMS limit per request).
 */

const { sendSms, normalisePhone } = require('./sms.service');

const BATCH_SIZE = 100;

// ── Template helper ────────────────────────────────────────────────────────────
/**
 * Replace {name}, {due}, {shop}, {amount}, {invoice} placeholders
 */
const fillTemplate = (template, data = {}) =>
  template
    .replace(/\{name\}/gi,    data.name    || 'Customer')
    .replace(/\{due\}/gi,     String(data.due     || '0'))
    .replace(/\{shop\}/gi,    data.shop    || 'our store')
    .replace(/\{amount\}/gi,  String(data.amount  || '0'))
    .replace(/\{invoice\}/gi, data.invoice || '');

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Send SMS to a single customer
 * @param {Object} customer — must have .phone
 * @param {string} message
 */
const sendToCustomer = async (customer, message) => {
  if (!customer?.phone) return { success: false, error: 'No phone number' };
  return sendSms(customer.phone, message);
};

/**
 * Send the same SMS to multiple customers in batches of 100
 * Customers without valid phones are silently skipped.
 *
 * @param {Object[]} customers — array with .phone property
 * @param {string}   message   — already-final message (no per-customer personalisation)
 */
const sendBulk = async (customers, message) => {
  const valid = customers.filter((c) => normalisePhone(c.phone || '').length === 10);

  if (!valid.length) {
    return { success: false, sent: 0, skipped: customers.length, error: 'No valid phone numbers' };
  }

  let sent = 0;
  const failures = [];

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch  = valid.slice(i, i + BATCH_SIZE);
    const phones = batch.map((c) => c.phone);
    const result = await sendSms(phones, message);

    if (result.success) {
      sent += batch.length;
    } else {
      failures.push({ batchIndex: Math.floor(i / BATCH_SIZE) + 1, error: result.error });
      console.error(`[Notify] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, result.error);
    }
  }

  return {
    success:  failures.length === 0,
    sent,
    skipped:  customers.length - valid.length,
    failures,
  };
};

/**
 * Send personalised due payment reminder to a single customer
 *
 * @param {Object} customer  — { name, phone }
 * @param {string} shopName
 * @param {number} [dueAmount] — optional specific due amount
 */
const sendDueReminder = async (customer, shopName, dueAmount) => {
  const message = fillTemplate(
    'Hi {name}, you have a pending payment at {shop}. Please visit us or call to settle your dues. Thank you!',
    { name: customer.name, shop: shopName, due: dueAmount }
  );
  return sendToCustomer(customer, message);
};

/**
 * Send sale receipt SMS to a single customer (auto-triggered after sale)
 *
 * @param {Object} customer — { name, phone }
 * @param {Object} sale     — { totalAmount, invoiceNumber }
 * @param {string} shopName
 */
const sendReceipt = async (customer, sale, shopName) => {
  const amount = Number(sale.totalAmount || 0).toFixed(0);
  const inv    = sale.invoiceNumber || '';
  const message = `Hi ${customer.name}! Thanks for shopping at ${shopName}. Bill: Rs.${amount}. Invoice: ${inv}. Visit again!`;
  return sendToCustomer(customer, message);
};

module.exports = { sendToCustomer, sendBulk, sendDueReminder, sendReceipt, fillTemplate };
