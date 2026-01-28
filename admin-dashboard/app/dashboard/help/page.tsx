'use client';

import React, { useState } from 'react';
import { PageWrapper } from '@/components/dashboard/layout';
import { Button, Input, Badge, Alert } from '@/components/ui';
import {
  HelpCircle,
  Search,
  Book,
  FileText,
  Video,
  MessageCircle,
  Mail,
  Phone,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Users,
  Shield,
  Wallet,
  AlertTriangle,
  Activity,
  Settings,
  BarChart3,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
  Database,
  Globe,
  Smartphone,
  CreditCard,
  RefreshCw,
  Download,
  Upload,
  Eye,
  Lock,
  UserPlus,
  TrendingUp,
  Bell,
  Command,
  Keyboard,
  PlayCircle,
  BookOpen,
  Lightbulb,
  Target,
  Layers,
  Send,
  Copy,
  Check,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

interface GuideSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  articles: GuideArticle[];
}

interface GuideArticle {
  id: string;
  title: string;
  content: string;
  steps?: string[];
  tips?: string[];
  warnings?: string[];
}

interface ShortcutCategory {
  name: string;
  shortcuts: { keys: string[]; description: string }[];
}

// ============================================
// HELP DATA
// ============================================

const FAQ_DATA: FAQItem[] = [
  // General
  {
    category: 'General',
    question: 'What is NaijaMarket Intel?',
    answer: 'NaijaMarket Intel is a WhatsApp-first commodity price intelligence platform for Nigerian markets. It connects traders who submit prices, validators who verify submissions, and consumers who access real-time market data. The admin dashboard allows you to monitor platform activity, detect fraud, manage users, and process payouts.',
  },
  {
    category: 'General',
    question: 'How do I access different features based on my role?',
    answer: 'Access is role-based: Super Admins have full access to all features including settings and API keys. Admins can manage users and approve payouts. Supervisors can take actions on fraud alerts. Analysts have view-only access to dashboards and reports. Viewers have basic dashboard access only. Contact your Super Admin if you need elevated permissions.',
  },
  {
    category: 'General',
    question: 'What markets and commodities does the platform cover?',
    answer: 'Phase 1 covers 8 major Nigerian markets: Mile 12 (Lagos), Onitsha Main Market (Anambra), Iddo Market (Lagos), Ariaria Market (Abia), Alaba International (Lagos), Wuse Market (Abuja), Kano Main Market, and Jos Main Market. We track 24+ commodities across food, building materials, and manufacturing categories.',
  },
  // Fraud Detection
  {
    category: 'Fraud Detection',
    question: 'How does GPS spoofing detection work?',
    answer: 'The system validates that traders are physically present at the market by checking their GPS coordinates against the market\'s known location. Submissions must be within 500 meters of the market center. We also detect impossible travel patterns (e.g., submissions from markets 500km apart within minutes) and flag identical coordinates from multiple users.',
  },
  {
    category: 'Fraud Detection',
    question: 'What triggers a price manipulation alert?',
    answer: 'Prices are flagged when they deviate more than 30% from the established baseline for that commodity at that market. The baseline is calculated from the rolling average of approved submissions. Sudden spikes or drops are automatically flagged for review.',
  },
  {
    category: 'Fraud Detection',
    question: 'How is collusion between traders and validators detected?',
    answer: 'The system monitors validation patterns over a 7-day window. If a validator consistently approves submissions from the same trader (above 80% of interactions), or if the same group of validators always validates the same traders, a collusion alert is triggered. Validators are also excluded from validating traders they\'ve interacted with in the last 24 hours.',
  },
  {
    category: 'Fraud Detection',
    question: 'What should I do when I see a critical fraud alert?',
    answer: 'Critical alerts require immediate attention. Review the evidence provided, check the user\'s history, and take appropriate action (warn, suspend, or ban). For GPS spoofing, verify the submission details and consider suspending the user. For price manipulation, check if there\'s a legitimate market event causing the deviation. Document your decision in the resolution notes.',
  },
  // Financial Operations
  {
    category: 'Financial',
    question: 'How does the payout system work?',
    answer: 'Payouts are processed weekly on Fridays at 6 PM WAT. Users must have a minimum balance of ₦500 to receive a payout. Traders earn ₦20 per approved submission, and validators earn ₦50 per validation (when voting with the majority). Payouts are distributed as airtime via VTPass to the user\'s registered phone number.',
  },
  {
    category: 'Financial',
    question: 'What happens when a payout fails?',
    answer: 'Failed payouts are automatically retried up to 3 times. Common failure reasons include invalid phone numbers, network issues, or insufficient VTPass balance. Check the failure reason in the payout details. If retries fail, the amount remains in the user\'s pending balance for the next payout cycle. You can also manually trigger a retry from the Financial Operations page.',
  },
  {
    category: 'Financial',
    question: 'How do I process an emergency payout?',
    answer: 'Emergency payouts can be triggered by Super Admins and Admins from the Financial Operations page. Click "Process Batch" and select the users to include. Note that emergency payouts still require the minimum balance threshold and are subject to the same validation checks.',
  },
  // User Management
  {
    category: 'Users',
    question: 'How do I suspend a user?',
    answer: 'Navigate to User Management, find the user using search or filters, click on their profile, and select "Suspend" from the actions menu. You\'ll need to provide a reason for the suspension. Suspended users cannot submit prices or validate submissions, but their pending balance is preserved.',
  },
  {
    category: 'Users',
    question: 'What\'s the difference between suspension and banning?',
    answer: 'Suspension is temporary and reversible - the user can be reinstated after review. Banning is permanent and typically reserved for confirmed fraud cases. Banned users lose access to the platform and forfeit any pending balance. Both actions are logged in the audit trail.',
  },
  {
    category: 'Users',
    question: 'How does the reputation system work?',
    answer: 'Traders start with a reputation score of 50. Each approved submission adds +2 points, and each rejection subtracts -2 points. Traders with reputation ≥80 get instant approval (no validation needed). Traders with reputation <30 are flagged for manual review. Validators have an accuracy rate instead, based on how often they vote with the majority.',
  },
  // Technical
  {
    category: 'Technical',
    question: 'How often is data synced between systems?',
    answer: 'Real-time data (submissions, validations) is processed immediately via webhooks. The Google Sheets to Azure SQL sync runs daily at 12:00 AM UTC. Dashboard statistics are refreshed every 5 minutes. If you notice stale data, try refreshing the page or check the System Health page for sync status.',
  },
  {
    category: 'Technical',
    question: 'What should I do if the dashboard is slow or unresponsive?',
    answer: 'First, check the System Health page for any service degradation. Clear your browser cache and try refreshing. If the issue persists, check your internet connection. For persistent issues, contact technical support with your browser version and any error messages you see in the console (F12 > Console tab).',
  },
  {
    category: 'Technical',
    question: 'How do I export data for reporting?',
    answer: 'Most tables have an "Export" button that downloads data as CSV. For advanced reporting, use the Power BI dashboards linked in the Reports section. Analysts and above can export up to 10,000 rows at a time. For larger exports, contact a Super Admin who can run direct database queries.',
  },
];

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Zap,
    description: 'Learn the basics of the admin dashboard',
    articles: [
      {
        id: 'dashboard-overview',
        title: 'Dashboard Overview',
        content: 'The Executive Overview dashboard provides a real-time snapshot of platform health. Key metrics include active users, submission volume, pending payouts, and fraud alerts.',
        steps: [
          'Log in with your admin credentials',
          'Review the KPI cards at the top for quick stats',
          'Check the trend charts for patterns over time',
          'Review the activity feed for recent actions',
          'Address any critical alerts in the alerts panel',
        ],
        tips: [
          'Click on any KPI card to see detailed breakdown',
          'Use the date picker to view historical data',
          'Set up email alerts for critical metrics',
        ],
      },
      {
        id: 'navigation',
        title: 'Navigating the Dashboard',
        content: 'The dashboard uses a sidebar navigation with main sections and a top bar with quick actions.',
        steps: [
          'Use the sidebar to navigate between main sections',
          'Click the collapse button to minimize the sidebar',
          'Use keyboard shortcuts for faster navigation (see Shortcuts section)',
          'The breadcrumb shows your current location',
          'Use the search bar for quick access to users or submissions',
        ],
        tips: [
          'Press Cmd/Ctrl + K to open quick search',
          'Bookmark frequently used pages',
          'Right-click sidebar items to open in new tab',
        ],
      },
      {
        id: 'first-actions',
        title: 'Your First Actions',
        content: 'Here are the most common tasks you\'ll perform as an admin.',
        steps: [
          'Review and resolve pending fraud alerts',
          'Check the validation queue for stuck submissions',
          'Monitor payout status and address failures',
          'Review new user registrations',
          'Check system health for any issues',
        ],
        warnings: [
          'Always document your decisions when resolving fraud alerts',
          'Never share your admin credentials',
          'Log out when leaving your workstation',
        ],
      },
    ],
  },
  {
    id: 'fraud-management',
    title: 'Fraud Management',
    icon: Shield,
    description: 'Detect and handle fraudulent activity',
    articles: [
      {
        id: 'understanding-alerts',
        title: 'Understanding Fraud Alerts',
        content: 'Fraud alerts are generated automatically by our detection systems. Each alert includes severity level, evidence, and recommended actions.',
        steps: [
          'Navigate to Fraud Detection from the sidebar',
          'Review alerts sorted by severity (Critical > High > Medium > Low)',
          'Click on an alert to see detailed evidence',
          'Review the user\'s history and past alerts',
          'Take appropriate action based on the evidence',
        ],
        tips: [
          'Critical alerts often require immediate suspension',
          'Check for patterns across multiple alerts',
          'Use the timeline view to see alert history',
        ],
        warnings: [
          'Don\'t ignore critical alerts for more than 1 hour',
          'Document all actions taken for audit purposes',
          'Escalate unclear cases to supervisors',
        ],
      },
      {
        id: 'taking-action',
        title: 'Taking Action on Alerts',
        content: 'Available actions depend on alert severity and your role permissions.',
        steps: [
          'Review all evidence before taking action',
          'Select the appropriate action: Warn, Suspend, Ban, or Dismiss',
          'Provide a detailed reason for your decision',
          'For suspensions, set a review date',
          'Confirm the action and verify it was applied',
        ],
        tips: [
          'Use "Warn" for first-time minor violations',
          'Use "Suspend" for repeated violations or serious fraud',
          'Use "Ban" only for confirmed, egregious fraud',
          '"Dismiss" marks alert as false positive',
        ],
      },
      {
        id: 'fraud-patterns',
        title: 'Common Fraud Patterns',
        content: 'Learn to recognize common fraud schemes on the platform.',
        steps: [
          'GPS Spoofing: Fake locations to submit from anywhere',
          'Price Manipulation: Artificially inflating or deflating prices',
          'Collusion: Traders and validators working together',
          'Multiple Accounts: Same person with multiple identities',
          'Rapid Submission: Automated or scripted submissions',
        ],
        tips: [
          'GPS spoofing often shows perfect coordinates (too precise)',
          'Collusion shows patterns in approval rates',
          'Multiple accounts share phone prefixes or submission patterns',
        ],
      },
    ],
  },
  {
    id: 'financial-ops',
    title: 'Financial Operations',
    icon: Wallet,
    description: 'Manage payouts and financial reporting',
    articles: [
      {
        id: 'payout-process',
        title: 'Weekly Payout Process',
        content: 'Payouts are processed automatically every Friday at 6 PM WAT.',
        steps: [
          'Monday-Thursday: Monitor pending balances',
          'Thursday: Review and resolve any flagged accounts',
          'Friday morning: Final review of payout queue',
          'Friday 6 PM: Automatic payout processing begins',
          'Friday evening: Monitor success/failure rates',
          'Saturday: Address any failed payouts',
        ],
        tips: [
          'Most failures are due to network issues and resolve on retry',
          'Check VTPass balance before large payout runs',
          'Invalid phone numbers need manual user contact',
        ],
      },
      {
        id: 'handling-failures',
        title: 'Handling Failed Payouts',
        content: 'Failed payouts require investigation and may need manual intervention.',
        steps: [
          'Filter payouts by "Failed" status',
          'Check the failure reason for each',
          'For network errors: Wait and retry automatically',
          'For invalid phone: Contact user to update',
          'For insufficient balance: Alert finance team',
          'Document all manual interventions',
        ],
        warnings: [
          'Never manually transfer funds outside the system',
          'All payouts must be logged for audit',
          'Escalate repeated failures to technical support',
        ],
      },
    ],
  },
  {
    id: 'user-management',
    title: 'User Management',
    icon: Users,
    description: 'Manage traders, validators, and admin users',
    articles: [
      {
        id: 'user-search',
        title: 'Finding and Filtering Users',
        content: 'Use search and filters to find specific users quickly.',
        steps: [
          'Go to User Management from the sidebar',
          'Use the search bar for phone number or name',
          'Apply filters for status, market, or reputation range',
          'Sort by relevant columns (last active, submissions, etc.)',
          'Click on a user row to see full details',
        ],
        tips: [
          'Search supports partial phone number matching',
          'Save common filter combinations as presets',
          'Export filtered results for offline analysis',
        ],
      },
      {
        id: 'user-actions',
        title: 'User Actions',
        content: 'Admins can perform various actions on user accounts.',
        steps: [
          'View: See full user profile and history',
          'Edit: Update user details (name, market)',
          'Warn: Send warning message via WhatsApp',
          'Suspend: Temporarily disable account',
          'Ban: Permanently disable account',
          'Reset: Clear user\'s session and force re-login',
        ],
        warnings: [
          'Banning is irreversible - use with caution',
          'Always provide a reason for any action',
          'Suspended users can appeal via support',
        ],
      },
    ],
  },
];

const KEYBOARD_SHORTCUTS: ShortcutCategory[] = [
  {
    name: 'Navigation',
    shortcuts: [
      { keys: ['Cmd/Ctrl', 'K'], description: 'Open quick search' },
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'F'], description: 'Go to Fraud Detection' },
      { keys: ['G', 'P'], description: 'Go to Financial Operations' },
      { keys: ['G', 'U'], description: 'Go to User Management' },
      { keys: ['G', 'S'], description: 'Go to Settings' },
      { keys: ['['], description: 'Toggle sidebar' },
    ],
  },
  {
    name: 'Actions',
    shortcuts: [
      { keys: ['Cmd/Ctrl', 'S'], description: 'Save changes' },
      { keys: ['Cmd/Ctrl', 'E'], description: 'Export current view' },
      { keys: ['Cmd/Ctrl', 'R'], description: 'Refresh data' },
      { keys: ['Esc'], description: 'Close modal / Cancel' },
      { keys: ['Enter'], description: 'Confirm action' },
    ],
  },
  {
    name: 'Tables',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Navigate rows' },
      { keys: ['Enter'], description: 'Open selected row' },
      { keys: ['Cmd/Ctrl', 'A'], description: 'Select all' },
      { keys: ['Space'], description: 'Toggle row selection' },
      { keys: ['Delete'], description: 'Delete selected (if allowed)' },
    ],
  },
];

const CONTACT_OPTIONS = [
  {
    icon: MessageCircle,
    title: 'Live Chat',
    description: 'Chat with our support team',
    availability: 'Mon-Fri, 9 AM - 6 PM WAT',
    action: 'Start Chat',
    primary: true,
  },
  {
    icon: Mail,
    title: 'Email Support',
    description: 'support@naijamarket.ng',
    availability: 'Response within 24 hours',
    action: 'Send Email',
    href: 'mailto:support@naijamarket.ng',
  },
  {
    icon: Phone,
    title: 'Phone Support',
    description: '+234 800 123 4567',
    availability: 'Mon-Fri, 9 AM - 6 PM WAT',
    action: 'Call Now',
    href: 'tel:+2348001234567',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp',
    description: '+234 800 123 4567',
    availability: '24/7 for urgent issues',
    action: 'Message Us',
    href: 'https://wa.me/2348001234567',
  },
];

// ============================================
// HELP PAGE COMPONENT
// ============================================

type HelpTab = 'guides' | 'faq' | 'shortcuts' | 'contact' | 'videos';

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState<HelpTab>('guides');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFAQs, setExpandedFAQs] = useState<Set<number>>(new Set());
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [copiedShortcut, setCopiedShortcut] = useState<string | null>(null);

  // Filter FAQs based on search
  const filteredFAQs = FAQ_DATA.filter(
    faq =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group FAQs by category
  const faqsByCategory = filteredFAQs.reduce((acc, faq) => {
    if (!acc[faq.category]) acc[faq.category] = [];
    acc[faq.category].push(faq);
    return acc;
  }, {} as Record<string, FAQItem[]>);

  const toggleFAQ = (index: number) => {
    setExpandedFAQs(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleCopyShortcut = (shortcut: string) => {
    navigator.clipboard.writeText(shortcut);
    setCopiedShortcut(shortcut);
    setTimeout(() => setCopiedShortcut(null), 2000);
  };

  const tabs = [
    { id: 'guides' as HelpTab, label: 'Guides', icon: Book },
    { id: 'faq' as HelpTab, label: 'FAQ', icon: HelpCircle },
    { id: 'shortcuts' as HelpTab, label: 'Shortcuts', icon: Keyboard },
    { id: 'videos' as HelpTab, label: 'Videos', icon: Video },
    { id: 'contact' as HelpTab, label: 'Contact', icon: MessageCircle },
  ];

  return (
    <PageWrapper
      title="Help Center"
      subtitle="Documentation, guides, and support resources"
    >
      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dash-muted" />
          <input
            type="text"
            placeholder="Search help articles, FAQs, and guides..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-dash-card border border-dash-border rounded-xl text-dash-text placeholder:text-dash-muted focus:outline-none focus:border-naija-green-500 focus:ring-1 focus:ring-naija-green-500/50"
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-dash-border pb-4 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'bg-naija-green-500 text-white'
                  : 'text-dash-muted hover:text-dash-text hover:bg-dash-card'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {/* Guides Tab */}
        {activeTab === 'guides' && (
          <GuidesTab
            sections={GUIDE_SECTIONS}
            selectedGuide={selectedGuide}
            selectedArticle={selectedArticle}
            onSelectGuide={setSelectedGuide}
            onSelectArticle={setSelectedArticle}
            searchQuery={searchQuery}
          />
        )}

        {/* FAQ Tab */}
        {activeTab === 'faq' && (
          <FAQTab
            faqsByCategory={faqsByCategory}
            expandedFAQs={expandedFAQs}
            onToggleFAQ={toggleFAQ}
            filteredCount={filteredFAQs.length}
            totalCount={FAQ_DATA.length}
          />
        )}

        {/* Shortcuts Tab */}
        {activeTab === 'shortcuts' && (
          <ShortcutsTab
            categories={KEYBOARD_SHORTCUTS}
            copiedShortcut={copiedShortcut}
            onCopy={handleCopyShortcut}
          />
        )}

        {/* Videos Tab */}
        {activeTab === 'videos' && (
          <VideosTab />
        )}

        {/* Contact Tab */}
        {activeTab === 'contact' && (
          <ContactTab options={CONTACT_OPTIONS} />
        )}
      </div>
    </PageWrapper>
  );
}

// ============================================
// GUIDES TAB
// ============================================

interface GuidesTabProps {
  sections: GuideSection[];
  selectedGuide: string | null;
  selectedArticle: string | null;
  onSelectGuide: (id: string | null) => void;
  onSelectArticle: (id: string | null) => void;
  searchQuery: string;
}

function GuidesTab({ 
  sections, 
  selectedGuide, 
  selectedArticle, 
  onSelectGuide, 
  onSelectArticle,
  searchQuery,
}: GuidesTabProps) {
  const currentSection = sections.find(s => s.id === selectedGuide);
  const currentArticle = currentSection?.articles.find(a => a.id === selectedArticle);

  // Filter sections based on search
  const filteredSections = searchQuery
    ? sections.filter(section =>
        section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        section.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        section.articles.some(article =>
          article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          article.content.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : sections;

  if (currentArticle && currentSection) {
    return (
      <div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-dash-muted mb-6">
          <button 
            onClick={() => { onSelectGuide(null); onSelectArticle(null); }}
            className="hover:text-naija-green-400 transition-colors"
          >
            Guides
          </button>
          <ChevronRight className="w-4 h-4" />
          <button 
            onClick={() => onSelectArticle(null)}
            className="hover:text-naija-green-400 transition-colors"
          >
            {currentSection.title}
          </button>
          <ChevronRight className="w-4 h-4" />
          <span className="text-dash-text">{currentArticle.title}</span>
        </div>

        {/* Article Content */}
        <div className="dash-card max-w-3xl">
          <h2 className="text-2xl font-bold text-dash-text mb-4">{currentArticle.title}</h2>
          <p className="text-dash-muted mb-6">{currentArticle.content}</p>

          {currentArticle.steps && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-dash-text mb-3 flex items-center gap-2">
                <Layers className="w-5 h-5 text-naija-green-400" />
                Steps
              </h3>
              <ol className="space-y-3">
                {currentArticle.steps.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-naija-green-500/20 text-naija-green-400 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="text-dash-text pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {currentArticle.tips && (
            <div className="mb-6 p-4 bg-status-info/10 border border-status-info/30 rounded-lg">
              <h3 className="text-lg font-semibold text-status-info mb-3 flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                Pro Tips
              </h3>
              <ul className="space-y-2">
                {currentArticle.tips.map((tip, index) => (
                  <li key={index} className="flex gap-2 text-dash-text">
                    <CheckCircle className="w-4 h-4 text-status-info flex-shrink-0 mt-0.5" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {currentArticle.warnings && (
            <div className="mb-6 p-4 bg-status-warning/10 border border-status-warning/30 rounded-lg">
              <h3 className="text-lg font-semibold text-status-warning mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Important Warnings
              </h3>
              <ul className="space-y-2">
                {currentArticle.warnings.map((warning, index) => (
                  <li key={index} className="flex gap-2 text-dash-text">
                    <XCircle className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-dash-border">
            <Button variant="secondary" onClick={() => onSelectArticle(null)}>
              ← Back to {currentSection.title}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (currentSection) {
    return (
      <div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-dash-muted mb-6">
          <button 
            onClick={() => onSelectGuide(null)}
            className="hover:text-naija-green-400 transition-colors"
          >
            Guides
          </button>
          <ChevronRight className="w-4 h-4" />
          <span className="text-dash-text">{currentSection.title}</span>
        </div>

        {/* Section Header */}
        <div className="dash-card mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-naija-green-500/20 flex items-center justify-center">
              <currentSection.icon className="w-6 h-6 text-naija-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-dash-text">{currentSection.title}</h2>
              <p className="text-dash-muted">{currentSection.description}</p>
            </div>
          </div>
        </div>

        {/* Articles List */}
        <div className="space-y-3">
          {currentSection.articles.map((article) => (
            <button
              key={article.id}
              onClick={() => onSelectArticle(article.id)}
              className="w-full dash-card hover:border-naija-green-500/50 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-dash-text mb-1">{article.title}</h3>
                  <p className="text-sm text-dash-muted line-clamp-2">{article.content}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-dash-muted flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>

        <Button variant="secondary" onClick={() => onSelectGuide(null)} className="mt-6">
          ← Back to All Guides
        </Button>
      </div>
    );
  }

  // Section Grid
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filteredSections.map((section) => {
        const Icon = section.icon;
        return (
          <button
            key={section.id}
            onClick={() => onSelectGuide(section.id)}
            className="dash-card hover:border-naija-green-500/50 transition-colors text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-naija-green-500/20 flex items-center justify-center flex-shrink-0">
                <Icon className="w-6 h-6 text-naija-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-dash-text mb-1">{section.title}</h3>
                <p className="text-sm text-dash-muted mb-3">{section.description}</p>
                <div className="flex items-center gap-2 text-xs text-dash-muted">
                  <FileText className="w-4 h-4" />
                  {section.articles.length} articles
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-dash-muted" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// FAQ TAB
// ============================================

interface FAQTabProps {
  faqsByCategory: Record<string, FAQItem[]>;
  expandedFAQs: Set<number>;
  onToggleFAQ: (index: number) => void;
  filteredCount: number;
  totalCount: number;
}

function FAQTab({ faqsByCategory, expandedFAQs, onToggleFAQ, filteredCount, totalCount }: FAQTabProps) {
  let globalIndex = 0;

  return (
    <div>
      {filteredCount < totalCount && (
        <p className="text-sm text-dash-muted mb-4">
          Showing {filteredCount} of {totalCount} FAQs
        </p>
      )}

      <div className="space-y-6">
        {Object.entries(faqsByCategory).map(([category, faqs]) => (
          <div key={category}>
            <h3 className="text-lg font-semibold text-dash-text mb-3 flex items-center gap-2">
              <Badge variant="info">{category}</Badge>
              <span className="text-sm text-dash-muted font-normal">({faqs.length} questions)</span>
            </h3>
            <div className="space-y-2">
              {faqs.map((faq) => {
                const index = globalIndex++;
                const isExpanded = expandedFAQs.has(index);
                
                return (
                  <div
                    key={index}
                    className="dash-card"
                  >
                    <button
                      onClick={() => onToggleFAQ(index)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <span className="font-medium text-dash-text pr-4">{faq.question}</span>
                      <ChevronDown
                        className={`w-5 h-5 text-dash-muted flex-shrink-0 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-dash-border">
                        <p className="text-dash-muted leading-relaxed">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(faqsByCategory).length === 0 && (
        <div className="text-center py-12">
          <HelpCircle className="w-12 h-12 text-dash-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-dash-text mb-2">No FAQs found</h3>
          <p className="text-dash-muted">Try adjusting your search query</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// SHORTCUTS TAB
// ============================================

interface ShortcutsTabProps {
  categories: ShortcutCategory[];
  copiedShortcut: string | null;
  onCopy: (shortcut: string) => void;
}

function ShortcutsTab({ categories, copiedShortcut, onCopy }: ShortcutsTabProps) {
  return (
    <div className="space-y-6">
      <Alert variant="info" icon={Keyboard}>
        Use keyboard shortcuts to navigate faster. On Mac, use <kbd className="px-1.5 py-0.5 bg-dash-bg rounded text-xs">Cmd</kbd>, on Windows/Linux use <kbd className="px-1.5 py-0.5 bg-dash-bg rounded text-xs">Ctrl</kbd>.
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <div key={category.name} className="dash-card">
            <h3 className="text-lg font-semibold text-dash-text mb-4 flex items-center gap-2">
              <Command className="w-5 h-5 text-naija-green-400" />
              {category.name}
            </h3>
            <div className="space-y-3">
              {category.shortcuts.map((shortcut) => {
                const shortcutString = shortcut.keys.join(' + ');
                const isCopied = copiedShortcut === shortcutString;
                
                return (
                  <div
                    key={shortcutString}
                    className="flex items-center justify-between group"
                  >
                    <span className="text-sm text-dash-muted">{shortcut.description}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {shortcut.keys.map((key, i) => (
                          <React.Fragment key={i}>
                            <kbd className="px-2 py-1 bg-dash-bg border border-dash-border rounded text-xs text-dash-text font-mono">
                              {key}
                            </kbd>
                            {i < shortcut.keys.length - 1 && (
                              <span className="text-dash-muted">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                      <button
                        onClick={() => onCopy(shortcutString)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-dash-hover rounded"
                        title="Copy shortcut"
                      >
                        {isCopied ? (
                          <Check className="w-3 h-3 text-status-success" />
                        ) : (
                          <Copy className="w-3 h-3 text-dash-muted" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// VIDEOS TAB
// ============================================

function VideosTab() {
  const videos = [
    {
      title: 'Dashboard Overview',
      duration: '5:32',
      thumbnail: '📊',
      description: 'Learn how to navigate the admin dashboard and understand key metrics.',
    },
    {
      title: 'Fraud Detection Walkthrough',
      duration: '8:15',
      thumbnail: '🛡️',
      description: 'How to review fraud alerts and take appropriate actions.',
    },
    {
      title: 'Processing Weekly Payouts',
      duration: '6:45',
      thumbnail: '💰',
      description: 'Step-by-step guide to managing the weekly payout process.',
    },
    {
      title: 'User Management Basics',
      duration: '4:20',
      thumbnail: '👥',
      description: 'How to search, filter, and manage trader and validator accounts.',
    },
    {
      title: 'Handling Failed Payouts',
      duration: '7:10',
      thumbnail: '🔄',
      description: 'Troubleshooting and resolving failed payout issues.',
    },
    {
      title: 'Settings Configuration',
      duration: '9:30',
      thumbnail: '⚙️',
      description: 'Configure platform settings, fraud thresholds, and notifications.',
    },
  ];

  return (
    <div>
      <Alert variant="info" icon={Video} className="mb-6">
        Video tutorials are coming soon! These will provide visual walkthroughs of all dashboard features.
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((video) => (
          <div
            key={video.title}
            className="dash-card hover:border-naija-green-500/50 transition-colors cursor-pointer group"
          >
            {/* Thumbnail Placeholder */}
            <div className="aspect-video bg-dash-bg rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
              <span className="text-4xl">{video.thumbnail}</span>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-naija-green-500 flex items-center justify-center">
                  <PlayCircle className="w-6 h-6 text-white" />
                </div>
              </div>
              <Badge className="absolute bottom-2 right-2">{video.duration}</Badge>
            </div>
            
            <h3 className="font-semibold text-dash-text mb-1">{video.title}</h3>
            <p className="text-sm text-dash-muted">{video.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// CONTACT TAB
// ============================================

interface ContactTabProps {
  options: typeof CONTACT_OPTIONS;
}

function ContactTab({ options }: ContactTabProps) {
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketPriority, setTicketPriority] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

  const handleSubmitTicket = async () => {
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    setTicketSubmitted(true);
    setTicketSubject('');
    setTicketMessage('');
  };

  return (
    <div className="space-y-6">
      {/* Contact Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <div
              key={option.title}
              className={`dash-card ${option.primary ? 'border-naija-green-500' : ''}`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  option.primary ? 'bg-naija-green-500' : 'bg-dash-bg'
                }`}>
                  <Icon className={`w-6 h-6 ${option.primary ? 'text-white' : 'text-dash-muted'}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-dash-text mb-1">{option.title}</h3>
                  <p className="text-sm text-dash-muted mb-1">{option.description}</p>
                  <p className="text-xs text-dash-muted mb-3">{option.availability}</p>
                  {option.href ? (
                    <a
                      href={option.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-naija-green-400 hover:text-naija-green-300"
                    >
                      {option.action}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <Button size="sm" variant={option.primary ? 'primary' : 'secondary'}>
                      {option.action}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Support Ticket Form */}
      <div className="dash-card">
        <h3 className="text-lg font-semibold text-dash-text mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-naija-green-400" />
          Submit a Support Ticket
        </h3>

        {ticketSubmitted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-status-success/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-status-success" />
            </div>
            <h4 className="text-lg font-semibold text-dash-text mb-2">Ticket Submitted!</h4>
            <p className="text-dash-muted mb-4">
              We&apos;ve received your request and will respond within 24 hours.
            </p>
            <Button variant="secondary" onClick={() => setTicketSubmitted(false)}>
              Submit Another Ticket
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Subject"
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
              placeholder="Brief description of your issue"
            />

            <div>
              <label className="block text-sm font-medium text-dash-muted mb-2">Priority</label>
              <div className="flex gap-2">
                {['low', 'normal', 'high', 'urgent'].map((priority) => (
                  <button
                    key={priority}
                    onClick={() => setTicketPriority(priority)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      ticketPriority === priority
                        ? priority === 'urgent'
                          ? 'bg-status-danger text-white'
                          : priority === 'high'
                          ? 'bg-status-warning text-white'
                          : 'bg-naija-green-500 text-white'
                        : 'bg-dash-bg text-dash-muted hover:text-dash-text'
                    }`}
                  >
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dash-muted mb-2">Message</label>
              <textarea
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Describe your issue in detail..."
                rows={5}
                className="w-full px-4 py-3 bg-dash-bg border border-dash-border rounded-lg text-dash-text placeholder:text-dash-muted focus:outline-none focus:border-naija-green-500 focus:ring-1 focus:ring-naija-green-500/50 resize-none"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSubmitTicket}
                isLoading={isSubmitting}
                leftIcon={Send}
                disabled={!ticketSubject || !ticketMessage}
              >
                Submit Ticket
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* System Status */}
      <div className="dash-card">
        <h3 className="text-lg font-semibold text-dash-text mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-naija-green-400" />
          System Status
        </h3>
        <div className="space-y-3">
          {[
            { name: 'API Services', status: 'operational' },
            { name: 'WhatsApp Integration', status: 'operational' },
            { name: 'Payment Processing', status: 'operational' },
            { name: 'Database', status: 'operational' },
          ].map((service) => (
            <div key={service.name} className="flex items-center justify-between">
              <span className="text-dash-text">{service.name}</span>
              <Badge variant="success">
                <span className="w-2 h-2 rounded-full bg-status-success mr-1.5 animate-pulse" />
                Operational
              </Badge>
            </div>
          ))}
        </div>
        <a
          href="https://status.naijamarket.ng"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-naija-green-400 hover:text-naija-green-300 mt-4"
        >
          View full status page
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
