const Shop = require('./shop.model');
const User = require('../auth/auth.model');
const { isValidVpa } = require('../../utils/upi');
const { isValidGstin, stateCodeOf, stateNameOf, STATE_CODES } = require('../../utils/gst');

const createShop = async (ownerId, data) => {
  const shop = await Shop.create({ ...data, owner: ownerId });

  // Add shop to owner's shops array
  await User.findByIdAndUpdate(ownerId, { $addToSet: { shops: shop._id } });
  return shop;
};

const getShops = async (user) => {
  if (user.role === 'super_admin') return Shop.find().populate('owner', 'name email');
  return Shop.find({ _id: { $in: user.shops } });
};

const getShopById = async (shopId, user) => {
  const shop = await Shop.findById(shopId).populate('owner', 'name email');
  if (!shop) throw Object.assign(new Error('Shop not found'), { status: 404 });
  if (user.role !== 'super_admin' && !user.shops.some((s) => s.toString() === shopId)) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }
  return shop;
};

/**
 * Validate and normalise the GST block of a shop update.
 *
 * WHY THIS IS HERE AND NOT ONLY ON THE SCHEMA
 *   Settings saves through findOneAndUpdate, which does NOT run `pre('save')`
 *   hooks. The schema has a hook that derives `stateCode` from the GSTIN so the
 *   two can never disagree — but that hook never fired on this path, so changing
 *   the GSTIN in Settings left a stale or empty stateCode. stateCode is what
 *   decides CGST+SGST versus IGST, so a stale one silently produces the wrong
 *   tax split on every subsequent invoice. Deriving it here closes that.
 *
 * Field validators DO run (runValidators: true), so GSTIN format is already
 * checked by the schema; this adds the cross-field rules a single field cannot.
 */
function normaliseGstUpdate(data) {
  const out = { ...data };
  // Captured BEFORE any derivation: once stateCode is overwritten from the GSTIN,
  // a contradiction in the caller's input is invisible and would be silently
  // "corrected" instead of reported.
  const suppliedStateCode = data.stateCode;

  if (out.gstNumber !== undefined) {
    out.gstNumber = String(out.gstNumber || '').trim().toUpperCase();
    if (out.gstNumber && !isValidGstin(out.gstNumber)) {
      throw Object.assign(
        new Error('Invalid GSTIN — must be 15 characters with a valid check digit'),
        { status: 400 }
      );
    }
    // Derive the state code from the GSTIN. This is the fix for the hook that
    // never ran: the GSTIN embeds the state, so it is the authority.
    if (out.gstNumber) {
      const derived = stateCodeOf(out.gstNumber);
      if (derived) out.stateCode = derived;
    } else if (out.stateCode === undefined) {
      // GSTIN cleared and no explicit state supplied — drop the stale code rather
      // than leaving a state that no longer has a document behind it.
      out.stateCode = '';
    }
  }

  if (suppliedStateCode !== undefined && suppliedStateCode !== '') {
    const supplied = String(suppliedStateCode).trim();
    if (!STATE_CODES[supplied]) {
      throw Object.assign(
        new Error(`Unknown state code "${supplied}" — must be a 2-digit GST state code`),
        { status: 400 }
      );
    }
    // If a state code was supplied AND it contradicts the GSTIN, reject rather
    // than silently overriding it. The GSTIN is the authority, but quietly
    // discarding what the caller typed hides a real mistake on their side.
    if (out.gstNumber) {
      const derived = stateCodeOf(out.gstNumber);
      if (derived && derived !== supplied) {
        throw Object.assign(
          new Error(`State code ${supplied} (${stateNameOf(supplied)}) does not match `
                  + `the GSTIN, which is registered in ${derived} (${stateNameOf(derived)})`),
          { status: 400 }
        );
      }
    }
    out.stateCode = supplied;
  }

  if (out.gstScheme !== undefined
      && !['regular', 'composition', 'unregistered'].includes(out.gstScheme)) {
    throw Object.assign(new Error('gstScheme must be regular, composition or unregistered'), { status: 400 });
  }

  if (out.gstMode !== undefined && !['exclusive', 'inclusive'].includes(out.gstMode)) {
    throw Object.assign(new Error('gstMode must be exclusive or inclusive'), { status: 400 });
  }

  if (out.taxRate !== undefined) {
    const r = Number(out.taxRate);
    if (!Number.isFinite(r) || r < 0 || r > 100) {
      throw Object.assign(new Error('Default GST rate must be between 0 and 100'), { status: 400 });
    }
    out.taxRate = r;
  }

  if (out.invoicePrefix !== undefined) {
    out.invoicePrefix = String(out.invoicePrefix || '').trim().toUpperCase();
    if (!out.invoicePrefix) {
      throw Object.assign(new Error('Invoice prefix cannot be empty'), { status: 400 });
    }
    // The prefix becomes part of a stored invoice number, so keep it to characters
    // that are safe in a document reference and in a filename.
    if (!/^[A-Z0-9/-]{1,10}$/.test(out.invoicePrefix)) {
      throw Object.assign(
        new Error('Invoice prefix may use letters, numbers, / and - only (max 10 characters)'),
        { status: 400 }
      );
    }
  }

  if (out.invoiceRoundOff !== undefined) out.invoiceRoundOff = !!out.invoiceRoundOff;

  return out;
}

/**
 * Cross-field GST coherence, checked against the state the shop will be IN after
 * the update rather than against the payload alone.
 *
 * Checking the payload alone was too strict: a shop seeded with no GSTIN and the
 * default 'regular' scheme could not save ANY field — editing just the invoice
 * prefix was rejected for a GSTIN problem the user had not touched. Only a change
 * that actually moves the shop INTO a registered scheme without a GSTIN is
 * refused, which is the case worth blocking.
 */
function assertGstCoherence(existing, update) {
  const merged = {
    gstNumber: update.gstNumber !== undefined ? update.gstNumber : (existing.gstNumber || ''),
    gstScheme: update.gstScheme !== undefined ? update.gstScheme : (existing.gstScheme || 'regular'),
  };
  const changingIntoRegistered =
    (update.gstScheme !== undefined && update.gstScheme !== 'unregistered')
    || (update.gstNumber !== undefined && update.gstNumber === '' && merged.gstScheme !== 'unregistered');

  if (changingIntoRegistered && !merged.gstNumber) {
    throw Object.assign(
      new Error('A GSTIN is required for the regular and composition schemes. '
              + 'Choose "Not registered" if the shop has no GSTIN.'),
      { status: 400 }
    );
  }
}

const updateShop = async (shopId, ownerId, role, data) => {
  data = normaliseGstUpdate(data);

  const touchesGst = ['gstNumber', 'gstScheme', 'stateCode'].some((k) => data[k] !== undefined);
  if (touchesGst) {
    const existing = await Shop.findById(shopId).select('gstNumber gstScheme').lean();
    if (existing) assertGstCoherence(existing, data);
  }

  // `pre('validate')` hooks don't fire on findOneAndUpdate, so the UPI guard
  // is enforced here — this is the path Settings → Payments actually uses.
  if (data.upiSettings) {
    const { enabled, vpa, merchantName } = data.upiSettings;
    if (vpa && !isValidVpa(vpa)) {
      throw Object.assign(
        new Error('Invalid UPI ID — expected a format like shopname@bank'),
        { status: 400 }
      );
    }
    if (enabled && !isValidVpa(vpa)) {
      throw Object.assign(
        new Error('A valid UPI ID is required before enabling UPI QR payments'),
        { status: 400 }
      );
    }
    if (enabled && !merchantName?.trim()) {
      throw Object.assign(
        new Error('Merchant / store name is required before enabling UPI QR payments'),
        { status: 400 }
      );
    }
  }

  const filter = role === 'super_admin' ? { _id: shopId } : { _id: shopId, owner: ownerId };
  const shop = await Shop.findOneAndUpdate(filter, data, { new: true, runValidators: true });
  if (!shop) throw Object.assign(new Error('Shop not found or access denied'), { status: 404 });
  return shop;
};

const deleteShop = async (shopId, ownerId, role) => {
  const filter = role === 'super_admin' ? { _id: shopId } : { _id: shopId, owner: ownerId };
  const shop = await Shop.findOneAndDelete(filter);
  if (!shop) throw Object.assign(new Error('Shop not found or access denied'), { status: 404 });
  // Remove shop from owner's list
  await User.findByIdAndUpdate(ownerId, { $pull: { shops: shopId } });
  return shop;
};

// Add staff to a shop
const addStaffToShop = async (shopId, staffId, ownerId) => {
  const shop = await Shop.findOne({ _id: shopId, owner: ownerId });
  if (!shop) throw Object.assign(new Error('Shop not found'), { status: 404 });
  await User.findOneAndUpdate(
    { _id: staffId, ownerId },
    { $addToSet: { shops: shopId } }
  );
  return shop;
};

module.exports = {
  normaliseGstUpdate,
  assertGstCoherence, createShop, getShops, getShopById, updateShop, deleteShop, addStaffToShop };
