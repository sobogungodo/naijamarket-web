# 🎛️ NaijaMarket Intel Admin Dashboard

> Operations Control Center for Nigeria's Premier Commodity Intelligence Platform

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.4-blue?style=flat-square&logo=typescript" />
  <img src="https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css" />
  <img src="https://img.shields.io/badge/Recharts-2.12-FF6B6B?style=flat-square" />
  <img src="https://img.shields.io/badge/Azure%20SQL-Ready-0078D4?style=flat-square&logo=microsoft-azure" />
</p>

---

## 📋 Overview

A comprehensive admin dashboard for managing the NaijaMarket Intel platform - Nigeria's Bloomberg of Commodities. Built with Next.js 14, TypeScript, and Tailwind CSS, featuring:

- 🛡️ **Fraud Detection Center** - Real-time monitoring of GPS spoofing, price manipulation, and collusion
- 💰 **Financial Operations** - Payout management, VTPass integration, transaction tracking
- 👥 **User Management** - Trader and validator administration with reputation tracking
- 📊 **System Health** - Service status, performance metrics, error monitoring
- 📈 **Analytics Dashboard** - Interactive charts powered by Recharts

---

## 🎨 Design System

### Theme: Industrial Bloomberg Terminal
- **Primary Color**: Nigerian Green (#008751)
- **Accent Color**: Nigerian Gold (#FCD116)
- **Background**: Deep dark (#0a0e14)
- **Typography**: JetBrains Mono (data), Plus Jakarta Sans (UI)

### Key Features
- Dark theme optimized for extended monitoring sessions
- High data density with clear visual hierarchy
- Real-time pulse animations for live data
- Responsive design for desktop and tablet

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Azure SQL Database access (or use mock data)

### Installation

```bash
# Clone or navigate to the project
cd admin-dashboard

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your credentials
nano .env.local

# Start development server
npm run dev
```

### Default Login Credentials
```
Email: olawale.sobogungod@giggabytes.eu
Password: NaijaAdmin2024!
```

---

## 📁 Project Structure

```
admin-dashboard/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Redirect to dashboard
│   ├── login/
│   │   └── page.tsx            # Login page
│   ├── dashboard/
│   │   ├── layout.tsx          # Dashboard shell with sidebar
│   │   ├── page.tsx            # Executive overview
│   │   ├── fraud/page.tsx      # Fraud detection center
│   │   ├── financial/page.tsx  # Financial operations
│   │   ├── users/page.tsx      # User management
│   │   └── health/page.tsx     # System health
│   └── api/
│       └── auth/[...nextauth]/ # NextAuth API routes
├── components/
│   ├── ui/                     # Reusable UI components
│   │   └── index.tsx           # StatCard, Badge, Button, etc.
│   ├── charts/                 # Recharts wrappers
│   │   └── index.tsx           # Area, Line, Bar, Pie charts
│   ├── dashboard/              # Dashboard-specific components
│   │   ├── layout.tsx          # Sidebar, Header
│   │   ├── widgets.tsx         # FraudAlert, ActivityFeed
│   │   └── data-table.tsx      # DataTable with pagination
│   └── providers/
│       └── session-provider.tsx
├── lib/
│   ├── auth.ts                 # NextAuth configuration
│   ├── db.ts                   # Azure SQL connection
│   └── utils.ts                # Utility functions
├── types/
│   └── index.ts                # TypeScript definitions
├── middleware.ts               # Auth middleware
├── tailwind.config.ts          # Tailwind with Nigerian theme
└── next.config.js              # Next.js configuration
```

---

## 🔐 Role-Based Access Control

| Role | Dashboard | Fraud | Financial | Users | Settings |
|------|-----------|-------|-----------|-------|----------|
| Super Admin | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| Admin | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ❌ View |
| Supervisor | ✅ Full | ✅ Full | ✅ View | ❌ None | ❌ None |
| Analyst | ✅ View | ✅ View | ✅ View | ❌ None | ❌ None |
| Viewer | ✅ View | ❌ None | ❌ None | ❌ None | ❌ None |

---

## 📊 Dashboard Modules

### 1. Executive Overview
- Real-time KPI cards (traders, submissions, payouts, approval rate)
- Weekly activity trend chart
- Market distribution pie chart
- Payout by network breakdown
- Quick actions panel
- System status bar

### 2. Fraud Detection Center
- Critical alert banner with counts
- Fraud type distribution
- 4-week trend analysis
- Alert severity filtering
- Top offenders table
- Fraud pattern analysis

### 3. Financial Operations
- Pending payout queue
- Weekly payout trend
- Network breakdown with success rates
- Batch processing controls
- VTPass integration status
- Transaction history

### 4. User Management
- Trader listing with reputation scores
- Validator listing with accuracy rates
- Registration trend chart
- Status filtering (active/suspended/banned)
- Quick actions (view/suspend/approve)

### 5. System Health
- Service status grid (8 services)
- Response time trends (24h)
- Request throughput chart
- 7-day uptime history
- Recent errors log
- Resource usage meters

---

## 🛠️ Development

### Scripts

```bash
# Development
npm run dev          # Start dev server at localhost:3000

# Production
npm run build        # Build for production
npm run start        # Start production server

# Quality
npm run lint         # Run ESLint
npm run type-check   # TypeScript check
```

### Adding New Admin Users

Edit `lib/auth.ts` and add to the `ADMIN_USERS` array:

```typescript
{
  id: '5',
  email: 'newadmin@naijamarket.ng',
  name: 'New Admin',
  passwordHash: await bcrypt.hash('SecurePassword123!', 12),
  role: 'admin',
  avatar: null,
  isActive: true,
}
```

### Connecting to Real Database

1. Update `.env.local` with Azure SQL credentials
2. Uncomment the database calls in API routes
3. Replace mock data with actual queries

---

## 🚢 Deployment to Vercel

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial admin dashboard"
git remote add origin https://github.com/yourusername/naijamarket-admin.git
git push -u origin main
```

### Step 2: Deploy on Vercel
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Add environment variables from `.env.example`
4. Deploy!

### Step 3: Configure Domain
```
admin.naijamarket.ng → your-vercel-deployment.vercel.app
```

---

## 📈 Performance Optimizations

- ✅ Server-side rendering for initial load
- ✅ Client-side data fetching with SWR (ready to implement)
- ✅ Skeleton loaders for loading states
- ✅ Responsive design with mobile support
- ✅ Dark theme to reduce eye strain
- ✅ Lazy loading for charts
- ✅ Debounced search inputs

---

## 🔒 Security Features

- ✅ JWT-based authentication (8-hour expiry)
- ✅ Role-based route protection
- ✅ CSRF protection via NextAuth
- ✅ Secure headers (X-Frame-Options, etc.)
- ✅ Password hashing with bcrypt (12 rounds)
- ✅ Environment variables for secrets

---

## 📝 API Integration Notes

### Azure SQL Queries
The `lib/db.ts` file contains pre-built queries for:
- Dashboard statistics
- Fraud alerts
- Recent submissions
- Pending payouts
- Trader/validator listings

### Google Sheets Sync
For real-time data from Google Sheets, implement:
1. Service account authentication
2. Sheets API v4 integration
3. Webhook for change notifications

### VTPass Integration
For airtime payouts:
1. Configure API credentials
2. Implement retry logic
3. Handle webhook callbacks

---

## 🤝 Contributing

This is an internal tool for NaijaMarket Intel. For feature requests or bug reports, contact the development team.

---

## 📄 License

Proprietary - © 2024 Giggababytes Oy. All rights reserved.

---

## 👨‍💻 Author

**Prof** (Olawale)  
Giggababytes Oy  
olawale.sobogungod@giggabytes.eu

---

<p align="center">
  <strong>🇳🇬 Built for Nigeria, Powered by Innovation 🚀</strong>
</p>
