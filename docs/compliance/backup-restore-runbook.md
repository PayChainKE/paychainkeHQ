# Backup & Restore Runbook

Status: **drafted, not yet executed**. I don't have MongoDB Atlas or hosting-provider
credentials from this environment, so I could not run an actual restore drill — this
document is the concrete procedure for Brandon (or whoever holds Atlas access) to run it.
Confirm the checklist at the bottom once done and date it.

## What's actually at stake

This is the production data store for a live payments platform. The collections that
matter most if backups ever had to be used for real:

- `merchants` — KES/USDC balances, hashed payment PINs, KYB verification status. Losing
  this without a clean restore means merchants' balances become unrecoverable from the
  app itself.
- `transactions`, `stkrequests`, `paymentlinks`, `payoutbatches` — the transaction
  ledger. This is the audit trail a bank-grade system cannot lose.
- `auditlogs` — admin/officer action history; also the record you'd need to reconstruct
  what happened around any incident, including a breach investigation (see the DPA
  procedure in this same folder).

## 1. Confirm continuous backups are actually enabled

MongoDB Atlas free/shared tiers (M0/M2/M5) do **not** include continuous backups —
only paid dedicated clusters (M10+) do. First step is simply confirming which tier this
cluster is on:

1. Atlas → your project → Clusters → the cluster backing `MONGO_URI` (shard names seen
   in this session: `ac-lkseiau-shard-00-XX.dojuoad.mongodb.net`).
2. Check the cluster tier. If it's M0/M2/M5, **there is no automated backup at all** —
   this is the actual first finding of this exercise, not a hypothetical. If so, either
   upgrade to M10+ (enables Cloud Backup with continuous snapshots) or set up your own
   scheduled `mongodump` export to separate storage (S3/GCS) as a stopgap.
3. If M10+, go to **Backup** tab on the cluster → confirm "Cloud Backup" is toggled on
   and note the snapshot frequency/retention window.

## 2. Run an actual restore drill (not just confirm snapshots exist)

A backup nobody has ever restored from is a hypothesis, not a safety net. Do this on a
schedule (quarterly is reasonable for a system this size), not once:

1. In Atlas, pick a recent snapshot → **Restore** → **Restore to a new cluster** (never
   restore over the live cluster during a drill). Name it something obvious like
   `paychain-restore-drill-<date>`.
2. Once the new cluster is up, point a **local-only** copy of the backend at it: set
   `MONGO_URI` to the drill cluster's connection string in a throwaway `.env`, start the
   server, and confirm:
   - `GET /api/health` returns `db: connected`.
   - A known merchant record actually exists and its `kesBalance` matches what you'd
     expect as of the snapshot time.
   - `db.transactions.countDocuments()` is in the right ballpark for that point in time.
3. Time the whole drill, start to finish (snapshot restore start → verified queryable).
   That duration is your real RTO (Recovery Time Objective) — write it down. If it's
   longer than you're comfortable with during a real incident, that's the thing to fix
   before this matters.
4. **Delete the drill cluster** when done — it's a live copy of production data
   (merchant PII, balances) and shouldn't sit around indefinitely.

## 3. Point-in-time consideration

Continuous backups on M10+ support point-in-time restore within the retention window
(check your plan's window — commonly 24h–7 days at the entry tier). For a payments app,
know specifically: if a bad deploy or bug corrupts transaction data at 14:32 today, can
you restore to 14:31? Confirm the actual granularity your current plan gives you, not
just "backups exist."

## 4. What's NOT covered by Atlas backups

- **Cloudinary-hosted KYB documents/photos** — these live outside Mongo entirely (see
  `backend/utils/cloudinary.js`). Confirm Cloudinary's own retention/versioning
  separately; an Atlas restore does not bring these back if deleted there.
- **`.env` / secrets** — not data, but if the host (Render) is ever lost, these need
  their own secure backup (a password manager or secrets vault entry), since they're
  not stored in git.

## Drill log

| Date | Tier confirmed | Snapshot restored | RTO measured | Issues found | Run by |
|------|----------------|--------------------|--------------|---------------|--------|
| _(fill in after first drill)_ | | | | | |
