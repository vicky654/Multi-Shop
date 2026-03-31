/**
 * Bill / Expense Parser Service
 * - parseText: regex-based extraction from raw bill text (no external API)
 * - parseImage: OpenAI Vision extraction from bill/receipt image
 * Both return: [{ name, price, qty, category }]
 */

const MAX_ITEMS = 20;

// ── Text Parser ───────────────────────────────────────────────────────────────
// Handles common bill formats:
//   "Milk 50 10"          → name price qty
//   "Milk x10 @50"        → name qty price
//   "Milk - Rs.50 (10)"   → with symbols stripped
//   "1. Milk 50.00 10"    → with list numbers
const parseText = (text) => {
  if (!text || typeof text !== 'string') return [];

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && !/^[-=*#]+$/.test(l)); // skip dividers

  const items = [];

  for (const line of lines) {
    // Skip lines that look like headers / totals / dates
    if (/total|subtotal|discount|tax|gst|date|invoice|bill|receipt|amount|grand/i.test(line)) continue;

    // Strip list numbers at start: "1.", "2)", "#3"
    const cleaned = line.replace(/^[\d]+[.)]\s*/, '').trim();

    // Extract all number tokens (handles ₹50, Rs.50, 50.00, 1,000)
    const numTokens = [...cleaned.matchAll(/[\d,]+(?:\.\d+)?/g)].map((m) => ({
      value: parseFloat(m[0].replace(/,/g, '')),
      index: m.index,
    }));

    if (numTokens.length < 1) continue;

    let price = 0;
    let qty   = 1;
    let nameEnd = cleaned.length;

    if (numTokens.length >= 2) {
      // Heuristic: larger number = price, smaller = qty (for typical retail)
      const a = numTokens[numTokens.length - 2];
      const b = numTokens[numTokens.length - 1];

      // If qty-indicator keywords appear ("x", "qty", "nos", "pcs")
      const hasQtyKeyword = /\bx\b|\bqty\b|\bnos?\b|\bpcs?\b|\bunits?\b/i.test(cleaned);

      if (hasQtyKeyword) {
        // e.g. "Milk x10 @50"  or "Milk qty:5 price:50"
        price = Math.max(a.value, b.value);
        qty   = Math.min(a.value, b.value);
      } else if (b.value <= 100 && a.value > b.value) {
        // Last number looks like qty (small), second-last = price
        price = a.value;
        qty   = b.value;
      } else {
        // Default: last = qty, second-last = price
        price = a.value;
        qty   = b.value;
      }
      nameEnd = Math.min(a.index, b.index);
    } else if (numTokens.length === 1) {
      price   = numTokens[0].value;
      nameEnd = numTokens[0].index;
    }

    // Extract name: everything before the first number token
    const rawName = cleaned
      .slice(0, nameEnd)
      .replace(/[₹@#\-:,/\\()\[\]]/g, ' ')
      .replace(/\brs\.?\b|\binr\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!rawName || rawName.length < 2) continue;
    if (price <= 0)                      continue;

    items.push({
      name:     rawName.charAt(0).toUpperCase() + rawName.slice(1),
      price:    Math.round(price * 100) / 100,
      qty:      Math.max(1, Math.round(qty)),
      category: guessCategory(rawName),
    });

    if (items.length >= MAX_ITEMS) break;
  }

  return items;
};

// Simple keyword-based category guesser
const guessCategory = (name) => {
  const n = name.toLowerCase();
  if (/milk|bread|rice|flour|oil|sugar|salt|spice|dal|wheat|egg|butter|cheese|yogurt|curd/i.test(n)) return 'Grocery';
  if (/shirt|pant|dress|trouser|saree|kurta|jacket|shoe|sandal|slipper|belt|watch|bag/i.test(n)) return 'Clothing';
  if (/phone|mobile|laptop|tablet|charger|cable|battery|earphone|speaker|tv|fridge|washing/i.test(n)) return 'Electronics';
  if (/shampoo|soap|toothpaste|cream|lotion|face|hair|body|sanitizer|deo|perfume/i.test(n)) return 'Personal Care';
  if (/medicine|tablet|capsule|syrup|cream|ointment|drop|injection/i.test(n)) return 'Medicine';
  if (/toy|game|puzzle|doll|ball|bat|cycle|board/i.test(n)) return 'Toys';
  return 'General';
};

// ── Image Parser (OpenAI Vision) ──────────────────────────────────────────────
const parseImage = async (buffer, mimetype) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('Image parsing requires OPENAI_API_KEY to be configured'), { status: 503 });
  }

  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey });
  const b64    = buffer.toString('base64');

  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `This is a bill, receipt, or purchase order. Extract all line items.
Return ONLY valid JSON in this exact format (no markdown, no explanation):
{"items":[{"name":"product name","price":50,"qty":1},{"name":"another product","price":30,"qty":2}]}
Rules:
- name: short product/item name (max 50 chars)
- price: unit price as a number
- qty: quantity as a number (default 1 if not shown)
- Exclude totals, taxes, discounts, headers
- Maximum ${MAX_ITEMS} items`,
        },
        {
          type: 'image_url',
          image_url: { url: `data:${mimetype};base64,${b64}`, detail: 'high' },
        },
      ],
    }],
    max_tokens: 1000,
  });

  const raw     = completion.choices[0]?.message?.content || '{"items":[]}';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  return (parsed.items || [])
    .slice(0, MAX_ITEMS)
    .filter((i) => i.name && i.price > 0)
    .map((i) => ({
      name:     String(i.name).trim(),
      price:    Math.round(parseFloat(i.price) * 100) / 100,
      qty:      Math.max(1, Math.round(parseFloat(i.qty) || 1)),
      category: guessCategory(String(i.name)),
    }));
};

module.exports = { parseText, parseImage };
