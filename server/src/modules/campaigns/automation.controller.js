const Automation = require('./automation.model');
const {
  createAutomation,
  getAutomations,
  updateAutomation,
  deleteAutomation,
} = require('./automation.service');

// POST /api/automations
const create = async (req, res) => {
  const automation = await createAutomation(req.user._id, req.body);
  res.status(201).json({ automation });
};

// GET /api/automations?shopId=xxx
const list = async (req, res) => {
  const { shopId } = req.query;
  if (!shopId) return res.status(400).json({ message: 'shopId is required' });

  const automations = await getAutomations(shopId);
  res.json({ automations });
};

// PATCH /api/automations/:id
const update = async (req, res) => {
  const automation = await updateAutomation(req.params.id, req.user._id, req.body);
  if (!automation) return res.status(404).json({ message: 'Automation not found' });
  res.json({ automation });
};

// DELETE /api/automations/:id
const remove = async (req, res) => {
  const automation = await deleteAutomation(req.params.id, req.user._id);
  if (!automation) return res.status(404).json({ message: 'Automation not found' });
  res.json({ message: 'Automation deleted' });
};

// PATCH /api/automations/:id/toggle
const toggle = async (req, res) => {
  const automation = await Automation.findById(req.params.id);
  if (!automation) return res.status(404).json({ message: 'Automation not found' });

  automation.enabled = !automation.enabled;
  await automation.save();

  res.json({ automation });
};

module.exports = { create, list, update, remove, toggle };
