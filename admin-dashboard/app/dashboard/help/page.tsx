'use client';

import React, { useState, useEffect } from 'react';
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
  ChevronLeft,
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
  Play,
  Pause,
  RotateCcw,
  MousePointer,
  Navigation,
  GitBranch,
  ArrowRight,
  ArrowDown,
  Circle,
  Square,
  LayoutDashboard,
  X,
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

interface TourStep {
  title: string;
  description: string;
  icon: React.ElementType;
  highlight: string;
}

// ============================================
// HELP DATA
// ============================================

const FAQ_DATA: FAQItem[] = [
  { category: 'General', question: 'What is NaijaMarket Intel?', answer: 'NaijaMarket Intel is a WhatsApp-first commodity price intelligence platform for Nigerian markets. It connects traders who submit prices, validators who verify submissions, and consumers who access real-time market data. The admin dashboard allows you to monitor platform activity, detect fraud, manage users, and process payouts.' },
  { category: 'General', question: 'How do I access different features based on my role?', answer: 'Access is role-based: Super Admins have full access to all features including settings and API keys. Admins can manage users and approve payouts. Supervisors can take actions on fraud alerts. Analysts have view-only access to dashboards and reports. Viewers have basic dashboard access only. Contact your Super Admin if you need elevated permissions.' },
  { category: 'General', question: 'What markets and commodities does the platform cover?', answer: 'Phase 1 covers 8 major Nigerian markets: Mile 12 (Lagos), Onitsha Main Market (Anambra), Iddo Market (Lagos), Ariaria Market (Abia), Alaba International (Lagos), Wuse Market (Abuja), Kano Main Market, and Jos Main Market. We track 24+ commodities across food, building materials, and manufacturing categories.' },
  { category: 'Fraud Detection', question: 'How does GPS spoofing detection work?', answer: 'The system validates that traders are physically present at the market by checking their GPS coordinates against the market\'s known location. Submissions must be within 500 meters of the market center. We also detect impossible travel patterns and flag identical coordinates from multiple users.' },
  { category: 'Fraud Detection', question: 'What triggers a price manipulation alert?', answer: 'Prices are flagged when they deviate more than 30% from the established baseline for that commodity at that market. The baseline is calculated from the rolling average of approved submissions. Sudden spikes or drops are automatically flagged for review.' },
  { category: 'Fraud Detection', question: 'How is collusion between traders and validators detected?', answer: 'The system monitors validation patterns over a 7-day window. If a validator consistently approves submissions from the same trader (above 80% of interactions), or if the same group of validators always validates the same traders, a collusion alert is triggered.' },
  { category: 'Fraud Detection', question: 'What should I do when I see a critical fraud alert?', answer: 'Critical alerts require immediate attention. Review the evidence provided, check the user\'s history, and take appropriate action (warn, suspend, or ban). Document your decision in the resolution notes.' },
  { category: 'Financial', question: 'How does the payout system work?', answer: 'Payouts are processed weekly on Fridays at 6 PM WAT. Users must have a minimum balance of ₦500 to receive a payout. Traders earn ₦50 per approved submission, and validators earn ₦50 per validation. Payouts are distributed as airtime via VTPass.' },
  { category: 'Financial', question: 'What happens when a payout fails?', answer: 'Failed payouts are automatically retried up to 3 times. Common failure reasons include invalid phone numbers, network issues, or insufficient VTPass balance. If retries fail, the amount remains in the user\'s pending balance for the next payout cycle.' },
  { category: 'Financial', question: 'How do I process an emergency payout?', answer: 'Emergency payouts can be triggered by Super Admins and Admins from the Financial Operations page. Click "Process Batch" and select the users to include. Emergency payouts still require the minimum balance threshold.' },
  { category: 'Users', question: 'How do I suspend a user?', answer: 'Navigate to User Management, find the user using search or filters, click on their profile, and select "Suspend" from the actions menu. You\'ll need to provide a reason for the suspension.' },
  { category: 'Users', question: 'What\'s the difference between suspension and banning?', answer: 'Suspension is temporary and reversible - the user can be reinstated after review. Banning is permanent and typically reserved for confirmed fraud cases. Banned users lose access and forfeit any pending balance.' },
  { category: 'Users', question: 'How does the reputation system work?', answer: 'Traders start with a reputation score of 50. Each approved submission adds +2 points, and each rejection subtracts -2 points. Traders with reputation ≥80 get instant approval. Traders with reputation <30 are flagged for manual review.' },
  { category: 'Technical', question: 'How often is data synced between systems?', answer: 'Real-time data is processed immediately via webhooks. The Google Sheets to Azure SQL sync runs daily at 12:00 AM UTC. Dashboard statistics are refreshed every 5 minutes.' },
  { category: 'Technical', question: 'What should I do if the dashboard is slow?', answer: 'First, check the System Health page for any service degradation. Clear your browser cache and try refreshing. For persistent issues, contact technical support with your browser version and any error messages.' },
  { category: 'Technical', question: 'How do I export data for reporting?', answer: 'Most tables have an "Export" button that downloads data as CSV. For advanced reporting, use the Power BI dashboards linked in the Reports section. Analysts and above can export up to 10,000 rows at a time.' },
];

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'getting-started', title: 'Getting Started', icon: Zap, description: 'Learn the basics of the admin dashboard',
    articles: [
      { id: 'dashboard-overview', title: 'Dashboard Overview', content: 'The Executive Overview dashboard provides a real-time snapshot of platform health.', steps: ['Log in with your admin credentials', 'Review the KPI cards at the top for quick stats', 'Check the trend charts for patterns', 'Review the activity feed', 'Address any critical alerts'], tips: ['Click on any KPI card to see detailed breakdown', 'Use the date picker to view historical data'] },
      { id: 'navigation', title: 'Navigating the Dashboard', content: 'The dashboard uses a sidebar navigation with main sections and a top bar.', steps: ['Use the sidebar to navigate between main sections', 'Click the collapse button to minimize the sidebar', 'Use keyboard shortcuts for faster navigation', 'Use the search bar for quick access'], tips: ['Press Cmd/Ctrl + K to open quick search', 'Bookmark frequently used pages'] },
      { id: 'first-actions', title: 'Your First Actions', content: 'Here are the most common tasks you\'ll perform as an admin.', steps: ['Review and resolve pending fraud alerts', 'Check the validation queue', 'Monitor payout status', 'Review new user registrations', 'Check system health'], warnings: ['Always document your decisions', 'Never share your admin credentials', 'Log out when leaving your workstation'] },
    ],
  },
  {
    id: 'fraud-management', title: 'Fraud Management', icon: Shield, description: 'Detect and handle fraudulent activity',
    articles: [
      { id: 'understanding-alerts', title: 'Understanding Fraud Alerts', content: 'Fraud alerts are generated automatically by our detection systems.', steps: ['Navigate to Fraud Detection from the sidebar', 'Review alerts sorted by severity', 'Click on an alert to see detailed evidence', 'Review the user\'s history', 'Take appropriate action'], tips: ['Critical alerts often require immediate suspension', 'Check for patterns across multiple alerts'], warnings: ['Don\'t ignore critical alerts for more than 1 hour', 'Document all actions taken'] },
      { id: 'taking-action', title: 'Taking Action on Alerts', content: 'Available actions depend on alert severity and your role permissions.', steps: ['Review all evidence before taking action', 'Select the appropriate action: Warn, Suspend, Ban, or Dismiss', 'Provide a detailed reason for your decision', 'Confirm the action'], tips: ['Use "Warn" for first-time minor violations', 'Use "Suspend" for repeated violations', '"Dismiss" marks alert as false positive'] },
    ],
  },
  {
    id: 'financial-ops', title: 'Financial Operations', icon: Wallet, description: 'Manage payouts and financial reporting',
    articles: [
      { id: 'payout-process', title: 'Weekly Payout Process', content: 'Payouts are processed automatically every Friday at 6 PM WAT.', steps: ['Monday-Thursday: Monitor pending balances', 'Thursday: Review flagged accounts', 'Friday morning: Final review of payout queue', 'Friday 6 PM: Automatic processing begins', 'Saturday: Address any failed payouts'], tips: ['Most failures are due to network issues', 'Check VTPass balance before large payout runs'] },
      { id: 'handling-failures', title: 'Handling Failed Payouts', content: 'Failed payouts require investigation and may need manual intervention.', steps: ['Filter payouts by "Failed" status', 'Check the failure reason', 'For network errors: Wait and retry', 'For invalid phone: Contact user', 'Document all manual interventions'], warnings: ['Never manually transfer funds outside the system', 'All payouts must be logged for audit'] },
    ],
  },
  {
    id: 'user-management', title: 'User Management', icon: Users, description: 'Manage traders, validators, and admin users',
    articles: [
      { id: 'user-search', title: 'Finding and Filtering Users', content: 'Use search and filters to find specific users quickly.', steps: ['Go to User Management from the sidebar', 'Use the search bar for phone number or name', 'Apply filters for status, market, or reputation', 'Sort by relevant columns', 'Click on a user row to see full details'], tips: ['Search supports partial phone number matching', 'Export filtered results for offline analysis'] },
      { id: 'user-actions', title: 'User Actions', content: 'Admins can perform various actions on user accounts.', steps: ['View: See full user profile and history', 'Edit: Update user details', 'Warn: Send warning message', 'Suspend: Temporarily disable account', 'Ban: Permanently disable account'], warnings: ['Banning is irreversible - use with caution', 'Always provide a reason for any action'] },
    ],
  },
];

const KEYBOARD_SHORTCUTS: ShortcutCategory[] = [
  { name: 'Navigation', shortcuts: [{ keys: ['Cmd/Ctrl', 'K'], description: 'Open quick search' }, { keys: ['G', 'D'], description: 'Go to Dashboard' }, { keys: ['G', 'F'], description: 'Go to Fraud Detection' }, { keys: ['G', 'P'], description: 'Go to Financial Operations' }, { keys: ['G', 'U'], description: 'Go to User Management' }, { keys: ['['], description: 'Toggle sidebar' }] },
  { name: 'Actions', shortcuts: [{ keys: ['Cmd/Ctrl', 'S'], description: 'Save changes' }, { keys: ['Cmd/Ctrl', 'E'], description: 'Export current view' }, { keys: ['Cmd/Ctrl', 'R'], description: 'Refresh data' }, { keys: ['Esc'], description: 'Close modal / Cancel' }, { keys: ['Enter'], description: 'Confirm action' }] },
  { name: 'Tables', shortcuts: [{ keys: ['↑', '↓'], description: 'Navigate rows' }, { keys: ['Enter'], description: 'Open selected row' }, { keys: ['Cmd/Ctrl', 'A'], description: 'Select all' }, { keys: ['Space'], description: 'Toggle row selection' }] },
];

const CONTACT_OPTIONS = [
  { icon: MessageCircle, title: 'Live Chat', description: 'Chat with our support team', availability: 'Mon-Fri, 9 AM - 6 PM WAT', action: 'Start Chat', primary: true },
  { icon: Mail, title: 'Email Support', description: 'support@naijamarket.ng', availability: 'Response within 24 hours', action: 'Send Email', href: 'mailto:support@naijamarket.ng' },
  { icon: Phone, title: 'Phone Support', description: '+234 800 123 4567', availability: 'Mon-Fri, 9 AM - 6 PM WAT', action: 'Call Now', href: 'tel:+2348001234567' },
  { icon: MessageCircle, title: 'WhatsApp', description: '+234 800 123 4567', availability: '24/7 for urgent issues', action: 'Message Us', href: 'https://wa.me/2348001234567' },
];

const TOUR_STEPS: TourStep[] = [
  { title: 'Welcome to NaijaMarket Admin', description: 'This tour will guide you through the main features of the admin dashboard.', icon: LayoutDashboard, highlight: 'sidebar' },
  { title: 'KPI Overview Cards', description: 'These cards show real-time metrics: active traders, submissions today, pending payouts, and fraud alerts.', icon: BarChart3, highlight: 'kpi-cards' },
  { title: 'Fraud Detection', description: 'Monitor and resolve fraud alerts here. Critical alerts are highlighted in red.', icon: Shield, highlight: 'fraud-section' },
  { title: 'Financial Operations', description: 'Manage weekly payouts, track success rates, and handle failed transactions.', icon: Wallet, highlight: 'financial-section' },
  { title: 'User Management', description: 'Search, filter, and manage trader and validator accounts.', icon: Users, highlight: 'users-section' },
  { title: 'System Health', description: 'Monitor API status, database connections, and service health.', icon: Activity, highlight: 'health-section' },
  { title: 'Settings', description: 'Configure platform settings, fraud thresholds, and manage team members.', icon: Settings, highlight: 'settings-section' },
  { title: 'You\'re All Set!', description: 'You now know the basics. Use the Help Center anytime for more detailed guides.', icon: CheckCircle, highlight: 'complete' },
];

// ============================================
// MAIN COMPONENT
// ============================================

type HelpTab = 'guides' | 'faq' | 'shortcuts' | 'tours' | 'demos' | 'flowcharts' | 'videos' | 'contact';

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState<HelpTab>('guides');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFAQs, setExpandedFAQs] = useState<Set<number>>(new Set());
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [copiedShortcut, setCopiedShortcut] = useState<string | null>(null);

  const filteredFAQs = FAQ_DATA.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const faqsByCategory = filteredFAQs.reduce((acc, faq) => {
    if (!acc[faq.category]) acc[faq.category] = [];
    acc[faq.category].push(faq);
    return acc;
  }, {} as Record<string, FAQItem[]>);

  const toggleFAQ = (index: number) => {
    setExpandedFAQs(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
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
    { id: 'tours' as HelpTab, label: 'Interactive Tours', icon: MousePointer },
    { id: 'demos' as HelpTab, label: 'Animated Demos', icon: Play },
    { id: 'flowcharts' as HelpTab, label: 'Flowcharts', icon: GitBranch },
    { id: 'faq' as HelpTab, label: 'FAQ', icon: HelpCircle },
    { id: 'shortcuts' as HelpTab, label: 'Shortcuts', icon: Keyboard },
    { id: 'videos' as HelpTab, label: 'Videos', icon: Video },
    { id: 'contact' as HelpTab, label: 'Contact', icon: MessageCircle },
  ];

  return (
    <PageWrapper title="Help Center" subtitle="Documentation, guides, interactive tutorials, and support resources">
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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-naija-green-500 text-white' : 'text-dash-muted hover:text-dash-text hover:bg-dash-card'}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === 'guides' && <GuidesTab sections={GUIDE_SECTIONS} selectedGuide={selectedGuide} selectedArticle={selectedArticle} onSelectGuide={setSelectedGuide} onSelectArticle={setSelectedArticle} searchQuery={searchQuery} />}
        {activeTab === 'tours' && <InteractiveToursTab steps={TOUR_STEPS} />}
        {activeTab === 'demos' && <AnimatedDemosTab />}
        {activeTab === 'flowcharts' && <FlowchartsTab />}
        {activeTab === 'faq' && <FAQTab faqsByCategory={faqsByCategory} expandedFAQs={expandedFAQs} onToggleFAQ={toggleFAQ} filteredCount={filteredFAQs.length} totalCount={FAQ_DATA.length} />}
        {activeTab === 'shortcuts' && <ShortcutsTab categories={KEYBOARD_SHORTCUTS} copiedShortcut={copiedShortcut} onCopy={handleCopyShortcut} />}
        {activeTab === 'videos' && <VideosTab />}
        {activeTab === 'contact' && <ContactTab options={CONTACT_OPTIONS} />}
      </div>
    </PageWrapper>
  );
}

// ============================================
// INTERACTIVE TOURS TAB
// ============================================

function InteractiveToursTab({ steps }: { steps: TourStep[] }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tourStarted, setTourStarted] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentStep < steps.length - 1) {
      interval = setInterval(() => setCurrentStep(prev => prev + 1), 4000);
    } else if (currentStep >= steps.length - 1) {
      setIsPlaying(false);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentStep, steps.length]);

  const handleStart = () => { setTourStarted(true); setCurrentStep(0); setIsPlaying(true); };
  const handleReset = () => { setCurrentStep(0); setIsPlaying(false); };

  const step = steps[currentStep];
  const Icon = step?.icon;

  if (!tourStarted) {
    return (
      <div className="text-center py-12">
        <div className="w-24 h-24 rounded-full bg-naija-green-500/20 flex items-center justify-center mx-auto mb-6">
          <MousePointer className="w-12 h-12 text-naija-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-dash-text mb-4">Interactive Product Tour</h2>
        <p className="text-dash-muted mb-8 max-w-md mx-auto">Take a guided tour of the admin dashboard to learn about all the key features.</p>
        <Button onClick={handleStart} leftIcon={Play} size="lg">Start Tour</Button>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {[{ title: 'Quick Start Tour', duration: '3 min', steps: 8, icon: Zap }, { title: 'Fraud Detection Deep Dive', duration: '5 min', steps: 12, icon: Shield }, { title: 'Financial Operations', duration: '4 min', steps: 10, icon: Wallet }].map((tour) => (
            <button key={tour.title} onClick={handleStart} className="dash-card hover:border-naija-green-500/50 transition-colors text-left">
              <div className="flex items-center gap-3 mb-2">
                <tour.icon className="w-5 h-5 text-naija-green-400" />
                <span className="font-medium text-dash-text">{tour.title}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-dash-muted">
                <span>{tour.duration}</span><span>•</span><span>{tour.steps} steps</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-dash-muted">Step {currentStep + 1} of {steps.length}</span>
          <span className="text-sm text-dash-muted">{Math.round(((currentStep + 1) / steps.length) * 100)}% Complete</span>
        </div>
        <div className="h-2 bg-dash-border rounded-full overflow-hidden">
          <div className="h-full bg-naija-green-500 transition-all duration-500" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <div className="dash-card mb-6">
        <div className="flex items-start gap-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${currentStep === steps.length - 1 ? 'bg-status-success/20' : 'bg-naija-green-500/20'}`}>
            <Icon className={`w-8 h-8 ${currentStep === steps.length - 1 ? 'text-status-success' : 'text-naija-green-400'}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-dash-text mb-2">{step.title}</h3>
            <p className="text-dash-muted leading-relaxed">{step.description}</p>
          </div>
        </div>
        <div className="mt-6 p-4 bg-dash-bg rounded-xl border border-dash-border">
          <TourVisual highlight={step.highlight} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))} disabled={currentStep === 0} leftIcon={ChevronLeft}>Previous</Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setIsPlaying(!isPlaying)}>{isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}</Button>
          <Button variant="ghost" onClick={handleReset}><RotateCcw className="w-5 h-5" /></Button>
        </div>
        <Button onClick={() => currentStep === steps.length - 1 ? setTourStarted(false) : setCurrentStep(prev => prev + 1)} rightIcon={currentStep === steps.length - 1 ? Check : ChevronRight}>{currentStep === steps.length - 1 ? 'Finish' : 'Next'}</Button>
      </div>

      <div className="flex justify-center gap-2 mt-6">
        {steps.map((_, index) => (
          <button key={index} onClick={() => setCurrentStep(index)} className={`w-2 h-2 rounded-full transition-all ${index === currentStep ? 'w-8 bg-naija-green-500' : index < currentStep ? 'bg-naija-green-500/50' : 'bg-dash-border'}`} />
        ))}
      </div>
    </div>
  );
}

function TourVisual({ highlight }: { highlight: string }) {
  return (
    <div className="relative h-48 overflow-hidden">
      <div className="flex h-full">
        <div className={`w-14 bg-dash-card border-r border-dash-border flex flex-col items-center py-3 gap-2 transition-all duration-500 ${highlight === 'sidebar' ? 'ring-2 ring-naija-green-500 rounded-lg' : ''}`}>
          {[LayoutDashboard, Shield, Wallet, Users, Activity].map((SideIcon, i) => (
            <div key={i} className="w-8 h-8 rounded-lg bg-dash-border flex items-center justify-center"><SideIcon className="w-4 h-4 text-dash-muted" /></div>
          ))}
        </div>
        <div className="flex-1 p-3">
          <div className={`grid grid-cols-4 gap-2 mb-3 transition-all duration-500 ${highlight === 'kpi-cards' ? 'ring-2 ring-naija-green-500 rounded-lg p-1' : ''}`}>
            {[1, 2, 3, 4].map(i => (<div key={i} className="h-12 rounded-lg bg-dash-card border border-dash-border p-2"><div className="w-10 h-2 bg-dash-border rounded mb-1" /><div className="w-6 h-3 bg-naija-green-500/20 rounded" /></div>))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className={`h-16 rounded-lg bg-dash-card border border-dash-border p-2 ${highlight === 'fraud-section' ? 'ring-2 ring-naija-green-500' : ''}`}><div className="flex items-center gap-1 mb-1"><Shield className="w-3 h-3 text-status-danger" /><div className="w-10 h-2 bg-dash-border rounded" /></div></div>
            <div className={`h-16 rounded-lg bg-dash-card border border-dash-border p-2 ${highlight === 'financial-section' ? 'ring-2 ring-naija-green-500' : ''}`}><div className="flex items-center gap-1 mb-1"><Wallet className="w-3 h-3 text-naija-green-400" /><div className="w-10 h-2 bg-dash-border rounded" /></div></div>
            <div className={`h-16 rounded-lg bg-dash-card border border-dash-border p-2 ${highlight === 'users-section' ? 'ring-2 ring-naija-green-500' : ''}`}><div className="flex items-center gap-1 mb-1"><Users className="w-3 h-3 text-status-info" /><div className="w-10 h-2 bg-dash-border rounded" /></div></div>
            <div className={`h-16 rounded-lg bg-dash-card border border-dash-border p-2 ${highlight === 'health-section' || highlight === 'settings-section' ? 'ring-2 ring-naija-green-500' : ''}`}><div className="flex items-center gap-1 mb-1"><Activity className="w-3 h-3 text-status-success" /><div className="w-10 h-2 bg-dash-border rounded" /></div></div>
          </div>
        </div>
      </div>
      {highlight === 'complete' && (<div className="absolute inset-0 bg-dash-bg/90 flex items-center justify-center"><div className="text-center"><CheckCircle className="w-12 h-12 text-status-success mx-auto mb-2" /><p className="font-semibold text-dash-text">Tour Complete!</p></div></div>)}
    </div>
  );
}

// ============================================
// ANIMATED DEMOS TAB
// ============================================

function AnimatedDemosTab() {
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);
  const demos = [
    { id: 'fraud-resolution', title: 'Resolving a Fraud Alert', description: 'Step-by-step walkthrough of reviewing and resolving fraud alerts', icon: Shield, duration: '2 min', steps: ['Navigate to Fraud Detection', 'Select an alert to review', 'Examine the evidence', 'Choose an action (Warn/Suspend/Ban)', 'Add resolution notes', 'Confirm the action'] },
    { id: 'payout-processing', title: 'Processing Payouts', description: 'How to review, approve, and monitor weekly payouts', icon: Wallet, duration: '3 min', steps: ['Go to Financial Operations', 'Review pending queue', 'Verify VTPass balance', 'Select recipients', 'Click Process Batch', 'Monitor status'] },
    { id: 'user-suspension', title: 'Suspending a User', description: 'Properly suspending a user account with documentation', icon: Users, duration: '1.5 min', steps: ['Search for the user', 'Open user profile', 'Click Suspend button', 'Provide reason', 'Confirm suspension'] },
    { id: 'data-export', title: 'Exporting Data', description: 'How to export data for reporting and analysis', icon: Download, duration: '1 min', steps: ['Apply filters to table', 'Click Export button', 'Select format (CSV/Excel)', 'Download file'] },
  ];

  if (selectedDemo) {
    const demo = demos.find(d => d.id === selectedDemo)!;
    return <AnimatedDemoPlayer demo={demo} onBack={() => setSelectedDemo(null)} />;
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold text-dash-text mb-2">Animated Walkthrough Demos</h2>
        <p className="text-dash-muted">Click-through demonstrations of common admin tasks</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {demos.map((demo) => (
          <button key={demo.id} onClick={() => setSelectedDemo(demo.id)} className="dash-card hover:border-naija-green-500/50 transition-all text-left group">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-naija-green-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-naija-green-500/30"><demo.icon className="w-6 h-6 text-naija-green-400" /></div>
              <div className="flex-1">
                <h3 className="font-semibold text-dash-text mb-1 group-hover:text-naija-green-400">{demo.title}</h3>
                <p className="text-sm text-dash-muted mb-3">{demo.description}</p>
                <div className="flex items-center gap-4 text-xs text-dash-muted"><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{demo.duration}</span><span className="flex items-center gap-1"><Layers className="w-3 h-3" />{demo.steps.length} steps</span></div>
              </div>
              <PlayCircle className="w-8 h-8 text-dash-muted group-hover:text-naija-green-400" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AnimatedDemoPlayer({ demo, onBack }: { demo: { id: string; title: string; icon: React.ElementType; steps: string[] }; onBack: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const Icon = demo.icon;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentStep < demo.steps.length - 1) {
      interval = setInterval(() => setCurrentStep(prev => prev + 1), 2500);
    } else if (currentStep >= demo.steps.length - 1) {
      setIsPlaying(false);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentStep, demo.steps.length]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={onBack} leftIcon={ChevronLeft}>Back</Button>
        <div className="flex items-center gap-3"><Icon className="w-6 h-6 text-naija-green-400" /><h2 className="text-xl font-bold text-dash-text">{demo.title}</h2></div>
      </div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">{demo.steps.map((_, index) => (<div key={index} className={`flex-1 h-1 rounded-full transition-colors ${index <= currentStep ? 'bg-naija-green-500' : 'bg-dash-border'}`} />))}</div>
        <div className="flex justify-between text-xs text-dash-muted"><span>Step {currentStep + 1} of {demo.steps.length}</span></div>
      </div>
      <div className="dash-card mb-6">
        <div className="aspect-video bg-dash-bg rounded-xl border border-dash-border flex items-center justify-center overflow-hidden relative">
          <div className="absolute w-6 h-6 animate-pulse" style={{ left: '40%', top: '50%' }}><MousePointer className="w-6 h-6 text-naija-green-400 drop-shadow-lg" /></div>
          <div className="text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-naija-green-500/20 flex items-center justify-center mx-auto mb-4"><span className="text-2xl font-bold text-naija-green-400">{currentStep + 1}</span></div>
            <h3 className="text-lg font-semibold text-dash-text mb-2">{demo.steps[currentStep]}</h3>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))} disabled={currentStep === 0} leftIcon={ChevronLeft}>Previous</Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setIsPlaying(!isPlaying)}>{isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}</Button>
          <Button variant="ghost" onClick={() => { setCurrentStep(0); setIsPlaying(true); }}><RotateCcw className="w-5 h-5" /></Button>
        </div>
        <Button onClick={() => currentStep === demo.steps.length - 1 ? onBack() : setCurrentStep(prev => prev + 1)} rightIcon={currentStep === demo.steps.length - 1 ? Check : ChevronRight}>{currentStep === demo.steps.length - 1 ? 'Done' : 'Next'}</Button>
      </div>
      <div className="mt-8">
        <h3 className="font-semibold text-dash-text mb-4">All Steps</h3>
        <div className="space-y-2">
          {demo.steps.map((step, index) => (
            <button key={index} onClick={() => { setCurrentStep(index); setIsPlaying(false); }} className={`w-full flex items-center gap-4 p-3 rounded-lg text-left transition-colors ${index === currentStep ? 'bg-naija-green-500/20 border border-naija-green-500/30' : 'bg-dash-card hover:bg-dash-hover'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${index < currentStep ? 'bg-naija-green-500 text-white' : index === currentStep ? 'bg-naija-green-500/20 text-naija-green-400' : 'bg-dash-border text-dash-muted'}`}>{index < currentStep ? <Check className="w-4 h-4" /> : <span className="text-sm font-medium">{index + 1}</span>}</div>
              <p className="font-medium text-dash-text">{step}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// FLOWCHARTS TAB
// ============================================

function FlowchartsTab() {
  const [selectedFlowchart, setSelectedFlowchart] = useState<string | null>(null);
  const flowcharts = [
    { id: 'submission-flow', title: 'Price Submission Flow', description: 'How submissions are processed from trader to approval', icon: TrendingUp },
    { id: 'validation-flow', title: 'Validation Process', description: 'How validators review and approve/reject submissions', icon: CheckCircle },
    { id: 'payout-flow', title: 'Payout Processing', description: 'Weekly payout workflow from pending to completed', icon: Wallet },
    { id: 'fraud-flow', title: 'Fraud Detection Pipeline', description: 'How fraud is detected and escalated', icon: Shield },
  ];

  if (selectedFlowchart) return <InteractiveFlowchart flowchartId={selectedFlowchart} onBack={() => setSelectedFlowchart(null)} />;

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold text-dash-text mb-2">Interactive Process Flowcharts</h2>
        <p className="text-dash-muted">Click on any flowchart to see the interactive version</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {flowcharts.map((flowchart) => (
          <button key={flowchart.id} onClick={() => setSelectedFlowchart(flowchart.id)} className="dash-card hover:border-naija-green-500/50 transition-all text-left group">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-naija-green-500/20 flex items-center justify-center flex-shrink-0"><flowchart.icon className="w-6 h-6 text-naija-green-400" /></div>
              <div className="flex-1">
                <h3 className="font-semibold text-dash-text mb-1 group-hover:text-naija-green-400">{flowchart.title}</h3>
                <p className="text-sm text-dash-muted">{flowchart.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-dash-muted group-hover:text-naija-green-400" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function InteractiveFlowchart({ flowchartId, onBack }: { flowchartId: string; onBack: () => void }) {
  const [activeNode, setActiveNode] = useState<string | null>(null);

  const flowchartData: Record<string, { title: string; nodes: { id: string; label: string; description: string; type: 'start' | 'process' | 'decision' | 'end' }[] }> = {
    'submission-flow': {
      title: 'Price Submission Flow',
      nodes: [
        { id: 'start', label: 'Trader Submits Price', description: 'Trader sends price via WhatsApp with GPS location', type: 'start' },
        { id: 'gps-check', label: 'GPS Validation', description: 'System checks if trader is within 500m of market', type: 'decision' },
        { id: 'price-check', label: 'Price Validation', description: 'Check if price is within ±30% of baseline', type: 'decision' },
        { id: 'rep-check', label: 'Reputation Check', description: 'Check if trader reputation ≥80 for instant approval', type: 'decision' },
        { id: 'validation', label: 'Validator Queue', description: 'Assigned to 3 validators for review', type: 'process' },
        { id: 'consensus', label: 'Consensus Vote', description: '2+ approvals = approved, 2+ rejections = rejected', type: 'decision' },
        { id: 'approved', label: 'Approved', description: 'Price added to database, trader earns ₦50', type: 'end' },
        { id: 'rejected', label: 'Rejected', description: 'Submission rejected, reputation decreases', type: 'end' },
      ],
    },
    'validation-flow': {
      title: 'Validation Process',
      nodes: [
        { id: 'start', label: 'New Submission', description: 'Submission enters validation queue', type: 'start' },
        { id: 'assign', label: 'Assign Validators', description: 'Select 3 validators from same market', type: 'process' },
        { id: 'notify', label: 'Send Notifications', description: 'WhatsApp notifications sent to validators', type: 'process' },
        { id: 'wait', label: 'Wait for Votes', description: '30-minute window for responses', type: 'process' },
        { id: 'check-votes', label: 'Check Votes', description: 'Evaluate received votes', type: 'decision' },
        { id: 'approved', label: 'Approved', description: 'Submission approved, rewards distributed', type: 'end' },
        { id: 'rejected', label: 'Rejected', description: 'Submission rejected', type: 'end' },
        { id: 'timeout', label: 'Timeout', description: 'Mark as expired if insufficient votes', type: 'end' },
      ],
    },
    'payout-flow': {
      title: 'Payout Processing Flow',
      nodes: [
        { id: 'start', label: 'Friday 6 PM', description: 'Weekly payout job triggered automatically', type: 'start' },
        { id: 'fetch', label: 'Fetch Pending', description: 'Get all users with balance ≥ ₦500', type: 'process' },
        { id: 'check-balance', label: 'VTPass Balance', description: 'Verify sufficient VTPass balance', type: 'decision' },
        { id: 'process', label: 'Process Batch', description: 'Send airtime to each recipient', type: 'process' },
        { id: 'check-result', label: 'Check Result', description: 'Verify each transaction status', type: 'decision' },
        { id: 'success', label: 'Success', description: 'Update ledger, clear balance', type: 'end' },
        { id: 'retry', label: 'Retry (3x)', description: 'Retry failed transactions up to 3 times', type: 'process' },
        { id: 'failed', label: 'Failed', description: 'Log failure, preserve balance', type: 'end' },
      ],
    },
    'fraud-flow': {
      title: 'Fraud Detection Pipeline',
      nodes: [
        { id: 'start', label: 'Incoming Data', description: 'Submissions, validations, user activity', type: 'start' },
        { id: 'gps-detector', label: 'GPS Detector', description: 'Check for spoofing, impossible travel', type: 'process' },
        { id: 'price-detector', label: 'Price Detector', description: 'Check for manipulation patterns', type: 'process' },
        { id: 'collusion-detector', label: 'Collusion Detector', description: 'Analyze validator-trader patterns', type: 'process' },
        { id: 'score', label: 'Calculate Score', description: 'Combine signals into risk score', type: 'process' },
        { id: 'threshold', label: 'Check Threshold', description: 'Is score above alert threshold?', type: 'decision' },
        { id: 'no-alert', label: 'No Action', description: 'Activity within normal parameters', type: 'end' },
        { id: 'create-alert', label: 'Create Alert', description: 'Generate fraud alert with evidence', type: 'process' },
        { id: 'notify', label: 'Notify Admin', description: 'Send alert to admin dashboard', type: 'end' },
      ],
    },
  };

  const data = flowchartData[flowchartId];
  if (!data) return null;

  const activeNodeData = data.nodes.find(n => n.id === activeNode);
  const typeColors = { start: 'bg-status-success/20 border-status-success text-status-success', end: 'bg-status-danger/20 border-status-danger text-status-danger', decision: 'bg-status-warning/20 border-status-warning text-status-warning', process: 'bg-naija-green-500/20 border-naija-green-500 text-naija-green-400' };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={onBack} leftIcon={ChevronLeft}>Back</Button>
        <h2 className="text-xl font-bold text-dash-text">{data.title}</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 dash-card">
          <div className="flex flex-wrap gap-3 justify-center p-4">
            {data.nodes.map((node) => (
              <button key={node.id} onClick={() => setActiveNode(activeNode === node.id ? null : node.id)} className={`px-4 py-3 border-2 rounded-xl transition-all cursor-pointer ${typeColors[node.type]} ${activeNode === node.id ? 'ring-2 ring-offset-2 ring-offset-dash-bg scale-105' : 'hover:scale-105'}`}>
                <span className="text-sm font-medium">{node.label}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-4 text-xs text-dash-muted justify-center pt-4 border-t border-dash-border">
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-status-success/50" /> Start</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-naija-green-500/50" /> Process</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-status-warning/50" /> Decision</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-status-danger/50" /> End</span>
          </div>
        </div>
        <div className="dash-card">
          <h3 className="font-semibold text-dash-text mb-4">Node Details</h3>
          {activeNodeData ? (
            <div>
              <Badge variant={activeNodeData.type === 'start' ? 'success' : activeNodeData.type === 'end' ? 'danger' : activeNodeData.type === 'decision' ? 'warning' : 'info'}>{activeNodeData.type}</Badge>
              <h4 className="text-lg font-medium text-dash-text mt-3 mb-2">{activeNodeData.label}</h4>
              <p className="text-dash-muted">{activeNodeData.description}</p>
            </div>
          ) : (
            <p className="text-dash-muted text-sm">Click on any node to see details</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// REMAINING TABS (FAQ, SHORTCUTS, VIDEOS, CONTACT, GUIDES)
// ============================================

function GuidesTab({ sections, selectedGuide, selectedArticle, onSelectGuide, onSelectArticle, searchQuery }: { sections: GuideSection[]; selectedGuide: string | null; selectedArticle: string | null; onSelectGuide: (id: string | null) => void; onSelectArticle: (id: string | null) => void; searchQuery: string }) {
  const currentSection = sections.find(s => s.id === selectedGuide);
  const currentArticle = currentSection?.articles.find(a => a.id === selectedArticle);
  const filteredSections = searchQuery ? sections.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.articles.some(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()))) : sections;

  if (currentArticle && currentSection) {
    return (
      <div>
        <div className="flex items-center gap-2 text-sm text-dash-muted mb-6">
          <button onClick={() => { onSelectGuide(null); onSelectArticle(null); }} className="hover:text-naija-green-400">Guides</button>
          <ChevronRight className="w-4 h-4" />
          <button onClick={() => onSelectArticle(null)} className="hover:text-naija-green-400">{currentSection.title}</button>
          <ChevronRight className="w-4 h-4" />
          <span className="text-dash-text">{currentArticle.title}</span>
        </div>
        <div className="dash-card max-w-3xl">
          <h2 className="text-2xl font-bold text-dash-text mb-4">{currentArticle.title}</h2>
          <p className="text-dash-muted mb-6">{currentArticle.content}</p>
          {currentArticle.steps && (<div className="mb-6"><h3 className="text-lg font-semibold text-dash-text mb-3 flex items-center gap-2"><Layers className="w-5 h-5 text-naija-green-400" />Steps</h3><ol className="space-y-3">{currentArticle.steps.map((step, i) => (<li key={i} className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-naija-green-500/20 text-naija-green-400 flex items-center justify-center text-sm font-medium">{i + 1}</span><span className="text-dash-text pt-0.5">{step}</span></li>))}</ol></div>)}
          {currentArticle.tips && (<div className="mb-6 p-4 bg-status-info/10 border border-status-info/30 rounded-lg"><h3 className="text-lg font-semibold text-status-info mb-3 flex items-center gap-2"><Lightbulb className="w-5 h-5" />Pro Tips</h3><ul className="space-y-2">{currentArticle.tips.map((tip, i) => (<li key={i} className="flex gap-2 text-dash-text"><CheckCircle className="w-4 h-4 text-status-info flex-shrink-0 mt-0.5" />{tip}</li>))}</ul></div>)}
          {currentArticle.warnings && (<div className="mb-6 p-4 bg-status-warning/10 border border-status-warning/30 rounded-lg"><h3 className="text-lg font-semibold text-status-warning mb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5" />Warnings</h3><ul className="space-y-2">{currentArticle.warnings.map((w, i) => (<li key={i} className="flex gap-2 text-dash-text"><XCircle className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />{w}</li>))}</ul></div>)}
          <Button variant="secondary" onClick={() => onSelectArticle(null)}>← Back to {currentSection.title}</Button>
        </div>
      </div>
    );
  }

  if (currentSection) {
    return (
      <div>
        <div className="flex items-center gap-2 text-sm text-dash-muted mb-6"><button onClick={() => onSelectGuide(null)} className="hover:text-naija-green-400">Guides</button><ChevronRight className="w-4 h-4" /><span className="text-dash-text">{currentSection.title}</span></div>
        <div className="dash-card mb-6"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-naija-green-500/20 flex items-center justify-center"><currentSection.icon className="w-6 h-6 text-naija-green-400" /></div><div><h2 className="text-xl font-bold text-dash-text">{currentSection.title}</h2><p className="text-dash-muted">{currentSection.description}</p></div></div></div>
        <div className="space-y-3">{currentSection.articles.map((article) => (<button key={article.id} onClick={() => onSelectArticle(article.id)} className="w-full dash-card hover:border-naija-green-500/50 text-left"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-dash-text mb-1">{article.title}</h3><p className="text-sm text-dash-muted line-clamp-2">{article.content}</p></div><ChevronRight className="w-5 h-5 text-dash-muted" /></div></button>))}</div>
        <Button variant="secondary" onClick={() => onSelectGuide(null)} className="mt-6">← Back to All Guides</Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filteredSections.map((section) => (<button key={section.id} onClick={() => onSelectGuide(section.id)} className="dash-card hover:border-naija-green-500/50 text-left"><div className="flex items-start gap-4"><div className="w-12 h-12 rounded-xl bg-naija-green-500/20 flex items-center justify-center flex-shrink-0"><section.icon className="w-6 h-6 text-naija-green-400" /></div><div className="flex-1"><h3 className="font-semibold text-dash-text mb-1">{section.title}</h3><p className="text-sm text-dash-muted mb-3">{section.description}</p><div className="flex items-center gap-2 text-xs text-dash-muted"><FileText className="w-4 h-4" />{section.articles.length} articles</div></div><ChevronRight className="w-5 h-5 text-dash-muted" /></div></button>))}
    </div>
  );
}

function FAQTab({ faqsByCategory, expandedFAQs, onToggleFAQ, filteredCount, totalCount }: { faqsByCategory: Record<string, FAQItem[]>; expandedFAQs: Set<number>; onToggleFAQ: (index: number) => void; filteredCount: number; totalCount: number }) {
  let globalIndex = 0;
  return (
    <div>
      {filteredCount < totalCount && <p className="text-sm text-dash-muted mb-4">Showing {filteredCount} of {totalCount} FAQs</p>}
      <div className="space-y-6">
        {Object.entries(faqsByCategory).map(([category, faqs]) => (
          <div key={category}>
            <h3 className="text-lg font-semibold text-dash-text mb-3 flex items-center gap-2"><Badge variant="info">{category}</Badge><span className="text-sm text-dash-muted font-normal">({faqs.length})</span></h3>
            <div className="space-y-2">{faqs.map((faq) => { const index = globalIndex++; const isExpanded = expandedFAQs.has(index); return (<div key={index} className="dash-card"><button onClick={() => onToggleFAQ(index)} className="w-full flex items-center justify-between text-left"><span className="font-medium text-dash-text pr-4">{faq.question}</span><ChevronDown className={`w-5 h-5 text-dash-muted flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} /></button>{isExpanded && <div className="mt-4 pt-4 border-t border-dash-border"><p className="text-dash-muted leading-relaxed">{faq.answer}</p></div>}</div>); })}</div>
          </div>
        ))}
      </div>
      {Object.keys(faqsByCategory).length === 0 && <div className="text-center py-12"><HelpCircle className="w-12 h-12 text-dash-muted mx-auto mb-4" /><h3 className="text-lg font-semibold text-dash-text mb-2">No FAQs found</h3><p className="text-dash-muted">Try adjusting your search query</p></div>}
    </div>
  );
}

function ShortcutsTab({ categories, copiedShortcut, onCopy }: { categories: ShortcutCategory[]; copiedShortcut: string | null; onCopy: (s: string) => void }) {
  return (
    <div className="space-y-6">
      <Alert variant="info" icon={Keyboard}>Use keyboard shortcuts to navigate faster. On Mac, use <kbd className="px-1.5 py-0.5 bg-dash-bg rounded text-xs">Cmd</kbd>, on Windows/Linux use <kbd className="px-1.5 py-0.5 bg-dash-bg rounded text-xs">Ctrl</kbd>.</Alert>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat) => (
          <div key={cat.name} className="dash-card">
            <h3 className="text-lg font-semibold text-dash-text mb-4 flex items-center gap-2"><Command className="w-5 h-5 text-naija-green-400" />{cat.name}</h3>
            <div className="space-y-3">{cat.shortcuts.map((s) => { const str = s.keys.join(' + '); return (<div key={str} className="flex items-center justify-between group"><span className="text-sm text-dash-muted">{s.description}</span><div className="flex items-center gap-2"><div className="flex gap-1">{s.keys.map((k, i) => (<React.Fragment key={i}><kbd className="px-2 py-1 bg-dash-bg border border-dash-border rounded text-xs text-dash-text font-mono">{k}</kbd>{i < s.keys.length - 1 && <span className="text-dash-muted">+</span>}</React.Fragment>))}</div><button onClick={() => onCopy(str)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-dash-hover rounded">{copiedShortcut === str ? <Check className="w-3 h-3 text-status-success" /> : <Copy className="w-3 h-3 text-dash-muted" />}</button></div></div>); })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VideosTab() {
  const videos = [
    { id: 'dashboard-overview', title: 'Dashboard Overview', duration: '5:32', thumbnail: '📊', description: 'Learn how to navigate the admin dashboard.' },
    { id: 'fraud-detection', title: 'Fraud Detection Walkthrough', duration: '8:15', thumbnail: '🛡️', description: 'How to review fraud alerts and take actions.' },
    { id: 'processing-payouts', title: 'Processing Weekly Payouts', duration: '6:45', thumbnail: '💰', description: 'Step-by-step guide to managing payouts.' },
    { id: 'user-management', title: 'User Management Basics', duration: '4:20', thumbnail: '👥', description: 'How to manage trader and validator accounts.' },
    { id: 'failed-payouts', title: 'Handling Failed Payouts', duration: '7:10', thumbnail: '🔄', description: 'Troubleshooting failed payout issues.' },
    { id: 'settings-config', title: 'Settings Configuration', duration: '9:30', thumbnail: '⚙️', description: 'Configure platform settings and thresholds.' },
  ];

  return (
    <div>
      <Alert variant="info" icon={Video} className="mb-6">Video tutorials are coming soon! In the meantime, try our <strong>Interactive Tours</strong> and <strong>Animated Demos</strong> for visual walkthroughs.</Alert>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((v) => (
          <div key={v.id} className="dash-card hover:border-naija-green-500/50 cursor-pointer group relative">
            <Badge className="absolute top-2 right-2 z-10" variant="warning">Coming Soon</Badge>
            <div className="aspect-video bg-dash-bg rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
              <span className="text-4xl">{v.thumbnail}</span>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><div className="w-12 h-12 rounded-full bg-dash-border flex items-center justify-center"><PlayCircle className="w-6 h-6 text-dash-muted" /></div></div>
              <Badge className="absolute bottom-2 right-2">{v.duration}</Badge>
            </div>
            <h3 className="font-semibold text-dash-text mb-1">{v.title}</h3>
            <p className="text-sm text-dash-muted">{v.description}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 dash-card border-dashed">
        <div className="text-center py-8">
          <Upload className="w-12 h-12 text-dash-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-dash-text mb-2">Have Training Videos?</h3>
          <p className="text-dash-muted mb-4 max-w-md mx-auto">Contact your administrator to upload custom training videos for your team.</p>
          <Button variant="secondary" leftIcon={Mail}>Contact Admin</Button>
        </div>
      </div>
    </div>
  );
}

function ContactTab({ options }: { options: typeof CONTACT_OPTIONS }) {
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketPriority, setTicketPriority] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

  const handleSubmit = async () => { setIsSubmitting(true); await new Promise(r => setTimeout(r, 1000)); setIsSubmitting(false); setTicketSubmitted(true); setTicketSubject(''); setTicketMessage(''); };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((opt) => (
          <div key={opt.title} className={`dash-card ${opt.primary ? 'border-naija-green-500' : ''}`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${opt.primary ? 'bg-naija-green-500' : 'bg-dash-bg'}`}><opt.icon className={`w-6 h-6 ${opt.primary ? 'text-white' : 'text-dash-muted'}`} /></div>
              <div className="flex-1">
                <h3 className="font-semibold text-dash-text mb-1">{opt.title}</h3>
                <p className="text-sm text-dash-muted mb-1">{opt.description}</p>
                <p className="text-xs text-dash-muted mb-3">{opt.availability}</p>
                {opt.href ? <a href={opt.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-naija-green-400 hover:text-naija-green-300">{opt.action}<ExternalLink className="w-3 h-3" /></a> : <Button size="sm" variant={opt.primary ? 'primary' : 'secondary'}>{opt.action}</Button>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="dash-card">
        <h3 className="text-lg font-semibold text-dash-text mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-naija-green-400" />Submit a Support Ticket</h3>
        {ticketSubmitted ? (
          <div className="text-center py-8"><div className="w-16 h-16 rounded-full bg-status-success/20 flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-status-success" /></div><h4 className="text-lg font-semibold text-dash-text mb-2">Ticket Submitted!</h4><p className="text-dash-muted mb-4">We&apos;ll respond within 24 hours.</p><Button variant="secondary" onClick={() => setTicketSubmitted(false)}>Submit Another</Button></div>
        ) : (
          <div className="space-y-4">
            <Input label="Subject" value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} placeholder="Brief description of your issue" />
            <div><label className="block text-sm font-medium text-dash-muted mb-2">Priority</label><div className="flex gap-2">{['low', 'normal', 'high', 'urgent'].map((p) => (<button key={p} onClick={() => setTicketPriority(p)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ticketPriority === p ? (p === 'urgent' ? 'bg-status-danger text-white' : p === 'high' ? 'bg-status-warning text-white' : 'bg-naija-green-500 text-white') : 'bg-dash-bg text-dash-muted hover:text-dash-text'}`}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>))}</div></div>
            <div><label className="block text-sm font-medium text-dash-muted mb-2">Message</label><textarea value={ticketMessage} onChange={(e) => setTicketMessage(e.target.value)} placeholder="Describe your issue in detail..." rows={5} className="w-full px-4 py-3 bg-dash-bg border border-dash-border rounded-lg text-dash-text placeholder:text-dash-muted focus:outline-none focus:border-naija-green-500 resize-none" /></div>
            <div className="flex justify-end"><Button onClick={handleSubmit} isLoading={isSubmitting} leftIcon={Send} disabled={!ticketSubject || !ticketMessage}>Submit Ticket</Button></div>
          </div>
        )}
      </div>
      <div className="dash-card">
        <h3 className="text-lg font-semibold text-dash-text mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-naija-green-400" />System Status</h3>
        <div className="space-y-3">{[{ name: 'API Services' }, { name: 'WhatsApp Integration' }, { name: 'Payment Processing' }, { name: 'Database' }].map((s) => (<div key={s.name} className="flex items-center justify-between"><span className="text-dash-text">{s.name}</span><Badge variant="success"><span className="w-2 h-2 rounded-full bg-status-success mr-1.5 animate-pulse" />Operational</Badge></div>))}</div>
        <a href="https://status.naijamarket.ng" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-naija-green-400 hover:text-naija-green-300 mt-4">View full status page<ExternalLink className="w-3 h-3" /></a>
      </div>
    </div>
  );
}
