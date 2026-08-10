# MultiShop ERP — Inventory, Purchase & Sales Design Spec
**Date:** 2026-04-16
**Author:** Senior ERP Architect (Claude)
**Status:** Approved for Implementation Planning
**Scope:** Phase 1–4 across Inventory, Purchase, Sales, Accounting modules

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Module Architecture](#2-module-architecture)
3. [Complete Flow Design](#3-complete-flow-design)
4. [Database Schema](#4-database-schema)
5. [Inventory Logic](#5-inventory-logic)
6. [Accounting Integration](#6-accounting-integration)
7. [API Design](#7-api-design)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Performance Strategy](#9-performance-strategy)
10. [RBAC Design](#10-rbac-design)
11. [Edge Case Handling](#11-edge-case-handling)
12. [Advanced Features](#12-advanced-features)
13. [Industry Gaps vs Zoho/Tally/Shopify](#13-industry-gaps)
14. [Implementation Phases](#14-implementation-phases)
15. [Priority Action Matrix](#15-priority-action-matrix)

---

## 1. System Overview

### What This System Is

A **multi-tenant, multi-shop ERP** for Indian SMB retail and wholesale businesses. It bridges POS-speed counter billing with ERP-depth tracking — covering inventory, purchase, sales, and accounting in one platform.

### Tenant & Organizational Hierarchy

```
Tenant (Organization / Enterprise)
  ├── Shop 1 (GST Legal Entity / Store Branch — GSTIN A)
  │     ├── Location 1 (Main Store Front)
  │     └── Location 2 (Backroom Warehouse)
  └── Shop 2 (Store Branch — GSTIN B or same GSTIN)
        └── Location 3 (Regional Warehouse)
```

- **Shop:** Commercial entity and GST tax filing unit. Owns document numbering sequences.
- **Location:** Physical storage point (store, warehouse, or transit zone). Stock is tracked per `productId + locationId`.

### Multi-Tenant Document Numbering Rules

- Document numbers are scoped per **Shop, per Financial Year, per Document Type**:
  `{SHOP_CODE}-{DOC_TYPE}-{FY_YYZZ}-{SEQ:4}` (e.g., `MUM-INV-2526-0001`, `DEL-PO-2526-0042`).
- Under CGST Rule 46, distinct places of business or shops under the same GSTIN must maintain non-colliding, sequential document series. Assigning a unique prefix per shop ensures full statutory compliance and zero sequence collisions across multi-shop tenants.

### Warehouse vs Shop Transfer Behavior

- **Intra-Shop Transfer (Location A ➔ Location B under same shop):** Executed via `StockTransfer` (`transfer_out` at source, `transfer_in` at destination). Pure stock ledger movement without tax or voucher entries.
- **Inter-Shop Transfer (Shop 1 ➔ Shop 2 under same tenant):**
  - *Same GSTIN:* Handled via Delivery Challan / Stock Transfer Note.
  - *Different GSTIN (Interstate/Intrastate branch transfer):* Auto-generates a Branch Transfer Tax Invoice per GST valuation rules.

### Target Business Types

| Business | Fit | Notes |
|----------|-----|-------|
| General retail (single/multi-shop) | Excellent | Full POS & inventory tracking |
| Pharma / FMCG wholesale | Good | Batch + Expiry + FEFO pick |
| B2B trading / dealer network | Good | PO + SO + Credit limits + Price Lists |
| Textile / apparel wholesale | Excellent | Supported via Variant-Ready Schema (`hasVariants`) |
| Restaurant / F&B | Poor | No BOM/table management |

### Central Data Architecture

Three tables are the single source of truth for all modules:

```
StockLedger      — every physical stock movement (append-only)
VoucherEntry     — every financial movement (double-entry)
SalesOrder.items.reservedQty — every committed-but-not-invoiced unit
```

Everything else (PO, GRN, Invoice, etc.) is a state machine that writes to one or more of these three.

### Module Connection Diagram

```
SUPPLIER → PurchaseOrder → GRN ────────────────► StockLedger ◄───────────┐
                            │                         │                   │
                            ▼                         │                   │
                     SupplierBill → VoucherEntry       │ (physical stock)  │
                            │                         │                   │
                     DebitNote ───────────────────── (reversal)            │
                                                                           │
CUSTOMER → Estimate → SalesOrder → Reserve ────────────────────────────────┘
                           │                          │
                           ▼                          ▼
                        Invoice → Post → StockLedger(out) + VoucherEntry
                           │
                    DeliveryNote
                           │
                     CreditNote → StockLedger(return_in) + Voucher reversal
```

---

## 2. Module Architecture

### Status State Machines

**PurchaseOrder:**
```
draft → approved → sent → partial → received → closed
any non-posted state → cancelled (owner only)
```

**GRN:**
```
draft → posted (IMMUTABLE after post — reversal only via DebitNote or cancellation flow)
```

**SupplierBill:**
```
draft → approved → partial → paid
approved → cancelled (only if paidAmount = 0)
```

**SalesOrder:**
```
draft → confirmed → in_process → partial → invoiced → closed
confirmed → cancelled (releases reservedQty)
```

**Invoice:**
```
draft → approved → posted → partial → paid
posted → cancelled (reverses StockLedger + VoucherEntry, requires paidAmount = 0)
```

**DeliveryNote:**
```
pending → dispatched → delivered
dispatched → cancelled (only if not delivered)
```

**CreditNote / DebitNote:**
```
draft → approved → settled
```

---

## 3. Complete Flow Design

### Purchase Flow

```
[Supplier]
    ↓
PurchaseOrder (DRAFT → APPROVED → SENT)
  - Optional. Skip for direct walk-in purchases.
  - Shares: supplierId, items[]{productId, qty, rate, taxSlab}
    ↓
GRN / MaterialInward (DRAFT → POSTED)
  - Handles partial delivery (orderedQty vs receivedQty)
  - On POST: writes to StockLedger (quantityIn)
  - Batch/expiry captured here
    ↓
SupplierBill (DRAFT → APPROVED → PAID)
  - Three-way match: Bill qty must = GRN received qty (±tolerance)
  - On APPROVE: creates VoucherEntry (Dr Stock, Cr Creditor)
  - Tracks payments[], balanceAmount
    ↓ (only if returns)
DebitNote (DRAFT → APPROVED → SETTLED)
  - Reverses StockLedger + reduces Creditor ledger
```

**Skippable steps:**
- PO → skip to GRN (unplanned purchase, cash vendor)
- GRN + Bill → merge for simple cash suppliers
- DebitNote → only on returns

### Sales Flow

```
[Customer]
    ↓
Estimate / Quotation (DRAFT → SENT → ACCEPTED/REJECTED)
  - Optional. B2C counter sales skip this.
  - Validity period enforced. Auto-expires.
    ↓
SalesOrder (DRAFT → CONFIRMED → IN_PROCESS → PARTIAL → CLOSED)
  - On CONFIRM: reserves stock (SalesOrder.items.reservedQty ++)
  - Reservation has TTL (configurable, default 7 days)
  - 1 SO can generate multiple Invoices (partial invoicing)
    ↓
Invoice (DRAFT → APPROVED → POSTED → PAID)
  - On POST: writes to StockLedger (quantityOut), creates VoucherEntry
  - If batch-tracked: FEFO auto-selects batches
  - 1 Invoice can have multiple DeliveryNotes (partial shipping)
    ↓ (if physical delivery)
DeliveryNote (PENDING → DISPATCHED → DELIVERED)
  - Tracks actual fulfillment separately from billing
    ↓ (if returns)
CreditNote (DRAFT → APPROVED → SETTLED)
  - Reverses StockLedger + reduces Debtor ledger
```

**Skippable steps:**
- Estimate (B2C / POS walk-in)
- SO → direct Invoice (existing Billing.jsx already does this, keep it)
- DeliveryNote (customer self-pickup)

### POS vs ERP — Two Parallel Flows (Both Kept)

| Mode | User | Flow |
|------|------|------|
| POS (existing Billing.jsx) | Billing staff | Search → Cart → Pay → Invoice auto-posted |
| ERP Sales | Sales manager | Estimate → SO → Invoice → Delivery |

These are not in conflict. The business configures which applies per customer type (walk-in vs credit customer).

---

## 4. Database Schema

### Product (enhanced from current)

```js
{
  _id, shopId,
  name, sku, barcode, hsnCode,          // hsnCode: required for GST compliance
  category, brand, unit,
  costPrice, sellingPrice, averageCostPrice, // averageCostPrice: computed via MAC
  discount,
  taxSlabId,                             // ref → TaxSlab
  taxType: enum['taxable','exempt','nil_rated','zero_rated'],
  taxInclusive: Boolean,                 // tax inclusive vs exclusive flag
  hasVariants: Boolean,                  // true if this is a parent product with variants
  parentProductId: ObjectId,             // null for parent/standalone, set for variant child
  variantAttributes: [                   // e.g. [{ key: "Size", value: "XL" }, { key: "Color", value: "Blue" }]
    { key: String, value: String }
  ],
  trackBatch: Boolean,
  trackExpiry: Boolean,
  minStock, maxStock, reorderPoint,
  images: [],
  isActive: Boolean,                     // NEVER delete products, soft delete via isActive = false
  createdAt, updatedAt
}
```
*Note: Transaction line items (`StockLedger`, `Invoice.items`, `GRN.items`) always reference `productId` (pointing to the specific variant SKU if `hasVariants: true`, or single product if `false`).*

**Indexes:**
```js
{ shopId: 1 }
{ shopId: 1, category: 1 }
{ name: 'text', sku: 'text', barcode: 'text', hsnCode: 'text' }
```

---

### StockSnapshot (NEW — materialized stock view)

```js
{
  _id,
  productId,                             // unique per product+shop+location
  shopId,
  locationId,                            // null = default/unspecified
  physical: Number,                      // Σ quantityIn - Σ quantityOut (posted only)
  reserved: Number,                      // from confirmed SalesOrders
  available: Number,                     // physical - reserved
  incoming: Number,                      // from approved POs not yet received
  averageCostPrice: Number,              // Moving Weighted Average Cost (MAC) for valuation
  lastUpdatedAt,
  version: Number                        // for optimistic concurrency
}
```

**Indexes:**
```js
{ productId: 1, shopId: 1, locationId: 1 }  // unique
{ shopId: 1, available: 1 }                  // for low stock queries
```

**Update rule:** Atomically updated on every GRN.post, Invoice.post, SO.confirm, SO.cancel. StockLedger is the audit trail; StockSnapshot is the fast-read cache.

---

### StockLedger (append-only, immutable after write)

```js
{
  _id, shopId, productId,
  locationId,
  transactionType: enum[
    'purchase',       // GRN posted
    'sale',           // Invoice posted
    'return_in',      // CreditNote approved
    'return_out',     // DebitNote approved
    'transfer_in',    // received from another location
    'transfer_out',   // sent to another location
    'adjustment_in',  // manual positive correction
    'adjustment_out', // manual negative correction
    'opening'         // opening stock entry
  ],
  referenceType: enum['grn','invoice','transfer','adjustment','credit_note','debit_note','opening'],
  referenceId,
  referenceNumber,                       // human-readable (GRN-001)
  batchNumber,
  expiryDate,
  batchStatus: enum['active','quarantined','recalled','expired'],
  quantityIn,                            // always >= 0
  quantityOut,                           // always >= 0
  rate,                                  // cost at time of transaction
  idempotencyKey,                        // prevents double-posting
  isReversed: Boolean,
  reversedByEntryId,
  createdAt, createdBy
}
```

**Indexes:**
```js
{ shopId: 1, productId: 1 }
{ shopId: 1, transactionType: 1 }
{ referenceType: 1, referenceId: 1 }
{ expiryDate: 1 }                        // TTL-based expiry cron
{ idempotencyKey: 1 }                    // unique — prevents duplicates
```

---

### PurchaseOrder

```js
{
  _id, shopId, poNumber,                 // auto: PO-2026-0001 (per shop, per year)
  supplierId,
  status: enum['draft','approved','sent','partial','received','closed','cancelled'],
  orderDate, expectedDate,
  items: [{
    productId, productName, qty, rate, discount,
    taxSlabId, cgst, sgst, igst, lineTotal
  }],
  subtotal, discountTotal, taxAmount, grandTotal,
  receivedSummary: [{
    productId, orderedQty, totalReceivedQty,
    grnBreakdown: [{ grnId, qty }]       // tracks which GRNs received what
  }],
  advancePayments: [{                    // advance paid before delivery
    date, amount, mode, reference
  }],
  notes, terms,
  approvedBy, approvedAt,
  cancelledAt, cancelledBy, cancellationReason,
  createdBy, createdAt, updatedAt
}
```

---

### GRN (MaterialInward)

```js
{
  _id, shopId, grnNumber,
  poId,                                  // null if direct purchase (no PO)
  supplierId,
  locationId,                            // which warehouse received
  status: enum['draft','posted','cancelled'],
  grnDate,
  supplierInvoiceRef,                    // prevents booking same supplier bill twice
  items: [{
    productId, productName,
    orderedQty, receivedQty, rejectedQty,
    rate, discount,
    taxSlabId, cgst, sgst, igst, lineTotal,
    batchNumber, expiryDate,             // batch tracking
    locationId                           // per-item location override
  }],
  subtotal, taxAmount, grandTotal,
  postedAt, postedBy,
  stockEntryIds: [],                     // refs to StockLedger entries created
  idempotencyKey,                        // prevents double-post on retry
  cancelledAt, cancelledBy, cancellationReason,
  createdBy, createdAt
}
```

**Unique index:** `{ shopId: 1, supplierInvoiceRef: 1, supplierId: 1 }` — prevents booking same supplier invoice twice.

---

### SupplierBill

```js
{
  _id, shopId, billNumber,
  supplierBillNumber,
  supplierId,
  grnIds: [],                            // one bill can cover multiple GRNs
  status: enum['draft','approved','partial','paid','overdue','cancelled'],
  billDate, dueDate,
  items: [{
    productId, qty, rate,
    taxSlabId, cgst, sgst, igst, lineTotal
  }],
  subtotal, taxAmount, grandTotal,
  paidAmount, balanceAmount,
  payments: [{
    date, amount, mode: enum['cash','bank','upi','cheque','advance_adjustment'],
    reference, note
  }],
  priceVarianceApproved: Boolean,        // if bill rate differs from GRN rate
  priceVarianceApprovedBy,
  ledgerVoucherId,
  createdBy, createdAt, updatedAt
}
```

---

### DebitNote

```js
{
  _id, shopId, debitNoteNumber,
  supplierId, billId, grnId,
  status: enum['draft','approved','settled'],
  date, reason,
  items: [{
    productId, qty, rate,
    taxSlabId, cgst, sgst, igst, lineTotal
  }],
  grandTotal,
  settledAgainst: [{ billId, amount }],
  ledgerVoucherId,
  stockEntryIds: [],
  createdBy, createdAt
}
```

---

### Estimate (Quotation)

```js
{
  _id, shopId, estimateNumber,
  customerId,
  customerSnapshot: { name, phone, email, address, gstin },
  status: enum['draft','sent','accepted','rejected','expired','converted'],
  validUntil,
  items: [{
    productId, productName, qty, rate, discount,
    taxSlabId, cgst, sgst, igst, lineTotal
  }],
  subtotal, discountTotal, taxAmount, grandTotal,
  notes, terms,
  convertedToSoId,
  createdBy, createdAt
}
```

---

### SalesOrder

```js
{
  _id, shopId, soNumber,
  customerId, estimateId,
  status: enum['draft','confirmed','in_process','partial','invoiced','closed','cancelled'],
  orderDate, deliveryDate,
  reservationExpiresAt,                  // auto-release reserved stock after this date
  shippingAddress: {},
  items: [{
    productId, productName,
    qty, rate, discount,
    taxSlabId, cgst, sgst, igst, lineTotal,
    reservedQty,
    invoicedQty,
    deliveredQty
  }],
  subtotal, discountTotal, taxAmount, grandTotal,
  notes, terms,
  invoiceIds: [],
  createdBy, createdAt, updatedAt
}
```

---

### Invoice (SalesInvoice)

```js
{
  _id, shopId, invoiceNumber,
  customerId,
  customerSnapshot: { name, phone, email, address, gstin, state },
  soId, estimateId,
  type: enum['tax_invoice','retail_invoice','proforma'],
  status: enum['draft','approved','posted','partial','paid','overdue','cancelled'],
  invoiceDate, dueDate,
  placeOfSupply,                         // state code for GST split decision
  reverseCharge: Boolean,
  items: [{
    productId, productName,
    qty, rate, discount,
    hsnCode,                             // for GSTR-1
    taxSlabId, cgst, sgst, igst, lineTotal,
    batchNumber, locationId              // which batch/location deducted
  }],
  subtotal, discountTotal, taxAmount, grandTotal,
  paidAmount, balanceAmount,
  payments: [{ date, amount, mode, reference }],
  postedToStock: Boolean,
  stockEntryIds: [],
  ledgerVoucherId,
  cancelledAt, cancelledBy, cancellationReason,
  createdBy, createdAt, updatedAt
}
```

---

### DeliveryNote

```js
{
  _id, shopId, deliveryNoteNumber,
  invoiceId, soId,
  status: enum['pending','dispatched','delivered','cancelled'],
  dispatchDate, deliveredDate,
  shippingAddress: {},
  courierName, trackingNumber,
  items: [{ productId, productName, qty, batchNumber }],
  createdBy, createdAt
}
```

**Note:** 1 Invoice → N DeliveryNotes (partial shipping). Invoice tracks `totalDeliveredQty` per item.

---

### CreditNote

```js
{
  _id, shopId, creditNoteNumber,
  customerId, invoiceId,
  status: enum['draft','approved','settled'],
  date, reason,
  items: [{ productId, qty, rate, taxSlabId, cgst, sgst, igst, lineTotal, batchNumber }],
  grandTotal,
  settledAgainst: [{ invoiceId, amount }],
  ledgerVoucherId,
  stockEntryIds: [],
  createdBy, createdAt
}
```

---

### Ledger

```js
{
  _id, shopId, name,
  type: enum['asset','liability','income','expense','equity'],
  group: enum[
    'debtors','creditors','bank','cash',
    'sales','purchase','sales_return','purchase_return',
    'tax_payable','tax_credit',
    'stock','fixed_asset','stock_shrinkage'
  ],
  openingBalance: Number,
  openingType: enum['Dr','Cr'],
  isSystem: Boolean,                     // cannot be deleted
  isActive: Boolean
}
```

**System ledgers auto-created on shop setup:**
- Stock / Inventory A/c
- Sales Revenue A/c
- Purchase A/c
- GST Payable (CGST), GST Payable (SGST), GST Payable (IGST)
- GST Input Credit (CGST), GST Input Credit (SGST), GST Input Credit (IGST)
- Cash A/c, Bank A/c
- Stock Shrinkage / Loss A/c

---

### VoucherEntry (double-entry, immutable after creation)

```js
{
  _id, shopId, voucherNumber,
  voucherType: enum['purchase','sale','payment','receipt','journal','contra','debit_note','credit_note'],
  referenceType, referenceId, referenceNumber,
  date, narration,
  entries: [{
    ledgerId, ledgerName,
    type: enum['Dr','Cr'],
    amount
  }],
  totalDebit, totalCredit,               // MUST be equal — enforced at DB level
  isReversed: Boolean,
  reversedByVoucherId,
  createdBy, createdAt
}
```

**MongoDB collection validation:**
```js
{
  $jsonSchema: {
    properties: {
      totalDebit: {},
      totalCredit: {}
    }
  }
}
// + application-level check: totalDebit === totalCredit before insert
```

---

### Payment (standalone entity for multi-invoice payments)

```js
{
  _id, shopId,
  partyType: enum['customer','supplier'],
  partyId,
  amount, mode: enum['cash','bank','upi','cheque','advance'],
  reference, date,
  allocations: [{
    documentType: enum['invoice','supplier_bill'],
    documentId,
    amount
  }],
  status: enum['cleared','bounced','pending'],
  bounceDetails: { date, fee, resolvedAt },
  ledgerVoucherId,
  createdBy, createdAt
}
```

---

### TaxSlab

```js
{
  _id, name,                             // e.g., "GST 18%"
  type: enum['GST','IGST','VAT','NONE'],
  rate,                                  // total rate: 18
  cgstRate, sgstRate, igstRate, cessRate,
  isActive
}
```

---

### StockTransfer

```js
{
  _id, shopId, transferNumber,
  fromLocationId, toLocationId,
  status: enum['draft','dispatched','received','cancelled'],
  dispatchedAt, receivedAt,
  items: [{ productId, qty, batchNumber, batchStatus }],
  notes,
  dispatchedBy, receivedBy,
  createdAt
}
```

**On dispatch:** `StockLedger: transfer_out` from source (stock removed from source)
**On receive:** `StockLedger: transfer_in` to destination (stock added at destination)
**In-transit period:** Stock is neither at source nor destination — visible in transit report.

---

### PriceList (Customer & Tier Pricing)

```js
{
  _id, shopId,
  name: String,                          // e.g., "Wholesale", "VIP Customer", "Dealer Tier 1"
  description: String,
  currency: String,                      // default "INR"
  rules: [{
    productId: ObjectId,
    minQty: Number,                      // quantity threshold
    tierPrice: Number,                   // fixed price override
    discountPercent: Number              // % discount override
  }],
  isActive: Boolean,
  createdAt, updatedAt
}
```

*Pricing Resolution:* `Customer Specific Custom Price > Quantity Tier Price > Customer PriceList > Product Default Selling Price`.

---

### AuditLog (Immutable System Audit Trail)

```js
{
  _id, tenantId, shopId,
  entityType: enum['Invoice','GRN','PurchaseOrder','SalesOrder','StockLedger','Payment','SupplierBill','CreditNote','DebitNote'],
  entityId: ObjectId,
  action: enum['create','update','approve','post','cancel','payment','settle'],
  changes: {
    before: Object,
    after: Object
  },
  performedBy: ObjectId,
  ipAddress: String,
  userAgent: String,
  timestamp: Date
}
```
*Note: Append-only collection. Every approval, posting, cancellation, and payment creates an unalterable audit log entry.*

---

## 5. Inventory Logic

### Stock Formula

```
Physical  = Σ StockLedger.quantityIn  - Σ StockLedger.quantityOut
            (only posted entries, not draft/cancelled)

Reserved  = Σ SalesOrder.items.reservedQty
            (SO.status IN ['confirmed','in_process','partial'])

Available = Physical - Reserved

Incoming  = Σ (PO.items.qty - PO.receivedSummary.totalReceivedQty)
            (PO.status IN ['approved','sent','partial'])

Projected = Available + Incoming
```

### StockSnapshot — Atomic Update Pattern

```js
// On GRN.post:
await StockSnapshot.findOneAndUpdate(
  { productId, shopId, locationId },
  {
    $inc: { physical: receivedQty, available: receivedQty, version: 1 },
    $set: { lastUpdatedAt: new Date() }
  },
  { upsert: true, returnDocument: 'after' }
);

// On SO.confirm (reserve stock):
const result = await StockSnapshot.findOneAndUpdate(
  { productId, shopId, available: { $gte: qtyToReserve } }, // atomic check
  { $inc: { reserved: qtyToReserve, available: -qtyToReserve, version: 1 } },
  { returnDocument: 'after' }
);
if (!result) throw new InsufficientStockError(productId, qtyToReserve);
```

### FEFO Batch Allocation

```js
async function allocateBatchesForSale(productId, shopId, locationId, qtyNeeded) {
  const batches = await StockLedger.aggregate([
    {
      $match: {
        productId, shopId,
        ...(locationId ? { locationId } : {}),
        batchStatus: { $nin: ['quarantined', 'recalled'] }
      }
    },
    {
      $group: {
        _id: { batchNumber: '$batchNumber', expiryDate: '$expiryDate', locationId: '$locationId' },
        available: { $sum: { $subtract: ['$quantityIn', '$quantityOut'] } }
      }
    },
    { $match: { available: { $gt: 0 } } },
    { $sort: { '_id.expiryDate': 1, '_id.batchNumber': 1 } }  // FEFO
  ]);

  const allocations = [];
  let remaining = qtyNeeded;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.available);
    const daysToExpiry = daysBetween(new Date(), batch._id.expiryDate);
    allocations.push({ ...batch._id, qty: take, nearExpiry: daysToExpiry < 30 });
    remaining -= take;
  }

  if (remaining > 0)
    throw new InsufficientStockError(productId, qtyNeeded, qtyNeeded - remaining);
  return allocations;
}
```

### Reorder Point Check (Cron, every 6 hours)

```js
async function checkReorderPoints(shopId) {
  const products = await Product.find({ shopId, isActive: true, reorderPoint: { $gt: 0 } });

  for (const p of products) {
    const snap = await StockSnapshot.findOne({ productId: p._id, shopId });
    if (!snap) continue;
    const projected = snap.available + snap.incoming;

    if (projected <= p.reorderPoint) {
      const hasOpenPO = await PurchaseOrder.exists({
        shopId, 'items.productId': p._id,
        status: { $in: ['draft', 'approved', 'sent'] }
      });
      if (!hasOpenPO) {
        const lastRate     = await getLastPurchaseRate(p._id, shopId);
        const lastSupplier = await getLastSupplier(p._id, shopId);
        await createDraftPO({ shopId, supplierId: lastSupplier,
          items: [{ productId: p._id, qty: p.maxStock - snap.physical, rate: lastRate }],
          notes: `Auto-reorder: stock at ${snap.available}, reorder point ${p.reorderPoint}`
        });
        await notify(shopId, 'REORDER_TRIGGERED', { productName: p.name });
      }
    }
  }
}
```

### Inventory Valuation — Moving Weighted Average Cost (MAC)

While FEFO (First Expired, First Out) is used for **physical batch selection**, accounting inventory valuation uses **Moving Weighted Average Cost (MAC)**.

On every posted `GRN`:
```js
async function updateMovingAverageCost(productId, shopId, receivedQty, receivedRate) {
  const snapshot = await StockSnapshot.findOne({ productId, shopId });
  const currentPhysical = snapshot ? snapshot.physical : 0;
  const currentAvgCost = snapshot && snapshot.averageCostPrice ? snapshot.averageCostPrice : 0;

  const newTotalQty = currentPhysical + receivedQty;
  const newAvgCost = newTotalQty > 0 
    ? ((currentPhysical * currentAvgCost) + (receivedQty * receivedRate)) / newTotalQty
    : receivedRate;

  await StockSnapshot.updateOne(
    { productId, shopId },
    { $set: { averageCostPrice: newAvgCost } }
  );
  await Product.updateOne(
    { _id: productId },
    { $set: { averageCostPrice: newAvgCost } }
  );
}
```

### Negative Stock Control Policy

Configured via Shop Settings: `negativeStockPolicy: enum['block', 'warning', 'manager_override']` (Default: `'warning'` for B2C POS counter sales, `'manager_override'` for ERP sales orders).

- Walk-in counter billing is not blocked by stock sync delays.
- If negative stock occurs, `StockLedger` records negative physical stock and triggers an instant `NEGATIVE_STOCK_ALERT` to store manager. Costing resolves upon the next posted `GRN`.

---

## 6. Accounting Integration

### GST Calculation

```js
function calculateLineGST(item, shopStateCode, placeOfSupply) {
  const { taxType, taxSlab, rate, qty, discount, taxInclusive } = item;

  if (taxType === 'exempt' || taxType === 'nil_rated' || taxType === 'zero_rated') {
    return { taxable: rate * qty * (1 - (discount || 0) / 100), cgst: 0, sgst: 0, igst: 0 };
  }

  const grossAmount = rate * qty * (1 - (discount || 0) / 100);
  let taxable = grossAmount;

  if (taxInclusive) {
    taxable = grossAmount / (1 + taxSlab / 100);
  }

  const totalTax = grossAmount - taxable;

  if (placeOfSupply !== shopStateCode) {
    return { taxable, igst: totalTax, cgst: 0, sgst: 0 };       // Interstate
  } else {
    return { taxable, igst: 0, cgst: totalTax / 2, sgst: totalTax / 2 }; // Intrastate
  }
}
```

### Modular Accounting Mode

- **Background Dual-Entry Engine:** `VoucherEntries` are **always generated by backend transaction handlers** behind the scenes to maintain strict financial balance.
- **UI Mode Toggle (`enableAdvancedAccounting: Boolean`):**
  - **Simple Mode (`false`):** Hides Chart of Accounts, Vouchers, and General Ledger from UI. Shows simple Cash/Bank balances, Customer Receivables, Supplier Payables, and Sales Summaries. Ideal for small retail shops.
  * **Full ERP Mode (`true`):** Enables Daybook, Trial Balance, Profit & Loss, Balance Sheet, and custom Journal Vouchers for accountants.

### Auto-Generated Vouchers

| Event | Dr | Cr |
|-------|----|----|
| GRN Posted | Stock A/c + GST Input Credit | Supplier/Creditor A/c |
| Sales Invoice Posted | Customer/Debtor A/c | Sales Revenue + GST Payable |
| Payment Received | Cash/Bank A/c | Customer/Debtor A/c |
| Payment Made (to supplier) | Supplier/Creditor A/c | Cash/Bank A/c |
| Credit Note Approved | Sales Return + GST Payable | Customer/Debtor A/c |
| Debit Note Approved | Supplier/Creditor A/c | Purchase Return + GST Input Credit |
| Stock Adjustment (-) | Stock Shrinkage A/c | Stock/Inventory A/c |
| Stock Adjustment (+) | Stock/Inventory A/c | Stock Surplus A/c |

### Three-Way Matching Rule

When creating SupplierBill from GRN:
- Bill qty must = GRN received qty per item
- Bill rate deviation > configured threshold (default 2%) requires manager approval
- `priceVarianceApproved: true` + `priceVarianceApprovedBy` stored

---

## 7. API Design

### Purchase Module

```
POST   /api/purchase-orders                Create PO
GET    /api/purchase-orders                List (status, supplierId, from, to, page, limit)
GET    /api/purchase-orders/:id            Detail + items + receivedSummary
PATCH  /api/purchase-orders/:id/approve   Approve (manager+)
PATCH  /api/purchase-orders/:id/cancel    Cancel

POST   /api/grns                           Create (poId optional)
GET    /api/grns                           List (poId, supplierId, status, from, to)
GET    /api/grns/:id
POST   /api/grns/:id/post                 Post to stock (idempotency key required)
POST   /api/grns/:id/cancel

POST   /api/supplier-bills                 Create (from grnIds)
GET    /api/supplier-bills                 List (status, supplierId, overdue)
GET    /api/supplier-bills/:id
POST   /api/supplier-bills/:id/approve
POST   /api/supplier-bills/:id/record-payment
GET    /api/supplier-bills/:id/voucher

POST   /api/debit-notes
POST   /api/debit-notes/:id/approve
POST   /api/debit-notes/:id/settle
```

### Sales Module

```
POST   /api/estimates
GET    /api/estimates                      (customerId, status, from, to)
POST   /api/estimates/:id/convert         → creates SalesOrder

POST   /api/sales-orders
GET    /api/sales-orders                   (status, customerId, from, to)
POST   /api/sales-orders/:id/confirm      Reserves stock
POST   /api/sales-orders/:id/create-invoice  Partial or full
POST   /api/sales-orders/:id/cancel       Releases reserved stock

POST   /api/invoices
GET    /api/invoices                       (status, customerId, from, to, overdue)
GET    /api/invoices/:id
POST   /api/invoices/:id/approve
POST   /api/invoices/:id/post             Posts stock + voucher (idempotency key required)
POST   /api/invoices/:id/record-payment
POST   /api/invoices/:id/create-delivery-note
POST   /api/invoices/:id/create-credit-note
POST   /api/invoices/:id/cancel

PATCH  /api/delivery-notes/:id/dispatch
PATCH  /api/delivery-notes/:id/deliver

POST   /api/credit-notes
POST   /api/credit-notes/:id/approve
POST   /api/credit-notes/:id/settle
```

### Inventory Module

```
GET    /api/stock                          (productId, shopId, locationId)
GET    /api/stock/batches                  (productId, shopId, includeExpired)
GET    /api/stock/movements                (productId, from, to, type)
POST   /api/stock/adjust                   Manual adjustment (manager required)
POST   /api/stock/transfer                 Location-to-location transfer

GET    /api/reports/stock-summary          (category, location, lowStock, outOfStock)
GET    /api/reports/purchase-summary       (from, to, supplierId)
GET    /api/reports/sales-summary          (from, to, customerId)
GET    /api/reports/profit-loss            (from, to)
GET    /api/reports/aging/receivables      Overdue customer balances by age bucket
GET    /api/reports/aging/payables         Overdue supplier balances by age bucket
GET    /api/reports/gst/gstr1              (period: YYYY-MM) → GSTR-1 data
GET    /api/reports/gst/gstr3b             (period: YYYY-MM) → GSTR-3B summary
```

### Idempotency Pattern (all POST /post endpoints)

```
Header: X-Idempotency-Key: <uuid>
Server: check StockLedger for existing idempotencyKey
If found: return 200 with original result (do not re-process)
If not found: process and store key
```

### Pagination Standard

All list endpoints use cursor-based pagination:
```json
{
  "data": [...],
  "meta": {
    "total": 1250,
    "page": 1,
    "limit": 25,
    "nextCursor": "2026-03-15T10:30:00Z_objectId"
  }
}
```

---

## 8. Frontend Architecture

```
client/src/
├── modules/
│   ├── purchase/
│   │   ├── pages/
│   │   │   ├── PurchaseOrderList.jsx
│   │   │   ├── PurchaseOrderForm.jsx
│   │   │   ├── GRNList.jsx
│   │   │   ├── GRNForm.jsx
│   │   │   ├── SupplierBillList.jsx
│   │   │   ├── SupplierBillForm.jsx
│   │   │   └── DebitNoteForm.jsx
│   │   ├── api/purchase.api.js
│   │   └── store/purchaseSlice.js
│   │
│   ├── sales/
│   │   ├── pages/
│   │   │   ├── EstimateList.jsx
│   │   │   ├── EstimateForm.jsx
│   │   │   ├── SalesOrderList.jsx
│   │   │   ├── SalesOrderForm.jsx
│   │   │   ├── InvoiceList.jsx
│   │   │   ├── InvoiceForm.jsx
│   │   │   ├── DeliveryNoteForm.jsx
│   │   │   └── CreditNoteForm.jsx
│   │   ├── api/sales.api.js
│   │   └── store/salesSlice.js
│   │
│   └── inventory/
│       ├── pages/
│       │   ├── StockDashboard.jsx
│       │   ├── StockMovements.jsx
│       │   ├── BatchTracker.jsx
│       │   ├── StockAdjustment.jsx
│       │   └── LocationTransfer.jsx
│       ├── api/inventory.api.js
│       └── store/inventorySlice.js
│
├── components/common/
│   ├── DataTable/
│   │   ├── DataTable.jsx           # virtualized, sticky header, column toggle
│   │   ├── TableFilters.jsx
│   │   └── useSortFilter.js
│   │
│   ├── DocumentForm/               # shared by PO, GRN, Invoice, Estimate
│   │   ├── LineItemsTable.jsx      # editable rows (mode-aware: purchase/grn/sales)
│   │   ├── TaxSummary.jsx          # subtotal/CGST/SGST/IGST/grand total
│   │   ├── PartySearch.jsx         # supplier OR customer typeahead
│   │   ├── StatusTimeline.jsx      # visual flow: Draft → Approved → Paid
│   │   └── PaymentHistory.jsx
│   │
│   ├── PageLayout.jsx
│   ├── SearchInput.jsx             # debounced, with clear button
│   ├── ActionBar.jsx               # page-level actions (New, Export, Filter)
│   ├── StatusBadge.jsx             # color-coded status chips
│   └── StickyFooter.jsx            # save/submit always visible
│
└── store/
    ├── purchaseSlice.js            # UI state only (modals, selected rows)
    ├── salesSlice.js
    └── inventorySlice.js
    # NOTE: Server state (lists, details) stays in React Query — NOT Redux
```

### Key Design Rule: React Query vs Redux

- **React Query:** all server state (lists, document details, stock levels, reports)
- **Redux:** only UI state (active shop, auth, sidebar, theme, selected rows)
- **Never** put API response data into Redux store

### LineItemsTable — Universal Document Component

```jsx
// Controlled by `mode` prop — same component for PO, GRN, Invoice, Estimate
// mode='purchase': product, qty, rate, discount, tax, lineTotal
// mode='grn':      product, orderedQty, receivedQty, rejectedQty, batch, expiry, rate, tax
// mode='sales':    product, qty, rate, discount, tax, cgst, sgst, lineTotal
// mode='readonly': display only, no inputs
function LineItemsTable({ items, onChange, mode, taxSlabs, readOnly }) { ... }
```

---

## 9. Performance Strategy

### Caching Layers

| Layer | What | TTL | Invalidation |
|-------|------|-----|-------------|
| React Query (browser) | Product list | 60s | On create/update |
| React Query (browser) | Stock levels | 10s | On GRN/Invoice post |
| React Query (browser) | Dashboard KPIs | 300s | Background refresh |
| Redis (server) | StockSnapshot | No TTL | On every stock movement |
| Redis (server) | Search results | 60s | TTL |
| Redis (server) | Report data | 300s | On data change |

### Database Indexes — All Collections

```js
// Compound indexes on EVERY document collection:
{ shopId: 1, status: 1, createdAt: -1 }
{ shopId: 1, createdAt: -1 }
{ supplierId: 1, shopId: 1 }   // purchase
{ customerId: 1, shopId: 1 }   // sales
```

### Optimistic Updates (React Query)

Status changes (approve, post, pay) update the UI instantly before server confirms:
```js
onMutate: async (id) => {
  await qc.cancelQueries(['invoices']);
  const prev = qc.getQueryData(['invoices', filters]);
  qc.setQueryData(['invoices', filters], (old) => ({
    ...old,
    data: old.data.map((inv) => inv._id === id ? { ...inv, status: 'approved' } : inv)
  }));
  return { prev };
},
onError: (_, __, ctx) => qc.setQueryData(['invoices', filters], ctx.prev),
onSettled: () => qc.invalidateQueries(['invoices'])
```

### Virtualization

Lists > 100 rows use `@tanstack/react-virtual` — DOM renders only visible rows.

---

## 10. RBAC Design

Extends the existing `usePermissions` hook. New actions per module:

```js
const PERMISSIONS = {
  purchase_order: {
    billing_staff:   [],
    inventory_staff: ['read', 'create'],
    manager:         ['read', 'create', 'approve', 'cancel'],
    owner:           ['read', 'create', 'approve', 'cancel', 'delete']
  },
  grn: {
    inventory_staff: ['read', 'create', 'post'],
    manager:         ['read', 'create', 'post', 'cancel'],
    owner:           ['*']
  },
  supplier_bill: {
    inventory_staff: ['read'],
    manager:         ['read', 'create', 'approve', 'record_payment'],
    owner:           ['*']
  },
  estimate:        { billing_staff: ['read','create'], manager: ['*'], owner: ['*'] },
  sales_order:     { billing_staff: ['read'], manager: ['*'], owner: ['*'] },
  invoice:         { billing_staff: ['read','create'], manager: ['*'], owner: ['*'] },
  credit_note:     { billing_staff: [], manager: ['read','create','approve'], owner: ['*'] },
  debit_note:      { inventory_staff: [], manager: ['read','create','approve'], owner: ['*'] },
  stock_adjust:    { inventory_staff: ['read'], manager: ['read','create'], owner: ['*'] },
  stock_transfer:  { inventory_staff: ['read','create'], manager: ['*'], owner: ['*'] }
};
```

---

## 11. Edge Case Handling

| Scenario | Enforcement |
|----------|-------------|
| Double GRN post | `idempotencyKey` unique index on StockLedger |
| Over-delivery (GRN qty > PO qty) | Flag + manager approval; PO qty updated |
| Bill rate > GRN rate | `priceVarianceApproved` required if deviation > threshold |
| Invoice cancel with payment | Block cancel if `paidAmount > 0`; must reverse payment first |
| SO cancel — reserved stock | Service releases `reservedQty` atomically on StockSnapshot |
| Expired batch selected for sale | Warning shown; allow override with manager permission + audit log |
| Multiple GRNs per PO | `receivedSummary.grnBreakdown[]` tracks each GRN's contribution |
| Cheque bounce | Payment status → 'bounced'; allocations reversed; invoice reverts to unpaid |
| Duplicate invoice number | Unique index `{ shopId, invoiceNumber }` at DB level |
| Stock adjustment vs reservation | Block if `adjustmentQty` would make `available < 0`; show reserved qty in UI |
| Reservation expiry | Cron: SalesOrders past `reservationExpiresAt` auto-cancelled, stock released |
| POS Offline Billing | IndexedDB queue + client UUID `idempotencyKey` ➔ auto-sync on network reconnect |
| Multi-Document Writes | Mandatory MongoDB ACID Transactions (`session.withTransaction()`) |
| Data Retention Policy | Soft-delete only (`isActive: false`, `archivedAt`) for Masters; transactions are immutable |

---

## 12. Advanced Features

### Smart Alerts Engine

| Alert | Trigger | Channel |
|-------|---------|---------|
| STOCK_LOW | available <= reorderPoint | In-app + WhatsApp (owner) |
| STOCK_OUT | available = 0 AND pending SO | In-app + WhatsApp (urgent) |
| EXPIRY_NEAR | batch expiry in ≤30 days | In-app daily digest |
| EXPIRY_TODAY | batch expires today | In-app + auto-quarantine batch |
| PAYMENT_OVERDUE | supplier bill past dueDate | In-app + email (owner) |
| RECEIVABLE_OVERDUE | invoice past dueDate + grace | In-app + SMS (customer) |
| REORDER_AUTO | draft PO auto-created | In-app (review needed) |
| PRICE_SPIKE | bill rate >10% above last PO rate | In-app (manager review) |
| CREDIT_LIMIT | customer outstanding > credit limit | In-app (block invoice creation) |
| STOCK_VARIANCE | physical count differs from system >2% | In-app + audit log |

### AI Insights (Phase 4+)

- **Demand forecasting:** 6-month sales history → predict stock needs before festivals/seasons
- **Slow mover identification:** Products with no sale in 45 days → suggest markdown
- **Customer churn:** Customer who orders every 30 days hasn't ordered in 45 → alert
- **Margin by customer:** Flag customers being sold to below average margin
- **Smart reorder qty:** Instead of `maxStock - available`, use velocity-based: `avg_daily_sales × lead_time × safety_factor`

---

## 13. Industry Gaps vs Zoho/Tally/Shopify

### From Zoho to Adopt
- GSTR-1/3B export in government JSON format
- Bank statement CSV reconciliation
- Customer-facing estimate approval portal (email link → one-click accept)
- Saved report filter templates

### From Tally to Adopt
- **Daybook view:** chronological all-vouchers for the day (accountants love this)
- **Trial Balance:** auto-generated, proves accounting is correct
- **Cost centre tracking:** assign every voucher to a branch/department for branch-wise P&L
- **Financial year close procedure:** year-end zero-out of P&L, carry to retained earnings

### From Shopify POS to Adopt
- **Returns at counter:** scan original invoice barcode → auto-load items → instant credit note
- **Cart-level discounts:** BOGO, % off total cart, coupon codes
- **Customer loyalty points:** earn on purchase, redeem at billing
- **Receipt printer support:** ESC/POS protocol for thermal printers

---

## 14. Implementation Phases

### Phase 1 — Foundation (Estimated: 4–5 weeks)
**Backend:**
- Supplier master (CRUD)
- Product enhancements: `hsnCode`, `taxType`, `trackBatch`, `trackExpiry`, `reorderPoint`
- StockSnapshot collection + atomic update service
- StockLedger with idempotency key
- PurchaseOrder (full CRUD + approve/cancel)
- GRN (full CRUD + post with StockLedger + StockSnapshot write)

**Frontend:**
- Supplier list/form page
- PurchaseOrder list + form (with LineItemsTable in 'purchase' mode)
- GRN list + form (with LineItemsTable in 'grn' mode, linked to PO)
- Stock dashboard (per product: physical / reserved / available)

**Critical:** StockSnapshot must be in place BEFORE Phase 2 (billing relies on it)

---

### Phase 2 — Purchase Complete (Estimated: 3–4 weeks)
**Backend:**
- SupplierBill (create from GRN, three-way match, payment recording)
- DebitNote (create from Bill, approve, stock reversal)
- Ledger + VoucherEntry engine (system ledgers auto-created)
- GST calculation service
- Price variance check

**Frontend:**
- SupplierBill list + form
- DebitNote form
- Payment recording modal
- Voucher detail view (accounting entries)
- Supplier aging report

---

### Phase 3 — Sales Enhancement (Estimated: 4–5 weeks)
**Backend:**
- Estimate (CRUD, convert to SO)
- SalesOrder (full flow, stock reservation, reservation TTL cron)
- Invoice → SO linking (partial invoicing)
- DeliveryNote (1 invoice → N deliveries)
- CreditNote (stock reversal + voucher reversal)
- Customer credit limit enforcement

**Frontend:**
- Estimate list + form
- SalesOrder list + form
- Enhanced Invoice form (link to SO, show reserved stock)
- Delivery tracking UI
- CreditNote form (scan invoice → auto-load items)
- Customer aging report

---

### Phase 4 — Accounting, Reporting, Advanced (Estimated: 3–4 weeks)
**Backend:**
- Full P&L report from VoucherEntries
- Trial Balance
- GSTR-1 / GSTR-3B export (JSON + Excel)
- Expiry alerts cron
- Reorder point auto-PO cron
- Bank reconciliation CSV import
- Financial year close procedure

**Frontend:**
- P&L report with date range
- GST report (GSTR-1/3B download)
- Daybook view
- Advanced stock reports (aging, slow movers, expiry)
- Alert management UI

---

## 15. Priority Action Matrix

| Priority | Action | Impact | Effort |
|----------|--------|--------|--------|
| P0 | StockSnapshot (materialized view) | Eliminates #1 performance bottleneck | 2 days |
| P0 | Idempotency key on GRN/Invoice post | Prevents double-posting data corruption | 1 day |
| P1 | Three-way match (PO=GRN=Bill) | Prevents overbilling | 2 days |
| P1 | Reservation TTL + auto-release cron | Prevents permanently stuck stock | 1 day |
| P1 | HSN code on Product + GSTR-1 export | GST compliance (legally required) | 3 days |
| P2 | Product price tiers per customer type | Core wholesale feature | 3 days |
| P2 | Expiry alert cron + auto-quarantine | Pharma/FMCG compliance | 2 days |
| P2 | Auto-reorder from reorder point | Smart inventory management | 3 days |
| P3 | Bank reconciliation CSV import | Accountant productivity | 1 week |
| P3 | Returns at POS counter (scan invoice) | UX win for counter staff | 1 week |
| P4 | AI demand forecasting | Competitive differentiator | 2–3 weeks |

---

*Spec written by Claude (Senior ERP Architect) on 2026-04-16.*
*Implementation begins with Phase 1. Each phase gets its own implementation plan.*
