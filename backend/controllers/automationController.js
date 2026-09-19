import Automation from '../models/Automation.js';
import { logAudit } from '../utils/auditLog.js';
import { mostRecentSlot, nextSlot } from '../utils/eatSchedule.js';
import { AUTOMATIONS, getOrCreateAutomation, isKnownAutomation } from '../services/automationRegistry.js';
import { runNewsletterDigest } from '../services/newsletterDigestService.js';
import { runDigestPreview } from '../services/automationPreview.js';

const adminActor = (admin) => (admin
  ? { type: 'admin', id: admin._id || null, email: admin.email || null, name: admin.name || admin.email || 'admin' }
  : { type: 'admin', id: null, email: null, name: 'admin' });

function present(key, row) {
  const meta = AUTOMATIONS[key];
  const cfg = row.config || {};
  return {
    key,
    label: meta.label,
    description: meta.description,
    kind: meta.kind || 'digest',
    channel: meta.channel || 'Email',
    fields: meta.fields || null,
    copy: typeof meta.copy === 'function' ? meta.copy() : null,
    supportsPreview: typeof meta.run === 'function',
    enabled: row.enabled,
    autoSend: row.autoSend,
    config: cfg,
    // Only recurring-slot automations have a "next run".
    nextRunAt: !row.enabled ? null
      : cfg.days ? nextSlot(new Date(), cfg.days, cfg.time)
      : meta.everyMinutes ? new Date(Math.max(Date.now(), (row.lastSlotAt ? row.lastSlotAt.getTime() : 0) + meta.everyMinutes * 60 * 1000)) : null,
    lastRunAt: row.lastRunAt,
    lastRunStatus: row.lastRunStatus,
    lastRunSummary: row.lastRunSummary,
    updatedByEmail: row.updatedByEmail,
    updatedAt: row.updatedAt,
  };
}

// @desc    List every automation with its current switches, config and last run.
// @route   GET /api/automations
// @access  Private (Admin)
export const listAutomations = async (req, res) => {
  try {
    const rows = await Promise.all(Object.keys(AUTOMATIONS).map((k) => getOrCreateAutomation(k)));
    res.json({ success: true, data: rows.map((r) => present(r.key, r)) });
  } catch (error) {
    console.error('List Automations Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Update an automation's on/off + auto-send switches and its config.
// @route   PUT /api/automations/:key
// @access  Private (Admin, owner/admin role)
export const updateAutomation = async (req, res) => {
  try {
    const { key } = req.params;
    if (!isKnownAutomation(key)) return res.status(404).json({ error: 'Unknown automation.' });

    const existing = await getOrCreateAutomation(key);
    const body = req.body || {};
    const update = {};

    if (body.enabled !== undefined) update.enabled = !!body.enabled;
    if (body.autoSend !== undefined) update.autoSend = !!body.autoSend;
    if (body.config !== undefined) {
      try {
        update.config = AUTOMATIONS[key].validateConfig(body.config);
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    }

    // Whatever slot is already "current" when an admin switches this on or
    // changes its schedule is treated as handled — otherwise enabling at
    // 2pm on a Tuesday-9am schedule would fire a 5-hour-old slot at once.
    const willBeEnabled = update.enabled ?? existing.enabled;
    const cfg = update.config ?? existing.config;
    if (willBeEnabled && cfg?.days) {
      const current = mostRecentSlot(new Date(), cfg.days, cfg.time);
      if (current && (!existing.lastSlotAt || existing.lastSlotAt < current)) update.lastSlotAt = current;
    }
    update.updatedByEmail = req.admin?.email || '';

    const row = await Automation.findOneAndUpdate({ key }, { $set: update }, { returnDocument: 'after' });

    logAudit({
      action: 'admin.automation.updated', category: 'admin', severity: 'info',
      message: `Automation "${AUTOMATIONS[key].label}" updated (enabled: ${row.enabled}, auto-send: ${row.autoSend})`,
      actor: adminActor(req.admin), req,
      metadata: { key, enabled: row.enabled, autoSend: row.autoSend },
    });

    res.json({ success: true, data: present(key, row) });
  } catch (error) {
    console.error('Update Automation Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Prepare a newsletter digest right now, as a draft awaiting
//          approval. Never sends, whatever the auto-send switch says.
// @route   POST /api/automations/newsletter_digest/run-now
// @access  Private (Admin, owner/admin role)
export const runDigestNow = async (req, res) => {
  try {
    const result = await runNewsletterDigest({ force: true });
    const row = await getOrCreateAutomation('newsletter_digest');
    if (result.skipped === 'no_posts') {
      return res.status(400).json({ error: 'There are no published blog posts to build a digest from.' });
    }
    res.json({ success: true, message: 'Digest prepared — find it under Drafts on the Newsletter page.', data: present('newsletter_digest', row) });
  } catch (error) {
    console.error('Run Digest Now Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Dry run: who/what an automation WOULD act on right now, without
//          sending or recording anything. The safe way to see what switching
//          it on will do before doing it.
// @route   POST /api/automations/:key/preview
// @access  Private (Admin, owner/admin role)
export const previewAutomation = async (req, res) => {
  try {
    const { key } = req.params;
    if (!isKnownAutomation(key) || typeof AUTOMATIONS[key].run !== 'function') {
      return res.status(404).json({ error: 'This automation has no preview.' });
    }
    const row = await getOrCreateAutomation(key);
    // Preview the config the admin is currently editing if they sent one,
    // otherwise the saved config.
    let config = row.config;
    if (req.body?.config !== undefined) {
      try { config = AUTOMATIONS[key].validateConfig(req.body.config); } catch (e) { return res.status(400).json({ error: e.message }); }
    }
    const result = await runDigestPreview(key, { ...row.toObject(), config });
    res.json({ success: true, summary: result.summary });
  } catch (error) {
    console.error('Preview Automation Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
