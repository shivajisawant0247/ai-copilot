import React from 'react';
import { Menu, RefreshCw, Server, ServerOff } from 'lucide-react';
import { useCopilot } from '../../context/CopilotContext';
import type { PageId } from '../../types';

const PAGE_TITLES: Record<PageId, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Data Engineering Overview',
    subtitle: 'Monitor dataset health, multi-agent activity, and workspace metrics',
  },
  upload: {
    title: 'Data Upload & Profiling',
    subtitle: 'Ingest CSV, Excel, or JSON datasets with instant schema inspection',
  },
  cleaning: {
    title: 'Data Cleaning Agent',
    subtitle: 'Detect nulls, duplicates, outliers, and type anomalies via LangGraph',
  },
  sql: {
    title: 'SQL Generation Agent',
    subtitle: 'Translate natural language to DuckDB / PostgreSQL and inspect query results',
  },
  analytics: {
    title: 'AI Analytics Studio',
    subtitle: 'Interactive KPI aggregations, trend analysis, and correlation discovery',
  },
  etl: {
    title: 'ETL Pipeline Builder',
    subtitle: 'Design, validate, schedule, and execute end-to-end data pipelines',
  },
  ml: {
    title: 'Machine Learning Agent',
    subtitle: 'Automated task detection, model training, evaluation, and live inference',
  },
  chat: {
    title: 'AI Data Chat',
    subtitle: 'Conversational exploration returning answers, tables, charts, and insights',
  },
  reports: {
    title: 'Automated Report Generator',
    subtitle: 'Compile executive quality, analytics, and ML findings with PDF export',
  },
};

export const TopHeader: React.FC<{ onOpenMobile: () => void }> = ({ onOpenMobile }) => {
  const { currentPage, datasets, activeDatasetId, setActiveDatasetId, backendHealth, refreshBackendHealth } =
    useCopilot();
  const meta = PAGE_TITLES[currentPage];

  return (
    <header className="no-print sticky top-0 z-30 border-b border-white/[0.07] bg-[#09090b]/85 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobile}
            className="rounded-lg border border-white/10 bg-zinc-900 p-2 text-zinc-300 hover:bg-zinc-800 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-zinc-100 sm:text-lg">{meta.title}</h1>
            <p className="hidden text-xs text-zinc-400 sm:block">{meta.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active dataset switcher */}
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/90 px-2.5 py-1.5">
            <span className="hidden text-[11px] text-zinc-500 md:inline">Dataset:</span>
            <select
              value={activeDatasetId}
              onChange={(e) => setActiveDatasetId(e.target.value)}
              className="max-w-[170px] bg-transparent text-xs font-medium text-zinc-200 focus:outline-none sm:max-w-[220px]"
              aria-label="Select active dataset"
            >
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id} className="bg-zinc-900 text-zinc-100">
                  {ds.name} ({ds.rowCount} rows)
                </option>
              ))}
            </select>
          </div>

          {/* Backend mode indicator */}
          <button
            onClick={() => void refreshBackendHealth()}
            title={`API Endpoint: ${backendHealth.endpoint} (Click to re-check FastAPI)`}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              backendHealth.connected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                : 'border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
            }`}
          >
            {backendHealth.connected ? (
              <>
                <Server className="h-3.5 w-3.5" />
                <span>FastAPI Connected</span>
              </>
            ) : (
              <>
                <ServerOff className="h-3.5 w-3.5" />
                <span>Demo Mode (Mock AI)</span>
              </>
            )}
            <RefreshCw className="h-3 w-3 opacity-60" />
          </button>
        </div>
      </div>
    </header>
  );
};
