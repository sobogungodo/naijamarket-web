# 🔧 NAIJAMARKET ADMIN DASHBOARD - COMPLETE INTEGRATION GUIDE

This guide walks you through integrating the Google Sheets API with your deployed Admin Dashboard.

---

## 📋 WHAT YOU'LL ACCOMPLISH

1. ✅ Connect dashboard to Google Sheets (real data instead of mock)
2. ✅ Synchronize CONFIG values between script and dashboard
3. ✅ Set up Azure SQL sync job for analytics
4. ✅ Enable real-time data fetching with SWR hooks

---

## 🚀 STEP 1: GOOGLE CLOUD SETUP (5 minutes)

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select Project** → **New Project**
3. Name: `naijamarket-intel`
4. Click **Create**

### 1.2 Enable Google Sheets API

1. In the new project, go to **APIs & Services** → **Library**
2. Search for "Google Sheets API"
3. Click **Enable**

### 1.3 Create Service Account

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **Service Account**
3. Name: `naijamarket-dashboard`
4. Click **Create and Continue**
5. Skip the optional steps, click **Done**

### 1.4 Create JSON Key

1. Click on the service account you just created
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Select **JSON**
5. Click **Create** (downloads automatically)
6. **Save this file securely!**

### 1.5 Share Google Sheet with Service Account

1. Open the downloaded JSON file
2. Copy the `client_email` value (e.g., `naijamarket-dashboard@naijamarket-intel.iam.gserviceaccount.com`)
3. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8
4. Click **Share**
5. Paste the service account email
6. Set permission to **Editor**
7. Click **Send**

---

## 📁 STEP 2: ADD FILES TO YOUR DASHBOARD (10 minutes)

### 2.1 Install New Dependencies

```bash
cd admin-dashboard
npm install googleapis swr mssql
npm install -D @types/mssql
```

### 2.2 Add the Google Sheets Library

Create file: `lib/google-sheets.ts`

Copy the entire contents from the file provided in the integration package.

### 2.3 Add API Routes

Create these files in your `app/api/` folder:

```
app/
└── api/
    ├── dashboard/
    │   └── stats/
    │       └── route.ts      # Dashboard stats endpoint
    ├── validators/
    │   └── route.ts          # Validators endpoint
    ├── traders/
    │   └── route.ts          # Traders endpoint
    ├── fraud/
    │   └── route.ts          # Fraud alerts endpoint
    ├── payouts/
    │   └── route.ts          # Payouts endpoint
    └── config/
        └── route.ts          # Platform config endpoint
```

### 2.4 Add Data Hooks

Create file: `hooks/use-data.ts`

Copy the entire contents from the file provided.

---

## 🔐 STEP 3: CONFIGURE ENVIRONMENT VARIABLES (5 minutes)

### 3.1 Local Development

Create/update `.env.local`:

```env
# Existing
NEXTAUTH_SECRET=your-existing-secret
NEXTAUTH_URL=http://localhost:3000

# NEW - Google Sheets Integration
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"naijamarket-intel",...PASTE ENTIRE JSON HERE...}
GOOGLE_SPREADSHEET_ID=1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8

# NEW - Azure SQL (optional, for sync)
AZURE_SQL_CONNECTION_STRING=Server=tcp:naijafood.database.windows.net,1433;...

# NEW - Feature flags
ENABLE_MOCK_DATA=false
```

**Important:** The JSON key must be on a single line with no line breaks!

### 3.2 Vercel Production

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add these variables:

| Name | Value | Environment |
|------|-------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | (entire JSON, single line) | Production |
| `GOOGLE_SPREADSHEET_ID` | `1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8` | Production |

---

## 🔄 STEP 4: UPDATE DASHBOARD PAGES (15 minutes)

### 4.1 Update Executive Overview Page

Replace mock data with real API calls:

```tsx
// app/dashboard/page.tsx
'use client';

import { useDashboardStats } from '@/hooks/use-data';

export default function DashboardPage() {
  const { stats, isLoading, error } = useDashboardStats();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <PageWrapper title="Executive Overview">
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Active Traders"
          value={stats?.activeTraders || 0}
          icon={Users}
        />
        <StatCard
          title="Submissions Today"
          value={stats?.submissionsToday || 0}
          icon={TrendingUp}
        />
        <StatCard
          title="Pending Payouts"
          value={`₦${(stats?.pendingPayoutAmount || 0).toLocaleString()}`}
          icon={Wallet}
        />
        <StatCard
          title="Critical Alerts"
          value={stats?.criticalAlerts || 0}
          variant="danger"
          icon={AlertTriangle}
        />
      </div>
    </PageWrapper>
  );
}
```

### 4.2 Update Fraud Detection Page

```tsx
// app/dashboard/fraud/page.tsx
'use client';

import { useFraudAlerts } from '@/hooks/use-data';

export default function FraudPage() {
  const { alerts, resolveAlert, isLoading } = useFraudAlerts();

  const handleResolve = async (alertId: string) => {
    await resolveAlert(
      alertId,
      'RESOLVED',
      'Confirmed and user suspended',
      'admin@naijamarket.ng'
    );
  };

  return (
    <PageWrapper title="Fraud Detection">
      {alerts.map(alert => (
        <AlertCard
          key={alert.alert_id}
          alert={alert}
          onResolve={() => handleResolve(alert.alert_id)}
        />
      ))}
    </PageWrapper>
  );
}
```

### 4.3 Update User Management Page

```tsx
// app/dashboard/users/page.tsx
'use client';

import { useValidators, useTraders } from '@/hooks/use-data';

export default function UsersPage() {
  const { validators, suspendValidator } = useValidators();
  const { traders, suspendTrader } = useTraders();

  // ... rest of component
}
```

### 4.4 Update Financial Operations Page

```tsx
// app/dashboard/financial/page.tsx
'use client';

import { usePayouts } from '@/hooks/use-data';

export default function FinancialPage() {
  const { payouts, stats, retryPayout, processBatch } = usePayouts();

  // ... rest of component
}
```

---

## ⚙️ STEP 5: SYNC CONFIG WITH VALIDATORS.TXT (5 minutes)

The `/api/config` endpoint returns configuration that matches `validators.txt CONFIG`:

```tsx
// In your Settings page
import { usePlatformConfig } from '@/hooks/use-data';

export default function SettingsPage() {
  const { config, updateConfig } = usePlatformConfig();

  // config contains:
  // - validation.timeoutMinutes: 30 (matches CONFIG.VALIDATION.TIMEOUT_MINUTES)
  // - validation.validatorsRequired: 3 (matches CONFIG.VALIDATION.VALIDATORS_REQUIRED)
  // - rewards.validatorCorrectVote: 100 (matches CONFIG.REWARDS.CORRECT_VOTE)
  // - payout.minimumBalance: 500 (matches CONFIG.PAYOUT.MINIMUM_BALANCE)
  // ... etc
}
```

---

## 🔄 STEP 6: SET UP AZURE SQL SYNC (Optional, 10 minutes)

### 6.1 Create Azure Function

1. Go to Azure Portal
2. Create a new Function App
3. Runtime: Node.js 18
4. Add the sync script as a timer-triggered function

### 6.2 Configure Trigger

```json
{
  "bindings": [
    {
      "name": "syncTimer",
      "type": "timerTrigger",
      "direction": "in",
      "schedule": "0 */15 * * * *"  // Every 15 minutes
    }
  ]
}
```

### 6.3 Add Environment Variables to Function App

- `GOOGLE_SERVICE_ACCOUNT_KEY`
- `AZURE_SQL_CONNECTION_STRING`

---

## ✅ STEP 7: TEST EVERYTHING

### 7.1 Test API Routes

```bash
# Test dashboard stats
curl http://localhost:3000/api/dashboard/stats

# Test validators
curl http://localhost:3000/api/validators

# Test fraud alerts
curl http://localhost:3000/api/fraud
```

### 7.2 Check Data Flow

1. Submit a price via WhatsApp bot
2. Refresh dashboard - should see new submission
3. Create a fraud flag in Google Sheets
4. Refresh Fraud Detection page - should see alert

---

## 🐛 TROUBLESHOOTING

### Error: "GOOGLE_SERVICE_ACCOUNT_KEY not set"

**Solution:** Make sure the environment variable is set in both `.env.local` and Vercel.

### Error: "Permission denied" from Google Sheets

**Solution:** Share the spreadsheet with the service account email (found in JSON key file).

### Error: "Sheet not found"

**Solution:** Check that sheet names in `SHEETS_CONFIG.SHEETS` match exactly (case-sensitive).

### Data not updating

**Solution:** Check SWR cache - call `mutate()` after actions, or wait for revalidation interval.

---

## 📊 CONFIGURATION REFERENCE

| Script CONFIG | Dashboard Setting | Current Value |
|--------------|-------------------|---------------|
| `VALIDATION.TIMEOUT_MINUTES` | Validation Timeout | 30 minutes |
| `VALIDATION.VALIDATORS_REQUIRED` | Validators Per Submission | 3 |
| `VALIDATION.CONSENSUS_REQUIRED` | Consensus Threshold | 2 |
| `REWARDS.CORRECT_VOTE` | Validator Reward | ₦100 |
| `REWARDS.INCORRECT_VOTE` | Incorrect Vote Penalty | ₦0 |
| `PAYOUT.MINIMUM_BALANCE` | Minimum Payout Balance | ₦500 |
| `PAYOUT.FREQUENCY_DAYS` | Payout Frequency | 14 days |
| `GPS.DEFAULT_MARKET_RADIUS` | GPS Validation Radius | 500m |
| `GPS.MAX_GPS_AGE_SECONDS` | Max GPS Age | 300s |
| `FRAUD.PRICE_DEVIATION_THRESHOLD` | Price Deviation Alert | 30% |
| `FRAUD.COLLUSION_WINDOW_DAYS` | Collusion Detection Window | 7 days |

---

## 🎉 DONE!

Your Admin Dashboard is now connected to real data from the Validator WebApp!

**What's working:**
- ✅ Real-time dashboard statistics
- ✅ Validator and trader management
- ✅ Fraud alert monitoring and resolution
- ✅ Payout tracking and retry
- ✅ Configuration synchronized with WhatsApp bot

**Next Steps:**
- Add Power BI embedded reports
- Implement WebSocket for real-time updates
- Add notification system
- Create audit logging
