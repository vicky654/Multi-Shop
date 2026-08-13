/**
 * The eight workflow guides.
 *
 * DESIGN CONSTRAINT THAT SHAPES THIS FILE
 *   A guide must never claim the product works differently from how it does. So
 *   every step below names the real screen, the real button label and the real
 *   outcome, and `route` deep-links to the actual page. When a video is missing
 *   the written steps are shown instead — they are the primary content, not a
 *   placeholder, and they are useful on their own.
 *
 * HOW THE VIDEOS ARE PRODUCED
 *   `videoSpec` names the Cypress spec that drives the REAL application through
 *   the workflow with video recording on (`npm run guides:record` in client/).
 *   The recording is a genuine screen capture of the real app against real data —
 *   not a staged mock-up. If a spec has not been recorded, `VideoGuide` falls
 *   back to the written steps rather than showing a broken player.
 *
 *   Videos are looked up at `/guides/<id>.mp4` in the public folder. They are
 *   deliberately NOT committed as fake placeholder files: an absent video is an
 *   honest absence, and the fallback covers it.
 */

export const GUIDES = [
  {
    id: 'getting-started',
    order: 1,
    title: 'Getting Started',
    minutes: 2,
    summary: 'Create your shop, set your GST details, and understand how the pieces connect.',
    route: '/settings',
    videoSpec: 'cypress/e2e/guides/g01-getting-started.cy.js',
    steps: [
      'Open Settings from the sidebar. This is where your shop itself is configured.',
      'Fill in the shop name, address and phone — these print on every invoice.',
      'Open the Tax / GST section. Enter your GSTIN if you have one; the state code is filled in from it automatically.',
      'Choose your scheme: Regular charges GST and can claim input credit; Composition and Not-registered do not charge GST on invoices.',
      'Set the invoice prefix (e.g. INV) and whether totals round to the nearest rupee.',
      'Save. Everything else in the app — products, billing, reports, tax — hangs off this shop.',
    ],
    why: 'Every product, bill and report belongs to a shop. Getting the GST settings right now means '
       + 'your first invoice is correct and your tax figures add up from day one.',
  },
  {
    id: 'adding-products',
    order: 2,
    title: 'Adding Products',
    minutes: 3,
    summary: 'Add a product with cost, price and stock — including colour/size variants.',
    route: '/inventory',
    videoSpec: 'cypress/e2e/guides/g02-adding-products.cy.js',
    steps: [
      'Go to Inventory and click Add Product.',
      'Step 1 — enter the name, category and brand.',
      'Step 2 — if the product comes in colours or sizes, add them here and fill the grid with how many of each you have. The total stock is calculated from the grid, so it can never disagree with it.',
      'Step 3 — enter your cost price and selling price. The profit and margin are worked out as you type; you can also enter a target profit percent and let it set the price.',
      'Step 4 — optionally set a per-variant price, a GST rate for this product, a barcode and a reorder level.',
      'Step 5 — review the summary and save.',
    ],
    why: 'Cost price is what makes the profit and tax reports meaningful — a product saved without it '
       + 'shows revenue but no profit. The variant grid is what lets you sell "size 9 in blue" and '
       + 'have the right pair come off the shelf.',
  },
  {
    id: 'import-export',
    order: 3,
    title: 'Import & Export',
    minutes: 3,
    summary: 'Load your whole catalogue from a spreadsheet, and get it back out again.',
    route: '/inventory',
    videoSpec: 'cypress/e2e/guides/g03-import-export.cy.js',
    steps: [
      'On Inventory, click Sample File. This downloads a CSV in exactly the format Import expects, with worked examples.',
      'Open it in Excel. Required columns are name, category, price and costPrice; everything else is optional.',
      'For colour/size products, use the variants column: "Blue:8:4; Blue:9:6" means 4 pairs of blue size 8 and 6 of blue size 9. The stock column is then filled in for you.',
      'Replace the example rows with your products and save as CSV.',
      'Click Import CSV and upload it. Every row is validated first — you see exactly which rows failed and why, and the good rows still import.',
      'Click Export CSV (or Excel) at any time to download your full catalogue, including calculated profit, margin and stock value with a totals row.',
    ],
    why: 'Typing 200 products by hand takes a day; importing them takes a few minutes. Exporting is '
       + 'also your backup before any bulk change, and the file your accountant can actually read.',
  },
  {
    id: 'creating-a-bill',
    order: 4,
    title: 'Creating a Bill',
    minutes: 3,
    summary: 'Take payment at the counter and produce a correct GST invoice.',
    route: '/billing',
    videoSpec: 'cypress/e2e/guides/g04-creating-a-bill.cy.js',
    steps: [
      'Go to Billing. Products appear on the left — tap one, search by name, or scan a barcode.',
      'For a variant product, choose the colour and size; stock comes off that exact combination.',
      'Adjust quantities in the cart. GST is calculated by the server as you go, so the total on screen is the total that gets recorded.',
      'Optionally attach a customer, and apply a discount if you are giving one.',
      'Choose the payment method — cash, UPI, card, or split across several — then take payment.',
      'The invoice prints or shares, stock is reduced, and the sale appears in Orders, Reports and your GST figures immediately.',
      'Not ready to charge? Use Hold to park the cart and serve someone else; nothing is recorded until payment.',
    ],
    why: 'This is the one screen you will use every day. Everything else in the app is fed by it — '
       + 'if the bill is right, your stock, profit and tax are right automatically.',
  },
  {
    id: 'inventory-stock-audit',
    order: 5,
    title: 'Inventory & Stock Audit',
    minutes: 3,
    summary: 'Keep the system matching the shelves, and record the differences honestly.',
    route: '/inventory',
    videoSpec: 'cypress/e2e/guides/g05-inventory-audit.cy.js',
    steps: [
      'Inventory lists everything with its stock, margin and a low-stock warning.',
      'To correct a single product, open it and use Adjust Stock — you must give a reason (damage, theft, correction, restock).',
      'For a full count, click Stock Audit. Enter the quantity you actually counted for each product.',
      'The panel shows the difference against the system before you commit anything.',
      'Submit. Each difference is written as a dated adjustment with a reason, so it is auditable rather than silently overwritten.',
      'For variant products, count each colour/size separately — the totals are summed from the grid.',
    ],
    why: 'Stock drifts through damage, theft and miscounts. If the system says 12 and the shelf has 9, '
       + 'your stock value, profit and taxable income are all overstated. A monthly audit keeps those '
       + 'numbers true — and gives you a record of where the loss went.',
  },
  {
    id: 'sales-reports',
    order: 6,
    title: 'Sales & Reports',
    minutes: 2,
    summary: 'See what sold, how it was paid for, and whether the shop made money.',
    route: '/reports',
    videoSpec: 'cypress/e2e/guides/g06-sales-reports.cy.js',
    steps: [
      'Orders lists every bill you have raised; open one to see its lines, payment and invoice.',
      'Reports aggregates them. Pick a date range first — everything below responds to it.',
      'Sales trend shows revenue over time; Best sellers shows which products actually move.',
      'Payment breakdown shows your cash/UPI/card mix, which is what you reconcile the till against.',
      'Profit & Loss takes revenue, subtracts cost of goods sold and expenses, and shows what is left.',
      'Export any report to keep a copy or send it on.',
    ],
    why: 'Revenue alone is misleading. A busy shop can lose money on a bad margin mix, and the '
       + 'best-seller list is what tells you where to spend your reorder budget.',
  },
  {
    id: 'profit-margin',
    order: 7,
    title: 'Profit & Margin',
    minutes: 2,
    summary: 'Understand the difference, and price so the shop is actually viable.',
    route: '/reports',
    videoSpec: 'cypress/e2e/guides/g07-profit-margin.cy.js',
    steps: [
      'Profit per unit is the selling price after discount, minus your cost price.',
      'Margin is that profit as a percentage of the selling price — the figure to compare across products.',
      'In the Add Product pricing step, you can type a target profit percent and let the app set the price.',
      'Inventory shows a margin badge per product; the export includes profit, margin and stock value per line with totals.',
      'Reports → Profit & Loss shows the whole-shop picture after expenses, which is the number that matters.',
      'Watch products with high sales but thin margin — they can earn less than a slower product with a healthy one.',
    ],
    why: 'Markup and margin are not the same number, and confusing them is the most common way a shop '
       + 'underprices itself. A 50% markup on cost is only a 33% margin on the sale.',
  },
  {
    id: 'gst-tax',
    order: 8,
    title: 'GST & Tax',
    minutes: 3,
    summary: 'Charge the right tax, claim the credit you are entitled to, and see what you owe.',
    route: '/tax',
    videoSpec: 'cypress/e2e/guides/g08-gst-tax.cy.js',
    steps: [
      'Settings → Tax/GST holds your GSTIN, scheme, price mode (GST included in the price or added on top) and default rate.',
      'A product can override the default with its own GST rate; 0% is a valid, deliberate setting.',
      'On a bill, GST is split into CGST + SGST within your state, or IGST for another state — decided by the state code from your GSTIN.',
      'Record purchases under Purchases/GRN with their GST. That tax becomes input credit you can set against what you collected.',
      'Log business expenses under Expenses and classify them, so legitimate deductions are counted.',
      'Tax & Profit then shows your GST position (collected minus eligible credit) and your taxable profit.',
    ],
    why: 'Input credit is money you have already paid and can legitimately reclaim — most of what shops '
       + 'lose is credit they never recorded. Nothing here hides or reduces a sale; it makes sure what '
       + 'you owe is calculated accurately and on the correct figures.',
    note: 'MultiShop does not ship tax rates. Rates are configured per financial year so they stay '
        + 'correct as the law changes, and an unconfirmed year reports "not configured" rather than guessing.',
  },
];

/** Look up a guide by id. */
export const guideById = (id) => GUIDES.find((g) => g.id === id) || null;

/** Where a recorded video lives, if one has been produced. */
export const videoUrlFor = (id) => `/guides/${id}.mp4`;

/** The ordered journey a brand-new owner should follow. */
export const GUIDE_ORDER = GUIDES.slice().sort((a, b) => a.order - b.order).map((g) => g.id);
