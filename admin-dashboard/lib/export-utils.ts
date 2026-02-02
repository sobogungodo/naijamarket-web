// Export utilities for generating CSV downloads

export interface ExportColumn {
  key: string;
  header: string;
  formatter?: (value: any) => string;
}

/**
 * Format date for export
 */
export const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format currency for export
 */
export const formatCurrency = (amount: number): string => {
  return `₦${amount.toLocaleString('en-NG')}`;
};

/**
 * Convert data array to CSV string
 */
export const convertToCSV = <T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[]
): string => {
  // Header row
  const headers = columns.map((col) => `"${col.header}"`).join(',');
  
  // Data rows
  const rows = data.map((item) =>
    columns
      .map((col) => {
        const value = item[col.key];
        const formatted = col.formatter ? col.formatter(value) : value;
        // Escape quotes and wrap in quotes
        const escaped = String(formatted ?? '').replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(',')
  );
  
  return [headers, ...rows].join('\n');
};

/**
 * Download data as CSV file
 */
export const downloadCSV = (csvContent: string, filename: string): void => {
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

/**
 * Export traders data
 */
export const exportTraders = (traders: any[]): void => {
  const columns: ExportColumn[] = [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name' },
    { key: 'phone', header: 'Phone Number' },
    { key: 'market', header: 'Market' },
    { key: 'reputation', header: 'Reputation Score' },
    { key: 'submissions', header: 'Total Submissions' },
    { key: 'approved', header: 'Approved' },
    { key: 'rejected', header: 'Rejected' },
    { key: 'balance', header: 'Balance', formatter: formatCurrency },
    { key: 'bankName', header: 'Bank' },
    { key: 'accountNumber', header: 'Account Number' },
    { key: 'status', header: 'Status' },
    { key: 'lastActive', header: 'Last Active', formatter: formatDate },
    { key: 'createdAt', header: 'Joined', formatter: formatDate },
  ];
  
  const csv = convertToCSV(traders, columns);
  downloadCSV(csv, 'traders_export');
};

/**
 * Export validators data
 */
export const exportValidators = (validators: any[]): void => {
  const columns: ExportColumn[] = [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name' },
    { key: 'phone', header: 'Phone Number' },
    { key: 'type', header: 'Validator Type' },
    { key: 'accuracy', header: 'Accuracy Rate (%)' },
    { key: 'totalValidations', header: 'Total Validations' },
    { key: 'correctVotes', header: 'Correct Votes' },
    { key: 'balance', header: 'Balance', formatter: formatCurrency },
    { key: 'bankName', header: 'Bank' },
    { key: 'accountNumber', header: 'Account Number' },
    { key: 'status', header: 'Status' },
    { key: 'lastActive', header: 'Last Active', formatter: formatDate },
    { key: 'createdAt', header: 'Joined', formatter: formatDate },
  ];
  
  const csv = convertToCSV(validators, columns);
  downloadCSV(csv, 'validators_export');
};

/**
 * Export payouts/transactions data
 */
export const exportPayouts = (payouts: any[]): void => {
  const columns: ExportColumn[] = [
    { key: 'id', header: 'Transaction ID' },
    { key: 'userName', header: 'User Name' },
    { key: 'userType', header: 'User Type' },
    { key: 'phone', header: 'Phone Number' },
    { key: 'amount', header: 'Amount', formatter: formatCurrency },
    { key: 'bankName', header: 'Bank' },
    { key: 'accountNumber', header: 'Account Number' },
    { key: 'accountName', header: 'Account Name' },
    { key: 'status', header: 'Status' },
    { key: 'reference', header: 'Reference' },
    { key: 'createdAt', header: 'Created', formatter: formatDate },
    { key: 'processedAt', header: 'Processed', formatter: formatDate },
  ];
  
  const csv = convertToCSV(payouts, columns);
  downloadCSV(csv, 'payouts_export');
};

/**
 * Export fraud alerts data
 */
export const exportFraudAlerts = (alerts: any[]): void => {
  const columns: ExportColumn[] = [
    { key: 'id', header: 'Alert ID' },
    { key: 'type', header: 'Fraud Type' },
    { key: 'severity', header: 'Severity' },
    { key: 'userName', header: 'User Name' },
    { key: 'userPhone', header: 'Phone' },
    { key: 'description', header: 'Description' },
    { key: 'amountBlocked', header: 'Amount Blocked', formatter: formatCurrency },
    { key: 'status', header: 'Status' },
    { key: 'resolvedBy', header: 'Resolved By' },
    { key: 'createdAt', header: 'Detected', formatter: formatDate },
    { key: 'resolvedAt', header: 'Resolved', formatter: formatDate },
  ];
  
  const csv = convertToCSV(alerts, columns);
  downloadCSV(csv, 'fraud_alerts_export');
};

/**
 * Export overview/dashboard data
 */
export const exportDashboardStats = (stats: any): void => {
  const data = [
    { metric: 'Active Traders', value: stats.activeTraders },
    { metric: 'Total Validators', value: stats.totalValidators },
    { metric: 'Submissions Today', value: stats.submissionsToday },
    { metric: 'Pending Payouts', value: formatCurrency(stats.pendingPayouts) },
    { metric: 'Approval Rate', value: `${stats.approvalRate}%` },
    { metric: 'Total Markets', value: stats.totalMarkets },
    { metric: 'Report Generated', value: formatDate(new Date()) },
  ];
  
  const columns: ExportColumn[] = [
    { key: 'metric', header: 'Metric' },
    { key: 'value', header: 'Value' },
  ];
  
  const csv = convertToCSV(data, columns);
  downloadCSV(csv, 'dashboard_summary');
};

/**
 * Export financial report
 */
export const exportFinancialReport = (data: {
  summary: any;
  transactions: any[];
  period: string;
}): void => {
  // First section: Summary
  const summaryRows = [
    `"NaijaMarket Intel - Financial Report"`,
    `"Period: ${data.period}"`,
    `"Generated: ${formatDate(new Date())}"`,
    `""`,
    `"Summary"`,
    `"Total Disbursed","${formatCurrency(data.summary.totalDisbursed)}"`,
    `"Pending Payouts","${formatCurrency(data.summary.pendingPayouts)}"`,
    `"Traders Paid","${data.summary.tradersPaid}"`,
    `"Validators Paid","${data.summary.validatorsPaid}"`,
    `"Success Rate","${data.summary.successRate}%"`,
    `""`,
    `"Transaction Details"`,
  ];
  
  const columns: ExportColumn[] = [
    { key: 'id', header: 'ID' },
    { key: 'userName', header: 'Name' },
    { key: 'userType', header: 'Type' },
    { key: 'amount', header: 'Amount', formatter: formatCurrency },
    { key: 'bankName', header: 'Bank' },
    { key: 'status', header: 'Status' },
    { key: 'processedAt', header: 'Date', formatter: formatDate },
  ];
  
  const transactionCSV = convertToCSV(data.transactions, columns);
  const fullCSV = summaryRows.join('\n') + '\n' + transactionCSV;
  
  downloadCSV(fullCSV, `financial_report_${data.period.replace(/\s/g, '_')}`);
};
