// ─────────────────────────────────────────────────────────────────────────────
// PATCH for your SystemHealth component (wherever it renders the 4 metric cards)
//
// The 4 top metric cards pull from: healthData.summary
// Previously the field names didn't match the API response.
//
// Replace your existing metric cards section with this:
// ─────────────────────────────────────────────────────────────────────────────

// 1. TYPE — update your HealthData interface / type
interface HealthSummary {
  servicesChecked: number;
  operational: number;
  avgResponseMs: number;
  databaseSize: string;   // ← was missing (caused "N/A")
  tableCount: number;     // ← was missing
  totalRecords: number;   // ← was missing (caused "0")
}

interface HealthData {
  status: string;
  availability: string;
  healthCheckDuration: string;
  checkedAt: string;
  summary: HealthSummary;
  services: ServiceStatus[];
}

// 2. METRIC CARDS — replace your existing 4-card grid with this
// (Keep your existing className / styling — only the DATA fields change)

function MetricCards({ data }: { data: HealthData }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

      {/* Card 1: Avg Response Time */}
      <div className="metric-card">
        <span className="metric-label">Avg Response Time</span>
        <span className="metric-value">
          {data.summary.avgResponseMs}ms
        </span>
        <span className="metric-sub">across all services</span>
      </div>

      {/* Card 2: Services Checked — shows operational/total */}
      <div className="metric-card">
        <span className="metric-label">Services Checked</span>
        <span className="metric-value">
          {data.summary.servicesChecked}
        </span>
        <span className="metric-sub">
          {data.summary.operational} operational
        </span>
      </div>

      {/* Card 3: Database Size — FIX: was "N/A", now shows real GB/MB */}
      <div className="metric-card">
        <span className="metric-label">Database Size</span>
        <span className="metric-value">
          {/* 
            FIX: Previously this read healthData.dbSize (wrong field name)
            Correct field: data.summary.databaseSize 
          */}
          {data.summary.databaseSize ?? 'N/A'}
        </span>
        <span className="metric-sub">
          {data.summary.tableCount} tables
        </span>
      </div>

      {/* Card 4: Total Records — FIX: was "0", now shows real row count */}
      <div className="metric-card">
        <span className="metric-label">Total Records</span>
        <span className="metric-value">
          {/*
            FIX: Previously this read healthData.totalRecords (undefined → "0")
            Correct field: data.summary.totalRecords
          */}
          {data.summary.totalRecords > 0
            ? data.summary.totalRecords.toLocaleString()  // "2,305,761"
            : '—'}
        </span>
        <span className="metric-sub">across all tables</span>
      </div>

    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// 3. DATA FETCHING — ensure your useEffect uses these fields
//    Replace wherever you call the health API:
// ─────────────────────────────────────────────────────────────────────────────

/*
  const fetchHealth = async () => {
    const res = await fetch('/api/health', { cache: 'no-store' });
    const data: HealthData = await res.json();
    setHealthData(data);

    // Access like this:
    // data.summary.databaseSize   → "4.23 GB"
    // data.summary.totalRecords   → 2305761
    // data.summary.tableCount     → 146
    // data.summary.servicesChecked → 6
    // data.summary.operational    → 4
  };
*/


// ─────────────────────────────────────────────────────────────────────────────
// 4. ADMIN DASHBOARD SERVICE CARD — Fix circular URL check
//
//    The health page IS the admin dashboard, so checking its own URL
//    always shows "Operational" (it's serving the request!).
//
//    Fix options (pick one):
//
//    Option A: Check a SPECIFIC admin-only endpoint instead
//              e.g. GET /api/admin/stats → will fail if DB is down
//
//    Option B: Check the admin dashboard login page
//              url: 'https://naijamarket-admin.vercel.app/login'
//
//    Option C: Remove the self-check, replace with a meaningful service
//              e.g. "Google Sheets API" or "Azure Functions"
//
//    Recommended → Option A: the API route above already checks
//    NEXT_PUBLIC_ADMIN_URL env var, so set it in Vercel to your real admin URL
// ─────────────────────────────────────────────────────────────────────────────
