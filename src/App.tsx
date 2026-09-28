import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header, ActiveTab } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { AccessDeniedScreen } from './components/AccessDeniedScreen';
import { OverviewView } from './components/OverviewView';
import { UniversalIdLookup } from './components/UniversalIdLookup';
import { PlatformUsersView } from './components/PlatformUsersView';
import { ServersManagementView } from './components/ServersManagementView';
import { BotsManagementView } from './components/BotsManagementView';
import { CommunicationView } from './components/CommunicationView';
import { PlatformBansView } from './components/PlatformBansView';
import { PlatformReportsView } from './components/PlatformReportsView';
import { ContentModerationView } from './components/ContentModerationView';
import { AuditLogView } from './components/AuditLogView';
import { NodeDiagnosticsView } from './components/NodeDiagnosticsView';
import { SettingsModal } from './components/SettingsModal';
import { stoatApi } from './services/stoatApi';
import { Shield, Loader2 } from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { isAuthenticated, isPrivileged, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [openReportCount, setOpenReportCount] = useState<number>(0);

  // Cross-view navigation state
  const [navTargetUser, setNavTargetUser] = useState<string | undefined>();
  const [navTargetChannel, setNavTargetChannel] = useState<string | undefined>();
  const [navTargetServer, setNavTargetServer] = useState<string | undefined>();

  // Fetch count of open safety reports
  useEffect(() => {
    if (isAuthenticated && isPrivileged) {
      stoatApi.fetchPlatformReports('Open')
        .then((reports) => setOpenReportCount(reports.length))
        .catch(() => {});
    }
  }, [isAuthenticated, isPrivileged, activeTab]);

  const handleNavigateToPlatformBan = (userId: string) => {
    setNavTargetUser(userId);
    setActiveTab('bans');
  };

  const handleInspectUser = (userId: string) => {
    setNavTargetUser(userId);
    setActiveTab('users');
  };

  const handleNavigateToContent = (channelId?: string) => {
    setNavTargetChannel(channelId);
    setActiveTab('content');
  };

  const handleInspectId = (id: string) => {
    setActiveTab('lookup');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 animate-pulse">
          <Shield className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-300 font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          Verifying DawnChat Administrator Privileges (privileged: true)...
        </div>
        <p className="text-xs text-neutral-400 mt-1">Connecting to api.dawn-chat.com & MongoDB main instance</p>
      </div>
    );
  }

  // Gate 1: Not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Gate 2: Authenticated, but DOES NOT have `privileged: true` in database
  if (!isPrivileged) {
    return <AccessDeniedScreen />;
  }

  // Gate 3: Access Granted! Full privileged dashboard
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-200">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        reportCount={openReportCount}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'overview' && (
          <OverviewView setActiveTab={setActiveTab} reportCount={openReportCount} />
        )}

        {activeTab === 'users' && (
          <PlatformUsersView
            onNavigateToPlatformBan={handleNavigateToPlatformBan}
          />
        )}

        {activeTab === 'servers' && (
          <ServersManagementView
            onInspectUser={handleInspectUser}
            onNavigateToPlatformBan={handleNavigateToPlatformBan}
          />
        )}

        {activeTab === 'bots' && (
          <BotsManagementView
            onInspectUser={handleInspectUser}
            onNavigateToPlatformBan={handleNavigateToPlatformBan}
          />
        )}

        {activeTab === 'communication' && (
          <CommunicationView
            onInspectUser={handleInspectUser}
          />
        )}

        {activeTab === 'lookup' && (
          <UniversalIdLookup
            onNavigateToPlatformBan={handleNavigateToPlatformBan}
            onNavigateToContent={handleNavigateToContent}
          />
        )}

        {activeTab === 'bans' && (
          <PlatformBansView
            initialUserId={navTargetUser}
          />
        )}

        {activeTab === 'reports' && (
          <PlatformReportsView
            onBanUser={handleNavigateToPlatformBan}
            onInspectId={handleInspectId}
          />
        )}

        {activeTab === 'content' && (
          <ContentModerationView
            initialChannelId={navTargetChannel}
          />
        )}

        {activeTab === 'audit' && (
          <AuditLogView />
        )}

        {activeTab === 'node' && (
          <NodeDiagnosticsView />
        )}
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
