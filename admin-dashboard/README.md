# NaijaMarket Intel - Admin Dashboard API Integration

This package provides the complete API integration layer connecting the Admin Dashboard to the Validator WebApp's Google Sheets database.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NAIJAMARKET INTEL PLATFORM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┐         ┌────────────────────────────────────┐   │
│  │   WhatsApp Users     │         │   Admin Dashboard                   │   │
│  │   (Traders/Validators)│        │   (naijamarket-admin.vercel.app)   │   │
│  └──────────┬───────────┘         └─────────────────┬──────────────────┘   │
│             │                                       │                       │
│             ▼                                       ▼                       │
│  ┌──────────────────────┐         ┌────────────────────────────────────┐   │
│  │   validators.txt     │         │   API Routes (/api/*)              │   │
│  │   (Google Apps Script)│        │   - /api/dashboard/stats           │   │
│  │                      │         │   - /api/validators                │   │
│  │   • Registration     │         │   - /api/traders                   │   │
│  │   • Vote Processing  │◄───────►│   - /api/fraud                     │   │
│  │   • Payout Processing│         │   - /api/payouts                   │   │
│  │   • GPS Verification │         │   - /api/config                    │   │
│  └──────────┬───────────┘         └─────────────────┬──────────────────┘   │
│             │                                       │                       │
│             ▼                                       ▼                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    GOOGLE SHEETS DATABASE                             │  │
│  │                    Spreadsheet ID: 1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE  │  │
│  │                                                                       │  │
│  │   ┌──────────────┬──────────────┬──────────────┬──────────────┐      │  │
│  │   │ Validators   │ Trader       │ Rewards      │ Fraud_Flags  │      │  │
│  │   │ _Votes       │ _Submissions │ _Ledger      │              │      │  │
│  │   └──────────────┴──────────────┴──────────────┴──────────────┘      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    AZURE SQL DATABASE (Analytics)                     │  │
│  │                    naijafood.database.windows.net                     │  │
│  │                    Daily sync from Google Sheets                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 📁 File Structure

```
admin-dashboard-api/
├── lib/
│   └── google-sheets.ts      # Google Sheets API client and data functions
├── app/
│   └── api/
│       ├── dashboard/
│       │   └── stats/
│       │       └── route.ts  # Dashboard statistics API
│       ├── validators/
│       │   └── route.ts      # Validators CRUD API
│       ├── traders/
│       │   └── route.ts      # Traders CRUD API
│       ├── fraud/
│       │   └── route.ts      # Fraud alerts API
│       ├── payouts/
│       │   └── route.ts      # Payouts management API
│       └── config/
│           └── route.ts      # Platform configuration API
├── hooks/
│   └── use-data.ts           # React hooks for data fetching
├── scripts/
│   └── sync-to-azure.ts      # Google Sheets to Azure SQL sync script
├── .env.example              # Environment variables template
└── README.md                 # This file
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install googleapis swr mssql
# or
yarn add googleapis swr mssql
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

**Required variables:**

| Variable | Description |
|----------|-------------|
| `NEXTAUTH_SECRET` | Session encryption key |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Google service account JSON |
| `GOOGLE_SPREADSHEET_ID` | Google Sheets spreadsheet ID |

### 3. Set Up Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Sheets API
4. Create a Service Account:
   - Go to IAM & Admin > Service Accounts
   - Create Service Account
   - Create JSON key
5. Share your Google Sheet with the service account email (Editor access)
6. Copy the JSON key to `GOOGLE_SERVICE_ACCOUNT_KEY` environment variable

### 4. Copy Files to Your Dashboard Project

```bash
# Copy the lib folder
cp -r lib/google-sheets.ts your-dashboard/lib/

# Copy API routes
cp -r app/api/* your-dashboard/app/api/

# Copy hooks
cp -r hooks/use-data.ts your-dashboard/hooks/

# Copy environment template
cp .env.example your-dashboard/
```

### 5. Update Your Dashboard Pages

Example usage in a page:

```tsx
'use client';

import { useDashboardStats, useFraudAlerts } from '@/hooks/use-data';

export default function DashboardPage() {
  const { stats, isLoading: statsLoading } = useDashboardStats();
  const { alerts, resolveAlert } = useFraudAlerts({ status: 'PENDING' });

  if (statsLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Active Traders: {stats?.activeTraders}</h1>
      <h2>Pending Fraud Alerts: {alerts.length}</h2>
    </div>
  );
}
```

## 📊 API Reference

### GET /api/dashboard/stats

Returns aggregated platform statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalTraders": 1247,
    "activeTraders": 1089,
    "totalValidators": 342,
    "activeValidators": 298,
    "submissionsToday": 234,
    "pendingValidations": 47,
    "pendingPayouts": 89,
    "pendingPayoutAmount": 156700,
    "criticalAlerts": 3,
    "unresolvedAlerts": 12
  }
}
```

### GET /api/validators

List validators with optional filters.

**Query Parameters:**
- `status`: Filter by status (ACTIVE, SUSPENDED, BANNED)
- `market`: Filter by market name or ID
- `search`: Search by name or phone
- `limit`: Pagination limit (default: 100)
- `offset`: Pagination offset (default: 0)

### GET /api/traders

List traders with optional filters.

**Query Parameters:**
- `status`: Filter by status
- `market`: Filter by market
- `search`: Search by name or phone
- `minReputation`: Minimum reputation score
- `maxReputation`: Maximum reputation score

### GET /api/fraud

List fraud alerts with optional filters.

**Query Parameters:**
- `status`: PENDING, INVESTIGATING, RESOLVED, DISMISSED
- `severity`: CRITICAL, HIGH, MEDIUM, LOW
- `type`: GPS_SPOOFING, PRICE_MANIPULATION, COLLUSION, etc.

### POST /api/fraud

Resolve a fraud alert.

**Request Body:**
```json
{
  "action": "resolve",
  "alertId": "FRD_001",
  "resolution": "RESOLVED",
  "notes": "Confirmed GPS spoofing, user suspended",
  "adminId": "admin@naijamarket.ng"
}
```

### GET /api/payouts

List payouts with optional filters.

### POST /api/payouts

Retry a failed payout or process batch.

**Request Body:**
```json
{
  "action": "retry",
  "payoutId": "PAY_001"
}
```

### GET /api/config

Get platform configuration (synchronized with validators.txt CONFIG).

### PUT /api/config

Update platform configuration.

## ⚙️ Configuration Synchronization

The dashboard settings are synchronized with the `validators.txt` CONFIG object:

| Script CONFIG | Dashboard Settings | Value |
|---------------|-------------------|-------|
| `VALIDATION.TIMEOUT_MINUTES` | Validation Timeout | 30 min |
| `VALIDATION.VALIDATORS_REQUIRED` | Validators per Submission | 3 |
| `VALIDATION.CONSENSUS_REQUIRED` | Consensus Threshold | 2 |
| `REWARDS.CORRECT_VOTE` | Validator Reward | ₦100 |
| `PAYOUT.MINIMUM_BALANCE` | Minimum Balance | ₦500 |
| `PAYOUT.FREQUENCY_DAYS` | Payout Frequency | 14 days |
| `GPS.DEFAULT_MARKET_RADIUS` | GPS Radius | 500m |

## 🔄 Azure SQL Sync

The `sync-to-azure.ts` script syncs data from Google Sheets to Azure SQL for analytics:

```bash
# Run manually
npx ts-node scripts/sync-to-azure.ts

# Or deploy as Azure Function (scheduled trigger)
```

**Sync Schedule Recommendation:**
- Production: Every 15 minutes
- Analytics: Daily at midnight

## 🧪 Mock Data Mode

When Google Sheets is not configured, the API returns mock data automatically. This allows for:
- Local development without Google credentials
- Demo deployments
- Testing

Set `ENABLE_MOCK_DATA=true` in environment to force mock mode.

## 🔒 Security Notes

1. **Never commit `.env.local`** - Contains sensitive credentials
2. **Use environment variables in Vercel** - Configure in project settings
3. **Rotate service account keys** - Periodically regenerate
4. **Limit sheet permissions** - Service account only needs specific sheets

## 📈 Performance Tips

1. **Use SWR caching** - Data hooks include automatic caching
2. **Batch API calls** - Use `Promise.all()` for multiple requests
3. **Implement pagination** - All list endpoints support limit/offset
4. **Set appropriate refresh intervals** - Don't over-fetch

## 🐛 Troubleshooting

### "GOOGLE_SERVICE_ACCOUNT_KEY not set"
- Check that the environment variable is properly set
- Ensure JSON is properly escaped (single line, no newlines in string)

### "Failed to fetch data"
- Verify Google Sheet is shared with service account email
- Check that sheet names match exactly (case-sensitive)
- Verify Spreadsheet ID is correct

### "Azure SQL connection failed"
- Check connection string format
- Verify IP is whitelisted in Azure SQL firewall
- Confirm credentials are correct

## 📝 Version History

- **v1.0.0** (2026-01-29)
  - Initial API integration package
  - Google Sheets client library
  - All API routes (stats, validators, traders, fraud, payouts, config)
  - React data fetching hooks
  - Azure SQL sync script
  - Configuration synchronization with validators.txt
