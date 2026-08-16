# Data Protection Act 2019 — Breach Notification & Data Subject Request Procedure

Status: **operational draft, needs legal sign-off**. This is grounded in this system's
actual data model and endpoints so it's directly actionable, not generic boilerplate —
but the legal thresholds and deadlines below should be confirmed against the current
Data Protection Act 2019 / Data Protection (General) Regulations 2021 text (or with
counsel) before being treated as your official policy. Having a data controller
certificate registers you with the ODPC; it doesn't by itself give you a rehearsed
process for the day something actually goes wrong — that's what this document is for.

---

## Part 1 — Data inventory (what personal data this system actually holds, and where)

Needed for both parts below: you can't scope a breach or fulfil a deletion request
without knowing exactly what's held. Pulled directly from `backend/models/`:

| Data subject | Model | Personal data held |
|---|---|---|
| Merchant (business owner) | `Merchant.js` | name, email, phone, business name/type/county/area, KRA PIN, hashed password, hashed payment PIN, business certificate (Cloudinary URL), map location, bank settlement details |
| Admin/officer (staff) | `Admin.js` | name, email, phone |
| Contact form submitters | `Contact.js` | whatever they submitted (name/email/message) |
| Waitlist signups | `Waitlist.js` | name, email/phone |
| Newsletter subscribers | `NewsletterCampaign.js`/related | email |
| Anyone paying a merchant | `Transaction.js`, `STKRequest.js`, `PaymentLink.js` | phone number, name (as sender/recipient), amounts |
| SMS recipients | `SmsLog.js` | phone number, message content |

Documents (KYB certificates, business photos) live in **Cloudinary**, not Mongo —
referenced by URL from `Merchant.certificateUrl` and similar fields.

Sensitive/credential fields (`Merchant.password`, `Merchant.appPin`, `Merchant.otp`,
`Admin.password`, `Admin.otp`) are hashed or `select: false` — see this session's
security hardening — so a raw database dump does not directly expose passwords or PINs
in plaintext, but does expose everything else in the table above.

---

## Part 2 — Breach notification procedure

### Step 0: Detection

As of this session, the concrete detection surfaces are:
- Sentry (once `SENTRY_DSN` is configured — see this session's changes) for application
  errors/exceptions.
- The new admin security-alert emails (`backend/utils/securityAlerts.js`) — account
  lockouts, large transfers, new privileged-account creation.
- MongoDB Atlas's own access/audit logs (Atlas project → Activity Feed) for anomalous
  database access.

None of these are a dedicated intrusion-detection system — they're what exists today.
If "how would we even know" is still an open question after reading this, that's the
real gap to close next, before the procedure below matters.

### Step 1: Triage (first 1 hour)

1. Confirm it's real — not a false positive (e.g. a legitimate load spike vs. an
   actual unauthorized access pattern).
2. Determine scope using the inventory in Part 1: which model(s), how many records,
   what fields. `db.<collection>.countDocuments()` and a timestamp range against
   `createdAt`/`updatedAt` gives a first estimate.
3. Contain: if it's an active compromise (leaked credential, compromised admin
   account), immediately: bump `tokenVersion` on the affected account(s) to invalidate
   sessions (the logout mechanism added this session does exactly this), rotate
   `JWT_SECRET`/`RESEND_API_KEY`/`MONGO_URI` credentials as applicable, and lock the
   affected `Merchant`/`Admin` record's `status`.

### Step 2: Assess notification obligations (within 72 hours of becoming aware)

Kenya's DPA 2019 framework generally expects notification to the **Office of the Data
Protection Commissioner (ODPC)** without undue delay — commonly benchmarked at 72 hours
— where the breach is likely to result in risk to data subjects' rights. **Confirm the
exact current threshold and deadline with counsel or the ODPC's published guidance**;
don't treat the 72-hour figure here as a legally verified citation.

What to prepare for the ODPC notification:
- Nature of the breach and approximate number of data subjects/records affected
  (from Step 1's triage).
- Likely consequences (e.g. exposed phone numbers → phishing/SIM-swap risk; exposed
  business/KYB data → impersonation risk).
- Measures taken or proposed (containment from Step 1, plus any user-facing fix).
- A contact point for follow-up.

### Step 3: Notify affected data subjects (where the breach poses genuine risk to them)

For merchants/officers/admins: email via the existing `resend.js` infrastructure —
this session added `sendSecurityAlertEmail`, which could be extended with a dedicated
breach-notice template if this is ever needed for real. Keep the notice specific: what
happened, what data of theirs was involved (from Part 1's inventory), what you've done,
what they should do (e.g. "change your password", "watch for suspicious SMS").

### Step 4: Post-incident

- Log the incident and the full timeline (detection → containment → notification) —
  the ODPC can ask for this later.
- Root-cause it and turn the fix into a permanent change, not a one-off patch.

---

## Part 3 — Data Subject Access & Deletion Request (DSAR) procedure

A data subject (a merchant, or anyone whose phone number appears as a transaction
recipient) can ask what you hold on them and ask for it to be deleted or corrected.
There is currently **no self-service endpoint for this** — it has to be handled
manually via direct DB queries until/unless a dedicated endpoint is built. Procedure
until then:

### Access request

1. Verify the requester's identity (match against the email/phone on the `Merchant` or
   `Admin` record — never disclose data based on an unverified claim of identity).
2. Query every collection in Part 1's table for records matching their email/phone.
3. Compile a summary (not a raw DB dump — omit hashed credential fields entirely, they
   provide the requester no value and shouldn't be included in an export).
4. Respond within a reasonable period (commonly benchmarked around 30 days under
   comparable data protection frameworks — confirm Kenya's specific expectation).

### Deletion request

1. Verify identity as above.
2. Determine what can actually be deleted vs. what must be retained: transaction
   records tied to KES/USDC money movement likely need to be retained for financial
   record-keeping / AML obligations even after a deletion request — this is exactly the
   kind of judgment call that needs legal confirmation on a case-by-case basis, not a
   blanket "delete everything."
3. For what can be deleted: remove or anonymize the `Merchant`/`Admin` document's PII
   fields (name, email, phone, business details) while preserving the transaction
   ledger's integrity (e.g. keep the `Transaction` row but drop the merchant's ability
   to be personally identified from it, if legally permissible).
4. Don't forget Cloudinary — KYB documents referenced by a deleted merchant's
   `certificateUrl` need separate deletion from Cloudinary itself; deleting the Mongo
   record does not delete the underlying file.
5. Log that the request was received and fulfilled (what was deleted, what was
   retained and why) — this record itself becomes evidence of compliance if ever
   questioned.

---

## What this document is not

It's a working procedure grounded in the real schema, not a substitute for a lawyer's
review. Two things worth getting explicit legal confirmation on before this is treated
as final: (1) the actual notification deadline/threshold under current Kenyan law, and
(2) exactly which transaction/financial records must legally be retained even after a
deletion request, and for how long.
