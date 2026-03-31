const asyncHandler          = require('../../utils/asyncHandler');
const { success }           = require('../../utils/response');
const { parseText, parseImage } = require('./parser.service');

// POST /api/parser/extract
// Body: { text } OR multipart with image file
const extract = asyncHandler(async (req, res) => {
  let items = [];

  if (req.file) {
    // Image mode — use OpenAI Vision
    items = await parseImage(req.file.buffer, req.file.mimetype);
  } else if (req.body.text) {
    // Text mode — regex parser
    items = parseText(req.body.text);
  } else {
    return res.status(400).json({ success: false, message: 'Provide image file or text' });
  }

  success(res, { items, count: items.length }, `Extracted ${items.length} item(s)`);
});

module.exports = { extract };
