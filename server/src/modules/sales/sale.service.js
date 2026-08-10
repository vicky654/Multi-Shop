const mongoose      = require('mongoose');
const Sale          = require('./sale.model');
const Product       = require('../products/product.model');
const Customer      = require('../customers/customer.model');
const Shop          = require('../shops/shop.model');
const cache         = require('../../utils/cache');
const ledgerService = require('../customers/creditLedger.service');
const stockService  = require('../inventory/stock.service');
const { isValidVpa, isValidTxnRef } = require('../../utils/upi');
const { computeInvoice } = require('../../utils/gst');
const { nextInvoiceNumber } = require('./invoiceCounter.model');

// ── Build enriched items from raw cart items ──────────────────────────────────
// preservePrice: when true (offline-synced sales), use item.price if set so
// the sale is recorded at the price the customer was shown, not the current DB price.
// skipStockCheck: used when editing an existing bill — that bill already holds
// its stock, so availability is judged on the *delta* (see buildStockDeltaOps)
// rather than the full new quantity, which would wrongly reject reductions.
const enrichItems = async (items, { preservePrice = false, skipStockCheck = false, skipExpiryCheck = false } = {}) => {
  let totalAmount = 0, totalDiscount = 0, totalProfit = 0;
  const enrichedItems = [];

  // Batch-fetch all products in one query instead of one per item
  const ids = [...new Set(items.map((i) => i.productId).filter(Boolean))];
  const products = await Product.find({ _id: { $in: ids }, isActive: true }).lean();
  const productMap = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

  for (const item of items) {
    const product = productMap[item.productId?.toString()];
    if (!product)
      throw Object.assign(new Error(`Product "${item.name || item.productId}" not found`), { status: 400 });

    const size  = item.selectedSize  || item.size  || '';
    const color = item.selectedColor || item.color || '';
    const qty   = Number(item.quantity);

    // ── Expiry guard ───────────────────────────────────────────────────────────
    // Enforced here, not just in the client cart: the API is reachable directly
    // (offline sync, public checkout, integrations), so a client-only check let
    // expired stock be sold. Skipped for edits of an already-recorded bill,
    // where the goods left the shelf before the expiry date passed.
    // Gated on expiryDate alone, NOT on trackExpiry: that flag controls expiry
    // *reporting*, so requiring it would let any product with a known-past
    // expiry date be sold simply because nobody ticked the box.
    if (!skipExpiryCheck && product.expiryDate) {
      const expiry = new Date(product.expiryDate);
      if (expiry < new Date()) {
        throw Object.assign(
          new Error(
            `"${product.name}" expired on ${expiry.toLocaleDateString('en-IN')} and cannot be sold`
          ),
          { status: 400 }
        );
      }
    }

    // ── Variant-level stock check ──────────────────────────────────────────────
    if (product.trackVariantStock && (size || color)) {
      const variant = (product.variantStock || []).find(
        (v) => v.size === size && v.color === color
      );
      if (!variant)
        throw Object.assign(new Error(`Variant (${size}/${color}) not found for "${product.name}"`), { status: 400 });
      if (!skipStockCheck && variant.stock < qty)
        throw Object.assign(new Error(`Insufficient stock for "${product.name}" [${size}/${color}]`), { status: 400 });
    } else {
      if (!skipStockCheck && product.stock < qty)
        throw Object.assign(new Error(`Insufficient stock for "${product.name}"`), { status: 400 });
    }

    const discount        = item.discount || 0;
    const productDiscount = product.discount || 0;
    const effectiveDisc   = Math.max(discount, productDiscount);
    // Offline sales preserve the price shown to the customer at the time of sale.
    // Online sales always use the current DB price.
    const basePrice       = preservePrice && item.price > 0 ? item.price : product.price;
    const discountedPrice = basePrice * (1 - effectiveDisc / 100);
    const subtotal        = +(discountedPrice * qty).toFixed(2);
    const profit          = +((discountedPrice - product.costPrice) * qty).toFixed(2);

    enrichedItems.push({
      product:       product._id,
      name:          product.name,
      price:         product.price,
      costPrice:     product.costPrice,
      quantity:      qty,
      discount:      effectiveDisc,
      subtotal,
      profit,
      selectedSize:  size,
      selectedColor: color,
      sku:           product.sku     || '',
      hsnCode:       product.hsnCode || '',
      unit:          product.unit    || 'pcs',
      // Carry variant tracking flag for deductStock
      _trackVariant: product.trackVariantStock && !!(size || color),
    });

    totalAmount   += subtotal;
    totalDiscount += +((product.price - discountedPrice) * qty).toFixed(2);
    totalProfit   += profit;
  }

  return { enrichedItems, totalAmount, totalDiscount, totalProfit };
};

// ── Stock movement (the single source of truth for moving Product stock) ──────
//
// Root `stock` is the product's total on-hand quantity; `variantStock[]` breaks
// that same total down per size/colour. They must therefore move TOGETHER: a
// variant sale decrements the matching variant entry AND root stock in one
// atomic update, so root never drifts away from sum(variantStock).
//
// Every path that moves stock goes through here — deduct, restore, refund,
// partial refund — which is what keeps deductions and restorations symmetric.
// Adding a movement path without using this helper is how double-deduction bugs
// get introduced.
//
//   sign = -1 → deduct (guarded: refuses to go negative)
//   sign = +1 → restore
const buildStockMovementOps = (items, sign, trackMap = {}) =>
  items.map((item) => {
    const size  = item.selectedSize  || '';
    const color = item.selectedColor || '';
    const qty   = Number(item.quantity);
    const delta = sign * qty;

    // Enriched items carry _trackVariant; stored sale items need the lookup.
    const isVariant = item._trackVariant !== undefined
      ? item._trackVariant
      : !!(trackMap[item.product?.toString()] && (size || color));

    // Only deductions need an availability guard
    const guard = sign < 0 ? { stock: { $gte: qty } } : {};

    if (isVariant) {
      return {
        updateOne: {
          filter: {
            _id: item.product,
            variantStock: { $elemMatch: { size, color, ...guard } },
            ...guard,
          },
          // Keep the breakdown and the total in lockstep
          update: { $inc: { 'variantStock.$.stock': delta, stock: delta } },
        },
      };
    }

    return {
      updateOne: {
        filter: { _id: item.product, ...guard },
        update: { $inc: { stock: delta } },
      },
    };
  });

// Resolve which of these products track variant stock (for stored sale items,
// which don't carry the _trackVariant flag).
const getTrackVariantMap = async (items, session) => {
  const ids = [...new Set(items.map((i) => i.product?.toString()).filter(Boolean))];
  const products = await Product.find({ _id: { $in: ids } }, null, { session })
    .select('trackVariantStock')
    .lean();
  return Object.fromEntries(products.map((p) => [p._id.toString(), p.trackVariantStock]));
};

// ── Atomic stock deduction (runs inside a transaction session) ─────────────────
const deductStock = async (enrichedItems, session) => {
  const ops = buildStockMovementOps(enrichedItems, -1);
  const result = await Product.bulkWrite(ops, { session, ordered: false });

  if (result.modifiedCount < enrichedItems.length) {
    throw Object.assign(
      new Error('One or more items ran out of stock — please refresh and retry'),
      { status: 409 }
    );
  }
};

// ── Variant-aware stock restore (refunds, abandoned UPI payments) ─────────────
const restoreStock = async (items, session) => {
  if (!items?.length) return;
  const trackMap = await getTrackVariantMap(items, session);
  const ops = buildStockMovementOps(items, +1, trackMap);
  if (ops.length) await Product.bulkWrite(ops, { session, ordered: false });
};

// ── Stock deltas for a bill edit ──────────────────────────────────────────────
// Compares the stored line items with the incoming ones per
// product+size+color, then emits one guarded $inc per changed key.
// Only the difference moves, so a bill that already holds 4 units and drops to
// 2 returns exactly 2 — the goods are never briefly released and resold.
const lineKey = (productId, size, color) => `${productId}|${size || ''}|${color || ''}`;

const buildStockDeltaOps = async (oldItems, newItems) => {
  const qty = new Map(); // key → { productId, size, color, delta, name }

  const bump = (item, sign) => {
    const productId = item.product?.toString();
    if (!productId) return;
    const size  = item.selectedSize  || '';
    const color = item.selectedColor || '';
    const key   = lineKey(productId, size, color);
    const prev  = qty.get(key) || { productId, size, color, delta: 0, name: item.name };
    prev.delta += sign * Number(item.quantity);
    qty.set(key, prev);
  };

  oldItems.forEach((i) => bump(i, -1)); // giving back what the bill held
  newItems.forEach((i) => bump(i, +1)); // taking what it now needs

  const changed = [...qty.values()].filter((e) => Math.abs(e.delta) > 1e-9);
  if (!changed.length) return { ops: [], insufficient: [] };

  const ids      = [...new Set(changed.map((e) => e.productId))];
  const products = await Product.find({ _id: { $in: ids } })
    .select('name stock trackVariantStock variantStock')
    .lean();
  const pMap     = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

  const ops          = [];
  const insufficient = [];

  for (const entry of changed) {
    const product = pMap[entry.productId];
    if (!product) {
      insufficient.push(entry.name || entry.productId);
      continue;
    }

    const isVariant = product.trackVariantStock && (entry.size || entry.color);
    // delta > 0 → the bill needs MORE stock, so check availability up front
    if (entry.delta > 0) {
      const available = isVariant
        ? (product.variantStock || []).find((v) => v.size === entry.size && v.color === entry.color)?.stock ?? 0
        : product.stock;
      if (available < entry.delta) {
        insufficient.push(`${product.name} (need ${entry.delta}, have ${available})`);
        continue;
      }
    }

    if (isVariant) {
      ops.push({
        updateOne: {
          filter: {
            _id: entry.productId,
            variantStock: {
              $elemMatch: {
                size:  entry.size,
                color: entry.color,
                ...(entry.delta > 0 ? { stock: { $gte: entry.delta } } : {}),
              },
            },
            ...(entry.delta > 0 ? { stock: { $gte: entry.delta } } : {}),
          },
          // Root and variant move together — same rule as buildStockMovementOps
          update: { $inc: { 'variantStock.$.stock': -entry.delta, stock: -entry.delta } },
        },
      });
    } else {
      ops.push({
        updateOne: {
          filter: {
            _id: entry.productId,
            ...(entry.delta > 0 ? { stock: { $gte: entry.delta } } : {}),
          },
          update: { $inc: { stock: -entry.delta } },
        },
      });
    }
  }

  return { ops, insufficient };
};

// ── Human-readable diff for the audit trail ───────────────────────────────────
const describeChanges = (sale, newItems, { newTaxRate, newMethod, newTotal }) => {
  const changes = [];
  const label   = (i) => [i.name, i.selectedSize, i.selectedColor].filter(Boolean).join(' ');

  const oldMap = new Map(sale.items.map((i) => [lineKey(i.product?.toString(), i.selectedSize, i.selectedColor), i]));
  const newMap = new Map(newItems.map((i) => [lineKey(i.product?.toString(), i.selectedSize, i.selectedColor), i]));

  for (const [key, oldItem] of oldMap) {
    const newItem = newMap.get(key);
    if (!newItem) {
      changes.push(`Removed ${label(oldItem)} (was ×${oldItem.quantity})`);
      continue;
    }
    if (Number(oldItem.quantity) !== Number(newItem.quantity))
      changes.push(`${label(oldItem)}: qty ${oldItem.quantity} → ${newItem.quantity}`);
    if (+Number(oldItem.price).toFixed(2) !== +Number(newItem.price).toFixed(2))
      changes.push(`${label(oldItem)}: price ₹${oldItem.price} → ₹${newItem.price}`);
    if (+Number(oldItem.discount || 0).toFixed(2) !== +Number(newItem.discount || 0).toFixed(2))
      changes.push(`${label(oldItem)}: discount ${oldItem.discount || 0}% → ${newItem.discount || 0}%`);
  }

  for (const [key, newItem] of newMap) {
    if (!oldMap.has(key)) changes.push(`Added ${label(newItem)} ×${newItem.quantity}`);
  }

  if (Number(sale.taxRate) !== Number(newTaxRate))
    changes.push(`Tax ${sale.taxRate}% → ${newTaxRate}%`);
  if (sale.paymentMethod !== newMethod)
    changes.push(`Payment ${sale.paymentMethod} → ${newMethod}`);
  if (+sale.totalAmount.toFixed(2) !== +newTotal.toFixed(2))
    changes.push(`Total ₹${sale.totalAmount.toFixed(2)} → ₹${newTotal.toFixed(2)}`);

  return changes.length ? changes : ['No line changes recorded'];
};

// ── Admin (staff) sale ────────────────────────────────────────────────────────
const createSale = async (user, data) => {
  const { shopId, items, customerId, paymentMethod, payments, notes, taxRate = 0,
          isPrivate = false, dueAmount = 0, offlineId, upiQr = false } = data;

  if (!items?.length) throw Object.assign(new Error('No items in sale'), { status: 400 });

  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === shopId)) {
    throw Object.assign(new Error('No access to this shop'), { status: 403 });
  }

  // ── Idempotency check for offline-synced sales ──────────────────────────────
  // If this sale was created offline (has an offlineId), check whether we've
  // already processed it. This prevents duplicate records if the device retries
  // a sync after a network hiccup mid-request.
  if (offlineId) {
    const existing = await Sale.findOne({ offlineId })
      .populate(['customerId', 'staffId', { path: 'shopId', select: 'name address phone currency taxRate logo' }])
      .lean();
    if (existing) return existing; // already synced — return the stored sale
  }

  const { enrichedItems, totalAmount, totalDiscount, totalProfit } = await enrichItems(
    items,
    { preservePrice: !!offlineId } // honour original sale price for offline-synced sales
  );

  // ── GST: computed server-side, never trusted from the client ─────────────────
  // The shop supplies the GST configuration; the customer's GSTIN (if any)
  // determines place of supply and therefore CGST+SGST vs IGST.
  const gstShop = await Shop.findById(shopId)
    .select('gstNumber stateCode gstMode invoicePrefix invoiceRoundOff taxRate name')
    .lean();
  if (!gstShop) throw Object.assign(new Error('Shop not found'), { status: 404 });

  const gstCustomer = customerId
    ? await Customer.findById(customerId).select('gstNumber stateCode').lean()
    : null;

  const placeOfSupplyCode = gstCustomer?.stateCode || gstShop.stateCode || null;

  // Each line's charged unit price is subtotal/quantity — the discount is already
  // applied by enrichItems, so it is passed through as the taxable value rather
  // than re-deriving a percentage (which would double-apply product discounts).
  const invoice = computeInvoice({
    lines: enrichedItems.map((i) => ({
      price:       i.quantity ? i.subtotal / i.quantity : 0,
      quantity:    i.quantity,
      discountPct: 0,
      taxRate,
      name:        i.name,
      hsnCode:     i.hsnCode,
    })),
    gstMode:  gstShop.gstMode || 'exclusive',
    sellerStateCode: gstShop.stateCode || null,
    placeOfSupplyCode,
    roundOff: gstShop.invoiceRoundOff !== false,
  });

  const taxAmount  = invoice.totalTax;
  const finalTotal = invoice.grandTotal;
  const ownerId    = user.role === 'owner' ? user._id : (user.ownerId || user._id);

  // Surfaced on the invoice instead of silently issuing a possibly-wrong split.
  const gstConfigWarning = !invoice.stateKnown && taxRate > 0
    ? 'Shop GSTIN/state not configured — tax shown as intra-state (CGST+SGST). Set GSTIN in Settings.'
    : '';

  const gstBreakdown = {
    mode:              invoice.gstMode,
    interState:        invoice.interState,
    sellerGstin:       gstShop.gstNumber || '',
    customerGstin:     gstCustomer?.gstNumber || '',
    sellerStateCode:   invoice.sellerStateCode || '',
    placeOfSupplyCode: invoice.placeOfSupplyCode || '',
    placeOfSupply:     invoice.placeOfSupply || '',
    taxableAmount:     invoice.taxableAmount,
    cgstAmount:        invoice.cgstAmount,
    sgstAmount:        invoice.sgstAmount,
    igstAmount:        invoice.igstAmount,
    roundOff:          invoice.roundOff,
    configWarning:     gstConfigWarning,
  };

  // ── Resolve primary payment method (for backward compat) ─────────────────────
  // When payments[] is supplied, derive paymentMethod from largest tender.
  let resolvedMethod = paymentMethod || 'cash';
  let resolvedPayments = [];
  if (Array.isArray(payments) && payments.length > 0) {
    // ── Split payment validation ──────────────────────────────────────────────
    // Validate BEFORE filtering: the old code silently dropped any entry with
    // amount <= 0, so a zero or negative tender was accepted and the recorded
    // payments no longer explained the bill total.
    payments.forEach((p, i) => {
      const amt = Number(p.amount);
      if (!Number.isFinite(amt))
        throw Object.assign(new Error(`Payment ${i + 1} has an invalid amount`), { status: 400 });
      if (amt <= 0)
        throw Object.assign(
          new Error(`Payment ${i + 1} (${p.method}) must be greater than ₹0 — got ₹${amt}`),
          { status: 400 }
        );
    });

    const tendered = +payments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2);
    // Allow a 1 paisa rounding tolerance, nothing more.
    if (Math.abs(tendered - finalTotal) > 0.01) {
      const diff = +(tendered - finalTotal).toFixed(2);
      throw Object.assign(
        new Error(
          `Split payment mismatch: tendered ₹${tendered.toFixed(2)} does not match the bill total ` +
          `₹${finalTotal.toFixed(2)} (${diff > 0 ? `₹${diff.toFixed(2)} over` : `₹${Math.abs(diff).toFixed(2)} short`})`
        ),
        { status: 400 }
      );
    }

    resolvedPayments = payments.map((p) => ({ method: p.method, amount: Number(p.amount) }));
    const largest = resolvedPayments.reduce((a, b) => (b.amount > a.amount ? b : a), resolvedPayments[0]);
    resolvedMethod = largest?.method || 'cash';
  }

  // Strip internal _trackVariant flag before persisting
  const saleItems = enrichedItems.map(({ _trackVariant, ...rest }) => rest);

  // ── UPI QR sales start unsettled ────────────────────────────────────────────
  // Stock is still deducted up front so the goods can't be double-sold while
  // the customer is paying, but the bill stays 'pending' (and therefore out of
  // all revenue reports, which filter on status:'completed') until a
  // transaction reference is recorded via verifyUpiPayment.
  const isUpiQrSale = !!upiQr && resolvedMethod === 'upi';
  const upiRefId    = isUpiQrSale ? `UPI${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1e4)}` : '';
  const shopUpi     = isUpiQrSale
    ? await Shop.findById(shopId).select('upiSettings name').lean()
    : null;

  if (isUpiQrSale) {
    if (!shopUpi?.upiSettings?.enabled || !isValidVpa(shopUpi.upiSettings.vpa)) {
      throw Object.assign(
        new Error('UPI QR is not configured for this shop — set it up in Settings → Payments'),
        { status: 400 }
      );
    }
  }

  // ── Credit limit ────────────────────────────────────────────────────────────
  // Checked before the transaction opens so a rejected sale leaves stock and the
  // customer's balance completely untouched. creditLimit 0 means unlimited.
  if (resolvedMethod === 'credit' && customerId) {
    const customer = await Customer.findById(customerId).select('name creditBalance creditLimit').lean();
    if (!customer) throw Object.assign(new Error('Customer not found'), { status: 400 });

    const limit = Number(customer.creditLimit) || 0;
    if (limit > 0) {
      const owed     = Number(customer.creditBalance) || 0;
      const newDue   = Math.min(finalTotal, Math.max(0, Number(dueAmount) || 0)) || finalTotal;
      const proposed = +(owed + newDue).toFixed(2);

      if (proposed > limit + 0.01) {
        throw Object.assign(
          new Error(
            `Credit limit exceeded for ${customer.name}: outstanding ₹${owed.toFixed(2)} ` +
            `+ ₹${newDue.toFixed(2)} = ₹${proposed.toFixed(2)} exceeds the ₹${limit.toFixed(2)} limit ` +
            `(₹${Math.max(0, limit - owed).toFixed(2)} available)`
          ),
          { status: 400 }
        );
      }
    }
  }

  // ── Reserve the invoice number BEFORE the transaction ───────────────────────
  // Deliberately outside: `withTransaction` retries its callback on transient
  // errors (write conflict, or the upsert creating the counter collection), and
  // re-running the reservation inside made a retry consume a second number while
  // the first was still claimed — surfacing as a duplicate-key 409 and a FAILED
  // SALE. The counter is atomic on its own, so reserving here is safe.
  //
  // Trade-off: a rolled-back sale burns its number, leaving a gap in the series.
  // A gap is an accounting annotation; a failed sale at the counter is lost
  // revenue. Gaps are traceable via invoiceSeq, so this is the safer default.
  const { invoiceNumber, seq, fy } = await nextInvoiceNumber(shopId, {
    prefix: gstShop.invoicePrefix || 'INV',
  });

  const session = await mongoose.startSession();
  let sale;

  try {
    await session.withTransaction(async () => {
      // Deduct stock atomically — 409 if any item's stock is exhausted
      await deductStock(enrichedItems, session);

      // Create sale document inside the same transaction
      [sale] = await Sale.create([{
        invoiceNumber,
        invoiceSeq: seq,
        invoiceFy:  fy,
        gst: gstBreakdown,
        items: saleItems,
        totalAmount: finalTotal,
        totalDiscount,
        totalProfit,
        taxAmount,
        taxRate,
        paymentMethod: resolvedMethod,
        payments:      resolvedPayments,
        customerId:    customerId || null,
        shopId,
        ownerId,
        staffId:    user._id,
        notes,
        status:        isUpiQrSale ? 'pending' : 'completed',
        paymentStatus: isUpiQrSale ? 'pending' : 'paid',
        isUpiQr:       isUpiQrSale,
        ...(isUpiQrSale ? {
          upiTxn: {
            refId:         upiRefId,
            vpa:           shopUpi.upiSettings.vpa,
            amount:        finalTotal,
            qrGeneratedAt: new Date(),
          },
        } : {}),
        isPrivate:  !!isPrivate,
        dueAmount:  resolvedMethod === 'credit' ? Math.max(0, Number(dueAmount) || 0) : 0,
        // Persist the client-side UUID so we can detect duplicate sync retries
        ...(offlineId ? { offlineId } : {}),
      }], { session });

      // Customer spend and credit ledger are applied at verification time for
      // UPI QR bills — nothing is owed or spent until the money actually lands.
      if (customerId && !isUpiQrSale) {
        await Customer.findByIdAndUpdate(
          customerId,
          {
            $inc:  { totalPurchases: 1, totalSpent: finalTotal },
            $push: { purchaseHistory: { saleId: sale._id, amount: finalTotal, date: sale.createdAt } },
          },
          { session }
        );
      }

      // ── Credit ledger entry ──────────────────────────────────────────────────
      if (resolvedMethod === 'credit' && customerId && !isUpiQrSale) {
        // Record what is actually deferred. A split tender names the credit
        // portion explicitly; otherwise honour dueAmount, falling back to the
        // whole bill. Using finalTotal when dueAmount is smaller overstated the
        // customer's debt (and disagreed with verifyUpiPayment).
        const explicitDue = Math.min(finalTotal, Number(dueAmount) || 0);
        const creditAmt   = resolvedPayments.find((p) => p.method === 'credit')?.amount
          ?? (explicitDue > 0 ? explicitDue : finalTotal);
        await ledgerService.recordCredit({
          customerId,
          shopId,
          saleId:     sale._id,
          amount:     creditAmt,
          notes:      notes || '',
          recordedBy: user._id,
        }, session);
      }
    });
  } finally {
    await session.endSession();
  }

  // Bust dashboard cache so next load sees fresh totals
  cache.del(`dashboard:${shopId}`);

  // ── Update StockSnapshot (fire-and-forget, non-blocking) ─────────────────────
  // The authoritative stock guard is `deductStock` inside the transaction.
  // Snapshot is best-effort for fast reads — failure here never blocks the sale.
  stockService.bulkUpdateFromSale({ items: sale.items, shopId }).catch((err) => {
    console.error('[StockSnapshot] bulkUpdateFromSale failed:', err.message);
  });

  await sale.populate(['customerId', 'staffId', { path: 'shopId', select: 'name address phone currency taxRate logo' }]);
  return sale;
};

// ── Public (online customer) checkout ─────────────────────────────────────────
const createPublicSale = async (data) => {
  const { shopId, items, customerName, customerPhone, customerEmail, paymentMethod, notes } = data;

  if (!shopId)        throw Object.assign(new Error('shopId is required'), { status: 400 });
  if (!items?.length) throw Object.assign(new Error('No items in sale'), { status: 400 });
  if (!customerName || !customerPhone)
    throw Object.assign(new Error('Customer name and phone are required'), { status: 400 });

  const shop = await Shop.findById(shopId);
  if (!shop || !shop.isActive)
    throw Object.assign(new Error('Shop not found'), { status: 404 });

  const { enrichedItems, totalAmount, totalDiscount, totalProfit } = await enrichItems(items);
  const taxRate    = shop.taxRate || 0;
  const taxAmount  = totalAmount * (taxRate / 100);
  const finalTotal = totalAmount + taxAmount;

  const session = await mongoose.startSession();
  let sale;

  try {
    await session.withTransaction(async () => {
      await deductStock(enrichedItems, session);

      // Find-or-create customer within the transaction for consistency
      let customer = await Customer.findOne({ shopId, phone: customerPhone }, null, { session });
      if (!customer) {
        [customer] = await Customer.create([{
          name:    customerName,
          phone:   customerPhone,
          email:   customerEmail || '',
          shopId,
          ownerId: shop.owner,
        }], { session });
      }

      [sale] = await Sale.create([{
        items: enrichedItems,
        totalAmount:   finalTotal,
        totalDiscount,
        totalProfit,
        taxAmount,
        taxRate,
        paymentMethod: paymentMethod || 'cash',
        customerId:    customer._id,
        shopId,
        ownerId:       shop.owner,
        customerName,
        customerPhone,
        notes,
        status:        'pending',
        isOnlineOrder: true,
      }], { session });

      await Customer.findByIdAndUpdate(
        customer._id,
        {
          $inc:  { totalPurchases: 1, totalSpent: finalTotal },
          $push: { purchaseHistory: { saleId: sale._id, amount: finalTotal, date: sale.createdAt } },
        },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  cache.del(`dashboard:${shopId}`);

  await sale.populate([{ path: 'shopId', select: 'name address phone currency logo' }]);
  return sale;
};

// ── List sales ────────────────────────────────────────────────────────────────
const getSales = async (user, query) => {
  const { shopId, startDate, endDate, paymentMethod, status, page = 1, limit = 20 } = query;
  const filter = {};

  if (user.role !== 'super_admin') filter.shopId = { $in: user.shops };
  if (shopId)        filter.shopId        = shopId;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (status)        filter.status        = status;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate)   filter.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59));
  }

  const skip = (page - 1) * limit;
  const [sales, total] = await Promise.all([
    Sale.find(filter)
      .populate('customerId', 'name phone')
      .populate('staffId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Sale.countDocuments(filter),
  ]);

  return { sales, total, page: parseInt(page), limit: parseInt(limit) };
};

const getSaleById = async (id, user) => {
  const sale = await Sale.findById(id)
    .populate('customerId', 'name phone email')
    .populate('staffId', 'name')
    .populate('lastEditedBy', 'name role')
    .populate('shopId', 'name address phone currency logo gstNumber taxRate upiSettings')
    .populate('items.product', 'name barcode sku');

  if (!sale) throw Object.assign(new Error('Sale not found'), { status: 404 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === sale.shopId._id.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });
  return sale;
};

const refundSale = async (id, user) => {
  const sale = await Sale.findById(id);
  if (!sale)                      throw Object.assign(new Error('Sale not found'), { status: 404 });
  if (sale.status === 'refunded') throw Object.assign(new Error('Already refunded'), { status: 400 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === sale.shopId.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });

  const session = await mongoose.startSession();
  let refunded;

  try {
    await session.withTransaction(async () => {
      // Restore stock and mark refunded in one atomic transaction.
      // Goes through restoreStock so variant products get BOTH their variant
      // entry and root stock returned — the old inline bulkWrite only touched
      // root, permanently under-reporting variant stock after a refund.
      await restoreStock(sale.items, session);

      refunded = await Sale.findByIdAndUpdate(
        id,
        { status: 'refunded' },
        { new: true, session }
      );
    });
  } finally {
    await session.endSession();
  }

  cache.del(`dashboard:${sale.shopId.toString()}`);

  // ── Update StockSnapshot — restore stock (fire-and-forget) ───────────────────
  stockService.bulkUpdateFromRefund({ items: sale.items, shopId: sale.shopId.toString() }).catch((err) => {
    console.error('[StockSnapshot] bulkUpdateFromRefund failed:', err.message);
  });

  return refunded;
};

// ── Partial Refund — refund specific line-items (fractional quantities allowed) ─
const partialRefund = async (id, user, refundItems) => {
  if (!Array.isArray(refundItems) || refundItems.length === 0)
    throw Object.assign(new Error('refundItems must be a non-empty array'), { status: 400 });

  const sale = await Sale.findById(id);
  if (!sale)                      throw Object.assign(new Error('Sale not found'), { status: 404 });
  if (sale.status === 'refunded') throw Object.assign(new Error('Sale already fully refunded'), { status: 400 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === sale.shopId.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });

  // Validate refund quantities against remaining quantities
  const refundMap = Object.fromEntries(
    refundItems.map((r) => [r.productId?.toString(), Number(r.quantity)])
  );

  // Items to give back, described the same way a sale item is, so the shared
  // movement helper can restore variant + root stock together.
  const itemsToRestore = [];
  let refundAmount = 0;

  for (const item of sale.items) {
    const pid = item.product?.toString();
    const refundQty = refundMap[pid] || 0;
    if (!refundQty) continue;

    const remaining = item.quantity - (item.refundedQty || 0);
    if (refundQty > remaining)
      throw Object.assign(
        new Error(`Cannot refund ${refundQty} of "${item.name}" — only ${remaining} remaining`),
        { status: 400 }
      );

    itemsToRestore.push({
      product:       item.product,
      selectedSize:  item.selectedSize,
      selectedColor: item.selectedColor,
      quantity:      refundQty,
    });

    refundAmount += (item.subtotal / item.quantity) * refundQty;
    item.refundedQty = (item.refundedQty || 0) + refundQty;
  }

  if (itemsToRestore.length === 0)
    throw Object.assign(new Error('No matching items found to refund'), { status: 400 });

  // Check if all quantities are now fully refunded → mark as refunded
  const allRefunded = sale.items.every(
    (item) => (item.refundedQty || 0) >= item.quantity
  );

  const session = await mongoose.startSession();
  let updated;

  try {
    await session.withTransaction(async () => {
      await restoreStock(itemsToRestore, session);

      updated = await Sale.findByIdAndUpdate(
        id,
        {
          items:  sale.items,
          status: allRefunded ? 'refunded' : 'completed',
        },
        { new: true, session }
      );
    });
  } finally {
    await session.endSession();
  }

  cache.del(`dashboard:${sale.shopId.toString()}`);
  return { sale: updated, refundAmount: +refundAmount.toFixed(2), fullyRefunded: allRefunded };
};

// ── UPI QR: confirm the money actually arrived ─────────────────────────────────
// Requires a transaction reference (UTR) the cashier has read off the customer's
// payment confirmation. A bare click can never settle a bill: no reference,
// no 'paid'. Once verified the bill becomes 'completed' and only then do the
// customer's spend totals and any credit ledger entry get applied.
const verifyUpiPayment = async (id, user, { transactionId, amountReceived } = {}) => {
  if (!isValidTxnRef(transactionId || '')) {
    throw Object.assign(
      new Error('A valid UPI transaction / UTR reference is required to confirm payment'),
      { status: 400 }
    );
  }

  const sale = await Sale.findById(id);
  if (!sale) throw Object.assign(new Error('Sale not found'), { status: 404 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === sale.shopId.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });
  if (!sale.isUpiQr)
    throw Object.assign(new Error('This bill was not paid by UPI QR'), { status: 400 });
  if (sale.paymentStatus === 'paid')
    throw Object.assign(new Error('This bill is already marked as paid'), { status: 400 });
  if (sale.paymentStatus !== 'pending')
    throw Object.assign(new Error(`Cannot verify a ${sale.paymentStatus} payment`), { status: 400 });

  const ref = transactionId.trim();

  // Guard against the same UTR being reused across bills
  const dupe = await Sale.findOne({
    _id:                    { $ne: sale._id },
    shopId:                 sale.shopId,
    'upiTxn.transactionId': ref,
  }).select('invoiceNumber').lean();
  if (dupe) {
    throw Object.assign(
      new Error(`Transaction ${ref} is already recorded against bill ${dupe.invoiceNumber}`),
      { status: 409 }
    );
  }

  const session = await mongoose.startSession();
  let updated;

  try {
    await session.withTransaction(async () => {
      updated = await Sale.findByIdAndUpdate(
        id,
        {
          $set: {
            status:                 'completed',
            paymentStatus:          'paid',
            'upiTxn.transactionId': ref,
            'upiTxn.verifiedAt':    new Date(),
            'upiTxn.verifiedBy':    user._id,
            ...(Number(amountReceived) > 0 ? { 'upiTxn.amount': Number(amountReceived) } : {}),
          },
        },
        { new: true, session }
      );

      // Deferred from createSale — apply now that the payment is real
      if (sale.customerId) {
        await Customer.findByIdAndUpdate(
          sale.customerId,
          {
            $inc:  { totalPurchases: 1, totalSpent: sale.totalAmount },
            $push: { purchaseHistory: { saleId: sale._id, amount: sale.totalAmount, date: sale.createdAt } },
          },
          { session }
        );
      }

      if (sale.paymentMethod === 'credit' && sale.customerId) {
        await ledgerService.recordCredit({
          customerId: sale.customerId,
          shopId:     sale.shopId,
          saleId:     sale._id,
          amount:     sale.dueAmount || sale.totalAmount,
          notes:      sale.notes || '',
          recordedBy: user._id,
        }, session);
      }
    });
  } finally {
    await session.endSession();
  }

  cache.del(`dashboard:${sale.shopId.toString()}`);

  await updated.populate(['customerId', 'staffId', { path: 'shopId', select: 'name address phone currency taxRate logo gstNumber upiSettings' }]);
  return updated;
};

// ── UPI QR: payment failed or was abandoned ───────────────────────────────────
// Restores the stock that createSale had reserved and parks the bill as
// 'cancelled', which keeps it out of every revenue report while leaving a
// record of the attempt.
const cancelUpiPayment = async (id, user, { paymentStatus = 'cancelled', reason = '' } = {}) => {
  if (!['failed', 'cancelled'].includes(paymentStatus))
    throw Object.assign(new Error("paymentStatus must be 'failed' or 'cancelled'"), { status: 400 });

  const sale = await Sale.findById(id);
  if (!sale) throw Object.assign(new Error('Sale not found'), { status: 404 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === sale.shopId.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });
  if (!sale.isUpiQr)
    throw Object.assign(new Error('This bill was not paid by UPI QR'), { status: 400 });
  if (sale.paymentStatus === 'paid')
    throw Object.assign(
      new Error('This payment is already verified — use refund instead'),
      { status: 400 }
    );
  if (sale.paymentStatus !== 'pending')
    throw Object.assign(new Error(`Payment is already ${sale.paymentStatus}`), { status: 400 });

  const session = await mongoose.startSession();
  let updated;

  try {
    await session.withTransaction(async () => {
      await restoreStock(sale.items, session);

      updated = await Sale.findByIdAndUpdate(
        id,
        {
          $set: {
            status:                 'cancelled',
            paymentStatus,
            'upiTxn.failureReason': String(reason || '').slice(0, 300),
          },
        },
        { new: true, session }
      );
    });
  } finally {
    await session.endSession();
  }

  cache.del(`dashboard:${sale.shopId.toString()}`);
  stockService.bulkUpdateFromRefund({ items: sale.items, shopId: sale.shopId.toString() }).catch((err) => {
    console.error('[StockSnapshot] cancelUpiPayment restore failed:', err.message);
  });

  return updated;
};

// ── Edit a completed bill ─────────────────────────────────────────────────────
// Applies stock changes as deltas (never restore-then-rededuct, which would
// briefly oversell), recalculates every total, corrects the customer's spend
// and credit position, and appends an audit entry recording who changed what
// and why. Runs entirely inside one transaction.
const updateSale = async (id, user, data) => {
  const { items, customerId, paymentMethod, taxRate, notes, isPrivate, dueAmount, reason } = data;

  if (!String(reason || '').trim() || String(reason).trim().length < 3)
    throw Object.assign(new Error('A reason for the modification is required'), { status: 400 });
  if (!items?.length)
    throw Object.assign(new Error('A bill must have at least one item'), { status: 400 });

  const sale = await Sale.findById(id);
  if (!sale) throw Object.assign(new Error('Sale not found'), { status: 404 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === sale.shopId.toString()))
    throw Object.assign(new Error('Access denied'), { status: 403 });

  // ── Guards: only a settled, untouched bill can be amended ──────────────────
  if (sale.status !== 'completed')
    throw Object.assign(
      new Error(`Only completed bills can be edited — this bill is ${sale.status}`),
      { status: 400 }
    );
  if (sale.paymentStatus !== 'paid')
    throw Object.assign(
      new Error('Payment must be verified before this bill can be edited'),
      { status: 400 }
    );
  if (sale.items.some((i) => (i.refundedQty || 0) > 0))
    throw Object.assign(
      new Error('This bill has refunded items — edit is blocked, use a refund instead'),
      { status: 400 }
    );
  if (sale.isOnlineOrder)
    throw Object.assign(new Error('Online orders cannot be edited here'), { status: 400 });

  // ── Recalculate from scratch ────────────────────────────────────────────────
  const newTaxRate = taxRate === undefined ? sale.taxRate : Number(taxRate);
  if (!Number.isFinite(newTaxRate) || newTaxRate < 0 || newTaxRate > 100)
    throw Object.assign(new Error('taxRate must be between 0 and 100'), { status: 400 });

  // preservePrice keeps the price the cashier typed rather than snapping back
  // to the current catalogue price.
  const { enrichedItems, totalAmount, totalDiscount, totalProfit } =
    await enrichItems(items, { preservePrice: true, skipStockCheck: true, skipExpiryCheck: true });

  // Edited bills go through the SAME server-side GST engine as createSale, so an
  // edit can never produce a differently-computed (or breakdown-less) invoice.
  const gstShopEdit = await Shop.findById(sale.shopId)
    .select('gstNumber stateCode gstMode invoiceRoundOff').lean();
  const gstCustEdit = customerId
    ? await Customer.findById(customerId).select('gstNumber stateCode').lean()
    : (sale.customerId
        ? await Customer.findById(sale.customerId).select('gstNumber stateCode').lean()
        : null);

  const editInvoice = computeInvoice({
    lines: enrichedItems.map((i) => ({
      price:       i.quantity ? i.subtotal / i.quantity : 0,
      quantity:    i.quantity,
      discountPct: 0,
      taxRate:     newTaxRate,
      name:        i.name,
      hsnCode:     i.hsnCode,
    })),
    gstMode:  gstShopEdit?.gstMode || 'exclusive',
    sellerStateCode:   gstShopEdit?.stateCode || null,
    placeOfSupplyCode: gstCustEdit?.stateCode || gstShopEdit?.stateCode || null,
    roundOff: gstShopEdit?.invoiceRoundOff !== false,
  });

  const newTaxAmount = editInvoice.totalTax;
  const newTotal     = editInvoice.grandTotal;
  const oldTotal     = sale.totalAmount;

  const newGst = {
    mode:              editInvoice.gstMode,
    interState:        editInvoice.interState,
    sellerGstin:       gstShopEdit?.gstNumber || '',
    customerGstin:     gstCustEdit?.gstNumber || '',
    sellerStateCode:   editInvoice.sellerStateCode || '',
    placeOfSupplyCode: editInvoice.placeOfSupplyCode || '',
    placeOfSupply:     editInvoice.placeOfSupply || '',
    taxableAmount:     editInvoice.taxableAmount,
    cgstAmount:        editInvoice.cgstAmount,
    sgstAmount:        editInvoice.sgstAmount,
    igstAmount:        editInvoice.igstAmount,
    roundOff:          editInvoice.roundOff,
    configWarning:     !editInvoice.stateKnown && newTaxRate > 0
      ? 'Shop GSTIN/state not configured — tax shown as intra-state (CGST+SGST).'
      : '',
  };

  const newMethod    = paymentMethod || sale.paymentMethod;
  const newCustomer  = customerId === undefined
    ? (sale.customerId ? sale.customerId.toString() : null)
    : (customerId || null);
  const oldCustomer  = sale.customerId ? sale.customerId.toString() : null;

  if (newMethod === 'credit' && !newCustomer)
    throw Object.assign(new Error('A customer is required for a credit bill'), { status: 400 });

  const newDue = newMethod === 'credit'
    ? Math.min(newTotal, Math.max(0, Number(dueAmount ?? sale.dueAmount) || 0))
    : 0;

  // ── Stock deltas ───────────────────────────────────────────────────────────
  const { ops: stockOps, insufficient } = await buildStockDeltaOps(sale.items, enrichedItems);
  if (insufficient.length)
    throw Object.assign(
      new Error(`Insufficient stock to increase: ${insufficient.join(', ')}`),
      { status: 409 }
    );

  const changes    = describeChanges(sale, enrichedItems, { newTaxRate, newMethod, newTotal });
  const saleItems  = enrichedItems.map(({ _trackVariant, ...rest }) => rest);
  const oldItems   = sale.items.map((i) => i.toObject ? i.toObject() : i);

  const session = await mongoose.startSession();
  let updated;

  try {
    await session.withTransaction(async () => {
      if (stockOps.length) {
        const result = await Product.bulkWrite(stockOps, { session, ordered: false });
        if (result.modifiedCount < stockOps.length)
          throw Object.assign(
            new Error('Stock changed while saving — please reopen the bill and retry'),
            { status: 409 }
          );
      }

      updated = await Sale.findByIdAndUpdate(
        id,
        {
          $set: {
            items:         saleItems,
            totalAmount:   newTotal,
            totalDiscount,
            totalProfit,
            taxAmount:     newTaxAmount,
            taxRate:       newTaxRate,
            gst:           newGst,
            paymentMethod: newMethod,
            customerId:    newCustomer,
            dueAmount:     newDue,
            ...(notes     !== undefined ? { notes }                : {}),
            ...(isPrivate !== undefined ? { isPrivate: !!isPrivate } : {}),
            lastEditedAt:  new Date(),
            lastEditedBy:  user._id,
          },
          $inc:  { editCount: 1 },
          $push: {
            editHistory: {
              editedBy:     user._id,
              editedByName: user.name || '',
              editedByRole: user.role || '',
              editedAt:     new Date(),
              reason:       String(reason).trim().slice(0, 300),
              before: {
                totalAmount:   oldTotal,
                taxAmount:     sale.taxAmount,
                taxRate:       sale.taxRate,
                totalDiscount: sale.totalDiscount,
                itemCount:     sale.items.length,
                paymentMethod: sale.paymentMethod,
              },
              after: {
                totalAmount:   newTotal,
                taxAmount:     newTaxAmount,
                taxRate:       newTaxRate,
                totalDiscount,
                itemCount:     saleItems.length,
                paymentMethod: newMethod,
              },
              changes,
            },
          },
        },
        { new: true, session }
      );

      // ── Correct customer spend ───────────────────────────────────────────────
      if (oldCustomer && newCustomer && oldCustomer === newCustomer) {
        const diff = +(newTotal - oldTotal).toFixed(2);
        if (diff !== 0) {
          await Customer.updateOne(
            { _id: newCustomer },
            { $inc: { totalSpent: diff } },
            { session }
          );
          await Customer.updateOne(
            { _id: newCustomer, 'purchaseHistory.saleId': sale._id },
            { $set: { 'purchaseHistory.$.amount': newTotal } },
            { session }
          );
        }
      } else {
        if (oldCustomer) {
          await Customer.updateOne(
            { _id: oldCustomer },
            {
              $inc:  { totalPurchases: -1, totalSpent: -oldTotal },
              $pull: { purchaseHistory: { saleId: sale._id } },
            },
            { session }
          );
        }
        if (newCustomer) {
          await Customer.updateOne(
            { _id: newCustomer },
            {
              $inc:  { totalPurchases: 1, totalSpent: newTotal },
              $push: { purchaseHistory: { saleId: sale._id, amount: newTotal, date: sale.createdAt } },
            },
            { session }
          );
        }
      }

      // ── Correct the credit position ──────────────────────────────────────────
      const oldCredit = sale.paymentMethod === 'credit' ? (sale.dueAmount || oldTotal) : 0;
      const newCredit = newMethod === 'credit' ? (newDue || newTotal) : 0;

      if (oldCustomer && oldCredit && oldCustomer !== newCustomer) {
        await ledgerService.recordCreditAdjustment({
          customerId: oldCustomer,
          shopId:     sale.shopId,
          saleId:     sale._id,
          delta:      -oldCredit,
          notes:      `Bill ${sale.invoiceNumber} edited — credit moved off this customer`,
          recordedBy: user._id,
        }, session);
      }

      if (newCustomer) {
        const base  = oldCustomer === newCustomer ? oldCredit : 0;
        const delta = +(newCredit - base).toFixed(2);
        if (delta !== 0) {
          await ledgerService.recordCreditAdjustment({
            customerId: newCustomer,
            shopId:     sale.shopId,
            saleId:     sale._id,
            delta,
            notes:      `Bill ${sale.invoiceNumber} edited — ${String(reason).trim().slice(0, 120)}`,
            recordedBy: user._id,
          }, session);
        }
      }
    });
  } finally {
    await session.endSession();
  }

  cache.del(`dashboard:${sale.shopId.toString()}`);

  // Resync the fast-read snapshot: reverse the old lines, apply the new ones.
  stockService.bulkUpdateFromRefund({ items: oldItems, shopId: sale.shopId.toString() })
    .then(() => stockService.bulkUpdateFromSale({ items: saleItems, shopId: sale.shopId.toString() }))
    .catch((err) => console.error('[StockSnapshot] updateSale resync failed:', err.message));

  await updated.populate([
    'customerId',
    'staffId',
    'lastEditedBy',
    { path: 'shopId', select: 'name address phone currency taxRate logo gstNumber' },
  ]);
  return updated;
};

// ── Bulk sync — processes offline sales sequentially (FIFO) ──────────────────
// Accepts an array of sale payloads, each carrying an offlineId.
// Returns a per-item result array so the client can update each record
// individually even when some succeed and others fail.
const bulkSyncSales = async (user, salesArray) => {
  if (!Array.isArray(salesArray) || salesArray.length === 0)
    throw Object.assign(new Error('sales array is required'), { status: 400 });

  if (salesArray.length > 50)
    throw Object.assign(new Error('Maximum 50 sales per bulk sync'), { status: 400 });

  const results = [];

  // Process in the order received — frontend already sorts by createdAt ASC (FIFO)
  for (const saleData of salesArray) {
    const { offlineId } = saleData;

    if (!offlineId) {
      results.push({ offlineId: null, success: false, error: 'Missing offlineId' });
      continue;
    }

    try {
      const sale = await createSale(user, saleData);
      results.push({
        offlineId,
        success:       true,
        saleId:        sale._id,
        invoiceNumber: sale.invoiceNumber,
      });
    } catch (err) {
      results.push({
        offlineId,
        success: false,
        error:   err.message || 'Unknown error',
        status:  err.status  || 500,
      });
    }
  }

  return results;
};

module.exports = {
  createSale, createPublicSale, getSales, getSaleById,
  refundSale, partialRefund, bulkSyncSales,
  verifyUpiPayment, cancelUpiPayment, updateSale,
};
