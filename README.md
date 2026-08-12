# NaijaMarket Intel - Web Platform

> The Bloomberg Terminal for African Commodities

Real-time commodity price intelligence platform for Nigerian markets. Track prices, analyze trends, and make smarter procurement decisions.

## 🚀 Features

- **Real-Time Prices**: GPS-verified price submissions from 10,000+ traders
- **226+ Markets**: Coverage across all Nigerian states
- **NFPI Index**: Nigeria's first food price index
- **Price Alerts**: Custom notifications via email, SMS, WhatsApp
- **Bloomberg-Style UI**: Professional terminal interface
- **API Access**: RESTful API for enterprise integration

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Azure SQL Server (via Prisma)
- **Authentication**: NextAuth.js
- **Charts**: Recharts, TradingView Lightweight Charts
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod

## 📦 Project Structure

```
naijamarket-web/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/            # Authentication pages
│   │   ├── (dashboard)/       # Protected dashboard pages
│   │   └── api/               # API routes
│   ├── components/            # Reusable components
│   │   ├── ui/               # Base UI components
│   │   ├── layout/           # Layout components
│   │   ├── charts/           # Chart components
│   │   └── forms/            # Form components
│   ├── lib/                   # Utilities and helpers
│   ├── hooks/                 # Custom React hooks
│   ├── types/                 # TypeScript definitions
│   └── styles/               # Global styles
├── prisma/                    # Database schema
├── public/                    # Static assets
└── ...config files
```

## 🏁 Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Azure SQL Database access

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/naijamarket-web.git
   cd naijamarket-web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values
   ```

4. **Generate Prisma client**
   ```bash
   npm run db:generate
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

6. **Open browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Azure SQL connection string | Yes |
| `NEXTAUTH_URL` | Application URL | Yes |
| `NEXTAUTH_SECRET` | NextAuth secret key | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `META_ACCESS_TOKEN` | Meta WhatsApp Cloud API token | For WhatsApp |
| `META_PHONE_NUMBER_ID` | Meta WhatsApp phone number ID | For WhatsApp |
| `PAYSTACK_SECRET_KEY` | Payment processing | For payments |

See `.env.example` for complete list.

## 📝 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript checks |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Prisma Studio |

## 🗄️ Database

The platform uses Azure SQL Database with Prisma ORM. The schema includes:

**Web Platform Tables (9 tables)**:
- `WebUsers` - Web authentication
- `WebSessions` - JWT session management
- `Watchlists` - Portfolio tracking
- `WatchlistItems` - Watchlist contents
- `ApiKeys` - B2B API access
- `ApiUsageLog` - API analytics
- `CommandHistory` - Terminal commands
- `SavedQueries` - Saved filters
- `UserActivity` - Activity tracking

**Reference Tables (17 tables)**:
- Markets, Items, Categories, Brands, etc.

**Total: 86 tables**

## 🎨 Design System

The UI follows a Bloomberg Terminal-inspired dark theme:

- **Colors**: Dark background (#0a0a0a), NaijaGreen (#00A36C), Gold (#FFB800)
- **Typography**: Space Grotesk (display), Geist (body), JetBrains Mono (code)
- **Components**: Terminal-style cards, data tables, charts

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/prices` | GET | Get current prices |
| `/api/prices/history` | GET | Get price history |
| `/api/markets` | GET | List markets |
| `/api/items` | GET | List items |
| `/api/nfpi` | GET | Get NFPI index |
| `/api/alerts` | GET/POST | Manage price alerts |
| `/api/watchlists` | GET/POST | Manage watchlists |

## 🚢 Deployment

### Azure Container Apps (Recommended)

```bash
# Build Docker image
docker build -t naijamarket-web .

# Push to Azure Container Registry
az acr build --registry <registry> --image naijamarket-web:latest .

# Deploy to Container Apps
az containerapp up --name naijamarket-web --resource-group rg-naijamarket-prod
```

### Vercel (Alternative)

```bash
vercel --prod
```

## 📄 License

Proprietary - Giggababytes Oy. All rights reserved.

## 🤝 Support

- **Email**: support@naijamarket.intel
- **Documentation**: https://docs.naijamarket.intel
- **Status**: https://status.naijamarket.intel

---

Built with ❤️ in Lagos & Finland
