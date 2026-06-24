# PayChain Bulk Pay Feature Analysis

**Date**: 2026-06-24 | **Status**: Comprehensive Examination Complete

---

## Executive Summary

The Bulk Pay feature is implemented across three layers:
- **Merchant Dashboard** (React/JSX) - Full-featured web UI
- **Mobile App** (React Native/TypeScript) - Core features present, some gaps
- **Backend** (Node.js/Express) - Complete API with Safaricom Daraja integration

Both frontends connect to the same backend API. They share authentication tokens via bearer JWT and store them in localStorage (dashboard) and AsyncStorage (mobile).

---

## Current Features in Merchant Dashboard

### ✅ Fully Implemented
1. **Payee Management**
   - View all saved payees with category filtering (All/Employees/Suppliers/Utilities)
   - Add new payees with 2-step modal (category selection → payment details)
   - Edit existing payees
   - Delete payees with confirmation dialog
   - Color-coded category indicators and icons

2. **Payment Methods Support**
   - Mobile Money (Personal Number, Paybill, Buy Goods) with field validation
   - Bank transfer with account validation (8-14 digits)
   - Per-method field validation:
     - Phone: Regex check for Kenyan numbers (07xx/01xx)
     - Paybill: 5-7 digits validation
     - Till: 6-8 digits validation
     - Bank Account: 8-14 digits validation

3. **KRA Compliance Framework**
   - Employee type: Requires KRA PIN + ID Number
   - Supplier type: Requires KRA PIN + eTIMS Invoice Number + CU Number
   - Optional fields: NSSF, SHIF/NHIF numbers
   - Form-level validation before API submission

4. **Batch Processing**
   - Multi-payee selection with checkboxes
   - Custom amount per payee input
   - CSV upload for bulk batch creation
   - CSV preview with:
     - Row-by-row summary
     - Payee matching (by name/phone)
     - Automatic PAYE tax calculation for employees
     - Total gross/net/tax summary

5. **Authorization & Security**
   - 4-digit PIN setup modal
   - 4-digit PIN verification before batch processing
   - Batch summary review (total amount, recipient count)
   - Receipts page showing each transaction detail

6. **Receipt Generation**
   - Individual receipt PDF export
   - Batch receipt PDF export with formatted table
   - Receipt includes: recipient name, amount, phone, method, reference, timestamp
   - Professional styling with business branding

7. **Profile Gating**
   - Feature blocked until merchant KRA PIN + Business Number are added to profile
   - Modal overlay with unlock flow directing to profile page

### 📋 Additional Features
- **Invoice Module** (separate from bulk pay):
  - Create/draft invoices
  - Add line items (description, qty, price)
  - Invoice PDF generation
  - Mark as Draft/Sent
  - Generate shareable invoice link
- **Fund Account Modal** - Account top-up flow (UI exists)
- **Privacy Mode** - Amounts toggleable for hiding on-screen values

---

## Current Features in Mobile App

### ✅ Implemented
1. **Payee Management** (Same core as dashboard)
   - View/add/edit/delete payees
   - Category filtering: All/Employees/Suppliers/Utilities/Contractors
   - 2-step modal flow for add/edit

2. **Enhanced Mobile UI**
   - Two-tab layout: Payees | Batches
   - Card-based payee display with colorful badges
   - Pull-to-refresh functionality
   - Bottom-sheet modals for all interactions
   - Floating action button for quick actions

3. **Amount Selection**
   - Amount editor modal per payee
   - Input with formatting (removes commas for parsing)
   - Automatic selection toggle when amount is set

4. **PIN Management**
   - PIN setup modal with confirmation
   - PIN authorization modal for batch confirmation
   - 4-digit PIN validation

5. **Batch Authorization**
   - Select multiple payees
   - Set custom amounts per payee
   - Batch total calculation
   - Liquidity check (balance vs. batch total)
   - Submit batch via PIN-protected endpoint

6. **Receipt Display**
   - Post-authorization receipts list
   - Batch reference tracking
   - Receipt detail: name, amount, method, phone, timestamp

7. **PDF Receipt Generation**
   - Uses `expo-print` for PDF generation
   - Professional HTML template with branding
   - Downloadable or shareable via OS share sheet
   - Summary cards: Total Payout, Recipients count, Average per recipient

8. **Profile Gating** (Same as dashboard)
   - Requires KRA PIN + Business Number

### ⚠️ Partial/Simulated
- **Edit Payee**: Changes are applied locally (no backend PUT endpoint, commented as TODO)
- **Batch Management**: Tab exists but no batch history list

---

## Missing Features in Mobile App (vs. Dashboard)

### 🔴 Not Implemented
1. **CSV Upload**
   - No file picker integration for CSV
   - No CSV parsing/preview
   - No bulk import from file

2. **Invoice Generation**
   - No invoice module on mobile
   - No invoice draft/send workflow
   - No invoice link generation

3. **Payment Method Specifics**
   - Limited UI for Paybill/Buy Goods fields
   - Less granular validation UI

4. **Funding/Top-up**
   - No "Fund Account" modal
   - No payment method selection for account deposits

5. **Batch History**
   - "Batches" tab is placeholder
   - No historical batch listing
   - No batch detail view/re-run capability

6. **Advanced Filtering**
   - No search by payee name
   - No amount range filtering

---

## API Client Setup

### Merchant Dashboard (`apps/merchant-dashboard/src/api/config.js`)
```javascript
// Creates axios instance with:
- baseURL: VITE_API_BASE_URL env var or production fallback
- withCredentials: true
- Default Content-Type: application/json
- Response interceptor for error handling
- Manual token header injection on each request:
  headers: { Authorization: `Bearer ${token}` }
```

**Token Source**: `localStorage.getItem('paychain_merchant_token')`

**Key**: Uses Vite environment variables for dynamic API routing

### Mobile App (`apps/mobile-app/src/api/config.ts`)
```typescript
// Creates axios instance with:
- baseURL: 10.0.2.2:5000 (Android), localhost:5000 (iOS), production fallback
- withCredentials: true
- Request interceptor that:
  1. Retrieves token from AsyncStorage
  2. Automatically injects Bearer token
  3. Handles missing token gracefully
- Supports platform-specific routing
```

**Token Source**: `AsyncStorage.getItem('paychain_merchant_token')`

**Key**: Automatic token injection via request interceptor (cleaner than dashboard)

---

## Auth Token Management

### Token Storage

| Platform | Storage Method | Key | Scope |
|----------|---|---|---|
| Dashboard | `localStorage` | `paychain_merchant_token` | Browser tab |
| Mobile | `AsyncStorage` (React Native) | `paychain_merchant_token` | App instance |

### Token Lifecycle

**Dashboard**:
1. Login → Backend returns JWT
2. Store in localStorage + set axios default header
3. On page refresh: Restore from localStorage + verify with `/api/auth/merchant/me`
4. Token persists across browser sessions

**Mobile**:
1. Login → Backend returns JWT
2. Store in AsyncStorage + axios request interceptor auto-injects
3. On app restart: Restore from AsyncStorage + verify with `/api/auth/merchant/me`
4. Token persists across app launches

### Token Injection

- **Dashboard**: Manual header per request
  ```javascript
  headers: { Authorization: `Bearer ${localStorage.getItem('paychain_merchant_token')}` }
  ```

- **Mobile**: Automatic via request interceptor
  ```typescript
  api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('paychain_merchant_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  })
  ```

### Session Validation

Both apps call `/api/auth/merchant/me` on startup to:
- Verify token is still valid
- Refresh merchant object with latest profile data
- Auto-logout on 401 (unauthorized)

---

## Data Synchronization Mechanism

### Current Synchronization Approach

**Type**: Event-driven with manual refresh (No real-time sync)

#### Payee List Sync

**Dashboard**:
```javascript
useEffect(() => {
  fetchPayees();  // Called on component mount
}, [])

// Manual refresh after add/edit/delete
const handleSavePayee = async () => {
  const res = await api.post('/api/bulkpay/payees', payload);
  setPayeesList(prev => [res.data, ...prev]);  // Local state update
}

const handleDeletePayee = async (id) => {
  await api.delete(`/api/bulkpay/payees/${id}`);
  setPayeesList(prev => prev.filter(p => p._id !== id));  // Local update
}
```

**Mobile**:
```typescript
const fetchPayees = useCallback(async () => {
  const res = await api.get('/api/bulkpay/payees');
  setPayeesList(res.data || []);
}, []);

useEffect(() => {
  if (merchant) fetchPayees();
}, [merchant, fetchPayees]);

// Pull-to-refresh available
<ScrollView refreshControl={<RefreshControl onRefresh={fetchPayees} />}>
```

**Sync Pattern**: Manual refresh via React state + optional pull-to-refresh

#### Batch History Sync

**Dashboard**:
- No batch history UI (receipts stored locally in state only)
- After authorization: `setAuthorizedReceipts(newReceipts)` (in-memory only)

**Mobile**:
- Batch tab placeholder (not implemented)
- After authorization: `setReceipts(newReceipts)` (in-memory only)

**Gap**: Neither app persists or retrieves historical batches from backend

#### Profile Sync

**Dashboard**:
```javascript
const [merchant, setMerchant] = useState(null);

useEffect(() => {
  const session = localStorage.getItem('paychain_merchant_session');
  if (session) setMerchant(JSON.parse(session));
  
  // Verify with backend
  axios.get('/api/auth/merchant/me')
    .then(res => {
      setMerchant(res.data.merchant);
      localStorage.setItem('paychain_merchant_session', JSON.stringify(res.data.merchant));
    })
}, []);
```

**Mobile**:
```typescript
useEffect(() => {
  const loadSession = async () => {
    const rawMerchant = await AsyncStorage.getItem('paychain_merchant_session');
    if (rawMerchant) setMerchant(JSON.parse(rawMerchant));
    
    api.get('/api/auth/merchant/me')
      .then(res => {
        setMerchant(res.data.merchant);
        AsyncStorage.setItem('paychain_merchant_session', JSON.stringify(res.data.merchant));
      })
  };
  loadSession();
}, []);
```

**Sync Pattern**: Load from storage + verify/refresh from backend on startup

### Limitations

1. **No Real-time Updates**: If payees added on dashboard, mobile doesn't auto-update
2. **Batch History Lost**: No persistence of batch records after session ends
3. **Manual Refresh Required**: Pull-to-refresh on mobile, but no auto-sync
4. **Eventual Consistency**: Both apps converge on next backend call

### Data Models Used for Sync

**Backend **:
- `Payee` - Persisted in MongoDB
- `PayoutBatch` - Persisted in MongoDB (for audit)
- `Transaction` - Persisted in MongoDB
- `Merchant` - Persisted (session data)

**Frontend**:
- React state (`useState`)
- localStorage/AsyncStorage for persistence
- In-memory only for batch receipts

---

## Backend API Endpoints

### Payee Management
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/bulkpay/payees` | JWT | Fetch all payees for merchant |
| POST | `/api/bulkpay/payees` | JWT | Add new payee with KRA validation |
| PUT | `/api/bulkpay/payees/:id` | JWT | Update payee details |
| DELETE | `/api/bulkpay/payees/:id` | JWT | Remove payee |

### PIN Management
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/bulkpay/set-pin` | JWT | Set initial 4-digit PIN (bcrypted) |
| PUT | `/api/bulkpay/reset-pin` | JWT | Change PIN (requires current PIN) |

### Batch Operations
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/bulkpay/upload-csv` | JWT | Parse CSV, preview with tax calcs |
| POST | `/api/bulkpay/authorize` | JWT + M-PESA Token | Process & authorize batch |

### Data Validation on Backend

**addPayee Validation**:
- Employee: Requires `kraPin` + `idNumber`
- Supplier: Requires `kraPin` + `etimsInvoiceNumber` + `cuNumber`
- Phone format: Stored as-is, frontend validates regex

**authorizeBatch Validation**:
1. PIN comparison (bcrypt verify)
2. Batch total vs. merchant `kesBalance`
3. Liquidity check before Daraja API call
4. KES balance deducted upfront (prevents double-spending)

---

## Authorization Flow

### PIN-Protected Authorization

```
User selects payees + amounts
        ↓
User clicks "Authorize" / "Pay Now"
        ↓
PIN modal appears (4-digit input)
        ↓
POST /api/bulkpay/authorize {
  batchRows: [{ name, type, phone, grossAmount, netAmount }],
  fundingSource: "Main Business Till",
  pin: "1234"
}
        ↓
Backend:
  1. Hash comparison: bcrypt.compare(pin, merchant.bulkPayPin)
  2. If invalid → 401 Unauthorized (retry PIN)
  3. If valid → Calculate totals + validate liquidity
  4. Deduct kesBalance upfront
  5. Call Safaricom Daraja API (B2C/B2B)
  6. Create Transaction ledger entries
  7. Create PayoutBatch record
  8. Send email receipt
        ↓
Response: { batch: PayoutBatch, message: "Success" }
        ↓
Frontend displays receipts (local state)
```

### Security Measures
- 4-digit PIN (bcrypt hashed with 10 salt rounds)
- JWT Bearer token required
- Liquidity validation before processing
- Upfront balance deduction
- Safaricom Daraja API (sandbox in dev)

---

## Key Implementation Insights

### Architecture Decisions

1. **PIN-Based Authorization**: 4-digit PIN hashed and stored separately from login password
2. **Upfront Deduction**: KES balance reduced before Daraja API to prevent race conditions
3. **Payee Creation on Fly**: If payee not in system, created during batch authorization
4. **CSV Tax Calculation**: PAYE, NSSF, SHIF calculated server-side during CSV preview
5. **No Real-time Sync**: Both apps rely on manual refresh patterns

### Technology Stack

| Layer | Tech | Key Libraries |
|-------|------|---|
| Backend | Node.js/Express | axios, bcryptjs, mongoose, csv-parser |
| Dashboard | React/Vite | axios, jsPDF, dom-to-image |
| Mobile | React Native | axios, @react-native-async-storage, expo-print |

### Limitations & Potential Issues

1. **Edit Payee** Not fully implemented on backend (commented as TODO in mobile)
2. **Batch History** Not retrievable from backend (no list endpoint)
3. **CSV Feature** Mobile has no file upload capability
4. **Real-time Sync** No WebSocket or polling for live updates
5. **Double-spending Risk** Mitigated by upfront deduction, but race conditions possible in high-concurrency scenarios

---

## Recommendations for Feature Parity

### Mobile App Gaps to Address

1. **High Priority**
   - [ ] Implement CSV upload + preview (use `react-native-document-picker`)
   - [ ] Add batch history retrieval endpoint + list UI
   - [ ] Complete edit payee backend PUT endpoint

2. **Medium Priority**
   - [ ] Add "Fund Account" modal for liquidity top-up
   - [ ] Implement search/filter for payees
   - [ ] Add invoice module (if business requirement)

3. **Low Priority**
   - [ ] Add settings page for PIN reset
   - [ ] Implement biometric unlock for PIN entry
   - [ ] Add export receipts in CSV format

### Backend Enhancements

1. **Data Retrieval**
   - `GET /api/bulkpay/batches` - List historical batches for merchant
   - `GET /api/bulkpay/batches/:id` - Get batch detail + retry capability

2. **Sync Improvements**
   - WebSocket support for real-time payee list updates
   - Batch status polling endpoint for long-running operations

3. **Mobile-Specific**
   - File upload endpoint that handles mobile multipart differently
   - Offline queue for batch submissions (store locally, sync on reconnect)

---

## Summary Table: Feature Comparison

| Feature | Dashboard | Mobile | Backend |
|---------|-----------|--------|---------|
| Add Payee | ✅ | ✅ | ✅ |
| Edit Payee | ✅ | ⚠️ (local only) | ✅ (PUT exists) |
| Delete Payee | ✅ | ✅ | ✅ |
| CSV Upload | ✅ | ❌ | ✅ |
| CSV Preview | ✅ | ❌ | ✅ |
| Batch Authorization | ✅ | ✅ | ✅ |
| PIN Setup | ✅ | ✅ | ✅ |
| Receipt Export | ✅ (PDF) | ✅ (PDF) | N/A |
| Batch History | ❌ | ❌ | ⚠️ (stored, no GET) |
| Invoice Generation | ✅ | ❌ | N/A |
| Funding Modal | ✅ | ❌ | N/A |
| Profile Gating | ✅ | ✅ | ✅ |
| Daraja Integration | ✅ | ✅ | ✅ |
| KRA Compliance | ✅ | ✅ | ✅ |

---

## Conclusion

The Bulk Pay feature is **well-architected** with a clear separation of concerns:
- Backend handles all business logic, validation, and payment processing
- Dashboard provides full feature set for desktop/web users
- Mobile provides core functionality with UX optimized for mobile

**Key Strengths**:
- Secure PIN-based authorization with bcrypt hashing
- Comprehensive KRA compliance framework
- Payee type flexibility (employee/supplier/utility/contractor)
- Tax calculation automation via CSV
- Professional receipt generation on both platforms

**Key Gaps**:
- Mobile missing CSV upload capability
- No batch history retrieval UI
- Limited real-time synchronization
- Edit payee not fully backend-integrated on mobile

Recommended priority: Implement CSV upload for mobile + batch history retrieval to achieve full feature parity.
