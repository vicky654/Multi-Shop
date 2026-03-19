const { verifyToken }    = require('../utils/jwt');
const User               = require('../modules/auth/auth.model');
const { Role }           = require('../modules/roles/role.model');
const { resolvePermissions } = require('../modules/roles/role.service');
const asyncHandler       = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized — no token' });
  }

  const decoded = verifyToken(token);
  const user    = await User.findById(decoded.id)
    .select('-password')
    .populate('customRoleId');         // populate custom role if set

  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: 'User not found or inactive' });
  }

  // Resolve permissions: custom role > built-in role defaults
  user.resolvedPermissions = resolvePermissions(user.role, user.customRoleId);

  req.user = user;
  next();
});

module.exports = { protect };
