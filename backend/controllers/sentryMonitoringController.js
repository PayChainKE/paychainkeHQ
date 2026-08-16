// Server-side proxy to Sentry's REST API — the admin dashboard's Security >
// Monitoring panel calls this instead of talking to Sentry directly, so the
// Sentry API token (read access to every issue/event across the org) never
// reaches the browser bundle. Gated entirely on SENTRY_AUTH_TOKEN +
// SENTRY_ORG_SLUG being set; returns `configured: false` cleanly until then
// rather than erroring, so the frontend can show a "connect Sentry" state.
//
// Sentry orgs are pinned to a data-residency region (EU/US/etc) and the
// region-specific API host is the only one that actually serves that org's
// data — the generic sentry.io host 404s/redirects rather than proxying.
// This org's auth token decodes to region_url "https://de.sentry.io", so
// that's hardcoded here rather than the generic host. If this org's region
// ever changes, update this constant.
const SENTRY_API_BASE = 'https://de.sentry.io/api/0';

// Defaults match the project slugs created during this app's own Sentry
// setup — override via env if a project is ever renamed.
const PROJECTS = [
  { key: 'web', label: 'Web Dashboards', slug: process.env.SENTRY_PROJECT_WEB || 'javascript-react' },
  { key: 'backend', label: 'Backend API', slug: process.env.SENTRY_PROJECT_BACKEND || 'node-express' },
  { key: 'mobile', label: 'Mobile App', slug: process.env.SENTRY_PROJECT_MOBILE || 'react-native' },
];

function sentryConfigured() {
  return !!(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG_SLUG);
}

async function fetchSentryIssues(projectSlug) {
  const org = process.env.SENTRY_ORG_SLUG;
  const url = `${SENTRY_API_BASE}/projects/${org}/${projectSlug}/issues/?query=is:unresolved&statsPeriod=14d&sort=freq&limit=10`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.SENTRY_AUTH_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Sentry API returned ${res.status} for project "${projectSlug}"`);
  }
  return res.json();
}

// @desc    Unresolved-issue summary across all 3 registered Sentry projects
//          (web dashboards, backend, mobile). Each project is fetched
//          independently so one misconfigured/renamed project doesn't take
//          the whole panel down — its card just shows its own error.
// @route   GET /api/admin/monitoring/sentry
// @access  Private (Admin — owner/admin/analyst)
export const getSentryOverview = async (req, res) => {
  if (!sentryConfigured()) {
    return res.json({ success: true, configured: false, projects: [] });
  }

  try {
    const results = await Promise.all(
      PROJECTS.map(async (p) => {
        try {
          const issues = await fetchSentryIssues(p.slug);
          return {
            key: p.key,
            label: p.label,
            slug: p.slug,
            ok: true,
            unresolvedCount: issues.length,
            issues: issues.slice(0, 10).map((i) => ({
              id: i.id,
              shortId: i.shortId,
              title: i.title,
              culprit: i.culprit,
              level: i.level,
              count: i.count,
              userCount: i.userCount,
              firstSeen: i.firstSeen,
              lastSeen: i.lastSeen,
              permalink: i.permalink,
            })),
          };
        } catch (err) {
          return { key: p.key, label: p.label, slug: p.slug, ok: false, error: err.message, unresolvedCount: 0, issues: [] };
        }
      })
    );

    res.json({ success: true, configured: true, projects: results });
  } catch (error) {
    console.error('Sentry Overview Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
