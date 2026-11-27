import React from 'react';
import {
  BarChart3,
  Bot,
  BrainCircuit,
  DatabaseZap,
  FileSpreadsheet,
  FileText,
  GitBranch,
  LayoutDashboard,
  MessageSquareCode,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import { useCopilot } from '../../context/CopilotContext';
import type { PageId } from '../../types';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.FC<{ className?: string }>;
  group: 'Workspace' | 'AI Agents' | 'Outputs';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Main Dashboard', icon: LayoutDashboard, group: 'Workspace' },
  { id: 'upload', label: 'Data Upload', icon: UploadCloud, group: 'Workspace' },
  { id: 'cleaning', label: 'Data Cleaning Agent', icon: Sparkles, group: 'AI Agents' },
  { id: 'sql', label: 'SQL Agent', icon: DatabaseZap, group: 'AI Agents' },
  { id: 'analytics', label: 'AI Analytics', icon: BarChart3, group: 'AI Agents' },
  { id: 'etl', label: 'ETL Pipeline Builder', icon: GitBranch, group: 'AI Agents' },
  { id: 'ml', label: 'Machine Learning Agent', icon: BrainCircuit, group: 'AI Agents' },
  { id: 'chat', label: 'AI Data Chat', icon: MessageSquareCode, group: 'Outputs' },
  { id: 'reports', label: 'Report Generator', icon: FileText, group: 'Outputs' },
];

export const Sidebar: React.FC<{
  mobileOpen: boolean;
  onCloseMobile: () => void;
}> = ({ mobileOpen, onCloseMobile }) => {
  const { currentPage, setCurrentPage, agents, activeDataset } = useCopilot();

  const groups: NavItem['group'][] = ['Workspace', 'AI Agents', 'Outputs'];

  const activeAgentsCount = agents.filter((a) => a.status === 'Processing').length;

  const content = (
    <div className="flex h-full flex-col border-r border-white/[0.07] bg-[#0b0b0e]">
      {/* Brand */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-zinc-100">DataCopilot</div>
            <div className="text-[11px] text-zinc-500">LangGraph Studio</div>
          </div>
        </div>
        <button
          onClick={onCloseMobile}
          className="rounded-lg p-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-100 lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Active Dataset Pill */}
      <div className="px-3 pt-4 pb-2">
        <div className="rounded-lg border border-white/[0.07] bg-zinc-900/60 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Active Dataset</span>
            <span className="font-mono text-[10px] text-cyan-400">{activeDataset.format}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <span className="truncate text-xs font-medium text-zinc-200">{activeDataset.name}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
            <span>{activeDataset.rowCount} rows</span>
            <span>Quality {activeDataset.quality.overallScore}%</span>
          </div>
        </div>
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {groups.map((group) => (
          <div key={group}>
            <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {group}
            </div>
            <div className="space-y-0.5">
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                const active = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentPage(item.id);
                      onCloseMobile();
                    }}
                    className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-all duration-150 ${
                      active
                        ? 'border border-cyan-500/25 bg-cyan-500/10 text-cyan-300'
                        : 'border border-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        active ? 'text-cyan-400' : 'text-zinc-500 group-hover:text-zinc-300'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Agent Monitor Summary */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-zinc-900/50 px-3 py-2">
          <div>
            <div className="text-[11px] font-medium text-zinc-300">LangGraph Runtime</div>
            <div className="text-[10px] text-zinc-500">
              {activeAgentsCount > 0 ? `${activeAgentsCount} agent running` : '6 agents ready'}
            </div>
          </div>
          <span
            className={`h-2 w-2 rounded-full ${
              activeAgentsCount > 0 ? 'animate-pulse bg-cyan-400' : 'bg-emerald-400'
            }`}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="no-print hidden w-64 shrink-0 lg:block">{content}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onCloseMobile} />
          <div className="relative z-10 h-full w-64">{content}</div>
        </div>
      )}
    </>
  );
};
