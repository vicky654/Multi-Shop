/**
 * Centralized validation middleware (express-validator).
 *
 * Usage:
 *   const { validate, rules } = require('../../middlewares/validate');
 *   router.post('/', validate(rules.createProduct), ctrl.create);
 *
 * Each `rules.*` export is an array of check() / body() validators that is
 * passed directly to `validate()`, which runs them and short-circuits with
 * 422 + structured errors if any fail.
 */

const { body, validationResult } = require('express-validator');

// ── Runner ────────────────────────────────────────────────────────────────────
const validate = (validators) => [
  ...validators,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }
    next();
  },
];

// ── Rule sets ─────────────────────────────────────────────────────────────────
const rules = {

  // POST /products
  createProduct: [
    body('name').trim().notEmpty().withMessage('name is required'),
    body('category').trim().notEmpty().withMessage('category is required'),
    body('price').isFloat({ min: 0 }).withMessage('price must be ≥ 0'),
    body('costPrice').isFloat({ min: 0 }).withMessage('costPrice must be ≥ 0'),
    body('shopId').notEmpty().withMessage('shopId is required'),
    body('discount').optional().isFloat({ min: 0, max: 100 }).withMessage('discount must be 0–100'),
    body('stock').optional().isFloat({ min: 0 }).withMessage('stock must be ≥ 0'),
    body('expiryDate').optional().isISO8601().withMessage('expiryDate must be a valid date'),
  ],

  // PUT /products/:id
  updateProduct: [
    body('price').optional().isFloat({ min: 0 }).withMessage('price must be ≥ 0'),
    body('costPrice').optional().isFloat({ min: 0 }).withMessage('costPrice must be ≥ 0'),
    body('discount').optional().isFloat({ min: 0, max: 100 }).withMessage('discount must be 0–100'),
    body('stock').optional().isFloat({ min: 0 }).withMessage('stock must be ≥ 0'),
    body('expiryDate').optional().isISO8601().withMessage('expiryDate must be a valid date'),
  ],

  // POST /customers
  createCustomer: [
    body('name').trim().notEmpty().withMessage('name is required'),
    body('phone').trim().notEmpty().withMessage('phone is required'),
    body('shopId').notEmpty().withMessage('shopId is required'),
    body('email').optional().isEmail().withMessage('email must be valid'),
  ],

  // POST /expenses
  createExpense: [
    body('category').trim().notEmpty().withMessage('category is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('amount must be > 0'),
    body('shopId').notEmpty().withMessage('shopId is required'),
    body('date').optional().isISO8601().withMessage('date must be a valid date'),
  ],

  // POST /auth/register
  register: [
    body('name').trim().notEmpty().withMessage('name is required'),
    body('email').isEmail().withMessage('valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('password must be ≥ 6 characters'),
    body('role').optional().isIn(['owner', 'manager', 'billing_staff', 'inventory_staff'])
      .withMessage('invalid role'),
  ],

  // POST /sales (alias — sale.routes.js already has its own inline validators;
  // this entry allows consuming the centralized runner from there in the future)
  createSale: [
    body('shopId').notEmpty().withMessage('shopId is required'),
    body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
    body('items.*.productId').notEmpty().withMessage('Each item must have a productId'),
    body('items.*.quantity').isFloat({ min: 0.001 }).withMessage('Each item quantity must be > 0'),
    body('taxRate').optional().isFloat({ min: 0, max: 100 }).withMessage('taxRate must be 0–100'),
    body('payments').optional().isArray().withMessage('payments must be an array'),
    body('payments.*.method').optional()
      .isIn(['cash', 'card', 'upi', 'credit']).withMessage('payment method must be cash/card/upi/credit'),
    body('payments.*.amount').optional().isFloat({ min: 0 }).withMessage('payment amount must be ≥ 0'),
  ],

  // PATCH /sales/:id/partial-refund
  partialRefund: [
    body('refundItems').isArray({ min: 1 }).withMessage('refundItems must be a non-empty array'),
    body('refundItems.*.productId').notEmpty().withMessage('Each refund item must have a productId'),
    body('refundItems.*.quantity').isFloat({ min: 0.001 }).withMessage('Each refund quantity must be > 0'),
  ],

  // POST /credit-ledger/:customerId/repay
  repayCredit: [
    body('amount').isFloat({ min: 0.01 }).withMessage('amount must be > 0'),
    body('shopId').notEmpty().withMessage('shopId is required'),
    body('notes').optional().isString(),
  ],
};

module.exports = { validate, rules };
