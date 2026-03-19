// allowRoles('super_admin', 'owner') — pass any number of roles
const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required roles: ${roles.join(', ')}`,
    });
  }
  next();
};

// Ensure the user has access to the requested shop
const shopAccess = (req, res, next) => {
  const shopId = req.params.shopId || req.body.shopId || req.query.shopId;

  if (!shopId) return next(); // no shopId in request — let controller validate

  const { role, shops } = req.user;

  // Super admin always has access
  if (role === 'super_admin') return next();

  // Owner and staff: check if shopId is in their shops array
  const hasAccess = shops.some((id) => id.toString() === shopId.toString());
  if (!hasAccess) {
    return res.status(403).json({ success: false, message: 'No access to this shop' });
  }
  next();
};

module.exports = { allowRoles, shopAccess };
