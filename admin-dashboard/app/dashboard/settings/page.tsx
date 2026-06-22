'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { PageWrapper } from '@/components/dashboard/layout';
import { Button, Input, Badge, Alert } from '@/components/ui';
import {
  Settings,
  User,
  Shield,
  Bell,
  CreditCard,
  Key,
  Users,
  Globe,
  Clock,
  AlertTriangle,
  CheckCircle,
  Save,
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
    gpsSpoofingEnabled: true,
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
    paystackPublicKey: '',
    paystackSecretKey: '********************************',
    vtpassApiKey: '********************************',
    vtpassSecretKey: '********************************',
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialTeamMembers);

  // Settings now live in state (seeded with defaults, hydrated from /api/config).
  const [settings, setSettings] = useState(mockSettings);

  // Sections persisted to Admin_Config this phase.
  const PERSISTED_TABS: SettingsTab[] = ['platform', 'validation', 'payouts', 'fraud', 'notifications', 'api'];

  // Filter tabs based on user role
  const availableTabs = TABS.filter(tab => tab.requiredRole.includes(userRole));

  // Hydrate persisted sections from the backend on mount; keep defaults on failure.
  useEffect(() => {
    let active = true;
    fetch('/api/config')
      .then((r) => r.json())
      .then((json) => {
        if (active && json?.success && json.data) {
          setSettings((prev) => ({
            ...prev,
            platform: { ...prev.platform, ...(json.data.platform || {}) },
            validation: { ...prev.validation, ...(json.data.validation || {}) },
            payouts: { ...prev.payouts, ...(json.data.payouts || {}) },
            fraud: { ...prev.fraud, ...(json.data.fraud || {}) },
            notifications: { ...prev.notifications, ...(json.data.notifications || {}) },
            api: { ...prev.api, ...(json.data.api || {}) },
          }));
        }
      })
      .catch(() => { /* keep defaults */ });
    return () => { active = false; };
  }, []);

  const updateSetting = (section: SettingsTab, key: string, value: unknown) => {
    setSettings((prev) => ({
      ...prev,
      [section]: { ...(prev as Record<string, Record<string, unknown>>)[section], [key]: value },
    }));
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);

    if (!PERSISTED_TABS.includes(activeTab)) {
      setSaveError('Saving is not enabled for this tab yet.');
      return;
    }

    setIsSaving(true);
    try {
      const sectionData = (settings as Record<string, Record<string, unknown>>)[activeTab];
      // API secrets are write-only: never re-persist the masked sentinel ('****'
      // would overwrite the real encrypted key), the empty display-only public key,
      // so only freshly-entered values are saved.
      const entries =
        activeTab === 'api'
          ? Object.entries(sectionData).filter(
              ([k, v]) => k !== 'paystackPublicKey' && v !== '****' && v !== ''
            )
          : Object.entries(sectionData);
      if (entries.length === 0) {
        setSaveError('No API key changes to save. Click “Edit” on a field to enter a new value.');
        return;
      }
      const adminEmail = (session?.user as { email?: string })?.email;
      const results = await Promise.all(
        entries.map(([key_name, value]) =>
          fetch('/api/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section: activeTab, key_name, value, adminEmail }),
          }).then((r) => r.json())
        )
      );
      const failed = results.find((r) => !r?.success);
      if (failed) {
        setSaveError(failed.error || 'Failed to save some settings.');
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      setSaveError('Network error while saving.');
    } finally {
      setIsSaving(false);
    }
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
        activeTab === 'api' ? null : (
          <Button
            onClick={handleSave}
            isLoading={isSaving}
            leftIcon={Save}
          >
            Save Changes
          </Button>
        )
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

          {saveError && (
            <Alert variant="danger" icon={AlertTriangle} className="mb-6">
              {saveError}
            </Alert>
          )}

          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <ProfileSettings session={session} />
          )}

          {/* Platform Settings */}
          {activeTab === 'platform' && (
            <PlatformSettings
              settings={settings.platform}
              onChange={(key, value) => updateSetting('platform', key, value)}
            />
          )}

          {/* Validation Settings */}
          {activeTab === 'validation' && (
            <ValidationSettings
              settings={settings.validation}
              onChange={(key, value) => updateSetting('validation', key, value)}
            />
          )}

          {/* Fraud Detection Settings */}
          {activeTab === 'fraud' && (
            <FraudSettings
              settings={settings.fraud}
              onChange={(key, value) => updateSetting('fraud', key, value)}
            />
          )}

          {/* Payout Settings */}
          {activeTab === 'payouts' && (
            <PayoutSettings
              settings={settings.payouts}
              onChange={(key, value) => updateSetting('payouts', key, value)}
            />
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <NotificationSettings
              settings={settings.notifications}
              onChange={(key, value) => updateSetting('notifications', key, value)}
            />
          )}

          {/* API Keys */}
          {activeTab === 'api' && (
            <ApiKeysSettings
              settings={settings.api}
              onChange={(key, value) => updateSetting('api', key, value)}
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
    try {
      const resp = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        alert(data.error || 'Failed to send invitation. Please try again.');
        setIsSending(false);
        return;
      }
      onInvite({ name, email, role, status: 'active' });
      setInviteSent(true);
    } catch {
      alert('Network error. Please check your connection and try again.');
    } finally {
      setIsSending(false);
    }
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
        <div className="mt-4 flex items-center gap-3">
          <Button variant="secondary" leftIcon={Shield} disabled>
            Enable 2FA
          </Button>
          <Badge variant="info">Coming Soon</Badge>
        </div>
      </SettingsSection>
    </div>
  );
}

// ============================================
// PLATFORM SETTINGS
// ============================================

function PlatformSettings({ settings, onChange }: { settings: typeof mockSettings.platform; onChange: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-6">
      <SettingsSection title="General" icon={Globe}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Platform Name"
            value={settings.platformName}
            onChange={(e) => onChange('platformName', e.target.value)}
            leftIcon={Globe}
          />
          <Input
            label="Tagline"
            value={settings.tagline}
            onChange={(e) => onChange('tagline', e.target.value)}
          />
          <Input
            label="Support Email"
            type="email"
            value={settings.supportEmail}
            onChange={(e) => onChange('supportEmail', e.target.value)}
            leftIcon={Mail}
          />
          <Input
            label="Support Phone"
            value={settings.supportPhone}
            onChange={(e) => onChange('supportPhone', e.target.value)}
            leftIcon={Phone}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Localization" icon={MapPin}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-dash-text mb-2">Default Language</label>
            <select
              className="w-full bg-dash-bg border border-dash-border rounded-lg px-4 py-2.5 text-dash-text"
              value={settings.defaultLanguage}
              onChange={(e) => onChange('defaultLanguage', e.target.value)}
            >
              <option value="en">English</option>
              <option value="pcm">Pidgin English</option>
              <option value="yo">Yoruba</option>
              <option value="ig">Igbo</option>
              <option value="ha">Hausa</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dash-text mb-2">Timezone</label>
            <select
              className="w-full bg-dash-bg border border-dash-border rounded-lg px-4 py-2.5 text-dash-text"
              value={settings.timezone}
              onChange={(e) => onChange('timezone', e.target.value)}
            >
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
            checked={settings.maintenanceMode}
            onChange={(v) => onChange('maintenanceMode', v)}
            variant="danger"
          />
          <ToggleSetting
            label="Registration Open"
            description="Allow new traders and validators to register"
            checked={settings.registrationOpen}
            onChange={(v) => onChange('registrationOpen', v)}
          />
        </div>
      </SettingsSection>
    </div>
  );
}

// ============================================
// VALIDATION SETTINGS
// ============================================

function ValidationSettings({ settings, onChange }: { settings: typeof mockSettings.validation; onChange: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-6">
      <SettingsSection title="Validation Rules" icon={CheckCircle}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Validators Per Submission"
            type="number"
            value={settings.validatorsPerSubmission}
            onChange={(e) => onChange('validatorsPerSubmission', Number(e.target.value))}
            min={1}
            max={10}
          />
          <Input
            label="Consensus Threshold"
            type="number"
            value={settings.consensusThreshold}
            onChange={(e) => onChange('consensusThreshold', Number(e.target.value))}
            min={1}
            max={10}
          />
          <Input
            label="Validation Timeout (minutes)"
            type="number"
            value={settings.validationTimeoutMinutes}
            onChange={(e) => onChange('validationTimeoutMinutes', Number(e.target.value))}
            leftIcon={Timer}
          />
          <Input
            label="Instant Approval Threshold"
            type="number"
            value={settings.instantApprovalThreshold}
            onChange={(e) => onChange('instantApprovalThreshold', Number(e.target.value))}
            leftIcon={Percent}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Rate Limits" icon={Clock}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Max Submissions Per Day"
            type="number"
            value={settings.maxSubmissionsPerDay}
            onChange={(e) => onChange('maxSubmissionsPerDay', Number(e.target.value))}
          />
          <Input
            label="Max Submissions Per Hour"
            type="number"
            value={settings.maxSubmissionsPerHour}
            onChange={(e) => onChange('maxSubmissionsPerHour', Number(e.target.value))}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="GPS & Price Validation" icon={MapPin}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="GPS Radius (meters)"
            type="number"
            value={settings.gpsRadiusMeters}
            onChange={(e) => onChange('gpsRadiusMeters', Number(e.target.value))}
            leftIcon={MapPin}
          />
          <Input
            label="Price Deviation Threshold (%)"
            type="number"
            value={settings.priceDeviationThreshold}
            onChange={(e) => onChange('priceDeviationThreshold', Number(e.target.value))}
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

function FraudSettings({ settings, onChange }: { settings: typeof mockSettings.fraud; onChange: (key: string, value: unknown) => void }) {
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
            checked={settings.gpsSpoofingEnabled}
            onChange={(v) => onChange('gpsSpoofingEnabled', v)}
          />
          <ToggleSetting
            label="Price Manipulation Detection"
            description="Flag prices significantly outside market baseline"
            checked={settings.priceManipulationEnabled}
            onChange={(v) => onChange('priceManipulationEnabled', v)}
          />
          <ToggleSetting
            label="Collusion Detection"
            description="Identify suspicious validator-trader patterns"
            checked={settings.collusionDetectionEnabled}
            onChange={(v) => onChange('collusionDetectionEnabled', v)}
          />
          <ToggleSetting
            label="Rapid Submission Detection"
            description="Flag users exceeding submission rate limits"
            checked={settings.rapidSubmissionEnabled}
            onChange={(v) => onChange('rapidSubmissionEnabled', v)}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Automatic Actions" icon={AlertTriangle}>
        <div className="space-y-4">
          <ToggleSetting
            label="Auto-Suspend on Critical Alert"
            description="Automatically suspend users with critical fraud alerts"
            checked={settings.autoSuspendOnCritical}
            onChange={(v) => onChange('autoSuspendOnCritical', v)}
            variant="danger"
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Thresholds" icon={Settings}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Collusion Window (days)"
            type="number"
            value={settings.collusionWindowDays}
            onChange={(e) => onChange('collusionWindowDays', Number(e.target.value))}
          />
          <Input
            label="Max Validator-Trader Interactions"
            type="number"
            value={settings.maxValidatorTraderInteractions}
            onChange={(e) => onChange('maxValidatorTraderInteractions', Number(e.target.value))}
          />
          <Input
            label="Suspicious GPS Threshold"
            type="number"
            value={settings.suspiciousGpsThreshold}
            onChange={(e) => onChange('suspiciousGpsThreshold', Number(e.target.value))}
          />
        </div>
      </SettingsSection>
    </div>
  );
}

// ============================================
// PAYOUT SETTINGS
// ============================================

function PayoutSettings({ settings, onChange }: { settings: typeof mockSettings.payouts; onChange: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-6">
      <SettingsSection title="Reward Amounts" icon={Wallet}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Trader Reward (₦)"
            type="number"
            value={settings.traderRewardAmount}
            onChange={(e) => onChange('traderRewardAmount', Number(e.target.value))}
          />
          <Input
            label="Validator Reward (₦)"
            type="number"
            value={settings.validatorRewardAmount}
            onChange={(e) => onChange('validatorRewardAmount', Number(e.target.value))}
          />
          <Input
            label="Minimum Payout Balance (₦)"
            type="number"
            value={settings.minimumPayoutBalance}
            onChange={(e) => onChange('minimumPayoutBalance', Number(e.target.value))}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Payout Schedule" icon={Clock}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-dash-text mb-2">Payout Day</label>
            <select
              className="w-full bg-dash-bg border border-dash-border rounded-lg px-4 py-2.5 text-dash-text"
              value={settings.payoutDay}
              onChange={(e) => onChange('payoutDay', e.target.value)}
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
            value={settings.payoutTime}
            onChange={(e) => onChange('payoutTime', e.target.value)}
          />
          <Input
            label="Max Retry Attempts"
            type="number"
            value={settings.maxRetryAttempts}
            onChange={(e) => onChange('maxRetryAttempts', Number(e.target.value))}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Payment Providers" icon={CreditCard}>
        <div className="space-y-4">
          <ToggleSetting
            label="VTPass (Airtime)"
            description="Primary provider for airtime distribution"
            checked={settings.vtpassEnabled}
            onChange={(v) => onChange('vtpassEnabled', v)}
          />
        </div>
      </SettingsSection>
    </div>
  );
}

// ============================================
// NOTIFICATION SETTINGS
// ============================================

function NotificationSettings({ settings, onChange }: { settings: typeof mockSettings.notifications; onChange: (key: string, value: unknown) => void }) {
  return (
    <div className="space-y-6">
      <SettingsSection title="Email Notifications" icon={Mail}>
        <div className="space-y-4">
          <ToggleSetting
            label="Email Alerts"
            description="Enable email notifications"
            checked={settings.emailAlertsEnabled}
            onChange={(v) => onChange('emailAlertsEnabled', v)}
          />
          <ToggleSetting
            label="Fraud Alerts"
            description="Receive email for critical and high severity fraud alerts"
            checked={settings.fraudAlertEmail}
            onChange={(v) => onChange('fraudAlertEmail', v)}
          />
          <ToggleSetting
            label="Payout Failures"
            description="Receive email when payout batch has failures"
            checked={settings.payoutFailureEmail}
            onChange={(v) => onChange('payoutFailureEmail', v)}
          />
          <ToggleSetting
            label="Daily Report"
            description="Receive daily summary email at 6 AM"
            checked={settings.dailyReportEmail}
            onChange={(v) => onChange('dailyReportEmail', v)}
          />
          <ToggleSetting
            label="Weekly Report"
            description="Receive weekly summary email on Mondays"
            checked={settings.weeklyReportEmail}
            onChange={(v) => onChange('weeklyReportEmail', v)}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Slack Integration" icon={MessageSquare}>
        <div className="space-y-4">
          <ToggleSetting
            label="Slack Notifications"
            description="Send alerts to a Slack channel"
            checked={settings.slackIntegration}
            onChange={(v) => onChange('slackIntegration', v)}
          />
          <Input
            label="Slack Webhook URL"
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={settings.slackWebhook}
            onChange={(e) => onChange('slackWebhook', e.target.value)}
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

// Maps each api field → UI label, its Vercel env var, the owning project, and
// whether it can be edited here. paystackPublicKey is display-only (not in Vercel yet).
const API_KEY_FIELDS: {
  key: keyof typeof mockSettings.api;
  group: string;
  groupIcon: React.ElementType;
  label: string;
  envVar: string;
  project: string;
  editable: boolean;
}[] = [
  { key: 'paystackPublicKey', group: 'Paystack (Payments)', groupIcon: CreditCard, label: 'Public Key', envVar: 'PAYSTACK_PUBLIC_KEY', project: 'naijamarket-web', editable: false },
  { key: 'paystackSecretKey', group: 'Paystack (Payments)', groupIcon: CreditCard, label: 'Secret Key', envVar: 'PAYSTACK_SECRET_KEY', project: 'naijamarket-web', editable: true },
  { key: 'vtpassApiKey', group: 'VTPass (Airtime)', groupIcon: Smartphone, label: 'API Key (Public)', envVar: 'VTPASS_PUBLIC_KEY', project: 'naijamarket-admin', editable: true },
  { key: 'vtpassSecretKey', group: 'VTPass (Airtime)', groupIcon: Smartphone, label: 'Secret Key', envVar: 'VTPASS_SECRET_KEY', project: 'naijamarket-admin', editable: true },
];

function ApiKeysSettings({ settings, onChange }: { settings: typeof mockSettings.api; onChange: (key: string, value: unknown) => void }) {
  const { data: session } = useSession();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [savingField, setSavingField] = useState<string | null>(null);
  const [fieldStatus, setFieldStatus] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const startEdit = (key: string) => {
    setEditingField(key);
    setDraft('');
    setFieldStatus((s) => { const n = { ...s }; delete n[key]; return n; });
  };
  const cancelEdit = () => { setEditingField(null); setDraft(''); };

  // Self-contained per-field save: update state, persist this single key, show
  // inline status. The stored encrypted value is never read back or revealed.
  const saveEdit = async (key: string) => {
    const value = draft.trim();
    if (!value) return;
    setSavingField(key);
    setFieldStatus((s) => { const n = { ...s }; delete n[key]; return n; });
    try {
      onChange(key, value);
      const adminEmail = (session?.user as { email?: string })?.email;
      const resp = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'api', key_name: key, value, adminEmail }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) {
        setFieldStatus((s) => ({ ...s, [key]: { ok: false, msg: data?.error || 'Failed to save key.' } }));
      } else {
        setFieldStatus((s) => ({ ...s, [key]: { ok: true, msg: '✓ Key updated' } }));
        setEditingField(null);
        setDraft('');
      }
    } catch {
      setFieldStatus((s) => ({ ...s, [key]: { ok: false, msg: 'Network error while saving.' } }));
    } finally {
      setSavingField(null);
    }
  };

  const groups = Array.from(new Set(API_KEY_FIELDS.map((f) => f.group)));

  return (
    <div className="space-y-6">
      <Alert variant="danger" icon={AlertTriangle}>
        API keys are sensitive. Never share them publicly. Rotate keys regularly for security.
      </Alert>

      {groups.map((group) => {
        const fields = API_KEY_FIELDS.filter((f) => f.group === group);
        const Icon = fields[0].groupIcon;
        return (
          <SettingsSection key={group} title={group} icon={Icon}>
            <div className="space-y-4">
              {fields.map((f) => {
                const isEditing = editingField === f.key;
                const stored = settings[f.key];
                const hasValue = !!stored && stored !== '';
                const status = fieldStatus[f.key];
                return (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-dash-text mb-2">{f.label}</label>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder={`Enter new ${f.label.toLowerCase()}…`}
                          className="flex-1 bg-dash-bg border border-dash-border rounded-lg px-4 py-2.5 text-dash-text font-mono text-sm"
                        />
                        <Button onClick={() => saveEdit(f.key)} isLoading={savingField === f.key} disabled={!draft.trim()}>
                          Save
                        </Button>
                        <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={!f.editable && !hasValue ? 'Not configured' : '••••••••••••'}
                          readOnly
                          className="flex-1 bg-dash-bg border border-dash-border rounded-lg px-4 py-2.5 text-dash-muted font-mono text-sm"
                        />
                        {f.editable && (
                          <Button variant="secondary" onClick={() => startEdit(f.key)}>Edit</Button>
                        )}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-dash-muted">
                      Vercel env: <span className="font-mono">{f.envVar}</span> ({f.project})
                      {!f.editable && ' — display only, not stored here'}
                    </p>
                    {status && (
                      <p className={`mt-1 text-xs ${status.ok ? 'text-status-success' : 'text-status-danger'}`}>
                        {status.msg}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </SettingsSection>
        );
      })}

      <Alert variant="info" icon={Key}>
        Changes are stored securely. Update the corresponding Vercel environment variable to activate in production.
      </Alert>
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
  checked,
  onChange,
}: {
  label: string;
  description: string;
  defaultChecked?: boolean;
  variant?: 'default' | 'danger';
  checked?: boolean;
  onChange?: (value: boolean) => void;
}) {
  // Controlled when an onChange handler is supplied; otherwise self-managed.
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const isControlled = onChange !== undefined;
  const value = isControlled ? !!checked : internalChecked;

  const handleToggle = () => {
    if (isControlled) {
      onChange!(!value);
    } else {
      setInternalChecked((c) => !c);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-dash-bg rounded-lg border border-dash-border">
      <div>
        <p className="font-medium text-dash-text">{label}</p>
        <p className="text-sm text-dash-muted">{description}</p>
      </div>
      <button
        onClick={handleToggle}
        className={`
          relative w-12 h-6 rounded-full transition-colors
          ${value
            ? variant === 'danger' ? 'bg-status-danger' : 'bg-naija-green-500'
            : 'bg-dash-border'
          }
        `}
      >
        <span
          className={`
            absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
            ${value ? 'translate-x-7' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
}

