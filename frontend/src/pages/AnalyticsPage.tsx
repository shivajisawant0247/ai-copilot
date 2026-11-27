import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Filter,
  GitCommitHorizontal,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Badge, Button, Card, CardHeader, MockDataPill } from '../components/ui/Primitives';
import { useCopilot } from '../context/CopilotContext';

const CHART_COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e'];

function computePearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const denom = Math.sqrt(denX * denY);
  return denom === 0 ? 0 : Number((num / denom).toFixed(2));
}

export const AnalyticsPage: React.FC = () => {
  const { activeDataset, setAgentStatus, notify } = useCopilot();

  const categoricalCols = useMemo(
    () => activeDataset.schema.filter((s) => s.type === 'categorical' || s.type === 'string' || s.type === 'boolean'),
    [activeDataset]
  );
  const numericCols = useMemo(
    () => activeDataset.schema.filter((s) => s.type === 'float' || s.type === 'integer' || s.type === 'number'),
    [activeDataset]
  );

  const [groupByCol, setGroupByCol] = useState<string>(categoricalCols[0]?.name || activeDataset.schema[0]?.name || '');
  const [metricCol, setMetricCol] = useState<string>(numericCols[0]?.name || activeDataset.schema[1]?.name || '');
  const [secondaryCol, setSecondaryCol] = useState<string>(numericCols[1]?.name || numericCols[0]?.name || '');
  const [filterValue, setFilterValue] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeGroupCol = activeDataset.schema.some((s) => s.name === groupByCol)
    ? groupByCol
    : categoricalCols[0]?.name || activeDataset.schema[0]?.name || '';
  const activeMetricCol = activeDataset.schema.some((s) => s.name === metricCol)
    ? metricCol
    : numericCols[0]?.name || '';
  const activeSecondaryCol = activeDataset.schema.some((s) => s.name === secondaryCol)
    ? secondaryCol
    : numericCols[1]?.name || activeMetricCol;

  const filterOptions = useMemo(() => {
    if (!activeGroupCol) return [];
    const set = new Set(activeDataset.rows.map((r) => String(r[activeGroupCol] ?? 'Unknown')));
    return ['ALL', ...Array.from(set)];
  }, [activeDataset, activeGroupCol]);

  const filteredRows = useMemo(() => {
    if (filterValue === 'ALL' || !activeGroupCol) return activeDataset.rows;
    return activeDataset.rows.filter((r) => String(r[activeGroupCol] ?? 'Unknown') === filterValue);
  }, [activeDataset, activeGroupCol, filterValue]);

  const kpis = useMemo(() => {
    const vals = filteredRows.map((r) => Number(r[activeMetricCol])).filter((n) => !Number.isNaN(n));
    const sum = vals.reduce((a, b) => a + b, 0);
    const avg = vals.length > 0 ? sum / vals.length : 0;
    const max = vals.length > 0 ? Math.max(...vals) : 0;
    return {
      count: filteredRows.length,
      sum: Number(sum.toFixed(2)),
      avg: Number(avg.toFixed(2)),
      max: Number(max.toFixed(2)),
    };
  }, [filteredRows, activeMetricCol]);

  const groupedBarData = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    filteredRows.forEach((r) => {
      const k = String(r[activeGroupCol] ?? 'Unknown');
      const v = Number(r[activeMetricCol]) || 0;
      const cur = map.get(k) || { sum: 0, count: 0 };
      map.set(k, { sum: cur.sum + v, count: cur.count + 1 });
    });
    return [...map.entries()].map(([name, info]) => ({
      name,
      total: Number(info.sum.toFixed(2)),
      average: Number((info.sum / Math.max(1, info.count)).toFixed(2)),
      count: info.count,
    }));
  }, [filteredRows, activeGroupCol, activeMetricCol]);

  const trendData = useMemo(() => {
    return filteredRows.slice(0, 20).map((r, idx) => ({
      index: `#${idx + 1}`,
      primary: Number(r[activeMetricCol]) || 0,
      secondary: Number(r[activeSecondaryCol]) || 0,
    }));
  }, [filteredRows, activeMetricCol, activeSecondaryCol]);

  const correlationMatrix = useMemo(() => {
    const cols = numericCols.slice(0, 4);
    return cols.map((rowCol) => {
      const rowValues: Record<string, string | number> = { feature: rowCol.name };
      cols.forEach((colCol) => {
        const pairs = filteredRows
          .map((r) => [Number(r[rowCol.name]), Number(r[colCol.name])])
          .filter(([a, b]) => !Number.isNaN(a) && !Number.isNaN(b));
        rowValues[colCol.name] = computePearson(
          pairs.map((p) => p[0]),
          pairs.map((p) => p[1])
        );
      });
      return { name: rowCol.name, values: rowValues };
    });
  }, [numericCols, filteredRows]);

  const scatterData = useMemo(() => {
    return filteredRows
      .map((r) => ({
        x: Number(r[activeMetricCol]),
        y: Number(r[activeSecondaryCol]),
      }))
      .filter((pt) => !Number.isNaN(pt.x) && !Number.isNaN(pt.y));
  }, [filteredRows, activeMetricCol, activeSecondaryCol]);

  const handleRunAgentInsights = () => {
    setIsRefreshing(true);
    setAgentStatus('analytics', 'Processing', 'Computing correlations & trends');
    setTimeout(() => {
      setIsRefreshing(false);
      setAgentStatus('analytics', 'Completed', 'Dashboards synchronized');
      notify('success', 'Analytics refreshed', 'KPIs, trends, and correlations updated for selected filters.');
    }, 550);
  };

  const leader = [...groupedBarData].sort((a, b) => b.total - a.total)[0];

  return (
    <div className="space-y-6">
      {/* Interactive Filter Toolbar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                <Filter className="h-3 w-3" /> Dimension
              </label>
              <select
                value={activeGroupCol}
                onChange={(e) => {
                  setGroupByCol(e.target.value);
                  setFilterValue('ALL');
                }}
                className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              >
                {activeDataset.schema.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-400">Primary Metric</label>
              <select
                value={activeMetricCol}
                onChange={(e) => setMetricCol(e.target.value)}
                className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              >
                {numericCols.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-400">Comparison Metric</label>
              <select
                value={activeSecondaryCol}
                onChange={(e) => setSecondaryCol(e.target.value)}
                className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              >
                {numericCols.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-400">Segment Filter</label>
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              >
                {filterOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MockDataPill label="Client Analytics" />
            <Button size="sm" onClick={handleRunAgentInsights} loading={isRefreshing}>
              <Sparkles className="h-3.5 w-3.5" />
              Refresh AI Observations
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-zinc-400">Filtered Records</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-zinc-100">{kpis.count}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-zinc-400">Total {activeMetricCol || 'Metric'}</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-cyan-300">{kpis.sum.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-zinc-400">Mean {activeMetricCol || 'Metric'}</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-zinc-100">{kpis.avg.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-zinc-400">Peak {activeMetricCol || 'Metric'}</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-violet-300">{kpis.max.toLocaleString()}</div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={`${activeMetricCol} by ${activeGroupCol}`}
            subtitle="Aggregated total comparison across segments"
            action={<BarChart3 className="h-4 w-4 text-cyan-400" />}
          />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groupedBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111115', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="total" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Trend Analysis"
            subtitle={`Sequential trajectory of ${activeMetricCol} vs ${activeSecondaryCol}`}
            action={<TrendingUp className="h-4 w-4 text-blue-400" />}
          />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="index" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111115', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="primary" stroke="#06b6d4" strokeWidth={2} dot={false} name={activeMetricCol} />
                <Line type="monotone" dataKey="secondary" stroke="#8b5cf6" strokeWidth={2} dot={false} name={activeSecondaryCol} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Feature Correlation Scatter"
            subtitle={`${activeMetricCol} (X) vs ${activeSecondaryCol} (Y)`}
            action={<GitCommitHorizontal className="h-4 w-4 text-violet-400" />}
          />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" dataKey="x" name={activeMetricCol} stroke="#71717a" fontSize={11} />
                <YAxis type="number" dataKey="y" name={activeSecondaryCol} stroke="#71717a" fontSize={11} />
                <ZAxis range={[45, 45]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ backgroundColor: '#111115', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Scatter data={scatterData} fill="#8b5cf6" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Segment Share"
            subtitle={`Record count share by ${activeGroupCol}`}
          />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={groupedBarData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={82} paddingAngle={3}>
                  {groupedBarData.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#111115', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Correlation Matrix & AI Observations */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Pearson Correlation Matrix"
            subtitle="Pairwise linear correlation across top numeric features"
          />
          <div className="overflow-x-auto p-4">
            {correlationMatrix.length > 0 ? (
              <table className="w-full text-center font-mono text-xs">
                <thead>
                  <tr className="text-zinc-400">
                    <th className="py-2 text-left font-medium">Feature</th>
                    {correlationMatrix.map((c) => (
                      <th key={c.name} className="px-2 py-2 font-medium">{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {correlationMatrix.map((row) => (
                    <tr key={row.name}>
                      <td className="py-2.5 text-left text-zinc-200">{row.name}</td>
                      {correlationMatrix.map((col) => {
                        const val = Number(row.values[col.name] ?? 0);
                        const intensity = Math.abs(val);
                        return (
                          <td key={col.name} className="p-1.5">
                            <div
                              className="rounded-md py-1.5 text-zinc-100"
                              style={{
                                backgroundColor:
                                  val >= 0
                                    ? `rgba(6, 182, 212, ${Math.max(0.08, intensity * 0.45)})`
                                    : `rgba(244, 63, 94, ${Math.max(0.08, intensity * 0.45)})`,
                              }}
                            >
                              {val.toFixed(2)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-zinc-400">At least two numeric columns are required for correlation analysis.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="AI Observations"
            subtitle="Automated statistical takeaways"
            action={<Badge variant="violet">Analytics Agent</Badge>}
          />
          <div className="space-y-3 p-4 text-xs text-zinc-300">
            <div className="rounded-lg border border-white/[0.06] bg-zinc-900/60 p-3">
              <div className="font-semibold text-cyan-300">Leading Segment</div>
              <p className="mt-1 text-zinc-400">
                {leader
                  ? `"${leader.name}" leads ${activeMetricCol} with ${leader.total.toLocaleString()} across ${leader.count} record(s).`
                  : 'No segment distribution available.'}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-zinc-900/60 p-3">
              <div className="font-semibold text-violet-300">Spread & Variance</div>
              <p className="mt-1 text-zinc-400">
                Peak {activeMetricCol} ({kpis.max.toLocaleString()}) is{' '}
                {kpis.avg > 0 ? `${(kpis.max / kpis.avg).toFixed(1)}×` : '—'} the filtered mean ({kpis.avg.toLocaleString()}).
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-zinc-900/60 p-3">
              <div className="font-semibold text-emerald-300">Recommendation</div>
              <p className="mt-1 text-zinc-400">
                Use the Machine Learning Agent to model {activeMetricCol} drivers across {activeDataset.columnCount - 1}{' '}
                candidate features.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
