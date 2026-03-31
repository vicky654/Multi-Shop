const express  = require('express');
const multer   = require('multer');
const { protect }   = require('../../middlewares/auth.middleware');
const { allowRoles } = require('../../middlewares/role.middleware');
const { extract }    = require('./parser.controller');

const router = express.Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(Object.assign(new Error('Only image files allowed'), { status: 400 }));
  },
});

router.use(protect);
router.use(allowRoles('super_admin', 'owner', 'manager', 'inventory_staff'));

router.post('/extract', imageUpload.single('image'), extract);

module.exports = router;
