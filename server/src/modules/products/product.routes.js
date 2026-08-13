const router  = require('express').Router();
const multer  = require('multer');
const ctrl    = require('./product.controller');
const { protect }    = require('../../middlewares/auth.middleware');
const { allowRoles, shopAccess } = require('../../middlewares/role.middleware');

// multer: store CSV in memory (no disk writes needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) cb(null, true);
    else cb(Object.assign(new Error('Only CSV files are allowed'), { status: 400 }));
  },
});

// multer: accept images for AI photo analysis
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(Object.assign(new Error('Only image files are allowed'), { status: 400 }));
  },
});

// ── Public routes (no auth required — customer shop) ─────────────────────────
router.get('/public',             ctrl.getPublic);
router.get('/public/categories',  ctrl.getPublicCategories);
router.get('/public/:id',         ctrl.getPublicOne);

// ── Protected routes ──────────────────────────────────────────────────────────
router.use(protect);

// P0 tenant isolation: apply shopAccess to EVERY route in this module.
// Without it, a caller could pass ?shopId=<another tenant> and the service
// filters would honour it — the list filters do
//     filter.shopId = { $in: user.shops };  if (shopId) filter.shopId = shopId;
// where the second line OVERWRITES the membership restriction, and
// reports shopFilter() returned { shopId } with no check at all.
// shopAccess validates query/body/param shopId against req.user.shops
// (super_admin bypasses, absent shopId falls through to the default filter).
router.use(shopAccess);

router.get('/',           ctrl.getAll);
router.get('/low-stock',  ctrl.lowStock);
router.get('/categories', ctrl.categories);
router.get('/export',        ctrl.exportCSV);        // ← CSV or XLSX (?format=)
router.get('/import-sample', ctrl.sampleImportFile); // ← downloadable template
router.get('/:id',        ctrl.getOne);

router.post(
  '/',
  allowRoles('super_admin', 'owner', 'manager', 'inventory_staff'),
  ctrl.create
);
router.post(
  '/audit/bulk',
  allowRoles('super_admin', 'owner', 'manager', 'inventory_staff'),
  ctrl.bulkAuditAdjust
);
router.post(
  '/import',
  allowRoles('super_admin', 'owner', 'manager', 'inventory_staff'),
  upload.single('file'),
  ctrl.importCSV
);                                                   // ← CSV bulk import
router.post(
  '/analyze-image',
  allowRoles('super_admin', 'owner', 'manager', 'inventory_staff'),
  imageUpload.single('image'),
  ctrl.analyzeImage
);                                                   // ← AI photo product detection
router.put(
  '/:id',
  allowRoles('super_admin', 'owner', 'manager', 'inventory_staff'),
  ctrl.update
);
router.delete(
  '/bulk',
  allowRoles('super_admin', 'owner', 'manager'),
  ctrl.bulkDelete
);                                                   // ← bulk delete (before /:id)
router.delete(
  '/:id',
  allowRoles('super_admin', 'owner', 'manager'),
  ctrl.remove
);

// ── Stock adjustment ─────────────────────────────────────────────────────────
router.patch(
  '/:id/adjust-stock',
  allowRoles('super_admin', 'owner', 'manager', 'inventory_staff'),
  ctrl.adjustStock
);

module.exports = router;
