import React from 'react';
import { Cpu } from 'lucide-react';
import { useCopilot } from '../../context/CopilotContext';
import type { AgentId, PageId } from '../../types';
import { AgentStatusBadge } from '../ui/Primitives';

const AGENT_TO_PAGE: Record<AgentId, PageId> = {
  cleaning: 'cleaning',
  sql: 'sql',
  analytics: 'analytics',
  etl: 'etl',
  ml: 'ml',
  report: 'reports',
};

export const AgentStatusStrip: React.FC = () => {
  const { agents, setCurrentPage } = useCopilot();

  return (
    <div className="no-print border-b border-white/[0.06] bg-[#0d0d11] px-4 py-2.5 sm:px-6">
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <div className="flex shrink-0 items-center gap-1.5 pr-2 text-[11px] font-medium text-zinc-400">
          <Cpu className="h-3.5 w-3.5 text-violet-400" />
          <span className="hidden sm:inline">LangGraph Agents:</span>
        </div>
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setCurrentPage(AGENT_TO_PAGE[agent.id])}
            title={`${agent.name} — ${agent.description}`}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-white/[0.06] bg-zinc-900/70 px-2.5 py-1 text-xs transition-colors hover:border-white/15 hover:bg-zinc-900"
          >
            <span className="font-medium text-zinc-300">{agent.shortName}</span>
            <AgentStatusBadge status={agent.status} />
          </button>
        ))}
      </div>
    </div>
  );
};
