'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { PageWrapper } from '@/components/dashboard/layout';
import { Button, Input, Badge, Alert } from '@/components/ui';
import {
  Settings,
  User,
  Shield,
  Bell,
  CreditCard,
  Database,
  Key,
  Users,
  Globe,
  Clock,
  AlertTriangle,
  CheckCircle,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Mail,
  Phone,
  MapPin,
  Wallet,
  Percent,
  Timer,
  Lock,
  Smartphone,
  MessageSquare,
  X,
  UserPlus,
  Trash2,
  Send,
} from 'lucide-react';
import type { AdminRole } from '@/types';

// ============================================
// SETTINGS TABS
// ============================================

type SettingsTab = 
  | 'profile' 
  | 'platform' 
  | 'validation' 
  | 'fraud' 
  | 'payouts' 
  | 'notifications' 
  | 'api' 
  | 'team';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  description: string;
  requiredRole: AdminRole[];
}

const TABS: TabConfig[] = [
  { 
    id: 'profile', 
    label: 'Profile', 
    icon: User, 
    description: 'Your account settings',
    requiredRole: ['super_admin', 'admin', 'supervisor', 'analyst', 'viewer'],
  },
  { 
    id: 'platform', 
    label: 'Platform', 
    icon: Globe, 
    description: 'General platform settings',
    requiredRole: ['super_admin', 'admin'],
  },
  { 
    id: 'validation', 
    label: 'Validation', 
    icon: CheckCircle, 
    description: 'Submission & validation rules',
    requiredRole: ['super_admin', 'admin'],
  },
  { 
    id: 'fraud', 
    label: 'Fraud Detection', 
    icon: Shield, 
    description: 'Fraud thresholds & actions',
    requiredRole: ['super_admin', 'admin'],
  },
  { 
    id: 'payouts', 
    label: 'Payouts', 
    icon: Wallet, 
    description: 'Payment configuration',
    requiredRole: ['super_admin', 'admin'],
  },
  { 
    id: 'notifications', 
    label: 'Notifications', 
    icon: Bell, 
    description: 'Alert preferences',
    requiredRole: ['super_admin', 'admin', 'supervisor'],
  },
  { 
    id: 'api', 
    label: 'API Keys', 
    icon: Key, 
    description: 'Integration credentials',
    requiredRole: ['super_admin'],
  },
  { 
    id: 'team', 
    label: 'Team', 
    icon: Users, 
    description: 'Manage admin users',
    requiredRole: ['super_admin'],
  },
];

// ============================================
// TYPES
// ============================================

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  lastLogin: Date;
}

// ============================================
// MOCK SETTINGS DATA
// ============================================

const mockSettings = {
  platform: {
    platformName: 'NaijaMarket Intel',
    tagline: 'The Bloomberg of Nigerian Commodities',
    supportEmail: 'support@naijamarket.ng',
    supportPhone: '+234 800 123 4567',
    maintenanceMode: false,
    registrationOpen: true,
    defaultLanguage: 'en',
    timezone: 'Africa/Lagos',
  },
  validation: {
    validatorsPerSubmission: 3,
    consensusThreshold: 2,
    validationTimeoutMinutes: 30,
    instantApprovalThreshold: 80,
    maxSubmissionsPerDay: 8,
    maxSubmissionsPerHour: 2,
    gpsRadiusMeters: 500,
    priceDeviationThreshold: 30,
  },
  fraud: {
    gpsSpoffingEnabled: true,
    priceManipulationEnabled: true,
    collusionDetectionEnabled: true,
    rapidSubmissionEnabled: true,
    autoSuspendOnCritical: true,
    collusionWindowDays: 7,
    maxValidatorTraderInteractions: 5,
    suspiciousGpsThreshold: 10,
  },
  payouts: {
    minimumPayoutBalance: 500,
    payoutDay: 'friday',
    payoutTime: '18:00',
    traderRewardAmount: 20,
    validatorRewardAmount: 50,
    maxRetryAttempts: 3,
    vtpassEnabled: true,
    flutterwaveEnabled: false,
  },
  notifications: {
    emailAlertsEnabled: true,
    fraudAlertEmail: true,
    payoutFailureEmail: true,
    dailyReportEmail: true,
    weeklyReportEmail: true,
    slackIntegration: false,
    slackWebhook: '',
  },
  api: {
    twilioAccountSid: 'AC************************',
    twilioAuthToken: '********************************',
    vtpassApiKey: '********************************',
    vtpassSecretKey: '********************************',
    flutterwavePublicKey: '********************************',
    flutterwaveSecretKey: '********************************',
  },
};

const initialTeamMembers: TeamMember[] = [
  { id: '1', name: 'Olawale Sobogungodo', email: 'olawale.sobogungodo@giggabytes.eu', role: 'super_admin', status: 'active', lastLogin: new Date() },
  { id: '2', name: 'Admin User', email: 'admin@naijamarket.ng', role: 'admin', status: 'active', lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  { id: '3', name: 'Supervisor User', email: 'supervisor@naijamarket.ng', role: 'supervisor', status: 'active', lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  { id: '4', name: 'Analyst User', email: 'analyst@naijamarket.ng', role: 'analyst', status: 'inactive', lastLogin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
];

// ============================================
// SETTINGS PAGE COMPONENT
// ============================================

export default function SettingsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: AdminRole })?.role || 'viewer';
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialTeamMembers);

  // Filter tabs based on user role
  const availableTabs = TABS.filter(tab => tab.requiredRole.includes(userRole));

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSaving(false);
    setSaveSuccess(true);
    
    // Clear success message after 3 seconds
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const toggleApiKeyVisibility = (key: string) => {
    setShowApiKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleUpdateMember = (updatedMember: TeamMember) => {
    setTeamMembers(prev => 
      prev.map(m => m.id === updatedMember.id ? updatedMember : m)
    );
  };

  const handleDeleteMember = (memberId: string) => {
    setTeamMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const handleInviteMember = (newMember: Omit<TeamMember, 'id' | 'lastLogin'>) => {
    const member: TeamMember = {
      ...newMember,
      id: `${Date.now()}`,
      lastLogin: new Date(),
    };
    setTeamMembers(prev => [...prev, member]);
  };

  return (
    <PageWrapper
      title="Settings"
      subtitle="Configure platform settings and preferences"
      actions={
        <Button
          onClick={handleSave}
          isLoading={isSaving}
          leftIcon={Save}
        >
          Save Changes
        </Button>
      }
    >
      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {availableTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all
                    ${isActive 
                      ? 'bg-naija-green-500/20 text-naija-green-400 border border-naija-green-500/30' 
                      : 'text-dash-muted hover:text-dash-text hover:bg-dash-card'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <div>
                    <p className="font-medium text-sm">{tab.label}</p>
                    <p className="text-xs opacity-70">{tab.description}</p>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {saveSuccess && (
            <Alert variant="success" icon={CheckCircle} className="mb-6">
              Settings saved successfully!
            </Alert>
          )}

          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <ProfileSettings session={session} />
          )}

          {/* Platform Settings */}
          {activeTab === 'platform' && (
            <PlatformSettings settings={mockSettings.platform} />
          )}

          {/* Validation Settings */}
          {activeTab === 'validation' && (
            <ValidationSettings settings={mockSettings.validation} />
          )}

          {/* Fraud Detection Settings */}
          {activeTab === 'fraud' && (
            <FraudSettings settings={mockSettings.fraud} />
          )}

          {/* Payout Settings */}
          {activeTab === 'payouts' && (
            <PayoutSettings settings={mockSettings.payouts} />
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <NotificationSettings settings={mockSettings.notifications} />
          )}

          {/* API Keys */}
          {activeTab === 'api' && (
            <ApiKeysSettings 
              settings={mockSettings.api} 
              showKeys={showApiKeys}
              onToggleKey={toggleApiKeyVisibility}
            />
          )}

          {/* Team Management */}
          {activeTab === 'team' && (
            <TeamSettings 
              members={teamMembers}
              onUpdateMember={handleUpdateMember}
              onDeleteMember={handleDeleteMember}
              onInviteMember={handleInviteMember}
            />
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

// ============================================
// MODAL COMPONENT
// ============================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-dash-card border border-dash-border rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dash-border">
          <h2 className="text-lg font-semibold text-dash-text">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-dash-hover text-dash-muted hover:text-dash-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================
// EDIT MEMBER MODAL
// ============================================

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: TeamMember | null;
  onSave: (member: TeamMember) => void;
  onDelete: (memberId: string) => void;
}

function EditMemberModal({ isOpen, onClose, member, onSave, onDelete }: EditMemberModalProps) {
  const [name, setName] = useState(member?.name || '');
  const [email, setEmail] = useState(member?.email || '');
  const [role, setRole] = useState(member?.role || 'viewer');
  const [status, setStatus] = useState<'active' | 'inactive'>(member?.status || 'active');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset form when member changes
  React.useEffect(() => {
    if (member) {
      setName(member.name);
      setEmail(member.email);
      setRole(member.role);
      setStatus(member.status);
    }
  }, [member]);

  const handleSave = async () => {
    if (!member) return;
    
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onSave({
      ...member,
      name,
      email,
      role,
      status,
    });
    
    setIsSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!member) return;
    
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onDelete(member.id);
    setIsSaving(false);
    setShowDeleteConfirm(false);
    onClose();
  };

  if (!member) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Team Member">
      {showDeleteConfirm ? (
        <div className="space-y-4">
          <Alert variant="danger" icon={AlertTriangle}>
            Are you sure you want to remove <strong>{member.name}</strong> from the team? This action cannot be undone.
          </Alert>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={isSaving}
              leftIcon={Trash2}
              className="flex-1"
            >
              Remove Member
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            leftIcon={User}
            placeholder="Enter full name"
          />
          
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={Mail}
            placeholder="Enter email address"
          />
          
          <div>
            <label className="block text-sm font-medium text-dash-muted mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-dash-bg border border-dash-border rounded-lg px-4 py-2.5 text-dash-text"
            >
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="supervisor">Supervisor</option>
              <option value="analyst">Analyst</option>
              <option value="viewer">Viewer</option>
            </select>
            <p className="mt-1 text-xs text-dash-muted">
              {role === 'super_admin' && 'Full access to all settings and features'}
              {role === 'admin' && 'Can manage users and approve payouts'}
              {role === 'supervisor' && 'Can take actions on fraud alerts'}
              {role === 'analyst' && 'View-only access to dashboards and reports'}
              {role === 'viewer' && 'Basic dashboard access only'}
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-dash-muted mb-2">Status</label>
            <div className="flex gap-3">
              <button
                onClick={() => setStatus('active')}
                className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                  status === 'active'
                    ? 'bg-status-success/20 border-status-success text-status-success'
                    : 'border-dash-border text-dash-muted hover:border-dash-hover'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatus('inactive')}
                className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                  status === 'inactive'
                    ? 'bg-status-danger/20 border-status-danger text-status-danger'
                    : 'border-dash-border text-dash-muted hover:border-dash-hover'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-dash-border flex gap-3">
            <Button
              variant="danger"
              onClick={() => setShowDeleteConfirm(true)}
              leftIcon={Trash2}
            >
              Remove
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              isLoading={isSaving}
              leftIcon={Save}
              disabled={!name || !email}
            >
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ============================================
// INVITE MEMBER MODAL
// ============================================

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (member: Omit<TeamMember, 'id' | 'lastLogin'>) => void;
}

function InviteMemberModal({ isOpen, onClose, onInvite }: InviteMemberModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('analyst');
  const [isSending, setIsSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  const handleInvite = async () => {
    setIsSending(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    onInvite({
      name,
      email,
      role,
      status: 'active',
    });
    
    setIsSending(false);
    setInviteSent(true);
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setRole('analyst');
    setInviteSent(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Invite Team Member">
      {inviteSent ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-status-success/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-status-success" />
          </div>
          <h3 className="text-lg font-semibold text-dash-text mb-2">Invitation Sent!</h3>
          <p className="text-dash-muted mb-6">
            An invitation email has been sent to <strong className="text-dash-text">{email}</strong>
          </p>
          <Button onClick={handleClose}>
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            leftIcon={User}
            placeholder="Enter full name"
          />
          
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={Mail}
            placeholder="Enter email address"
          />
          
          <div>
            <label className="block text-sm font-medium text-dash-muted mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-dash-bg border border-dash-border rounded-lg px-4 py-2.5 text-dash-text"
            >
              <option value="admin">Admin</option>
              <option value="supervisor">Supervisor</option>
              <option value="analyst">Analyst</option>
              <option value="viewer">Viewer</option>
            </select>
            <p className="mt-1 text-xs text-dash-muted">
              {role === 'admin' && 'Can manage users and approve payouts'}
              {role === 'supervisor' && 'Can take actions on fraud alerts'}
              {role === 'analyst' && 'View-only access to dashboards and reports'}
              {role === 'viewer' && 'Basic dashboard access only'}
            </p>
          </div>

          <Alert variant="info" icon={Mail}>
            An email will be sent with instructions to set up their account.
          </Alert>

          <div className="pt-4 flex gap-3">
            <Button variant="secondary" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              isLoading={isSending}
              leftIcon={Send}
              disabled={!name || !email}
              className="flex-1"
            >
              Send Invitation
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ============================================
// PROFILE SETTINGS
// ============================================

interface SessionData {
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
}

function ProfileSettings({ session }: { session: SessionData | null }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  return (
    <div className="space-y-6">
      <SettingsSection title="Account Information" icon={User}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            defaultValue={session?.user?.name || ''}
            leftIcon={User}
          />
          <Input
            label="Email Address"
            defaultValue={session?.user?.email || ''}
            leftIcon={Mail}
            disabled
          />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-dash-text mb-2">Role</label>
          <Badge variant="info" className="text-sm">
            {(session?.user?.role || 'viewer').replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </SettingsSection>

      <SettingsSection title="Change Password" icon={Lock}>
        <div className="space-y-4 max-w-md">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            leftIcon={Lock}
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            leftIcon={Key}
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftIcon={Key}
            error={confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match' : undefined}
          />
          <Button variant="secondary" disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}>
            Update Password
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Two-Factor Authentication" icon={Smartphone}>
        <div className="flex items-center justify-between p-4 bg-dash-bg rounded-lg border border-dash-border">
          <div>
            <p className="font-medium text-dash-text">2FA Status</p>
            <p className="text-sm text-dash-muted">Add an extra layer of security to your account</p>
          </div>
          <Badge variant="warning">Not Enabled</Badge>
        </div>
        <Button variant="secondary" className="mt-4" leftIcon={Shield}>
          Enable 2FA
        </Button>
      </SettingsSection>
    </div>
  );
}

// ============================================
// PLATFORM SETTINGS
// ============================================

function PlatformSettings({ settings }: { settings: typeof mockSettings.platform }) {
  return (
    <div className="space-y-6">
      <SettingsSection title="General" icon={Globe}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Platform Name"
            defaultValue={settings.platformName}
            leftIcon={Globe}
          />
          <Input
            label="Tagline"
            defaultValue={settings.tagline}
          />
          <Input
            label="Support Email"
            type="email"
            defaultValue={settings.supportEmail}
            leftIcon={Mail}
          />
          <Input
            label="Support Phone"
            defaultValue={settings.supportPhone}
            leftIcon={Phone}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Localization" icon={MapPin}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-dash-text mb-2">Default Language</label>
            <select className="w-full bg-dash-bg border border-dash-border rounded-lg px-4 py-2.5 text-dash-text">
              <option value="en">English</option>
              <option value="pcm">Pidgin English</option>
              <option value="yo">Yoruba</option>
              <option value="ig">Igbo</option>
              <option value="ha">Hausa</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dash-text mb-2">Timezone</label>
            <select className="w-full bg-dash-bg border border-dash-border rounded-lg px-4 py-2.5 text-dash-text">
              <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="System Status" icon={Settings}>
        <div className="space-y-4">
          <ToggleSetting
            label="Maintenance Mode"
            description="Temporarily disable the platform for maintenance"
            defaultChecked={settings.maintenanceMode}
            variant="danger"
          />
          <ToggleSetting
            label="Registration Open"
            description="Allow new traders and validators to register"
            defaultChecked={settings.registrationOpen}
          />
        </div>
      </SettingsSection>
    </div>
  );
}

// ============================================
// VALIDATION SETTINGS
// ============================================

function ValidationSettings({ settings }: { settings: typeof mockSettings.validation }) {
  return (
    <div className="space-y-6">
      <SettingsSection title="Validation Rules" icon={CheckCircle}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Validators Per Submission"
            type="number"
            defaultValue={settings.validatorsPerSubmission}
            min={1}
            max={10}
          />
          <Input
            label="Consensus Threshold"
            type="number"
            defaultValue={settings.consensusThreshold}
            min={1}
            max={10}
          />
          <Input
            label="Validation Timeout (minutes)"
            type="number"
            defaultValue={settings.validationTimeoutMinutes}
            leftIcon={Timer}
          />
          <Input
            label="Instant Approval Threshold"
            type="number"
            defaultValue={settings.instantApprovalThreshold}
            leftIcon={Percent}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Rate Limits" icon={Clock}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Max Submissions Per Day"
            type="number"
            defaultValue={settings.maxSubmissionsPerDay}
          />
          <Input
            label="Max Submissions Per Hour"
            type="number"
            defaultValue={settings.maxSubmissionsPerHour}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="GPS & Price Validation" icon={MapPin}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="GPS Radius (meters)"
            type="number"
            defaultValue={settings.gpsRadiusMeters}
            leftIcon={MapPin}
          />
          <Input
            label="Price Deviation Threshold (%)"
            type="number"
            defaultValue={settings.priceDeviationThreshold}
            leftIcon={Percent}
          />
        </div>
      </SettingsSection>
    </div>
  );
}

// ============================================
// FRAUD SETTINGS
// ============================================

function FraudSettings({ settings }: { settings: typeof mockSettings.fraud }) {
  return (
    <div className="space-y-6">
      <Alert variant="warning" icon={AlertTriangle}>
        Fraud detection settings affect platform security. Changes take effect immediately.
      </Alert>

      <SettingsSection title="Detection Modules" icon={Shield}>
        <div className="space-y-4">
          <ToggleSetting
            label="GPS Spoofing Detection"
            description="Detect fake GPS coordinates and impossible travel patterns"
            defaultChecked={settings.gpsSpoffingEnabled}
          />
          <ToggleSetting
            label="Price Manipulation Detection"
            description="Flag prices significantly outside market baseline"
            defaultChecked={settings.priceManipulationEnabled}
          />
          <ToggleSetting
            label="Collusion Detection"
            description="Identify suspicious validator-trader patterns"
            defaultChecked={settings.collusionDetectionEnabled}
          />
          <ToggleSetting
            label="Rapid Submission Detection"
            description="Flag users exceeding submission rate limits"
            defaultChecked={settings.rapidSubmissionEnabled}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Automatic Actions" icon={AlertTriangle}>
        <div className="space-y-4">
          <ToggleSetting
            label="Auto-Suspend on Critical Alert"
            description="Automatically suspend users with critical fraud alerts"
            defaultChecked={settings.autoSuspendOnCritical}
            variant="danger"
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Thresholds" icon={Settings}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Collusion Window (days)"
            type="number"
            defaultValue={settings.collusionWindowDays}
          />
          <Input
            label="Max Validator-Trader Interactions"
            type="number"
            defaultValue={settings.maxValidatorTraderInteractions}
          />
          <Input
            label="Suspicious GPS Threshold"
            type="number"
            defaultValue={settings.suspiciousGpsThreshold}
          />
        </div>
      </SettingsSection>
    </div>
  );
}

// ============================================
// PAYOUT SETTINGS
// ============================================

function PayoutSettings({ settings }: { settings: typeof mockSettings.payouts }) {
  return (
    <div className="space-y-6">
      <SettingsSection title="Reward Amounts" icon={Wallet}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Trader Reward (₦)"
            type="number"
            defaultValue={settings.traderRewardAmount}
          />
          <Input
            label="Validator Reward (₦)"
            type="number"
            defaultValue={settings.validatorRewardAmount}
          />
          <Input
            label="Minimum Payout Balance (₦)"
            type="number"
            defaultValue={settings.minimumPayoutBalance}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Payout Schedule" icon={Clock}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-dash-text mb-2">Payout Day</label>
            <select 
              className="w-full bg-dash-bg border border-dash-border rounded-lg px-4 py-2.5 text-dash-text"
              defaultValue={settings.payoutDay}
            >
              <option value="monday">Monday</option>
              <option value="tuesday">Tuesday</option>
              <option value="wednesday">Wednesday</option>
              <option value="thursday">Thursday</option>
              <option value="friday">Friday</option>
              <option value="saturday">Saturday</option>
              <option value="sunday">Sunday</option>
            </select>
          </div>
          <Input
            label="Payout Time"
            type="time"
            defaultValue={settings.payoutTime}
          />
          <Input
            label="Max Retry Attempts"
            type="number"
            defaultValue={settings.maxRetryAttempts}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Payment Providers" icon={CreditCard}>
        <div className="space-y-4">
          <ToggleSetting
            label="VTPass (Airtime)"
            description="Primary provider for airtime distribution"
            defaultChecked={settings.vtpassEnabled}
          />
          <ToggleSetting
            label="Flutterwave (Bank Transfer)"
            description="Alternative provider for direct bank transfers"
            defaultChecked={settings.flutterwaveEnabled}
          />
        </div>
      </SettingsSection>
    </div>
  );
}

// ============================================
// NOTIFICATION SETTINGS
// ============================================

function NotificationSettings({ settings }: { settings: typeof mockSettings.notifications }) {
  return (
    <div className="space-y-6">
      <SettingsSection title="Email Notifications" icon={Mail}>
        <div className="space-y-4">
          <ToggleSetting
            label="Email Alerts"
            description="Enable email notifications"
            defaultChecked={settings.emailAlertsEnabled}
          />
          <ToggleSetting
            label="Fraud Alerts"
            description="Receive email for critical and high severity fraud alerts"
            defaultChecked={settings.fraudAlertEmail}
          />
          <ToggleSetting
            label="Payout Failures"
            description="Receive email when payout batch has failures"
            defaultChecked={settings.payoutFailureEmail}
          />
          <ToggleSetting
            label="Daily Report"
            description="Receive daily summary email at 6 AM"
            defaultChecked={settings.dailyReportEmail}
          />
          <ToggleSetting
            label="Weekly Report"
            description="Receive weekly summary email on Mondays"
            defaultChecked={settings.weeklyReportEmail}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Slack Integration" icon={MessageSquare}>
        <div className="space-y-4">
          <ToggleSetting
            label="Slack Notifications"
            description="Send alerts to a Slack channel"
            defaultChecked={settings.slackIntegration}
          />
          <Input
            label="Slack Webhook URL"
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            defaultValue={settings.slackWebhook}
            disabled={!settings.slackIntegration}
          />
        </div>
      </SettingsSection>
    </div>
  );
}

// ============================================
// API KEYS SETTINGS
// ============================================

function ApiKeysSettings({ 
  settings, 
  showKeys, 
  onToggleKey 
}: { 
  settings: typeof mockSettings.api;
  showKeys: Record<string, boolean>;
  onToggleKey: (key: string) => void;
}) {
  return (
    <div className="space-y-6">
      <Alert variant="danger" icon={AlertTriangle}>
        API keys are sensitive. Never share them publicly. Rotate keys regularly for security.
      </Alert>

      <SettingsSection title="Twilio (WhatsApp)" icon={MessageSquare}>
        <div className="space-y-4">
          <ApiKeyInput
            label="Account SID"
            value={settings.twilioAccountSid}
            show={showKeys['twilioSid'] || false}
            onToggle={() => onToggleKey('twilioSid')}
          />
          <ApiKeyInput
            label="Auth Token"
            value={settings.twilioAuthToken}
            show={showKeys['twilioToken'] || false}
            onToggle={() => onToggleKey('twilioToken')}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="VTPass (Airtime)" icon={Smartphone}>
        <div className="space-y-4">
          <ApiKeyInput
            label="API Key"
            value={settings.vtpassApiKey}
            show={showKeys['vtpassApi'] || false}
            onToggle={() => onToggleKey('vtpassApi')}
          />
          <ApiKeyInput
            label="Secret Key"
            value={settings.vtpassSecretKey}
            show={showKeys['vtpassSecret'] || false}
            onToggle={() => onToggleKey('vtpassSecret')}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Flutterwave (Payments)" icon={CreditCard}>
        <div className="space-y-4">
          <ApiKeyInput
            label="Public Key"
            value={settings.flutterwavePublicKey}
            show={showKeys['flutterwavePublic'] || false}
            onToggle={() => onToggleKey('flutterwavePublic')}
          />
          <ApiKeyInput
            label="Secret Key"
            value={settings.flutterwaveSecretKey}
            show={showKeys['flutterwaveSecret'] || false}
            onToggle={() => onToggleKey('flutterwaveSecret')}
          />
        </div>
      </SettingsSection>

      <div className="flex gap-4">
        <Button variant="secondary" leftIcon={RefreshCw}>
          Rotate All Keys
        </Button>
        <Button variant="secondary" leftIcon={Database}>
          Export Backup
        </Button>
      </div>
    </div>
  );
}

// ============================================
// TEAM SETTINGS
// ============================================

interface TeamSettingsProps {
  members: TeamMember[];
  onUpdateMember: (member: TeamMember) => void;
  onDeleteMember: (memberId: string) => void;
  onInviteMember: (member: Omit<TeamMember, 'id' | 'lastLogin'>) => void;
}

function TeamSettings({ members, onUpdateMember, onDeleteMember, onInviteMember }: TeamSettingsProps) {
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const formatLastLogin = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-dash-text">Team Members</h3>
          <p className="text-sm text-dash-muted">Manage admin access to the dashboard</p>
        </div>
        <Button leftIcon={UserPlus} onClick={() => setIsInviteModalOpen(true)}>
          Invite Member
        </Button>
      </div>

      <div className="space-y-3">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-4 bg-dash-card border border-dash-border rounded-lg hover:border-dash-hover transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-naija-green-500/20 flex items-center justify-center">
                <span className="text-naija-green-400 font-semibold">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div>
                <p className="font-medium text-dash-text">{member.name}</p>
                <p className="text-sm text-dash-muted">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-sm text-dash-muted hidden md:block">
                <p>Last login</p>
                <p>{formatLastLogin(member.lastLogin)}</p>
              </div>
              <Badge variant={member.status === 'active' ? 'success' : 'default'}>
                {member.status}
              </Badge>
              <Badge variant="info">
                {member.role.replace('_', ' ')}
              </Badge>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setEditingMember(member)}
              >
                Edit
              </Button>
            </div>
          </div>
        ))}
      </div>

      <SettingsSection title="Role Permissions" icon={Shield}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dash-border">
                <th className="text-left py-3 px-4 text-dash-muted font-medium">Permission</th>
                <th className="text-center py-3 px-4 text-dash-muted font-medium">Super Admin</th>
                <th className="text-center py-3 px-4 text-dash-muted font-medium">Admin</th>
                <th className="text-center py-3 px-4 text-dash-muted font-medium">Supervisor</th>
                <th className="text-center py-3 px-4 text-dash-muted font-medium">Analyst</th>
                <th className="text-center py-3 px-4 text-dash-muted font-medium">Viewer</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'View Dashboard', perms: [true, true, true, true, true] },
                { name: 'View Fraud Alerts', perms: [true, true, true, true, false] },
                { name: 'Take Actions', perms: [true, true, true, false, false] },
                { name: 'Manage Users', perms: [true, true, false, false, false] },
                { name: 'Approve Payouts', perms: [true, true, false, false, false] },
                { name: 'View Financials', perms: [true, true, true, true, false] },
                { name: 'Export Data', perms: [true, true, true, true, false] },
                { name: 'Change Settings', perms: [true, false, false, false, false] },
              ].map((row) => (
                <tr key={row.name} className="border-b border-dash-border/50">
                  <td className="py-3 px-4 text-dash-text">{row.name}</td>
                  {row.perms.map((allowed, i) => (
                    <td key={i} className="text-center py-3 px-4">
                      {allowed ? (
                        <CheckCircle className="w-5 h-5 text-status-success inline" />
                      ) : (
                        <span className="text-dash-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      {/* Edit Member Modal */}
      <EditMemberModal
        isOpen={editingMember !== null}
        onClose={() => setEditingMember(null)}
        member={editingMember}
        onSave={onUpdateMember}
        onDelete={onDeleteMember}
      />

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInvite={onInviteMember}
      />
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function SettingsSection({ 
  title, 
  icon: Icon, 
  children 
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
}) {
  return (
    <div className="dash-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-naija-green-500/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-naija-green-400" />
        </div>
        <h3 className="font-semibold text-dash-text">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  defaultChecked = false,
  variant = 'default',
}: {
  label: string;
  description: string;
  defaultChecked?: boolean;
  variant?: 'default' | 'danger';
}) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="flex items-center justify-between p-4 bg-dash-bg rounded-lg border border-dash-border">
      <div>
        <p className="font-medium text-dash-text">{label}</p>
        <p className="text-sm text-dash-muted">{description}</p>
      </div>
      <button
        onClick={() => setChecked(!checked)}
        className={`
          relative w-12 h-6 rounded-full transition-colors
          ${checked 
            ? variant === 'danger' ? 'bg-status-danger' : 'bg-naija-green-500' 
            : 'bg-dash-border'
          }
        `}
      >
        <span
          className={`
            absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
            ${checked ? 'translate-x-7' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
}

function ApiKeyInput({
  label,
  value,
  show,
  onToggle,
}: {
  label: string;
  value: string;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-dash-text mb-2">{label}</label>
      <div className="flex gap-2">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          readOnly
          className="flex-1 bg-dash-bg border border-dash-border rounded-lg px-4 py-2.5 text-dash-text font-mono text-sm"
        />
        <Button variant="ghost" onClick={onToggle}>
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </Button>
        <Button variant="ghost">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
