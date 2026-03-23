/**
 * push.service.js — Firebase Cloud Messaging (FCM) via firebase-admin
 *
 * Setup:
 *   cd server && npm install firebase-admin
 *
 * Required env vars (add to .env):
 *   FCM_PROJECT_ID=your-project-id
 *   FCM_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
 *   FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *
 * How to get these:
 *   Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   Copy projectId, clientEmail, privateKey from the JSON file.
 */

const User = require('../auth/auth.model');

// ── Lazy-init firebase-admin so server starts even if pkg is not installed ────
let _admin = null;

const getAdmin = () => {
  if (_admin) return _admin;

  const { FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY } = process.env;
  if (!FCM_PROJECT_ID || !FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) return null;

  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   FCM_PROJECT_ID,
          clientEmail: FCM_CLIENT_EMAIL,
          // env vars store \n as literal \\n — convert back
          privateKey:  FCM_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
    _admin = admin;
    return _admin;
  } catch (err) {
    console.warn('[Push] firebase-admin not installed — push disabled. Run: npm install firebase-admin');
    return null;
  }
};

// ── Register / update a device token for a user ───────────────────────────────
const registerToken = async (userId, token) => {
  if (!token) return;
  // $addToSet prevents duplicates; limit to 5 tokens per user
  const user = await User.findByIdAndUpdate(
    userId,
    { $addToSet: { deviceTokens: token } },
    { new: true }
  ).select('deviceTokens');

  // Trim oldest tokens if over the 5-device limit
  if (user && user.deviceTokens.length > 5) {
    const trimmed = user.deviceTokens.slice(-5);
    await User.findByIdAndUpdate(userId, { deviceTokens: trimmed });
  }
};

// ── Remove a specific token (on logout) ──────────────────────────────────────
const removeToken = async (userId, token) => {
  await User.findByIdAndUpdate(userId, { $pull: { deviceTokens: token } });
};

// ── Send a single FCM message ─────────────────────────────────────────────────
const sendOne = async (token, { title, body, data = {}, badge = 1 }) => {
  const admin = getAdmin();
  if (!admin) return null;

  const message = {
    token,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: {
      priority: 'high',
      notification: {
        sound:     'default',
        channelId: 'multishop_alerts',
        icon:      'ic_notification',
        color:     '#2563eb',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge,
        },
      },
    },
  };

  return admin.messaging().send(message);
};

// ── Send to all registered devices for a user ────────────────────────────────
// Returns silently if FCM is not configured or user has no tokens.
const sendToUser = async (userId, payload) => {
  const admin = getAdmin();
  if (!admin) return;

  const user = await User.findById(userId).select('deviceTokens').lean();
  if (!user?.deviceTokens?.length) return;

  const results = await Promise.allSettled(
    user.deviceTokens.map((token) => sendOne(token, payload))
  );

  // Collect tokens that FCM rejected (invalid / expired)
  const staleTokens = user.deviceTokens.filter((_, i) => {
    const r = results[i];
    if (r.status !== 'rejected') return false;
    const code = r.reason?.code || r.reason?.errorInfo?.code || '';
    return code === 'messaging/registration-token-not-registered' ||
           code === 'messaging/invalid-registration-token';
  });

  if (staleTokens.length) {
    await User.findByIdAndUpdate(userId, {
      $pull: { deviceTokens: { $in: staleTokens } },
    });
  }
};

// ── Send to multiple user IDs (batch) ────────────────────────────────────────
const sendToUsers = async (userIds, payload) => {
  await Promise.allSettled(userIds.map((id) => sendToUser(id, payload)));
};

module.exports = { registerToken, removeToken, sendOne, sendToUser, sendToUsers };
