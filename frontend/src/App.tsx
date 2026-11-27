import React, { useState } from 'react';
import { AgentStatusStrip } from './components/agents/AgentStatusStrip';
import { Sidebar } from './components/layout/Sidebar';
import { ToastContainer } from './components/layout/ToastContainer';
import { TopHeader } from './components/layout/TopHeader';
import { CopilotProvider, useCopilot } from './context/CopilotContext';
import { AiChatPage } from './pages/AiChatPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DataCleaningPage } from './pages/DataCleaningPage';
import { DataUploadPage } from './pages/DataUploadPage';
import { EtlPipelinePage } from './pages/EtlPipelinePage';
import { MachineLearningPage } from './pages/MachineLearningPage';
import { ReportGeneratorPage } from './pages/ReportGeneratorPage';
import { SqlAgentPage } from './pages/SqlAgentPage';

const PageRouter: React.FC = () => {
  const { currentPage } = useCopilot();

  switch (currentPage) {
    case 'dashboard':
      return <DashboardPage />;
    case 'upload':
      return <DataUploadPage />;
    case 'cleaning':
      return <DataCleaningPage />;
    case 'sql':
      return <SqlAgentPage />;
    case 'analytics':
      return <AnalyticsPage />;
    case 'etl':
      return <EtlPipelinePage />;
    case 'ml':
      return <MachineLearningPage />;
    case 'chat':
      return <AiChatPage />;
    case 'reports':
      return <ReportGeneratorPage />;
    default:
      return <DashboardPage />;
  }
};

const AppShell: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#09090b] text-zinc-100">
      <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader onOpenMobile={() => setMobileMenuOpen(true)} />
        <AgentStatusStrip />
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6">
          <PageRouter />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
};

export function App() {
  return (
    <CopilotProvider>
      <AppShell />
    </CopilotProvider>
  );
}

export default App;
