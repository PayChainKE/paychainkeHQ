import Communication from '../models/Communication.js';
import Merchant from '../models/Merchant.js';

// Channel literal whitelist — guard the enum against drift via free-text query.
const CHANNELS = ['call', 'sms', 'whatsapp', 'voicemail'];
const STATUSES = ['new', 'in_progress', 'resolved', 'missed', 'spam'];

// Strip the secret-bearing PII off a merchant doc — only what the UI needs.
const safeMerchant = (m) => m && ({
  _id: m._id,
  businessName: m.businessName,
  name: m.name,
  phone: m.phone,
  status: m.status,
  flagged: m.flagged,
});

// @desc    Paginated call-center inbox + per-channel KPIs.
// @route   GET /api/admin/communications?range=24h|7d|30d|all&channel=&status=&q=&page=&limit=
// @access  Private (Admin)
export const getCommunications = async (req, res) => {
  try {
    const range = ['24h', '7d', '30d', 'all'].includes(req.query.range) ? req.query.range : '7d';
    const channel = CHANNELS.includes(req.query.channel) ? req.query.channel : null;
    const status  = STATUSES.includes(req.query.status)  ? req.query.status  : null;
    const q = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 25));

    const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 365 * 5;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const filter = { occurredAt: { $gte: since } };
    if (channel) filter.channel = channel;
    if (status)  filter.status  = status;
    if (q) {
      filter.$or = [
        { fromNumber: { $regex: q, $options: 'i' } },
        { callerName: { $regex: q, $options: 'i' } },
        { body: { $regex: q, $options: 'i' } },
      ];
    }

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    const [
      total, rows,
      kpis24h, kpisToday, kpisRange,
      channelMix, statusMix, durationAgg,
    ] = await Promise.all([
      Communication.countDocuments(filter),
      Communication.find(filter)
        .sort('-occurredAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('merchant', 'businessName name phone status flagged')
        .lean(),

      Communication.countDocuments({ occurredAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      Communication.countDocuments({ occurredAt: { $gte: todayStart } }),
      Communication.aggregate([
        { $match: { occurredAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            missed: { $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] } },
            resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            open: { $sum: { $cond: [{ $in: ['$status', ['new', 'in_progress']] }, 1, 0] } },
          },
        },
      ]),

      Communication.aggregate([
        { $match: { occurredAt: { $gte: since } } },
        { $group: { _id: '$channel', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Communication.aggregate([
        { $match: { occurredAt: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Communication.aggregate([
        { $match: { occurredAt: { $gte: since }, channel: 'call', durationSec: { $gt: 0 } } },
        { $group: { _id: null, avgDuration: { $avg: '$durationSec' }, totalDuration: { $sum: '$durationSec' } } },
      ]),
    ]);

    const rangeRow = kpisRange[0] || { count: 0, missed: 0, resolved: 0, open: 0 };
    const dur = durationAgg[0] || { avgDuration: 0, totalDuration: 0 };

    res.json({
      success: true,
      data: {
        range,
        kpis: {
          total24h: kpis24h,
          totalToday: kpisToday,
          totalRange: rangeRow.count,
          missed: rangeRow.missed,
          resolved: rangeRow.resolved,
          open: rangeRow.open,
          avgDurationSec: Math.round(dur.avgDuration || 0),
          totalDurationSec: dur.totalDuration || 0,
          resolutionRate: rangeRow.count > 0 ? Number(((rangeRow.resolved / rangeRow.count) * 100).toFixed(1)) : 0,
        },
        channelMix: channelMix.map((r) => ({ channel: r._id, count: r.count })),
        statusMix:  statusMix.map((r) => ({ status: r._id, count: r.count })),
        items: rows.map((r) => ({
          _id: r._id,
          channel: r.channel,
          direction: r.direction,
          fromNumber: r.fromNumber,
          toNumber: r.toNumber,
          callerName: r.callerName,
          merchant: safeMerchant(r.merchant),
          provider: r.provider,
          durationSec: r.durationSec,
          recordingUrl: r.recordingUrl,
          body: r.body,
          attachments: r.attachments,
          status: r.status,
          priority: r.priority,
          tags: r.tags,
          notes: r.notes,
          occurredAt: r.occurredAt,
          createdAt: r.createdAt,
        })),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Get Communications Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Update disposition (status / priority / tags) on a record.
// @route   PATCH /api/admin/communications/:id
// @access  Private (Admin)
export const updateCommunication = async (req, res) => {
  try {
    const update = {};
    if (req.body.status && STATUSES.includes(req.body.status)) update.status = req.body.status;
    if (typeof req.body.priority === 'boolean') update.priority = req.body.priority;
    if (Array.isArray(req.body.tags)) update.tags = req.body.tags.slice(0, 12);
    if (req.body.assignedTo === null) update.assignedTo = null;

    const doc = await Communication.findByIdAndUpdate(req.params.id, { $set: update }, { returnDocument: 'after' })
      .populate('merchant', 'businessName name phone status flagged')
      .lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });

    res.json({ success: true, data: doc });
  } catch (error) {
    console.error('Update Communication Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Append an internal note to a communication.
// @route   POST /api/admin/communications/:id/notes
// @access  Private (Admin)
export const addCommunicationNote = async (req, res) => {
  try {
    const body = (req.body.body || '').trim();
    if (body.length < 1) return res.status(400).json({ error: 'Note body is required.' });
    if (body.length > 2000) return res.status(400).json({ error: 'Note is too long.' });

    const note = {
      body,
      author: req.admin?._id || null,
      authorEmail: req.admin?.email || 'admin',
      createdAt: new Date(),
    };

    const doc = await Communication.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: note } },
      { returnDocument: 'after' }
    ).populate('merchant', 'businessName name phone status flagged').lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });

    res.json({ success: true, data: doc });
  } catch (error) {
    console.error('Add Communication Note Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Hard-delete (used for spam clearout — kept narrow on purpose).
// @route   DELETE /api/admin/communications/:id
// @access  Private (Admin)
export const deleteCommunication = async (req, res) => {
  try {
    const doc = await Communication.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete Communication Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
