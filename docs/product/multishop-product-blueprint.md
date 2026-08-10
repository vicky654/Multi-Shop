# MultiShop ERP — Official Product Bible
### The Complete Product Blueprint & Feature Reference Guide

**Version:** 1.0.0  
**Date:** 2026-07-28  
**Status:** Canonical Product Reference  
**Owner:** Product Team, MultiShop ERP  
**Audience:** Product Managers, Designers, Developers, QA Engineers, Business Owners, Clients, Investors

> This document is the single source of truth for the MultiShop ERP product. Anyone reading this document should completely understand the entire application — every screen, every feature, every user, every workflow — without reading a single line of source code.

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Complete User Hierarchy](#2-complete-user-hierarchy)
3. [Complete Navigation Architecture](#3-complete-navigation-architecture)
4. [Every Module](#4-every-module)
5. [Every Screen](#5-every-screen)
6. [Every Feature](#6-every-feature)
7. [Complete Business Flow](#7-complete-business-flow)
8. [Owner Experience](#8-owner-experience)
9. [Store Manager Experience](#9-store-manager-experience)
10. [Cashier Experience](#10-cashier-experience)
11. [Inventory Experience](#11-inventory-experience)
12. [Purchase Experience](#12-purchase-experience)
13. [Sales Experience](#13-sales-experience)
14. [Accounting Experience](#14-accounting-experience)
15. [Customer Experience](#15-customer-experience)
16. [Supplier Experience](#16-supplier-experience)
17. [Reports](#17-reports)
18. [Dashboards](#18-dashboards)
19. [Notifications](#19-notifications)
20. [Automation Engine](#20-automation-engine)
21. [AI Features](#21-ai-features)
22. [Settings](#22-settings)
23. [Integrations](#23-integrations)
24. [Mobile Apps](#24-mobile-apps)
25. [Future Modules Roadmap](#25-future-modules-roadmap)
26. [Feature Checklist](#26-feature-checklist)
27. [User Journey Maps](#27-user-journey-maps)
28. [Competitive Comparison](#28-competitive-comparison)
29. [Product Maturity Score](#29-product-maturity-score)

---

## 1. Product Vision

### Why MultiShop ERP Exists

Indian SMBs running retail and wholesale operations face a painful trilemma every single day:

1. **Legacy accounting software** (Tally, Busy, Marg) provides strong statutory compliance and double-entry accounting but delivers a terrible user experience, has no real-time multi-store stock visibility, and requires dedicated IT staff to maintain.

2. **Modern POS systems** (Shopify POS, POSist, Petpooja) offer fast, beautiful counter billing but completely lack native Indian GST compliance, double-entry financial accounting, and complex B2B order workflows.

3. **Enterprise ERPs** (SAP Business One, Oracle NetSuite, Microsoft Dynamics) provide comprehensive depth but cost ₹20–₹80 lakhs per year in licensing and implementation, making them inaccessible to the 63 million Indian SMB market.

**MultiShop ERP was built to close this gap.** It combines the speed and simplicity of a modern POS with the financial depth of a full ERP — natively built for Indian GST regulations, designed for multi-store retail and wholesale businesses, and priced for SMBs.

### The Problems It Solves

| Problem | Who Faces It | MultiShop Solution |
|:--------|:------------|:------------------|
| No real-time stock visibility across branches | Multi-store owners | Live cross-store inventory matrix with in-transit tracking |
| Stockouts and overstock causing cash losses | Inventory managers | FEFO batch picking, reorder point automation, velocity-based AI reorder |
| Overbilling by suppliers goes undetected | Purchase managers | 3-way PO → GRN → Bill matching with rate variance alerts |
| GST GSTR-1/3B filing takes days | Accountants | One-click GSTR-1 JSON/Excel export validated against govt schema |
| POS breaks down when internet fails | Cashiers | IndexedDB offline billing queue with automatic sync |
| Cannot compare branch profitability | Business owners | Multi-store consolidated P&L and branch comparison dashboard |
| Apparel/pharma variants not trackable | Textile/pharma shops | Variant-ready schema with batch/expiry/serial tracking |

### Target Customers

**Primary Markets:**
- General retail chains (2–50 branches): Grocery, Pharmacy, Electronics, Mobile, Hardware, Electrical
- Wholesale & distribution businesses: FMCG distributors, textile wholesalers, dealer networks
- Pharma retail and wholesale: Batch + expiry + FEFO compliance critical

**Secondary Markets:**
- Auto spare parts dealers
- Building materials and tiles
- Books and stationery
- Footwear and apparel retail
- Industrial supplies

**Business Size:**
- Small: 1–5 shops, ₹1–50 crore turnover
- Medium: 5–50 shops, ₹50 crore–₹500 crore turnover
- Large: 50–500 shops, ₹500 crore+ turnover

### Business Model

**SaaS Subscription (Tiered Plans):**

| Plan | Target | Shops | Users | Price/Month |
|:-----|:--------|:------|:------|:------------|
| **Starter** | Single shop, small retail | 1 | 3 | ₹999 |
| **Growth** | Small chains, distributors | 5 | 15 | ₹2,999 |
| **Professional** | Mid-size retail groups | 25 | 75 | ₹7,999 |
| **Enterprise** | Large franchise networks | Unlimited | Unlimited | Custom |

**Additional Revenue:**
- Per-SMS / WhatsApp notification charges
- Hardware bundling (Thermal printers, Barcode scanners)
- Implementation and onboarding services
- Data migration from Tally/Busy
- Custom integration development

### Competitive Advantage & Unique Selling Points

1. **Unified POS + ERP in One Platform** — No need to sync between separate billing and accounting software.
2. **Native Indian GST Architecture** — Built from ground up for CGST/SGST/IGST, GSTR-1/3B, E-Invoice, E-Way Bill.
3. **Sub-Second POS Speed with Full Accounting** — Checkout in < 1 second; double-entry ledgers auto-post simultaneously.
4. **Offline-First POS** — IndexedDB-powered offline billing with background sync. Works without internet.
5. **Multi-Store by Default** — Not an add-on. Every feature is multi-store-aware from day one.
6. **Variant-Ready Without Complexity** — Apparel size/color matrices work seamlessly without breaking simple retail flows.
7. **Modular Accounting Toggle** — Small shops can run simple billing; accountants can unlock full ERP accounting depth.
8. **AI-Powered Reorder & Forecasting** — Velocity-based smart reorder instead of naive min/max thresholds.

### Mission

*"To give every Indian business — from a single kirana store to a 200-branch retail chain — the financial clarity, inventory intelligence, and billing speed that was previously only available to Fortune 500 companies."*

### Future Vision (5-Year Roadmap)

- Become the default ERP platform for 1 million Indian SMBs.
- Expand to Southeast Asia (Malaysia, Indonesia, Thailand) with localized tax engines.
- Build an AI Copilot that runs daily business operations autonomously.
- Launch a B2B marketplace connecting retailers directly with distributors and manufacturers.
- Offer embedded financial services: business loans based on sales data, payment collections, insurance.

---

## 2. Complete User Hierarchy

MultiShop ERP supports a 20-level user hierarchy from the SaaS platform owner down to a guest visitor.

```
PLATFORM LEVEL
├── Platform Owner (SaaS Company)
└── Platform Admin (SaaS Support Team)

TENANT LEVEL
├── Tenant Admin (Enterprise Account Owner)
└── Business Owner (Company Proprietor / Director)

REGIONAL LEVEL
└── Regional Manager (Zone / State Manager)

STORE LEVEL
├── Store Owner (Branch Proprietor)
├── Store Manager (Operations Head)
└── Warehouse Manager (Logistics Head)

DEPARTMENT LEVEL
├── Inventory Manager
├── Purchase Manager
├── Sales Manager
└── Accountant

OPERATIONS LEVEL
├── Cashier / Billing Staff
├── Warehouse Staff
├── Delivery Staff
└── HR Manager

EXTERNAL PARTIES
├── Customer (B2C / B2B Buyer)
├── Supplier / Vendor
├── Auditor (Read-only External)
└── Guest (Unregistered)
```

### 1. Platform Owner

**Purpose:** The SaaS company that owns and operates MultiShop ERP.

**Responsibilities:**
- Global system health monitoring and uptime management
- Tenant provisioning, billing, and subscription management
- Cross-tenant analytics and revenue reporting
- Platform-wide security policy enforcement
- Feature flag management for phased rollouts

**Permissions:** God-mode access to all tenant data (with explicit audit logging for every access). Cannot modify financial data without a dual-approval unlock.

**KPIs:** Monthly Recurring Revenue (MRR), Tenant Churn Rate, Average Revenue Per User, System Uptime %.

---

### 2. Platform Admin

**Purpose:** SaaS support and operations team member.

**Responsibilities:**
- Respond to tenant support tickets and onboarding calls
- Provision and configure new tenant accounts
- Assist with data migration from Tally/Busy
- Monitor system errors and escalate to engineering

**Permissions:** Read access to tenant data with audit log. Cannot access financial records without tenant explicit invite.

---

### 3. Tenant Admin / Business Owner

**Purpose:** Ultimate authority within the business. Owns the subscription and all data.

**Responsibilities:**
- Configure the entire ERP from scratch during onboarding
- Define approval policies and authorization levels
- View consolidated P&L across all shops and branches
- Authorize large financial decisions (credit limits, large POs)
- Manage subscription plan and billing

**Daily Workflow:**
1. Open Owner Dashboard — review overnight alerts (low stock, overdue payments, GST deadlines)
2. Review consolidated sales and cash position
3. Approve pending high-value purchase orders or discount exceptions
4. Check AI-generated business health report
5. Review branch comparison metrics

**KPIs:** Gross Revenue, Net Profit %, Cash Burn Rate, Inventory Turnover, Days Sales Outstanding (DSO)

**Dashboard:** See Section 18 — Owner Dashboard.

**Permissions:** All permissions across all shops. Cannot be restricted by any system rule. Can grant and revoke all permissions.

---

### 4. Regional Manager

**Purpose:** Oversees a cluster of shops in a geographic zone or state.

**Responsibilities:**
- Monitor performance of assigned shops
- Authorize inter-store stock transfers within their region
- Resolve stock shortage escalations from store managers
- Review regional P&L and flag underperforming branches
- Ensure consistent pricing and promotion adherence across stores

**Permissions:** Full read and limited write access to shops within their designated `regionId`. Cannot access shops outside region.

**KPIs:** Region-wise Revenue, Average Ticket Size, Inventory Accuracy %, On-Time Delivery Rate.

---

### 5. Store Manager

**Purpose:** The day-to-day operational head of a single retail store branch.

**Responsibilities:**
- Open cash register at shift start
- Manage counter staff and assign POS terminals
- Handle customer escalations and approve return requests
- Review daily cash collection vs digital payments report
- Authorize cashier discount overrides (via PIN)
- Conduct weekly physical stock verification
- Close store shift and generate end-of-day report

**Daily Workflow:**
- 09:00 — Open Cash Register, verify opening balance
- 09:30 — Assign POS terminals to cashiers
- 12:00 — Review mid-day sales velocity, restock fast-moving items
- 17:00 — Approve any flagged discount overrides from counter
- 19:00 — Close Cash Register, reconcile cash vs digital
- 19:30 — Submit End-of-Day Store Report to Regional Manager

**Permissions:** Full access to their designated `shopId`. Cannot access other shops. Can approve discounts up to configured threshold.

**KPIs:** Daily Sales Target %, Cash Shortfall (₹), Counter Wait Time, Returns %.

---

### 6. Inventory Manager

**Purpose:** Owns stock accuracy. Ensures physical stock matches system records at all times.

**Responsibilities:**
- Review FEFO expiry alerts and quarantine expired batches
- Initiate and verify stock take counts
- Process manual stock adjustments with justification
- Monitor reorder point alerts and confirm auto-generated draft POs
- Manage barcode labeling for unlabeled stock
- Oversee bin locations and warehouse organization

**Permissions:** Inventory module (full), Stock Transfers (create/post), Stock Adjustments (create with audit log), cannot approve bills or post invoices.

**KPIs:** Stock Accuracy %, Dead Stock Value (₹), Expiry Loss (₹), Shrinkage %.

---

### 7. Purchase Manager

**Purpose:** Controls procurement, vendor relationships, and cost of purchase.

**Responsibilities:**
- Issue purchase orders to vendors
- Verify GRN goods received against purchase orders
- Perform 3-way matching (PO ↔ GRN ↔ Supplier Bill)
- Negotiate pricing and manage vendor rate cards
- Track advance payments to suppliers
- Manage debit notes for returns and short deliveries

**Permissions:** Purchase Orders (full), GRNs (full), Supplier Bills (create, approve), Debit Notes (full). Cannot access sales invoices or accounting vouchers.

**KPIs:** Purchase Cost vs Budget, Vendor On-Time Delivery %, 3-Way Match Exception Rate, Outstanding Payables (₹).

---

### 8. Sales Manager

**Purpose:** Drives B2B revenue through the full order-to-cash cycle.

**Responsibilities:**
- Respond to customer quotation requests (Estimates)
- Convert estimates to confirmed Sales Orders
- Monitor stock reservation levels and prevent expired reservations
- Enforce customer credit limit policies
- Track outstanding receivables and initiate collection calls
- Approve special discounts beyond cashier threshold

**Permissions:** Estimates (full), Sales Orders (full), Invoices (create, approve, post), Credit Notes (create, approve). Cannot access purchase or accounting modules.

**KPIs:** Order Conversion Rate, Invoice-to-Collection Days, Credit Limit Breach Count, Gross Margin %.

---

### 9. Cashier / Billing Staff

**Purpose:** High-speed walk-in customer checkout operator.

**Responsibilities:**
- Operate POS terminal for counter billing
- Scan barcodes and process multi-item carts
- Accept multi-mode payments (Cash, UPI, Card, Split)
- Issue thermal receipts and WhatsApp invoice
- Process counter returns with manager PIN authorization
- Hold and resume bills for customer convenience

**Permissions:** POS Counter only. Cannot access inventory levels, purchase orders, or financial reports. Can apply pre-configured discounts and promotions.

**KPIs:** Bills Processed Per Hour, Average Checkout Time (seconds), Cash Shortfall (₹/day), Return Rate %.

---

### 10. Accountant

**Purpose:** Maintains financial integrity, statutory compliance, and reporting accuracy.

**Responsibilities:**
- Audit daily voucher entries posted by system transactions
- Perform bank reconciliation via CSV import
- Prepare and export GSTR-1 and GSTR-3B reports
- Generate Trial Balance, P&L, and Balance Sheet
- Manage financial year closing procedure
- Record manual journal entries for adjustments

**Permissions:** All accounting modules (Vouchers, Ledgers, Reports, GST). Read access to Sales, Purchase, and Inventory for audit purposes.

**KPIs:** Reconciliation Backlog (Days), GST Filing Status, Trial Balance Mismatch Count, Days to Close FY.

---

### 11. Customer (External)

**Purpose:** The buyer — both B2C walk-in and B2B wholesale account.

**Access via:** Customer Portal (web link or PWA app)

**Features Available:**
- View past invoices and payment history
- Download PDF invoices and statements
- Check outstanding balance and credit limit usage
- Place repeat orders via B2B portal (Future)
- Receive payment link via WhatsApp/Email
- Loyalty points balance and redemption history

---

### 12. Supplier / Vendor (External)

**Purpose:** Goods or services vendor.

**Access via:** Vendor Portal (Future Phase)

**Features Available:**
- View open purchase orders from the company
- Upload and submit invoices against received GRNs
- Check payment status and outstanding balance
- Download payment receipts

---

## 3. Complete Navigation Architecture

### Left Sidebar (Primary Navigation)

The sidebar is the main navigation panel, visible on all pages except the full-screen POS counter. It collapses to an icon-only rail on smaller screens.

```
SIDEBAR NAVIGATION
┌────────────────────────────────┐
│  [LOGO]  MultiShop ERP         │
│  ─────────────────────────────│
│  [Store Picker Dropdown]       │  ◄ Instant store switch (<50ms)
│  ─────────────────────────────│
│  🏠  Dashboard                 │
│  ─────────────────────────────│
│  OPERATIONS                    │
│  🛒  POS Counter               │  ◄ Launches full-screen POS
│  📦  Inventory                 │
│  🚚  Purchase                  │
│  💰  Sales                     │
│  ─────────────────────────────│
│  PEOPLE                        │
│  👤  Customers                 │
│  🏭  Suppliers                 │
│  ─────────────────────────────│
│  FINANCE                       │
│  📒  Accounting                │
│  💳  Payments                  │
│  📊  GST                       │
│  💸  Expenses                  │
│  ─────────────────────────────│
│  REPORTS & ANALYTICS           │
│  📈  Reports                   │
│  🤖  AI Insights               │
│  ─────────────────────────────│
│  ADMIN                         │
│  ⚙️   Settings                  │
│  🔑  Users & Roles             │
│  📋  Audit Log                 │
│  🔗  Integrations              │
└────────────────────────────────┘
```

### Top Navigation Bar

```
[≡ Hamburger] [Logo] [Store: Mumbai ▼]   [⌘K Search] ... [🔔 Alerts(3)] [✅ Approvals(2)] [👤 Profile ▼]
```

**Components:**
- **Hamburger:** Collapse/expand sidebar.
- **Store Picker:** Dropdown showing all authorized shops. Selecting a shop instantly scopes all data to that branch. Business owners see an "All Stores" consolidated option.
- **Universal Search (⌘K / Ctrl+K):** Full command palette. Searches products, customers, invoices, suppliers, and navigates to any page in the app. Supports natural language queries via AI.
- **Notification Bell (🔔):** Grouped alerts with count badge — Low Stock, Expiry, Payment Due, Approval Needed.
- **Approval Center (✅):** Dedicated panel showing all pending approval requests.
- **Profile Menu (👤):** Name, role, avatar → Profile Settings, Theme Toggle (Light/Dark), Keyboard Shortcuts Help, Logout.

### Universal Command Palette (⌘K)

Triggered by `Cmd+K` (Mac) or `Ctrl+K` (Windows) from anywhere in the application.

**Capabilities:**
- **Navigation:** Type "Invoice" → Go to Invoice List. Type "PO" → Go to Purchase Orders.
- **Document Search:** Type "INV-2526-0042" → Open that invoice directly.
- **Customer Search:** Type customer name or phone number → View customer profile.
- **Product Search:** Type SKU or barcode → View product stock level.
- **Actions:** "New Invoice", "New Purchase Order", "Adjust Stock", "Transfer Stock".
- **AI Query:** Type "What is today's sales total?" → AI answers inline.
- **Recent Pages:** Shows last 5 visited pages at top.
- **Shortcuts:** Shows keyboard shortcut hints next to each action.

### Keyboard Shortcuts (Global)

| Shortcut | Action |
|:---------|:-------|
| `⌘K` / `Ctrl+K` | Open Command Palette |
| `⌘N` / `Ctrl+N` | Create New Document (context-aware) |
| `⌘/` / `Ctrl+/` | Focus Search on current list page |
| `?` | Open Keyboard Shortcuts Help modal |
| `F2` | POS: Focus product search input |
| `F4` | POS: Open payment dialog |
| `F8` | POS: Hold current bill |
| `F9` | POS: Apply discount |
| `F12` | POS: Print last receipt |
| `Esc` | Close drawer/modal, cancel current action |

### Recent Pages & Favorites

- **Recent Pages:** Last 10 visited pages, accessible from Command Palette and Profile menu.
- **Favorites:** Users can star (⭐) any page, invoice, or customer to pin it for instant access.

---

## 4. Every Module

### Module 1: Dashboard

**Purpose:** The first screen any user sees after login. Tailored by role to show the most important KPIs and action items without requiring navigation.

**Who Uses It:** Every user role sees a dashboard tailored to their permissions.

**Components:**
- KPI summary cards (Today's Sales, Gross Profit, Cash Balance, Pending Approvals)
- Time-series charts (Revenue trend, Stock value trend)
- Alert panel (Low stock items, Overdue payments, Expiring batches)
- Quick Actions (New Invoice, Receive Stock, Transfer, Record Payment)
- Pending Approvals widget (POs awaiting approval, Discount overrides)
- AI Insight of the Day (e.g., "Demand for Denim Jeans is 40% above average this week")

---

### Module 2: Products & Catalogue

**Purpose:** The master product database. Every item that can be bought, sold, or stocked must be registered here.

**Who Uses It:** Inventory Manager, Purchase Manager, Sales Manager, Cashier (read-only lookup).

**Key Screens:**
1. **Product List** — Data table with columns: Name, SKU, Barcode, Category, Unit, Tax Slab, Selling Price, Stock (Available), Status. Supports text search, category filter, brand filter, tax filter, and status filter.
2. **Product Detail** — Full product profile including all pricing tiers, variant matrix, stock levels across locations, purchase history, sales history, and attached images.
3. **Product Form** — Create/Edit form with sections: Basic Info, Pricing, Tax, Stock Settings, Variants, Images.
4. **Variant Matrix** — Grid view for managing size/color combinations with individual SKU and barcode per cell.
5. **Barcode Generator** — Print barcode labels for selected products. Choose label template, printer size, and print quantity.

**Key Features:**
- **Variant-Ready Schema:** Toggle `Has Variants` to expand product into a parent-child matrix. Each variant (e.g., Blue XL) gets its own SKU and barcode.
- **HSN Code Mapping:** Required for GST compliance. Shows HSN-linked tax slab rate.
- **Tax Inclusive/Exclusive Toggle:** Flag whether MRP includes GST or excludes it. Affects billing calculations.
- **Batch & Expiry Tracking:** Toggle per product for pharma and FMCG items.
- **Reorder Points:** Set Min Stock, Max Stock, Reorder Point per product per location.
- **Multiple Images:** Upload product images for POS product picker display.
- **Soft Delete (Deactivate):** Products are never hard-deleted. Deactivated products are hidden from POS but accessible in historical documents.

**Permissions:**
- Inventory Manager: Full create/edit
- Purchase Manager: Read + edit cost price
- Cashier: Read-only (via POS search)
- Sales Manager: Read + edit selling price

---

### Module 3: Inventory

**Purpose:** Real-time visibility into physical stock levels, location-wise breakdown, batch tracking, and movement history.

**Who Uses It:** Inventory Manager, Warehouse Staff, Store Manager, Business Owner.

**Key Screens:**
1. **Stock Dashboard** — Summary of total stock value, stockout items count, low stock alerts, and expiring batch count.
2. **Stock Register** — Per-product, per-location stock view showing Physical, Reserved, Available, Incoming quantities.
3. **Stock Movements Ledger** — Chronological stock movement history for any product: GRN In, Sales Out, Transfer, Adjustment, Return.
4. **Batch Tracker** — View all active batches with expiry dates, quantities, and status (Active/Near Expiry/Quarantined/Recalled).
5. **Stock Adjustment Form** — Record physical count discrepancies. Requires justification and auto-posts to `StockLedger` and `VoucherEntry` (Stock Shrinkage).
6. **Stock Transfer Form** — Transfer stock between locations within the same shop, or between shops.
7. **Physical Stock Take** — Guided cycle count worksheet: scan barcodes of items counted → system auto-calculates variance → generates draft adjustment.
8. **Reorder Report** — Products below reorder point sorted by urgency.

**Key Features:**
- **StockSnapshot (Real-Time Cache):** Every screen reads from the materialized `StockSnapshot` collection — never from raw ledger calculations. Sub-10ms response times even at 100,000 SKU scale.
- **StockLedger (Immutable Audit Trail):** Every stock movement appended as an immutable log entry. Can reconstruct stock level at any point in history.
- **Moving Average Cost (MAC):** `averageCostPrice` recalculated on every GRN post. Used for inventory valuation on Balance Sheet.
- **FEFO Batch Selection:** When billing, system auto-suggests earliest-expiring active batch. Cashier/warehouse staff can accept or override (with manager approval for expired batches).
- **Negative Stock Control:** Shop-level policy: `block` | `warning` | `manager_override`. B2C POS defaults to `warning` to avoid disrupting counter flow.
- **Quarantine Workflow:** Expired/damaged batches flagged as Quarantined. Cannot be selected for billing until status is resolved by Inventory Manager.
- **Stock-in-Transit:** Stock transferred between shops/locations shows as "In Transit" — neither at source nor destination — until the receiving store confirms receipt.

---

### Module 4: Purchase

**Purpose:** Full procurement lifecycle from vendor selection to payment.

**Who Uses It:** Purchase Manager, Inventory Manager (GRN), Accountant (Bills), Business Owner (Approvals).

**Sub-Modules & Screens:**

#### 4.1 Purchase Orders (PO)
- **PO List:** All POs with status filter (Draft, Approved, Sent, Partial, Received, Closed, Cancelled).
- **PO Form:** Select Supplier → Add Line Items (product, quantity, rate, discount, tax) → Calculate totals → Save Draft.
- **PO Actions:** Approve PO (Manager+), Send to Supplier (email/WhatsApp PDF), Mark as Received, Cancel.
- **PO Detail View:** Shows ordered vs received summary, GRN breakdown, advance payments recorded.

**Business Rules:**
- PO can be optional (skip to direct GRN for walk-in cash purchases).
- PO approval required above configured threshold (default ₹50,000).
- One PO can link to multiple GRNs (partial deliveries).
- Auto-draft PO generated when product hits reorder point.

#### 4.2 Goods Receipt Note (GRN / Material Inward)
- **GRN List:** All inward stock receipts with supplier, date, status.
- **GRN Form:** Link to PO (optional) → Pre-fills line items from PO → Enter Received Qty, Rejected Qty, Batch No, Expiry Date per line → Post.
- **GRN Post:** On posting: writes to `StockLedger` (purchase), updates `StockSnapshot` (physical+), recalculates MAC, creates `VoucherEntry` if accounting enabled.

**Business Rules:**
- GRN is IMMUTABLE after posting. Errors corrected via Debit Note.
- Over-delivery (received > ordered): Flag shown, manager approval required.
- Idempotency key required to prevent double-posting on network retry.
- Batch number and expiry date mandatory for `trackBatch = true` products.

#### 4.3 Supplier Bill
- **Bill List:** Payables outstanding, overdue highlighting.
- **Bill Form:** Create from GRN(s) → 3-Way Match runs automatically → Shows variance if bill rate ≠ GRN rate.
- **3-Way Match:** Bill qty must match GRN received qty. Rate variance > 2% requires manager approval.
- **Payment Recording:** Record partial or full payments (Cash, Bank, UPI, Cheque, Advance Adjustment). Cheque bounce handling supported.

#### 4.4 Debit Note (Purchase Return)
- Created when defective or excess stock is returned to supplier.
- Links to original GRN and Supplier Bill.
- On approval: reverses `StockLedger` (return_out), reduces supplier liability in ledger.

---

### Module 5: Sales

**Purpose:** Full B2B and B2C sales lifecycle from quotation to cash collection.

**Sub-Modules:**

#### 5.1 Estimate / Quotation
- **Purpose:** Formal price offer to B2B customers before order confirmation.
- **Form:** Customer → Add Items → Pricing (with PriceList applied) → Validity Date → Notes/Terms.
- **Actions:** Send to customer (email/WhatsApp PDF), Convert to Sales Order (1 click), Mark as Accepted/Rejected.
- **Expiry:** Estimates auto-expire after validity date. Status → `expired`.

#### 5.2 Sales Order (SO)
- **Purpose:** Confirmed buyer commitment that reserves inventory.
- **Confirm Action:** Reserves stock atomically — `StockSnapshot.reserved` increments, `available` decrements. Fails atomically if insufficient stock.
- **Reservation TTL:** Configurable (default 7 days). Cron auto-releases expired reservations and restores available stock.
- **Partial Invoicing:** One SO can generate multiple invoices as stock ships in batches.

#### 5.3 Invoice (Tax Invoice)
- **Types:** Tax Invoice (B2B GST-registered), Retail Invoice (B2C unregistered), Proforma Invoice.
- **GST Calculation:** Automatic CGST/SGST (intrastate) vs IGST (interstate) based on Place of Supply vs Shop State Code.
- **Post Invoice:** Writes `StockLedger` (sale), creates `VoucherEntry`, updates customer outstanding.
- **Cancel Invoice:** Allowed only if `paidAmount = 0`. Posts reversal entries to all ledgers.
- **E-Invoice IRN:** For B2B invoices above threshold, auto-fetches IRN from NIC API and embeds QR code on PDF.
- **E-Way Bill:** For goods transport above ₹50,000, generates E-Way Bill payload for portal submission.

#### 5.4 Delivery Note
- Tracks physical dispatch of goods against invoice.
- One invoice → Multiple delivery notes (partial shipping).
- Status: Pending → Dispatched → Delivered.
- Integrates with courier tracking number entry.

#### 5.5 Credit Note (Sales Return)
- Created when customer returns goods or receives credit for defective items.
- On approval: Reverses `StockLedger` (return_in), reverses GST liability, reduces debtor balance.
- Stock return goes to configurable location (can be quarantine if damaged).

---

### Module 6: POS Counter

**Purpose:** High-speed walk-in billing for B2C retail counter operations. The fastest and most-used screen in the system.

**Layout (Full Screen, Dual Column):**
```
LEFT COLUMN (Cart)                    RIGHT COLUMN (Product Search)
┌────────────────────────────────────┐┌───────────────────────────────────┐
│ Customer: [Walk-in ▼]              ││ [🔍 Scan barcode or search...    ]│
│ ─────────────────────────────────  ││ ─────────────────────────────────│
│ CART ITEMS                         ││ [Product Grid / List]            │
│ ─────────────────────────────────  ││  - Product Name                  │
│ Denim Jeans (Blue, 32)             ││  - Price                         │
│  3 × ₹650 = ₹1,950    [🗑️]        ││  - Stock Available               │
│                                    ││                                  │
│ Nike T-Shirt (White, M)            ││                                  │
│  1 × ₹999 = ₹999      [🗑️]        ││                                  │
│ ─────────────────────────────────  │└───────────────────────────────────┘
│ Subtotal:          ₹2,949          │
│ GST (18%):           ₹530          │
│ Discount:           -₹100          │
│ GRAND TOTAL:       ₹3,379          │
│ ─────────────────────────────────  │
│ [F4: COLLECT PAYMENT]              │
│ [F8: HOLD BILL] [F9: DISCOUNT]     │
└────────────────────────────────────┘
```

**Key Features:**
- **Barcode Scan:** Plug-in USB barcode scanner auto-adds items. Cart updates in < 150ms.
- **Quick Product Search:** Type product name or SKU. Results filter in real time.
- **Customer Linking:** Optionally attach a customer to the bill for loyalty points, credit, and WhatsApp invoice.
- **Discount:** Line-item discount or cart-level discount (BOGO, %, flat amount). Configured discount thresholds require manager PIN above limit.
- **Hold & Resume:** `F8` holds current cart. Multiple bills can be held simultaneously and resumed.
- **Split Payment:** Collect partial cash + partial UPI in a single transaction.
- **Offline Mode:** On network disconnect, billing continues from IndexedDB. Offline bills stored locally, synced automatically when connection restores. Offline receipt numbers (`OFF-MUM-1001`) replaced with official numbers post-sync.
- **Thermal Print:** `Enter` after payment → sends ESC/POS raw command to USB/LAN thermal printer in < 500ms.
- **Customer Display (2nd Monitor):** Optional second display shows cart items and total to customer. Displays UPI QR code for payment.
- **Return at Counter:** Cashier scans original receipt barcode → Auto-loads original items → Cashier selects returned items → Credit Note auto-generated with manager PIN.

---

### Module 7: Customers

**Purpose:** Central customer master for B2C walk-ins and B2B credit accounts.

**Screens:**
1. **Customer List** — Data table with Name, Phone, GSTIN, Credit Limit, Outstanding Balance, Last Purchase Date.
2. **Customer Form** — Create/Edit: Name, Phone, Email, GSTIN (for B2B), Billing/Shipping Addresses, Credit Limit, Credit Days, Price List, Custom Discount %.
3. **Customer Detail** — Full profile: Purchase history, Outstanding invoices, Credit limit usage, Payment history, Loyalty points, Documents.
4. **Receivables Aging** — Customer-wise overdue analysis buckets: 0-30, 31-60, 61-90, 90+ days.
5. **Payment Collection** — Record receipt from customer. Auto-allocates to oldest outstanding invoice.

**Business Rules:**
- Credit limit check runs before Sales Order confirmation and Invoice creation.
- If outstanding > credit limit: System blocks (or warns, based on setting) and requires Manager PIN override.
- B2B GSTIN format validated against regex (standard GSTIN pattern).
- Loyalty points earned on every POS bill. Redeemed as discount at POS counter.

---

### Module 8: Suppliers

**Purpose:** Vendor master for managing supplier relationships, rates, and purchase history.

**Screens:**
1. **Supplier List** — Name, Phone, GSTIN, Payment Terms, Outstanding Balance.
2. **Supplier Form** — Create/Edit: Company Name, Contact, GSTIN, Bank Details, Payment Terms, Credit Days, Preferred Product Mapping.
3. **Supplier Detail** — PO history, GRN history, Bill history, Payment history, Rate history, Outstanding balance.
4. **Payables Aging** — Supplier-wise overdue analysis with aging buckets.
5. **Ledger Statement** — Detailed account statement for a supplier for a date range.

---

### Module 9: Accounting

**Purpose:** Full double-entry accounting engine for financial integrity, statutory compliance, and management reporting.

**Sub-Modules:**
1. **Chart of Accounts (Ledgers)** — Hierarchical view of all ledgers grouped by type (Assets, Liabilities, Income, Expense, Equity). System ledgers created automatically on shop setup and cannot be deleted.
2. **Voucher Entry (Journal)** — Manual double-entry journal for adjustments. `totalDebit` must equal `totalCredit` before save.
3. **Daybook** — Chronological list of all vouchers for a selected date range, grouped by voucher type.
4. **General Ledger** — Account-wise ledger detail with running balance for any date range.
5. **Bank Reconciliation** — Upload bank CSV statement → Auto-match against recorded payment vouchers → Flag unreconciled entries.
6. **Trial Balance** — Group-wise and detailed trial balance proving accounting accuracy.
7. **Profit & Loss Statement** — Income minus Expense for any date range, with store-wise breakdown.
8. **Balance Sheet** — Assets = Liabilities + Equity snapshot for any date.
9. **GST Reports** — GSTR-1, GSTR-3B (see Section 17).
10. **Financial Year Close Wizard** — Multi-step wizard: Review P&L → Confirm Retained Earnings carryover → Lock old FY → Open new FY.

---

### Module 10: Reports

*See Section 17 for complete report documentation.*

**Report Types:** Sales, Purchase, Inventory, Finance, GST, Customer, Supplier, Store Comparison.

---

### Module 11: Settings

*See Section 22 for complete settings documentation.*

---

## 5. Every Screen

### Screen: Invoice Form

**Purpose:** Create a new B2B or B2C sales invoice.

**Layout:** Full-page form with three zones:
- **Header Zone:** Customer search typeahead, Invoice Date, Invoice Number (auto-generated), Type (Tax Invoice / Retail / Proforma), Place of Supply, Sales Order link (optional), POS Flag.
- **Line Items Zone:** Scrollable table — each row: Product Search, Variant Selection, Qty, Rate (PriceList-resolved), Discount %, HSN, Tax Slab, CGST, SGST, IGST, Line Total.
- **Footer Zone:** Sticky bottom bar — Subtotal, Discount Total, Taxable Amount, CGST, SGST, IGST, Cess, Grand Total, Paid Amount, Balance Due.

**Action Buttons:**
- `Save Draft` — Save without posting. Editable.
- `Approve` — Lock line items. Moves to posting step.
- `Post Invoice` — Final action. Writes StockLedger + VoucherEntry. Requires idempotency key. Irreversible without formal cancellation.
- `Print PDF` — Download/print formatted invoice PDF.
- `WhatsApp` — Share invoice link via Meta WhatsApp API.
- `Email` — Send invoice with PDF attachment.
- `Cancel Invoice` — Initiates formal reversal (only if balance due = full amount).

**Filters/Options on List Page:**
- Status filter: Draft, Approved, Posted, Partial, Paid, Overdue, Cancelled
- Date range
- Customer
- Sales person
- POS flag (counter sale vs ERP sale)
- Overdue only toggle

**Validation:**
- Grand Total must be > 0
- Customer required for credit invoices
- GSTIN required on Tax Invoice if customer is GST-registered
- HSN code required on every line item for Tax Invoice
- Place of Supply required (auto-fills from customer's state, editable)

**Empty State:** "No invoices yet. Create your first invoice →"

**Loading State:** Skeleton UI rows while data fetches. Invoice list returns in < 200ms from Redis cache.

---

### Screen: POS Counter

*(Documented fully in Module 6 above)*

---

### Screen: Stock Dashboard

**Purpose:** Give inventory managers a real-time view of stock health.

**Layout:** Full-page with 4 KPI cards at top, then data table below.

**KPI Cards:**
1. Total Stock Value (₹) — based on Moving Average Cost
2. Stockout Items Count — products where `available = 0`
3. Low Stock Alerts — products where `available ≤ reorderPoint`
4. Expiring Batches — batches with expiry ≤ 30 days

**Data Table:** Product-wise stock showing Physical, Reserved, Available, Incoming, Avg Cost, Stock Value.

**Columns Toggle:** User can show/hide columns. Preference saved per user.

**Bulk Actions:** Select multiple products → Print Barcode Labels, Set Reorder Point, Export CSV.

---

## 6. Every Feature

### Feature: Moving Average Cost (MAC) Recalculation

**Why It Exists:** Inventory needs a consistent cost basis for Balance Sheet valuation and COGS calculation. FIFO is overly complex for SMB retail. Standard Cost is too rigid. MAC auto-updates on every purchase receipt, giving an accurate real-time average cost per unit.

**Who Uses It:** Accountant (balance sheet), Inventory Manager (stock valuation), Business Owner (profit margin).

**Business Value:** Accurate COGS → Accurate Gross Margin → Better pricing decisions.

**Inputs:** GRN Received Qty, GRN Received Rate per line item.

**Output:** Updated `StockSnapshot.averageCostPrice` and `Product.averageCostPrice`.

**Workflow:** GRN Posted → `updateMovingAverageCost()` called in same MongoDB transaction → New avg cost stored atomically.

**Formula:** `New Avg Cost = ((Current Physical × Old Avg) + (GRN Qty × GRN Rate)) / (Current Physical + GRN Qty)`

**Edge Cases:**
- First GRN for a product: Avg cost = GRN rate.
- GRN with zero cost (free sample): Avg cost unchanged.
- Negative physical stock at time of GRN: System flags warning, calculates based on 0 base.

---

### Feature: 3-Way Purchase Matching

**Why It Exists:** Prevents supplier overbilling. The supplier bill should match what was actually ordered (PO) and what was actually received (GRN). Without this check, businesses routinely overpay vendors.

**Who Uses It:** Purchase Manager, Accountant.

**Business Value:** Prevents overbilling losses. Industry estimates show 3-way matching catches 4-8% overbilling in uncontrolled environments.

**Inputs:** PO Line Items (qty, rate), GRN Line Items (received qty, received rate), Supplier Bill Line Items (billed qty, billed rate).

**Output:** Match result per line item — Pass / Fail (qty mismatch) / Warning (rate variance > threshold).

**Workflow:** Supplier Bill form auto-runs match when GRN IDs are linked. Match result displayed per line. Bill approval blocked on Fail. Rate variance > 2% requires manager `priceVarianceApproved` flag.

**Permissions:** Only Purchase Manager or Manager+ can approve variance.

---

### Feature: FEFO Batch Selection

**Why It Exists:** For pharma and FMCG businesses, selling stock that expires soonest first prevents costly expiry write-offs and regulatory compliance failures.

**Who Uses It:** Cashier (via auto-suggestion), Inventory Manager (manual batch selection).

**Business Value:** Reduces expiry loss. For a pharma shop doing ₹1 crore/month, even 0.5% reduction in expiry loss = ₹60,000/year saved.

**Input:** Product ID, Location ID, Quantity Needed.

**Output:** Ordered list of batch allocations (earliest expiry first, excluding quarantined).

**Workflow:** During invoice line item creation, system queries available batches sorted by expiry date → Auto-suggests allocation → User can override (expired batch override requires manager PIN).

**Edge Cases:**
- Near-expiry warning: Batches expiring in < 30 days show orange warning flag.
- All batches quarantined: System blocks sale with clear error.
- Mixed batches: System splits across multiple batches automatically.

---

### Feature: Offline POS Billing & Sync

**Why It Exists:** Internet connectivity in Indian retail environments is unreliable. A POS that stops working on internet outage is a business liability.

**Who Uses It:** Cashier.

**Business Value:** Zero billing downtime regardless of internet connectivity.

**Workflow:**
1. Network connection drops → POS switches to Offline Mode (visual indicator in top bar).
2. Bills continue uninterrupted using local IndexedDB cart state.
3. Offline invoices assigned temporary numbers (`OFF-MUM-1001`) with client-generated UUID as idempotency key.
4. Network restores → Background Service Worker detects connectivity.
5. Offline queue posts to `/api/pos/sync-offline` with all pending bills.
6. Server validates idempotency keys, writes `StockLedger`, assigns official invoice numbers.
7. Cashier receives sync confirmation with official invoice numbers.

**Edge Cases:**
- Same item sold offline at two POS terminals simultaneously → Stock goes negative → `NEGATIVE_STOCK_ALERT` fires, reconciled on next GRN.
- Sync fails partway through → Retry with full idempotency key → Server treats as duplicate, returns cached 200.

---

### Feature: Customer Credit Limit Enforcement

**Why It Exists:** B2B wholesale businesses extend credit to buyers. Without automated enforcement, buyers exceed credit limits and businesses accumulate bad debt.

**Who Uses It:** System enforces automatically; Sales Manager and Business Owner manage exceptions.

**Business Value:** Reduces bad debt. Industry average bad debt in uncontrolled credit businesses: 2-5% of revenue.

**Input:** Customer's current outstanding balance (from Debtor Ledger), new invoice amount, configured credit limit.

**Validation:** If `(outstanding + new invoice amount) > creditLimit` → Block (or warn, depending on `negativeStockPolicy`-like setting).

**Override:** Manager+ can enter PIN to proceed with detailed reason logged to `AuditLog`.

---

## 7. Complete Business Flow

### Day 1: Company Onboarding

```
Create Tenant Account
       ↓
Enter Company Details (Name, GSTIN, Financial Year Start, State Code)
       ↓
Create Shops (Branch locations with individual GSTINs if applicable)
       ↓
Create Locations (Warehouses, Store fronts within each Shop)
       ↓
Create Users → Assign Roles → Set Branch Access
       ↓
Configure Settings (Document number series, Tax slabs, Approval thresholds)
       ↓
Import Master Data: Categories → Products (CSV) → Customers (CSV) → Suppliers (CSV)
       ↓
Post Opening Stock Entry (for each product at each location)
       ↓
Post Opening Balances (Ledger opening balances from old system)
       ↓
System Ready for Live Transactions
```

### Daily Operations Cycle

```
MORNING
  ├── Inventory Manager: Review overnight low-stock and expiry alerts
  ├── Purchase Manager: Process pending GRNs from yesterday's deliveries
  ├── Store Manager: Open cash register, assign POS terminals
  └── Cashier: Login, verify cash drawer opening balance

DAY
  ├── PURCHASE FLOW: Supplier arrives → GRN → Post Stock → Supplier Bill (3-way match) → Schedule Payment
  ├── SALES FLOW (B2C): Walk-in → POS Counter → Barcode Scan → Payment → Thermal Print → Done
  ├── SALES FLOW (B2B): Estimate → SO (Reserve Stock) → Invoice → Delivery Note → Payment → Receipt
  └── INVENTORY FLOW: Monitor stock levels → Initiate transfers → Handle returns and adjustments

EVENING
  ├── Accountant: Review day's vouchers in Daybook, flag discrepancies
  ├── Store Manager: Close cash register, reconcile cash vs digital, submit EOD report
  └── Business Owner: Review consolidated dashboard — revenue, profit, outstanding
```

### Document Lifecycle: Purchase Order

```
[DRAFT] Created by Purchase Manager
   │
   ▼ (Approve action by Manager+)
[APPROVED] Locked for editing. Ready to send to supplier.
   │
   ▼ (Send action — email/WhatsApp PDF)
[SENT] Supplier notified.
   │
   ├── Partial goods received → [PARTIAL]
   └── All goods received → [RECEIVED] → [CLOSED]
   
   Any non-posted state → [CANCELLED] by Manager (with reason logged)
```

### Document Lifecycle: Invoice

```
[DRAFT] Created by Sales Manager or Cashier
   │
   ▼ (Approve action)
[APPROVED] Line items locked. Ready for posting.
   │
   ▼ (Post action with idempotency key)
[POSTED] StockLedger + VoucherEntry written. Irreversible except via formal Cancel.
   │
   ├── Partial payment received → [PARTIAL]
   └── Full payment received → [PAID]
   
   [POSTED] → [CANCELLED] only if paidAmount = 0 (full reversal of stock and voucher entries)
   [POSTED] → [OVERDUE] automatically when past dueDate
```

### Year-End Financial Closing

```
Step 1: Review & lock all transactions for old FY (no new postings in old FY after lock)
       ↓
Step 2: Review Trial Balance — ensure totalDebit = totalCredit
       ↓
Step 3: Review P&L Statement — Net Profit / Net Loss figure
       ↓
Step 4: Post Year-End Journal Voucher:
         Dr Revenue Accounts (to zero them out)
         Dr Retained Earnings (if Net Loss)
         Cr Expense Accounts (to zero them out)
         Cr Retained Earnings (if Net Profit)
       ↓
Step 5: Carry forward Balance Sheet balances to new FY
       ↓
Step 6: Open new Financial Year (new document sequences start from 0001)
       ↓
Step 7: Old FY locked — read-only for future audits
```

---

## 8. Owner Experience

A business owner's primary touchpoint is the **Owner Dashboard** — a real-time command center for their entire business.

### Owner Dashboard (Full Description)

**Top KPI Row (Always Visible):**
| Card | Metric | Calculation | Color Logic |
|:-----|:-------|:------------|:------------|
| Today's Revenue | Σ posted invoices today | All shops consolidated | Green if ≥ daily target, Red if < 80% |
| Gross Profit % | (Revenue - COGS) / Revenue | MAC-based COGS | Green if > 30%, Yellow if 20-30%, Red if < 20% |
| Cash + Bank Balance | Current cash/bank ledger balances | All shops | — |
| Outstanding Receivables | Σ unpaid customer invoices | All shops | Red if > 15% of monthly revenue |

**Charts Section:**
1. **30-Day Revenue vs Expense Trend** — Bar chart overlay. Today's bar highlighted.
2. **Branch Performance** — Horizontal bar chart: Top 5 branches by revenue this month.
3. **Cash Flow Forecast (7-Day)** — Line chart projecting next 7 days based on scheduled receivables and payables.
4. **Stock Health** — Donut chart: Healthy / Low Stock / Stockout / Overstocked by value.

**Alert Panel (Actionable):**
- ⚠️ 3 products out of stock (View →)
- 🔴 7 invoices overdue > 60 days (₹2.3 lakh) (View →)
- 📦 12 batches expiring in < 30 days (View →)
- ✅ 2 purchase orders awaiting your approval (Approve →)

**AI Insight Card:**
*"📈 Your Delhi branch generated ₹1.2L today — 28% above its monthly average. This aligns with a regional festival season. Consider increasing stock of Fast-Moving items at Delhi."*

**Quick Actions:**
- New Invoice, New Purchase Order, Transfer Stock, View P&L, Download GST Report.

---

## 9. Store Manager Experience

### Opening Store (Morning Routine)

1. **Login** → Store Manager dashboard loads with their shop's data.
2. **Open Cash Register** → Enter opening cash balance → System logs shift start.
3. **Check Overnight Alerts** → Any low stock or expiry alerts for their store.
4. **Assign POS Terminals** → Assign today's cashiers to their billing counters.
5. **Review Pending Deliveries** → Check GRNs expected today from purchase manager.

### Mid-Day Operations

- Monitor **Live Sales Counter** — Bills per hour, current cart values.
- Approve **Discount Overrides** — Receive push notification when cashier exceeds discount limit → Enter PIN via mobile.
- Handle **Customer Escalations** — Access customer invoice history to resolve complaints.
- Review **Stock Alerts** — Fast-moving items that need restocking from warehouse.

### Closing Store (Evening Routine)

1. **Close Cash Register** → Enter actual physical cash counted.
2. **Cash Reconciliation Report** → System shows: Expected Cash (sum of cash sales) vs Actual Cash → Flag variance.
3. **Digital Payment Summary** → UPI, Card totals confirmed via settlement summary.
4. **End-of-Day Report** → PDF report of day's sales, payments, returns, generated automatically.
5. **Submit EOD** → Report emailed to Business Owner automatically.

---

## 10. Cashier Experience

### Shift Start

1. Login with Username + Password (or Biometric if configured).
2. POS screen loads immediately — full screen, no sidebar.
3. Opening cash count entered (if required by store policy).

### Billing Workflow (Happy Path)

```
Customer approaches counter with items
       ↓
Cashier scans first item barcode → Cart auto-populates (< 150ms)
       ↓
Continue scanning all items
       ↓
[F9] Apply promo code or discount if applicable
       ↓
Customer pays:
  → Cash: Enter ₹ received → System calculates change
  → UPI: Customer scans QR on customer display
  → Card: Push to card machine (Pine Labs / Razorpay integration)
  → Split: Collect partial cash + partial UPI
       ↓
[F4] Confirm Payment → Invoice auto-posted
       ↓
Thermal receipt prints automatically (ESC/POS)
       ↓
Optional: WhatsApp invoice to customer if phone registered
       ↓
Next customer
```

### Counter Return (Happy Path)

1. Cashier presses **Return** button or scans original invoice barcode.
2. Original invoice loads with all items.
3. Cashier selects returned items and quantities.
4. Enters return reason (Defective / Customer Changed Mind / Wrong Item).
5. Requires Manager PIN for authorization.
6. Credit Note posted → Customer receives cash/credit wallet refund.

---

## 11. Inventory Experience

### Receiving Inward Stock (GRN Workflow)

1. Supplier delivery arrives at warehouse.
2. Inventory/Warehouse staff opens **GRN Form** → Links to Purchase Order (if exists).
3. PO items pre-populate with ordered quantities.
4. Staff enters actual received quantities, rejected quantities per line.
5. For batch-tracked items: Enter Batch Number and Expiry Date per line.
6. For serial-tracked items: Scan or enter individual serial numbers.
7. **Post GRN** → Stock enters `StockLedger`, `StockSnapshot` updates in real-time.

### Stock Transfer (Inter-Location)

1. Source location staff creates **Stock Transfer Form**.
2. Select destination (same shop different location, or different shop).
3. Add products and quantities to transfer.
4. Dispatch → `StockLedger: transfer_out` at source. Stock shows as "In Transit".
5. Destination staff opens pending transfer → Verifies received quantities → Receive.
6. `StockLedger: transfer_in` at destination. Stock arrives.

### Physical Stock Take (Cycle Count)

1. Inventory Manager creates a **Stock Take Sheet** for a product category or location.
2. System generates count sheet with all products and system quantities (hidden initially).
3. Warehouse staff physically count and scan barcodes → Enter counted quantities.
4. Submit count → System reveals variance (System Qty vs Counted Qty).
5. Variance > tolerance threshold → Flags for manager review.
6. Manager approves → System posts `StockAdjustment` with `StockLedger: adjustment_in/out`.
7. `VoucherEntry` auto-posted: Stock Shrinkage (for negative adjustments) or Stock Surplus (for positive).

---

## 12. Purchase Experience

### Standard Purchase Flow

```
Auto-Reorder Alert Fired (if reorder point breached)
  OR
Purchase Manager decides to restock
       ↓
Create Purchase Order:
  - Select Supplier
  - Add products with quantities and negotiated rates
  - Set Expected Delivery Date
  - Save Draft
       ↓
Manager Reviews & Approves PO (if above threshold)
       ↓
PO Sent to Supplier (PDF via WhatsApp/Email)
       ↓
Supplier Delivers Goods
       ↓
Create GRN against PO:
  - System pre-fills from PO
  - Enter received quantities (may be partial)
  - Enter batch numbers and expiry dates
  - Post GRN → Stock enters system
       ↓
Create Supplier Bill against GRN:
  - 3-Way Match auto-runs
  - If variance: Requires manager approval
  - Approve Bill → Liability posted to Creditor Ledger
       ↓
Record Payment(s) against Bill:
  - Cash / Bank / UPI / Cheque
  - Advance adjustments applied
       ↓
Bill marked PAID → Supplier account settled
```

---

## 13. Sales Experience

### B2B Sales Flow

```
Customer Request
       ↓
Create Estimate/Quotation:
  - Customer details
  - Items with PriceList-resolved pricing
  - Validity date
  - Payment terms
  - Send to customer
       ↓
Customer Accepts (1-click portal link or phone confirmation)
       ↓
Convert Estimate to Sales Order (1 click):
  - All items pre-filled
  - Confirm SO → Stock Reserved atomically
  - Customer's credit limit verified
       ↓
Goods Ready → Create Invoice from SO:
  - Partial or full invoicing
  - FEFO batches auto-suggested
  - Tax calculated (CGST/SGST or IGST)
  - Post Invoice → StockLedger + VoucherEntry
       ↓
Delivery Note Created → Goods Dispatched
       ↓
Customer Receives Goods → Delivery Confirmed
       ↓
Payment Received:
  - Bank Transfer, UPI, Cheque
  - Applied against specific invoice(s)
       ↓
Invoice → PAID. Customer account settled.
```

---

## 14. Accounting Experience

### Daily Accounting Routine

1. **Morning:** Open **Daybook** → Review all vouchers posted yesterday (GRN purchases, Sales, Payments).
2. **Verify:** Check for any anomalies — unusual amounts, manual journal entries, cancelled invoices.
3. **Bank Reconciliation:** Import today's bank statement CSV → Match against ledger entries → Flag gaps.
4. **Approval:** Check if any manual journal entries need accountant counter-sign.

### Month-End Routine

1. Run **GSTR-1 Report** for the month → Validate HSN summaries → Export JSON → Upload to GST portal.
2. Run **GSTR-3B Summary** → Verify tax payable calculation → Record GST payment journal entry.
3. Review **Trial Balance** — Confirm Debit = Credit across all accounts.
4. Send **P&L Statement** to Business Owner.

### GST Filing

- **GSTR-1:** Monthly sales return. System generates validated JSON including B2B section (Table 4), B2CS section (Table 7), HSN Summary (Table 12), Document Series (Table 13).
- **GSTR-3B:** Monthly summary return. System calculates: Total Taxable Sales, CGST Payable, SGST Payable, IGST Payable, Input Tax Credit (CGST/SGST/IGST), Net Tax Payable.
- Both exports available in JSON (for portal upload) and Excel (for review).

---

## 15. Customer Experience

### B2B Customer Portal

A dedicated web link (`portal.multishop.app/c/{customerSlug}`) or PWA app for wholesale buyers.

**Features:**
- View all invoices with status (Paid / Unpaid / Overdue)
- Download PDF invoices and account statements
- View credit limit and outstanding balance
- Pay outstanding invoices via Razorpay payment link
- Track delivery status of recent orders
- Raise return or dispute on a specific invoice
- View loyalty points balance (B2C)
- Download GSTR-2A reconciliation data (B2B)

---

## 16. Supplier Experience

### Vendor Portal (Phase 3)

A web portal for suppliers to interact with the business self-service:

**Features:**
- View open purchase orders directed at them
- Confirm PO acceptance and provide delivery ETA
- Upload scanned supplier invoice against received GRN
- View payment status of submitted bills
- Download payment receipts
- View account statement (all bills, payments, outstanding)

---

## 17. Reports

MultiShop ERP generates 35 standard reports organized into 8 categories:

### Sales Reports

| Report | Description | Filters | Export |
|:-------|:------------|:--------|:-------|
| Sales Summary | Revenue by date/shop/category/salesperson | Date, Shop, Category, Customer, Salesperson | Excel, PDF |
| Invoice Register | All invoices with status and payment | Date, Status, Customer | Excel, PDF |
| Sales Return Summary | Credit notes and return reasons | Date, Product, Customer | Excel |
| Customer Receivables Aging | Outstanding by 0-30, 31-60, 61-90, 90+ buckets | Customer, Shop | Excel, PDF |
| Salesperson Performance | Revenue, invoices count, margin by rep | Date, Salesperson | Excel |
| Top Products by Revenue | Ranked by sales value | Date, Category, Shop | Excel |
| Price Override Log | All instances of manual price changes | Date, Cashier, Product | Excel |

### Purchase Reports

| Report | Description | Filters | Export |
|:-------|:------------|:--------|:-------|
| Purchase Summary | Procurement by date/supplier/category | Date, Shop, Supplier | Excel, PDF |
| GRN Register | All goods received with batch details | Date, Supplier, Product | Excel |
| Supplier Payables Aging | Outstanding by aging buckets | Supplier, Shop | Excel, PDF |
| 3-Way Match Exceptions | Bills with variance exceptions and approvals | Date, Supplier | Excel |
| Purchase Return Summary | Debit notes by supplier | Date, Supplier | Excel |
| Supplier Rate Comparison | Rate changes for a product across time | Product, Supplier | Excel |

### Inventory Reports

| Report | Description | Filters | Export |
|:-------|:------------|:--------|:-------|
| Stock Valuation Report | Stock value at average cost by product/location | Shop, Location, Category | Excel, PDF |
| Stock Movement Ledger | Item-level movement history | Product, Date, Type | Excel |
| ABC Inventory Analysis | Category A (80% value), B, C by revenue contribution | Shop, Date | Excel |
| Dead Stock Report | Products with zero movement in X days | Days, Shop, Category | Excel |
| Slow Moving Products | Below average velocity items | Days, Shop | Excel |
| Fast Moving Products | Top velocity items | Date, Shop | Excel |
| Batch Expiry Report | All batches with expiry dates | Days to Expiry, Shop | Excel |
| Reorder Report | Products below reorder point | Shop, Category | Excel |
| Stock Take Variance | Differences from last physical count | Date, Shop, Category | Excel |

### Financial Reports

| Report | Description | Filters | Export |
|:-------|:------------|:--------|:-------|
| Profit & Loss Statement | Revenue - Expenses = Net Profit | Date, Shop | Excel, PDF |
| Balance Sheet | Assets = Liabilities + Equity | Date | PDF |
| Trial Balance | All ledger closing balances | Date, Shop | Excel, PDF |
| Daybook | All vouchers chronologically | Date, Type | Excel, PDF |
| Cash Flow Statement | Operating/Investing/Financing cashflows | Date | PDF |
| Ledger Account | Detailed transaction register for any ledger | Ledger, Date | Excel |
| Bank Book | Bank account transactions only | Bank Ledger, Date | Excel |

### GST Reports

| Report | Description | Export |
|:-------|:------------|:-------|
| GSTR-1 Report | Monthly sales return detail | JSON (Govt), Excel |
| GSTR-3B Summary | Monthly summary return | Excel, PDF |
| HSN-wise Summary | Tax collected by HSN code | Excel |
| E-Invoice Register | All E-Invoices with IRN | Excel |
| E-Way Bill Register | All E-Way Bills generated | Excel |
| GST Input Credit Summary | ITC available by CGST/SGST/IGST | Excel |

### Customer Reports

| Report | Description |
|:-------|:------------|
| Customer Ledger | Full account statement for any customer |
| Customer Lifetime Value | Total revenue, profit, and tenure per customer |
| New vs Repeat Customer | Split of new and returning customers |
| Loyalty Points Report | Points earned, redeemed, and balance |

### Store Comparison Reports (Multi-Store)

| Report | Description |
|:-------|:------------|
| Branch Revenue Comparison | Side-by-side revenue across all shops |
| Branch Margin Comparison | Net margin % per shop |
| Branch Stock Efficiency | Inventory turnover ratio per shop |
| Inter-Branch Transfer Summary | All transfers between shops |

---

## 18. Dashboards

### Owner Dashboard

**KPI Cards:** Today's Revenue (All Shops), Gross Profit %, Total Cash + Bank Balance, Outstanding Receivables, Outstanding Payables, Active Alerts Count.

**Charts:**
1. 30-Day Revenue Trend (bar chart, all shops stacked)
2. Branch Performance Comparison (horizontal bar)
3. Product Category Revenue Breakdown (pie chart)
4. 7-Day Cash Flow Forecast (line chart)

**Widgets:** Alert Panel, Pending Approvals, AI Insight, Quick Actions.

---

### Store Manager Dashboard

**KPI Cards:** Today's Store Revenue, Bills Processed Today, Average Bill Value, Cash Register Balance (vs opening), Low Stock Items.

**Charts:**
1. Hourly Billing Velocity (bar chart for current day)
2. Payment Mode Split (Cash / UPI / Card / Credit)

**Widgets:** Today's Staff Present, Pending Supplier Deliveries, Customer Return Requests.

---

### Cashier Dashboard

Minimal — only shows what a cashier needs:
- Personal bills processed today
- Personal cash collected today
- Hold Bills waiting
- Quick shortcut to POS Counter

---

### Inventory Manager Dashboard

**KPI Cards:** Total Stock Value (₹), Stockout Items, Low Stock Alerts, Expiring Batches (30 days).

**Charts:**
1. Stock Value by Category (pie)
2. Top 10 Lowest Stock Items (bar)
3. Expiry Timeline (gantt-style for next 90 days)

---

### Accountant Dashboard

**KPI Cards:** Unreconciled Bank Entries, Trial Balance Status (Balanced / ⚠️ Mismatch), GSTR-1 Filed Status, Pending Voucher Approvals.

**Charts:**
1. Monthly GST Payable vs Input Credit
2. Revenue vs Expense Trend (P&L preview)

---

## 19. Notifications

MultiShop ERP dispatches notifications through three channels: **In-App Notification Center**, **WhatsApp** (Meta Cloud API), and **Email**.

### Complete Notification Catalogue

| Alert Code | Trigger Condition | Recipient | Channel |
|:-----------|:-----------------|:----------|:--------|
| `STOCK_LOW` | `available ≤ reorderPoint` | Inventory Manager, Store Manager | In-App + WhatsApp |
| `STOCK_OUT` | `available = 0` AND pending SO exists | Inventory Manager, Store Manager, Owner | In-App + WhatsApp (Urgent) |
| `EXPIRY_NEAR` | Batch expiry ≤ 30 days | Inventory Manager | In-App (Daily Digest) |
| `EXPIRY_TODAY` | Batch expires today | Inventory Manager | In-App + Auto-quarantine |
| `PAYMENT_OVERDUE_SUPPLIER` | Supplier bill past due date | Accountant, Purchase Manager, Owner | In-App + Email |
| `PAYMENT_OVERDUE_CUSTOMER` | Customer invoice past due date + grace | Sales Manager, Accountant | In-App + WhatsApp to Customer |
| `REORDER_AUTO` | Auto-draft PO created by reorder cron | Purchase Manager | In-App |
| `PRICE_SPIKE` | Bill rate > 10% above last PO rate | Purchase Manager | In-App |
| `CREDIT_LIMIT` | Customer outstanding > credit limit | Sales Manager | In-App (blocks transaction) |
| `STOCK_VARIANCE` | Physical count differs > 2% from system | Inventory Manager, Owner | In-App + Audit Log |
| `NEGATIVE_STOCK` | Stock goes below zero | Store Manager, Inventory Manager | In-App (Urgent) |
| `PO_APPROVAL` | PO created above threshold requiring approval | Manager+ | In-App + WhatsApp |
| `DISCOUNT_OVERRIDE` | Cashier exceeded discount threshold | Store Manager | In-App + Push |
| `CASH_SHORTFALL` | Cash closing balance ≠ expected cash from sales | Store Manager | In-App |
| `SYNC_COMPLETE` | Offline POS bills synced successfully | Cashier | In-App |
| `SYNC_FAILED` | Offline sync retry exceeded limit | Store Manager, Owner | In-App + Email |
| `LOGIN_SUSPICIOUS` | Login from new device/location | User, Admin | Email + In-App |
| `BACKUP_SUCCESS` | Daily backup completed | Platform Admin | Email |
| `BACKUP_FAILED` | Backup job failed | Platform Admin, Owner | Email (Urgent) |
| `GST_DEADLINE` | GSTR-1/3B filing deadline in 3 days | Accountant | In-App + Email |
| `CHEQUE_BOUNCE` | Payment marked as bounced | Accountant, Owner | In-App |
| `RESERVATION_EXPIRED` | SO reservation TTL expired, stock released | Sales Manager | In-App |
| `TRANSFER_RECEIVED` | Inter-branch stock transfer received | Inventory Manager (destination) | In-App |

---

## 20. Automation Engine

MultiShop ERP's automation engine runs on BullMQ job queues backed by Redis. Every automation is a **Trigger → Condition → Action → Notification** pipeline.

### Automation Catalogue

| Automation | Trigger | Condition | Action | Notification |
|:-----------|:--------|:----------|:-------|:-------------|
| **Auto-Reorder PO** | Every 6 hours (cron) | `projected ≤ reorderPoint` AND no open PO for product | Create Draft PO with last supplier and rate | `REORDER_AUTO` to Purchase Manager |
| **Stock Reservation Release** | Every hour (cron) | SO past `reservationExpiresAt` | Release `reservedQty` → restore `StockSnapshot.available`. SO → Cancelled. | `RESERVATION_EXPIRED` to Sales Manager |
| **Expiry Quarantine** | Daily at midnight | Batch expiry date = today | Set `batchStatus = 'quarantined'` | `EXPIRY_TODAY` to Inventory Manager |
| **Invoice Overdue Mark** | Daily at 8 AM | Invoice past `dueDate` | Set `status = 'overdue'` | `PAYMENT_OVERDUE_CUSTOMER` |
| **Supplier Bill Overdue** | Daily at 8 AM | Bill past `dueDate` | Flag `status = 'overdue'` | `PAYMENT_OVERDUE_SUPPLIER` |
| **Customer Payment Reminder** | Daily at 10 AM | Invoice overdue > X days | Send WhatsApp payment link to customer | WhatsApp with payment link |
| **Vendor Payment Alert** | Daily at 9 AM | Supplier bill due in 2 days | Alert Purchase Manager | In-App + Email |
| **GST Deadline Alert** | 20th of month | GSTR-1/3B not filed | Alert Accountant | In-App + Email |
| **EOD Store Report** | 9 PM daily | Shift closed | Generate and email EOD PDF report | Email to Owner + Regional Manager |
| **Backup Job** | 3 AM daily | — | MongoDB dump → S3 encrypted upload | Email (Success/Failure) |
| **Price Spike Alert** | On GRN Post | Bill rate > 10% above last PO rate | Flag on GRN, alert manager | `PRICE_SPIKE` In-App |
| **Low Stock Restock Alert** | On `StockSnapshot` update | `available ≤ reorderPoint` | Alert Inventory Manager | `STOCK_LOW` WhatsApp |
| **AI Demand Forecast** | Weekly Sunday 6 AM | Always | Recalculate velocity model for all products → Update reorder quantities | AI Insights dashboard widget updated |

---

## 21. AI Features

### AI Dashboard Widget

Every role's dashboard includes an AI Insight card that surfaces the single most actionable insight for that user.

**Examples by role:**
- Owner: *"Delhi store's margin dropped 4% this week due to ₹2.1L in manual discounts applied."*
- Inventory Manager: *"Product 'Paracetamol 500mg' will stockout in 3 days based on current velocity."*
- Purchase Manager: *"Supplier ABC has increased rates by 12% across 5 items in the last 2 months."*

### AI Copilot (Natural Language Querying)

Available via Command Palette (`⌘K`) or dedicated AI Chat page.

**Sample Queries:**
- *"What was last month's profit?"* → Pulls P&L and displays net profit inline.
- *"Which products are expiring in the next 30 days?"* → Lists batch expiry table.
- *"Show me top 5 customers by outstanding balance"* → Renders ranked table.
- *"Which branch has the most dead stock?"* → Branch + dead stock value comparison.

### Smart Reorder Engine

Replaces naive min/max thresholds with velocity-based forecasting:

```
Reorder Quantity = (Avg Daily Sales Velocity × Supplier Lead Time) + Safety Buffer (20%)

Where:
  Avg Daily Sales Velocity = 90-day rolling average units sold per day
  Supplier Lead Time       = Historical average days from PO to GRN for that supplier
  Safety Buffer            = Configurable multiplier (default 20%)
```

### Customer Churn Detection

Monitors B2B buyers whose ordering frequency has dropped:
- Customer who ordered every 30 days → has not ordered in 45+ days → Trigger `CHURN_RISK_ALERT` to Sales Manager.
- Sales Manager receives alert with customer's historical purchase value.

### Fraud / Anomaly Detection

- Flags cashier sessions with unusually high cancellation rates.
- Alerts on repeated manual price overrides by same cashier.
- Detects unusually large cash shortfalls in shift closing.
- Identifies purchase orders to new suppliers with unusually high amounts.

### Cash Flow Prediction

- 7-day and 30-day cash flow forecast based on:
  - Scheduled supplier bill payments (payables)
  - Expected customer invoice collections (receivables aging model)
  - Recurring expense schedule
- Displayed as a line chart on Owner Dashboard.

---

## 22. Settings

### Company Settings
- Company name, logo, registered address, GSTIN, PAN, state code, financial year start month.
- Branch/shop creation and configuration.
- Currency (default INR), decimal precision, number format.

### Store Settings (Per-Shop)
- Shop name, GSTIN, registered address, contact details.
- Document prefix for this shop (e.g., "MUM" for Mumbai).
- `negativeStockPolicy`: block / warning / manager_override.
- `enableAdvancedAccounting`: true / false (show/hide full accounting UI).
- Default location for inward stock.
- Reservation TTL (days) for sales order stock holds.

### POS Settings (Per-Shop)
- Default payment mode (Cash / UPI).
- Maximum discount without manager PIN (%).
- Enable / Disable customer display screen.
- Enable / Disable loyalty points earning.
- ESC/POS printer configuration (USB / LAN, port, baud rate).
- Receipt header and footer text.
- Auto-WhatsApp invoice after billing (on/off).

### Inventory Settings
- Default costing method (MAC — only option in current version).
- Batch tracking enabled globally / per product.
- Near-expiry alert threshold (days, default: 30).
- Stock shrinkage expense ledger mapping.
- Auto-quarantine on expiry (on/off).

### Purchase Settings
- PO approval required: Yes / No.
- PO approval threshold (₹ amount above which approval required).
- 3-way match rate variance tolerance (%, default: 2%).
- Auto-PO from reorder point (on/off).
- Default payment terms for new suppliers.

### Sales Settings
- Sales Order reservation TTL (days, default: 7).
- Customer credit limit enforcement: block / warning / off.
- E-Invoice threshold (₹ turnover, currently ₹5 crore mandatory).
- E-Way Bill threshold (₹ per consignment, currently ₹50,000).
- Default invoice type (Tax Invoice / Retail Invoice).

### Accounting Settings
- Chart of Accounts: Add custom ledgers, map to groups.
- Enable multi-currency (on/off, Phase 2).
- Bank accounts list with ledger mapping.
- Payment mode → Ledger mapping (Cash A/c, Bank A/c, UPI A/c).
- Financial year dates.

### GST Settings
- GSTIN per shop.
- HSN code validation (strict / warn / off).
- GSTR-1 filing frequency (Monthly / Quarterly).
- E-Invoice API credentials (NIC IRP production key).
- E-Way Bill API credentials.

### User & Role Settings
- Create / Edit / Deactivate users.
- Assign roles to users.
- Configure approval matrix (who can approve what, at what threshold).
- Session timeout (minutes, default: 480).
- 2FA enforcement (on/off per role).

### Notification Settings
- Configure which alerts go to which channel (In-App / WhatsApp / Email / SMS).
- WhatsApp API key configuration.
- SMS gateway configuration.
- Email server SMTP configuration.
- Per-user notification preferences.

### Theme Settings
- Light Mode / Dark Mode toggle.
- Brand color customization (primary color for invoice headers, receipts).

### Printing Settings
- Thermal printer model and connection.
- Invoice PDF template selection.
- Receipt content customization (logo, footer message, social handles).
- Barcode label size and template.

### Integration Settings
- Payment gateway API keys (Razorpay, PhonePe, Pine Labs).
- WhatsApp Cloud API token.
- Shopify store URL and access token.
- Amazon MWS credentials.
- Google Drive / OneDrive OAuth.
- S3 backup bucket configuration.

### Backup & Security Settings
- Automated backup frequency (daily / hourly).
- Backup storage (S3 bucket / Google Drive).
- Data retention period.
- IP whitelist for admin access.
- Audit log retention period.
- Password complexity policy.
- Session management (max concurrent sessions per user).

---

## 23. Integrations

### Payment Gateways
- **Razorpay:** POS card payments via EDC terminal API. Online payment links for invoices.
- **PhonePe:** UPI QR code generation for customer display.
- **Pine Labs Plutus:** Direct POS integration — push amount to card machine, receive settlement confirmation.
- **Paytm Business:** UPI and Paytm wallet acceptance.

### Government / Statutory
- **GST Portal (GSTN):** GSTR-1 JSON upload, GSTN GSTIN verification API.
- **NIC IRP (E-Invoice):** Auto-generate IRN and QR code for B2B invoices above ₹5 crore turnover threshold.
- **E-Way Bill Portal:** Auto-generate E-Way Bill for consignments above ₹50,000.

### Communication
- **Meta WhatsApp Cloud API:** Invoice sharing, payment reminders, low stock alerts, OTP delivery.
- **MSG91 / Twilio SMS:** DLT-compliant SMS for OTPs and payment reminders.
- **Nodemailer / SendGrid Email:** Transactional emails for invoices, statements, system alerts.

### Hardware
- **ESC/POS Thermal Printers:** Direct Web-USB / Web-Serial / LAN integration with Epson, TVS, Bixolon, RP80 printers.
- **Barcode Scanners:** Standard USB HID class — plug-in works, no driver needed.
- **Barcode Printers:** Zebra ZPL and Citizen label printers for stock labeling.
- **Weighing Scale:** RS-232 / USB scale integration for weight-based pricing at POS.
- **Cash Drawer:** ESC/POS kick signal to open cash drawer on payment.
- **Card Machines (EDC):** Pine Labs GPRS terminal integration.
- **Biometric Devices:** USB fingerprint scanner for manager PIN override authentication.

### E-Commerce
- **Shopify:** 2-way sync — product catalog, inventory levels, and order ingestion.
- **Amazon India (SP-API):** Multi-channel inventory sync and order management.
- **Flipkart Seller Hub:** Order ingestion and stock sync (Phase 3).
- **WooCommerce:** REST API webhook integration (Phase 3).

### Cloud Storage
- **Google Drive:** Automated export of daily reports, invoice PDFs.
- **Microsoft OneDrive:** Backup and report sync.
- **Dropbox:** Document storage and team sharing.
- **AWS S3:** Primary backup storage for database dumps and file uploads.

---

## 24. Mobile Apps

### Owner App (iOS + Android PWA)

**Purpose:** Give business owners real-time visibility and approval capability from their mobile phone.

**Features:**
- Consolidated Owner Dashboard (all shops) with live KPI cards.
- Revenue and profit charts — daily, weekly, monthly.
- Branch-by-branch performance comparison.
- Outstanding receivables and payables summary.
- Push notifications for all critical alerts (stock, approvals, overdue payments).
- One-tap approval for pending purchase orders and discount overrides.
- WhatsApp-style action: reply to alerts with approve/reject.
- AI daily business summary in chat format.
- Quick report: Today's P&L, Cash position, Top products.
- Offline: Cached last-seen data available without internet.

---

### Manager App (iOS + Android PWA)

**Purpose:** Store managers on the shop floor need quick access without a desktop.

**Features:**
- Store dashboard with hourly billing velocity.
- Live stock lookup — type product name → see stock at all locations.
- Approve discount overrides via mobile PIN entry (push notification → approve in 2 taps).
- Approve inter-branch stock transfer requests.
- View and action pending GRN deliveries.
- Cash register status (current session balance vs expected).
- End-of-day store report submission.

---

### Inventory App (iOS + Android)

**Purpose:** Warehouse staff using smartphones or tablets for stock operations.

**Features:**
- Camera barcode scanner for stock take / GRN.
- Scan product barcode → View stock level and location.
- Physical stock count entry (scan + enter quantity).
- Receive stock transfer and confirm delivery.
- Print barcode label via Bluetooth label printer.
- Offline scan queue synced when connected.

---

### Customer App (PWA)

**Purpose:** B2B customers manage their account self-service.

**Features:**
- View all invoices (list, search, filter).
- Download PDF invoices.
- View outstanding balance and payment history.
- Pay invoices via Razorpay payment link.
- Track delivery status.
- View loyalty points.

---

## 25. Future Modules Roadmap

### Phase 5 (Months 18–24)

| Module | Description |
|:-------|:------------|
| **CRM** | Lead management, follow-up scheduling, customer interaction history, sales pipeline. |
| **B2B Customer Portal** | Full self-service ordering portal for wholesale buyers. |
| **Vendor Portal** | Supplier self-service: View POs, submit invoices, track payments. |
| **Expense Management** | Track operational expenses (rent, utilities, salaries) against budget. |

### Phase 6 (Months 24–30)

| Module | Description |
|:-------|:------------|
| **Light Manufacturing / BOM** | Bill of Materials for kit assembly, hamper bundles, and kitting. |
| **HRMS & Payroll** | Employee management, attendance, shift scheduling, salary processing. |
| **Fixed Asset Management** | Asset tracking, depreciation vouchers, disposal accounting. |
| **Service Management** | Service tickets, AMC contracts, technician dispatching. |

### Phase 7 (Months 30–40)

| Module | Description |
|:-------|:------------|
| **E-Commerce Module** | Multi-channel order management hub (Shopify + Amazon + own website). |
| **Business Intelligence (BI)** | Advanced analytics with custom report builder and pivot tables. |
| **AI Copilot v2** | Full conversational business management — execute actions via natural language. |
| **Data Warehouse** | Separate analytics store for historical query performance at billion-row scale. |

---

## 26. Feature Checklist

### Core ERP Features

| Feature | Status |
|:--------|:-------|
| Multi-tenant architecture | ✅ Planned |
| Multi-shop / multi-branch | ✅ Planned |
| Multi-location / warehouse | ✅ Planned |
| Role-Based Access Control (18 roles) | ✅ Planned |
| Audit log (immutable) | ✅ Planned |
| Soft delete for master data | ✅ Planned |
| Document number series per shop/FY | ✅ Planned |
| Financial Year management | ✅ Planned |

### Inventory

| Feature | Status |
|:--------|:-------|
| Product master with variants | ✅ Planned |
| Barcode / SKU tracking | ✅ Planned |
| Batch + expiry tracking | ✅ Planned |
| Serial number tracking | 🔵 Phase 2 |
| FEFO batch selection | ✅ Planned |
| Moving Average Cost valuation | ✅ Planned |
| Stock Snapshot (materialized) | ✅ Planned |
| Stock Ledger (append-only) | ✅ Planned |
| Negative stock control | ✅ Planned |
| Reorder point automation | ✅ Planned |
| Physical stock count module | ✅ Planned |
| ABC inventory analysis | 🔵 Phase 2 |
| Dead stock report | 🔵 Phase 2 |

### Purchase

| Feature | Status |
|:--------|:-------|
| Purchase Orders | ✅ Planned |
| GRN / Material Inward | ✅ Planned |
| 3-Way match (PO-GRN-Bill) | ✅ Planned |
| Supplier Bills | ✅ Planned |
| Supplier payment recording | ✅ Planned |
| Debit Notes (purchase returns) | ✅ Planned |
| Purchase requisition workflow | 🔵 Phase 2 |
| Vendor rating system | 🟡 Future |

### Sales

| Feature | Status |
|:--------|:-------|
| Estimates / Quotations | ✅ Planned |
| Sales Orders with stock reservation | ✅ Planned |
| Tax Invoices | ✅ Planned |
| Delivery Notes | ✅ Planned |
| Credit Notes (sales returns) | ✅ Planned |
| Customer credit limit enforcement | ✅ Planned |
| Price lists (tier pricing) | ✅ Planned |
| Customer-facing quote portal | 🔵 Phase 2 |
| Commission tracking | 🔵 Phase 2 |

### POS

| Feature | Status |
|:--------|:-------|
| Barcode scanner integration | ✅ Planned |
| Offline billing (IndexedDB) | ✅ Planned |
| Split payment (cash + UPI) | ✅ Planned |
| Hold and resume bills | ✅ Planned |
| Thermal ESC/POS receipt print | ✅ Planned |
| Customer display (2nd screen) | ✅ Planned |
| Cart-level discounts + BOGO | 🔵 Phase 2 |
| Loyalty points earn/redeem | 🔵 Phase 2 |
| Return at counter (scan invoice) | 🔵 Phase 2 |

### Accounting

| Feature | Status |
|:--------|:-------|
| Double-entry voucher engine | ✅ Planned |
| System ledger auto-creation | ✅ Planned |
| Manual journal vouchers | ✅ Planned |
| Daybook | ✅ Planned |
| Trial Balance | ✅ Planned |
| Profit & Loss Statement | ✅ Planned |
| Balance Sheet | ✅ Planned |
| Bank reconciliation (CSV) | ✅ Planned |
| Financial year close wizard | ✅ Planned |
| Tax inclusive/exclusive billing | ✅ Planned |
| Modular accounting toggle (Simple/Full) | ✅ Planned |

### GST & Statutory

| Feature | Status |
|:--------|:-------|
| CGST/SGST/IGST auto-calculation | ✅ Planned |
| Intrastate vs interstate detection | ✅ Planned |
| HSN code mapping | ✅ Planned |
| GSTR-1 JSON export | ✅ Planned |
| GSTR-3B summary | ✅ Planned |
| E-Invoice (IRN via NIC API) | 🔵 Phase 2 |
| E-Way Bill generation | 🔵 Phase 2 |
| Reverse charge support | ✅ Planned |

---

## 27. User Journey Maps

### Business Owner: Full Day Journey

```
07:30 — Open mobile Owner App
         ↓ View consolidated overnight summary notification
         ↓ See 2 alerts: "Delhi branch low on 3 products" + "₹1.2L customer payment overdue"
         ↓ Tap alert → See overdue customer list → Forward to Sales Manager in 1 tap

09:00 — Open web dashboard on laptop
         ↓ Review consolidated P&L for yesterday
         ↓ Check branch comparison chart → Notice Mumbai margin dropped 3%
         ↓ Drill down → High manual discounts at Mumbai counter
         ↓ Change Mumbai discount threshold from 10% to 5% in Settings

10:30 — Approval Center has 1 item
         ↓ PO worth ₹1.8L from Purchase Manager → Review line items → Approve

12:00 — AI Insight: "Denim demand up 30% this weekend across all branches"
         ↓ Message Regional Manager to confirm Delhi and Mumbai stocked up

17:00 — Quick check from phone
         ↓ Today's revenue: ₹3.4L across 3 shops
         ↓ Close app, satisfied with daily performance
```

---

### Cashier: Single Billing Transaction Journey

```
POS Counter is active and idle
       ↓
Customer places items on counter
       ↓
Cashier scans first barcode [USB scanner] → Item added to cart in < 150ms
       ↓
Scans remaining 4 items → Cart shows all 5 items with totals
       ↓
Customer asks for discount → Cashier presses [F9]
       ↓
Applies 5% cart discount (within threshold — no PIN needed)
       ↓
Customer wants to pay via UPI → QR code appears on customer display
       ↓
Customer scans and pays → Cashier confirms payment received
       ↓
[F4] Confirm Payment → Invoice auto-posted → Thermal printer fires
       ↓
Receipt printed in < 500ms → Customer takes receipt
       ↓
Optional: Customer provides phone → WhatsApp invoice sent in background
       ↓
POS clears for next customer — Total transaction: < 45 seconds
```

---

### Purchase Manager: Full Purchase Cycle

```
Morning: Reorder alert on dashboard
         ↓
"Paracetamol 500mg at Warehouse: Available 20 (Reorder Point: 50)"
         ↓
Auto-draft PO exists → Review draft → Adjust quantities
         ↓
Approve PO → Send to supplier via WhatsApp PDF

Next Day: Supplier delivers
         ↓
Warehouse staff creates GRN linked to PO
         ↓
GRN form pre-fills from PO → Staff enters received quantities, batch numbers
         ↓
Post GRN → Stock enters system → Purchase Manager notified

Supplier sends invoice
         ↓
Purchase Manager creates Supplier Bill from GRN
         ↓
3-Way Match runs → Qty matches. Rate shows +3% variance vs GRN
         ↓
Purchase Manager enters price variance justification → Approves with reason logged
         ↓
Bill approved → Creditor ledger updated

Payment due in 14 days
         ↓
Automated reminder sent to Purchase Manager 2 days before due date
         ↓
Record payment via bank transfer → Bill marked PAID
```

---

## 28. Competitive Comparison

### Feature Comparison Matrix

| Feature | MultiShop ERP | Zoho Books/Inv | Shopify POS | Tally Prime | Busy Accounting | SAP B1 | NetSuite | Odoo |
|:--------|:-------------:|:--------------:|:-----------:|:-----------:|:---------------:|:------:|:--------:|:----:|
| **POS Speed (< 1s checkout)** | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Multi-Store Native** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Offline POS Billing** | ✅ | ❌ | Limited | ✅ (Desktop) | ✅ (Desktop) | ❌ | ❌ | ❌ |
| **Batch + Expiry Tracking** | ✅ | ✅ | Plugin | ✅ | ✅ | ✅ | ✅ | ✅ |
| **3-Way Purchase Matching** | ✅ | ✅ | ❌ | Manual | Manual | ✅ | ✅ | ✅ |
| **FEFO Batch Auto-Selection** | ✅ | ✅ | ❌ | Manual | Manual | ✅ | ✅ | ✅ |
| **Moving Average Costing** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Native GSTR-1 JSON Export** | ✅ | ✅ | Plugin | ✅ | ✅ | Plugin | Plugin | Plugin |
| **E-Invoice IRN (NIC API)** | ✅ Phase2 | ✅ | Plugin | ✅ | ✅ | Plugin | Plugin | Plugin |
| **Double-Entry Accounting** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Variant Products (Size/Color)** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **AI Demand Forecasting** | ✅ Phase4 | Limited | ❌ | ❌ | ❌ | ❌ | ✅ Addon | ❌ |
| **WhatsApp Invoice Share** | ✅ | ✅ | ❌ | Plugin | Plugin | ❌ | ❌ | Plugin |
| **SMB Pricing (< ₹3k/month)** | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |

### MultiShop's Unique Advantages

1. **POS + ERP Depth in One Product:** Neither Tally (no POS) nor Shopify POS (no accounting) can match this.
2. **Built-for-India Statutory:** Unlike SAP B1, NetSuite, and Odoo — all of which treat India as an afterthought requiring expensive localizations.
3. **Offline-First Web POS:** Unlike Zoho and Odoo web POS which fail on connectivity loss.
4. **Sub-₹3,000/month Pricing with Enterprise Features:** SAP B1 starts at ₹2,00,000/year. MultiShop Professional is ₹7,999/month.

---

## 29. Product Maturity Score

### Module-Level Maturity Assessment

| Module | Maturity | Score | Key Gaps | Priority |
|:-------|:---------|:-----:|:---------|:--------:|
| **Inventory Engine (StockLedger + StockSnapshot)** | Production-Ready Architecture | 9.5/10 | Serial number tracking (Phase 2) | P0 (Build First) |
| **Purchase Lifecycle** | Production-Ready | 9.0/10 | Purchase Requisition workflow | P0 |
| **POS Counter** | Production-Ready | 9.5/10 | Loyalty points, BOGO promotions | P0 |
| **Sales Lifecycle** | Production-Ready | 9.0/10 | Customer portal, commission tracking | P0 |
| **Multi-Store Operations** | Production-Ready | 9.5/10 | Regional manager drill-down | P0 |
| **Accounting Engine** | Solid Architecture | 8.5/10 | Financial close wizard UX | P1 |
| **GST Compliance** | Core Complete | 8.0/10 | E-Invoice, E-Way Bill API (Phase 2) | P1 |
| **POS Offline Sync** | Architecture Defined | 8.5/10 | Background sync conflict resolution edge cases | P1 |
| **AI Features** | Roadmap Defined | 7.0/10 | Smart reorder requires 3 months of data | P2 |
| **Reports Suite** | Partially Complete | 7.5/10 | Cash flow statement, CLV report | P1 |
| **Mobile Apps** | Architecture Defined | 7.0/10 | Full mobile build not started | P2 |
| **Integrations (E-Commerce)** | Roadmap Defined | 6.5/10 | Shopify, Amazon sync (Phase 3) | P2 |
| **Customer Portal** | Roadmap Defined | 6.0/10 | Basic portal (Phase 3) | P2 |
| **Vendor Portal** | Roadmap Defined | 5.5/10 | Full portal (Phase 3) | P3 |
| **CRM Module** | Future | 4.0/10 | Full CRM (Phase 5) | P3 |
| **HRMS / Payroll** | Future | 3.0/10 | Full HRMS (Phase 6) | P3 |

### Top Priority Improvements (P0)

1. **Thermal Printer Driver Integration** — Without this, POS is not production-usable at counter.
2. **Idempotency Key Enforcement** — Critical to prevent double-posting on network failures.
3. **MongoDB ACID Transaction Wrapping** — All posting handlers must use session transactions.
4. **StockSnapshot Atomic Updates** — Redis `redlock` for concurrent reservation conflicts.
5. **GSTR-1 JSON Generator** — Accountants cannot file GST without this.
6. **Role-Based Dashboard Implementation** — Every role must see a tailored dashboard.
7. **PDF Invoice Template** — Customers and suppliers need properly formatted invoices.
8. **3-Way Match UI** — The visual match result in Supplier Bill form must be clear and actionable.

---

*This document is the official Product Bible for MultiShop ERP.*  
*Version 1.0.0 — Last Updated: 2026-07-28*  
*For updates, corrections, or additions, contact the Product Team.*
