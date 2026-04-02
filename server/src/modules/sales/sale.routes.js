const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const ctrl   = require('./sale.controller');
const { protect }              = require('../../middlewares/auth.middleware');
const { allowRoles, shopAccess } = require('../../middlewares/role.middleware');

const validateSale = [
  body('shopId').notEmpty().withMessage('shopId is required'),
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.productId').notEmpty().withMessage('Each item must have a productId'),
  body('items.*.quantity').isFloat({ min: 0.001 }).withMessage('Each item quantity must be > 0'),
  body('taxRate').optional().isFloat({ min: 0, max: 100 }).withMessage('taxRate must be 0–100'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }
    next();
  },
];

// ── Public (customer shop checkout) ──────────────────────────────────────────
router.post('/public/checkout', ctrl.publicCheckout);

// ── Protected routes ──────────────────────────────────────────────────────────
router.use(protect);

router.get('/',     shopAccess, ctrl.getAll);
router.get('/:id',             ctrl.getOne);   // shopAccess enforced inside getSaleById
router.post('/',    shopAccess, allowRoles('super_admin', 'owner', 'manager', 'billing_staff'), validateSale, ctrl.create);
router.patch('/:id/refund',         allowRoles('super_admin', 'owner', 'manager'), ctrl.refund);
router.patch('/:id/partial-refund', allowRoles('super_admin', 'owner', 'manager'), ctrl.partialRefund);

module.exports = router;
