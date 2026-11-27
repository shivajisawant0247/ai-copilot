import React, { useMemo } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Database,
  DatabaseZap,
  FileSpreadsheet,
  GitBranch,
  Layers,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, Button, Card, CardHeader, MockDataPill } from '../components/ui/Primitives';
import { useCopilot } from '../context/CopilotContext';
import { formatBytes, formatNumber } from '../utils/dataHelpers';

export const DashboardPage: React.FC = () => {
  const { datasets, activeDataset, setActiveDatasetId, setCurrentPage, activities, agents } = useCopilot();

  const totalRows = useMemo(() => datasets.reduce((sum, d) => sum + d.rowCount, 0), [datasets]);
  const avgQuality = useMemo(
    () => Math.round(datasets.reduce((sum, d) => sum + d.quality.overallScore, 0) / Math.max(1, datasets.length)),
    [datasets]
  );

  // Build dynamic chart series from the active dataset
  const categoryBreakdown = useMemo(() => {
    const catCol =
      activeDataset.schema.find((s) => s.type === 'categorical')?.name ||
      activeDataset.schema.find((s) => s.type === 'string')?.name;
    const numCol = activeDataset.schema.find((s) => s.type === 'float' || s.type === 'integer')?.name;
    if (!catCol) return [];

    const map = new Map<string, { count: number; total: number }>();
    activeDataset.rows.forEach((r) => {
      const key = String(r[catCol] ?? 'Unknown');
      const val = numCol ? Number(r[numCol]) || 0 : 1;
      const prev = map.get(key) || { count: 0, total: 0 };
      map.set(key, { count: prev.count + 1, total: prev.total + val });
    });

    return [...map.entries()]
      .map(([name, info]) => ({
        name,
        records: info.count,
        metric: Number(info.total.toFixed(1)),
      }))
      .slice(0, 6);
  }, [activeDataset]);

  const qualityTrendData = useMemo(
    () => [
      { stage: 'Completeness', score: activeDataset.quality.completeness },
      { stage: 'Uniqueness', score: activeDataset.quality.uniqueness },
      { stage: 'Validity', score: activeDataset.quality.validity },
      { stage: 'Consistency', score: activeDataset.quality.consistency },
      { stage: 'Overall', score: activeDataset.quality.overallScore },
    ],
    [activeDataset]
  );

  const insights = useMemo(() => {
    const list: { title: string; detail: string; tag: string }[] = [];
    if (activeDataset.quality.missingCells > 0) {
      list.push({
        title: `${activeDataset.quality.missingCells} missing cells detected`,
        detail: `Completeness is at ${activeDataset.quality.completeness}%. Run the Data Cleaning Agent to impute missing values.`,
        tag: 'Quality',
      });
    } else {
      list.push({
        title: 'Zero missing cells in active dataset',
        detail: `${activeDataset.name} passed completeness checks at 100%.`,
        tag: 'Healthy',
      });
    }

    if (activeDataset.quality.duplicateRows > 0 || activeDataset.quality.typeMismatchCount > 0) {
      list.push({
        title: 'Schema & deduplication opportunity',
        detail: `Detected ${activeDataset.quality.duplicateRows} duplicate row(s) and ${activeDataset.quality.typeMismatchCount} type mismatch(es).`,
        tag: 'Actionable',
      });
    }

    const numCols = activeDataset.schema.filter((s) => s.type === 'float' || s.type === 'integer');
    if (numCols.length >= 2) {
      list.push({
        title: `${numCols.length} quantitative features ready for ML`,
        detail: `Columns like ${numCols.slice(0, 3).map((c) => c.name).join(', ')} can be used in AI Analytics or ML regression/classification.`,
        tag: 'ML Ready',
      });
    }
    return list;
  }, [activeDataset]);

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Uploaded Datasets</span>
            <Database className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-zinc-100 tabular-nums">{datasets.length}</span>
            <span className="text-xs text-zinc-500">active tables</span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-400">
            {formatNumber(totalRows)} total records indexed
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Active Quality Score</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-zinc-100 tabular-nums">
              {activeDataset.quality.overallScore}%
            </span>
            <Badge variant={activeDataset.quality.overallScore >= 90 ? 'emerald' : 'amber'}>
              {activeDataset.quality.overallScore >= 90 ? 'Production Ready' : 'Needs Cleaning'}
            </Badge>
          </div>
          <div className="mt-2 text-[11px] text-zinc-400">Workspace avg: {avgQuality}% across all datasets</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Detected Anomalies</span>
            <Sparkles className="h-4 w-4 text-violet-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-zinc-100 tabular-nums">
              {activeDataset.quality.missingCells +
                activeDataset.quality.duplicateRows +
                activeDataset.quality.outlierCount +
                activeDataset.quality.typeMismatchCount}
            </span>
            <span className="text-xs text-zinc-500">in active dataset</span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-400">
            {activeDataset.quality.missingCells} nulls · {activeDataset.quality.duplicateRows} dupes ·{' '}
            {activeDataset.quality.outlierCount} outliers
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">LangGraph Multi-Agents</span>
            <Layers className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-zinc-100 tabular-nums">{agents.length}</span>
            <span className="text-xs text-emerald-400">Online</span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-400">
            {agents.filter((a) => a.status === 'Completed').length} completed ·{' '}
            {agents.filter((a) => a.status === 'Processing').length} running
          </div>
        </Card>
      </div>

      {/* Quick Action Buttons */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-zinc-200">Quick Agent Workflows</div>
            <div className="text-[11px] text-zinc-400">Launch an autonomous engineering task on {activeDataset.name}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setCurrentPage('upload')}>
              <UploadCloud className="h-3.5 w-3.5 text-cyan-400" />
              Upload Dataset
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setCurrentPage('cleaning')}>
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              Run Cleaning Agent
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setCurrentPage('sql')}>
              <DatabaseZap className="h-3.5 w-3.5 text-blue-400" />
              Ask SQL Agent
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setCurrentPage('etl')}>
              <GitBranch className="h-3.5 w-3.5 text-emerald-400" />
              Build ETL Pipeline
            </Button>
            <Button size="sm" variant="primary" onClick={() => setCurrentPage('ml')}>
              <BrainCircuit className="h-3.5 w-3.5" />
              Train ML Model
            </Button>
          </div>
        </div>
      </Card>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Active Dataset Distribution"
            subtitle={`Aggregated metric breakdown for ${activeDataset.name}`}
            action={<BarChart3 className="h-4 w-4 text-cyan-400" />}
          />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111115',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="metric" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Data Quality Dimensions"
            subtitle="Completeness, uniqueness, validity, and consistency profile"
            action={<ShieldCheck className="h-4 w-4 text-emerald-400" />}
          />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={qualityTrendData}>
                <defs>
                  <linearGradient id="qualityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="stage" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#71717a" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111115',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2} fill="url(#qualityGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Bottom 3-Column Grid: Datasets, AI Insights, Recent Activity */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Uploaded Datasets */}
        <Card>
          <CardHeader
            title="Workspace Datasets"
            subtitle="Select a dataset to inspect or process"
            action={
              <button
                onClick={() => setCurrentPage('upload')}
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300"
              >
                Add New <ArrowRight className="h-3 w-3" />
              </button>
            }
          />
          <div className="divide-y divide-white/[0.06]">
            {datasets.map((ds) => {
              const isSelected = ds.id === activeDataset.id;
              return (
                <button
                  key={ds.id}
                  onClick={() => setActiveDatasetId(ds.id)}
                  className={`flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors ${
                    isSelected ? 'bg-cyan-500/[0.06]' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className={`h-4 w-4 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-zinc-500'}`} />
                      <span className="truncate text-xs font-semibold text-zinc-100">{ds.name}</span>
                      {ds.isCleaned && <Badge variant="emerald">Cleaned</Badge>}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                      <span>{ds.format}</span>
                      <span>·</span>
                      <span>{ds.rowCount} rows × {ds.columnCount} cols</span>
                      <span>·</span>
                      <span>{formatBytes(ds.sizeBytes)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs font-semibold text-zinc-200">{ds.quality.overallScore}%</div>
                    <div className="text-[10px] text-zinc-500">Quality</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* AI Generated Insights */}
        <Card>
          <CardHeader
            title="AI-Generated Insights"
            subtitle="Automated profiling observations"
            action={<MockDataPill label="Simulated AI" />}
          />
          <div className="space-y-3 p-4">
            {insights.map((ins, i) => (
              <div key={i} className="rounded-lg border border-white/[0.06] bg-zinc-900/60 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-100">{ins.title}</span>
                  <Badge variant={ins.tag === 'Healthy' ? 'emerald' : ins.tag === 'ML Ready' ? 'violet' : 'amber'}>
                    {ins.tag}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{ins.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader
            title="Recent Activity"
            subtitle="Pipeline & LangGraph execution log"
            action={<Activity className="h-4 w-4 text-zinc-400" />}
          />
          <div className="divide-y divide-white/[0.06]">
            {activities.slice(0, 5).map((act) => (
              <div key={act.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={`h-3.5 w-3.5 shrink-0 ${
                        act.status === 'error'
                          ? 'text-rose-400'
                          : act.status === 'warning'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    />
                    <span className="text-xs font-medium text-zinc-200">{act.action}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">{act.timestamp}</span>
                </div>
                {act.details && <p className="mt-1 pl-5 text-[11px] text-zinc-400">{act.details}</p>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
