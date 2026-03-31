const { verifyToken }        = require('../utils/jwt');
const User                   = require('../modules/auth/auth.model');
const { resolvePermissions } = require('../modules/roles/role.service');
const asyncHandler           = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized — no token' });
  }

  const decoded = verifyToken(token);

  // Load the primary user (staff if impersonating, owner otherwise)
  const user = await User.findById(decoded.id)
    .select('-password')
    .populate('customRoleId');

  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: 'User not found or inactive' });
  }

  // ── Impersonation handling ─────────────────────────────────────────────────
  if (decoded.isImpersonating) {
    // Prevent nested impersonation: the staff member being impersonated cannot
    // themselves impersonate someone else (checked by the token flag, not role).
    const owner = await User.findById(decoded.originalOwnerId).select('_id name email role isActive');
    if (!owner || !owner.isActive) {
      return res.status(401).json({ success: false, message: 'Originating owner session is invalid' });
    }
    req.isImpersonating  = true;
    req.originalOwner    = owner;
  }

  user.resolvedPermissions = resolvePermissions(user.role, user.customRoleId);
  req.user = user;

  // ── Enrich logContext with auth data (logContext was set before auth ran) ──
  // This ensures userId, actorId, and actingAs are correct for all audit logs.
  if (req.logContext) {
    req.logContext.userId = user._id;

    // Fill shopId from query/body if not already set by log middleware
    if (!req.logContext.shopId) {
      req.logContext.shopId =
        req.query.shopId ||
        req.body?.shopId  ||
        user.shops?.[0]?._id ||
        null;
    }

    if (req.isImpersonating) {
      // actorId = the real owner who started impersonation
      req.logContext.actorId  = decoded.originalOwnerId;
      // actingAs = the staff being impersonated (current req.user)
      req.logContext.actingAs = user._id;
    } else {
      req.logContext.actorId  = user._id;
      req.logContext.actingAs = null;
    }
  }

  next();
});

module.exports = { protect };
