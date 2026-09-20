import express from 'express';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Browsers post Content-Security-Policy violation reports here (report-only
// trial on the web apps). Public by necessity, so: tiny body, own rate limit,
// nothing stored, and query strings/fragments stripped before logging because
// they can carry tokens.
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

const clean = (v) => String(v ?? '').split(/[?#]/)[0].slice(0, 200);

router.post(
  '/',
  limiter,
  express.json({ type: ['application/csp-report', 'application/reports+json', 'application/json'], limit: '8kb' }),
  (req, res) => {
    const body = req.body;
    const reports = Array.isArray(body) ? body.map((r) => r?.body) : [body?.['csp-report']];
    for (const r of reports.slice(0, 5)) {
      if (!r || typeof r !== 'object') continue;
      console.warn(
        `[csp-report] directive=${clean(r['violated-directive'] || r.effectiveDirective)} ` +
        `blocked=${clean(r['blocked-uri'] || r.blockedURL)} ` +
        `page=${clean(r['document-uri'] || r.documentURL)} ` +
        `source=${clean(r['source-file'] || r.sourceFile)}`
      );
    }
    res.sendStatus(204);
  }
);

export default router;
