/**
 * allowPermissions('create_product', 'edit_product')
 * Checks req.user.resolvedPermissions (populated by auth middleware).
 * Super admin always passes.
 */
const allowPermissions = (...requiredPerms) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  // Super admin bypasses all permission checks
  if (req.user.role === 'super_admin') return next();

  const userPerms = req.user.resolvedPermissions || [];
  const missing   = requiredPerms.filter((p) => !userPerms.includes(p));

  if (missing.length > 0) {
    return res.status(403).json({
      success: false,
      message: `Missing permission${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
    });
  }

  next();
};

module.exports = { allowPermissions };
