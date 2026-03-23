/**
 * whatsapp.js — Client-side WhatsApp link utilities
 *
 * Uses free wa.me deep links — no API key needed.
 * Works for any WhatsApp-enabled phone number worldwide.
 */

/**
 * Generate a wa.me link for a single phone number + message.
 *
 * Rules:
 *  - Strips all non-digit characters (+, spaces, dashes)
 *  - Auto-prepends Indian country code (91) for 10-digit numbers
 *  - URL-encodes the message
 *
 * @param {string} phone   — raw phone in any format
 * @param {string} message — personalised message (already substituted)
 * @returns {string|null}  — wa.me URL, or null if phone is invalid
 */
export const generateWhatsAppLink = (phone, message) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;

  // Normalise to full number with country code
  const num =
    digits.length === 10 ? `91${digits}`              // Indian 10-digit → +91
    : digits.length === 12 && digits.startsWith('91') ? digits // already +91XXXXXXXXXX
    : digits.length === 11 && digits.startsWith('0')  ? `91${digits.slice(1)}`  // 0XXXXXXXXXX
    : digits;                                          // assume full international

  if (num.length < 10) return null;

  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
};

/**
 * Open WhatsApp chats for a list of customers in browser tabs.
 *
 * Each tab opens with a 500 ms stagger to avoid browser popup blockers.
 * Returns the full list of generated links (for fallback manual-click UI).
 *
 * @param {Array<{name:string, phone:string, due?:string, amount?:string}>} customers
 * @param {string} messageTemplate — may contain {name}, {shop}, {due}, {amount}
 * @param {string} shopName
 * @returns {Array<{name:string, phone:string, url:string}>}
 */
export const sendWhatsAppCampaign = (customers, messageTemplate, shopName = '') => {
  const links = [];

  customers.forEach((c, i) => {
    if (!c.phone) return;

    // Personalise the message for this customer
    const personalised = messageTemplate
      .replace(/\{name\}/gi,   c.name    || 'Customer')
      .replace(/\{shop\}/gi,   shopName)
      .replace(/\{due\}/gi,    c.due     || '0')
      .replace(/\{amount\}/gi, c.amount  || '0');

    const url = generateWhatsAppLink(c.phone, personalised);
    if (!url) return;

    links.push({ name: c.name, phone: c.phone, url });

    // Staggered open: 500 ms per customer (avoids simultaneous popup flood)
    setTimeout(() => {
      window.open(url, '_blank', 'noopener,noreferrer');
    }, i * 500);
  });

  return links;
};
