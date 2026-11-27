import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileDown,
  FileText,
  Printer,
  Sparkles,
} from 'lucide-react';
import {
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
import { generateExecutiveReportSummary } from '../services/api';
import { formatBytes } from '../utils/dataHelpers';

export const ReportGeneratorPage: React.FC = () => {
  const { activeDataset, latestMlSnapshot, setAgentStatus, logActivity, notify } = useCopilot();

  const [isGenerating, setIsGenerating] = useState(false);
  const [executiveSummary, setExecutiveSummary] = useState<string>(
    `Executive overview for ${activeDataset.name}: ${activeDataset.rowCount} records across ${activeDataset.columnCount} columns with an overall quality score of ${activeDataset.quality.overallScore}%.`
  );
  const [recommendations, setRecommendations] = useState<string[]>([
    'Verify missing value imputation before production warehouse ingestion.',
    'Review categorical distributions and outlier thresholds in AI Analytics.',
  ]);
  const [generatedAt, setGeneratedAt] = useState<string>(new Date().toLocaleString());

  const chartSummaryData = useMemo(() => {
    const catCol =
      activeDataset.schema.find((s) => s.type === 'categorical')?.name ||
      activeDataset.schema.find((s) => s.type === 'string')?.name;
    const numCol = activeDataset.schema.find((s) => s.type === 'float' || s.type === 'integer')?.name;
    if (!catCol) return [];
    const map = new Map<string, number>();
    activeDataset.rows.forEach((r) => {
      const k = String(r[catCol] ?? 'Unknown');
      const v = numCol ? Number(r[numCol]) || 0 : 1;
      map.set(k, (map.get(k) || 0) + v);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value: Number(value.toFixed(1)) })).slice(0, 6);
  }, [activeDataset]);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setAgentStatus('report', 'Processing', `Compiling report for ${activeDataset.name}`);
    try {
      const res = await generateExecutiveReportSummary(activeDataset);
      setExecutiveSummary(res.executiveSummary);
      setRecommendations(res.recommendations);
      setGeneratedAt(new Date().toLocaleString());
      setAgentStatus('report', 'Completed', 'Report ready for PDF export');
      logActivity({
        agent: 'report',
        action: `Generated report for ${activeDataset.name}`,
        datasetName: activeDataset.fileName,
        status: 'success',
        details: 'Compiled summary, quality audit, visuals, and ML snapshot.',
      });
      notify('success', 'Report generated', 'Executive report compiled and ready for PDF export.');
    } catch {
      setAgentStatus('report', 'Error', 'Report generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPdf = () => {
    notify('info', 'Opening print / PDF dialog', 'Choose "Save as PDF" in your browser print dialog.');
    setTimeout(() => window.print(), 200);
  };

  return (
    <div className="space-y-6">
      {/* Report Action Header */}
      <Card className="no-print p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileText className="h-4 w-4 text-cyan-400" />
            <div>
              <div className="text-xs font-semibold text-zinc-100">Automated Report Builder</div>
              <div className="text-[11px] text-zinc-400">Last compiled: {generatedAt}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MockDataPill label="Simulated Report Agent" />
            <Button size="sm" variant="secondary" onClick={() => void handleGenerateReport()} loading={isGenerating}>
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              Regenerate AI Report
            </Button>
            <Button size="sm" onClick={handleExportPdf}>
              <Printer className="h-3.5 w-3.5" />
              Export PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Printable Report Document */}
      <Card className="print-only-surface overflow-hidden">
        <div className="border-b border-white/[0.08] bg-zinc-900/60 px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge variant="cyan">AI Data Engineering Copilot · Executive Audit</Badge>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-zinc-100">{activeDataset.name}</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Source: {activeDataset.fileName} · Format: {activeDataset.format} · Size:{' '}
                {formatBytes(activeDataset.sizeBytes)} · Generated: {generatedAt}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-right">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300">Quality Score</div>
              <div className="font-mono text-2xl font-bold text-emerald-300">
                {activeDataset.quality.overallScore}%
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8 p-6">
          {/* Section 1: Executive Summary */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">1. Dataset Summary</h3>
            <p className="text-sm leading-relaxed text-zinc-300">{executiveSummary}</p>
            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
              <div className="rounded-lg border border-white/[0.07] bg-zinc-900/50 p-3">
                <div className="text-[11px] text-zinc-400">Total Rows</div>
                <div className="font-mono text-lg font-semibold text-zinc-100">{activeDataset.rowCount}</div>
              </div>
              <div className="rounded-lg border border-white/[0.07] bg-zinc-900/50 p-3">
                <div className="text-[11px] text-zinc-400">Total Columns</div>
                <div className="font-mono text-lg font-semibold text-zinc-100">{activeDataset.columnCount}</div>
              </div>
              <div className="rounded-lg border border-white/[0.07] bg-zinc-900/50 p-3">
                <div className="text-[11px] text-zinc-400">Missing Cells</div>
                <div className="font-mono text-lg font-semibold text-zinc-100">{activeDataset.quality.missingCells}</div>
              </div>
              <div className="rounded-lg border border-white/[0.07] bg-zinc-900/50 p-3">
                <div className="text-[11px] text-zinc-400">Duplicates</div>
                <div className="font-mono text-lg font-semibold text-zinc-100">{activeDataset.quality.duplicateRows}</div>
              </div>
            </div>
          </section>

          {/* Section 2: Data Quality Report */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">2. Data Quality Report</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Completeness', val: activeDataset.quality.completeness },
                { label: 'Uniqueness', val: activeDataset.quality.uniqueness },
                { label: 'Validity', val: activeDataset.quality.validity },
                { label: 'Consistency', val: activeDataset.quality.consistency },
              ].map((dim) => (
                <div key={dim.label} className="rounded-lg border border-white/[0.07] bg-zinc-900/50 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">{dim.label}</span>
                    <span className="font-mono font-semibold text-zinc-100">{dim.val}%</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800">
                    <div className="h-full rounded-full bg-cyan-400" style={{ width: `${dim.val}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 pt-1">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: Analytics Visualization */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
              3. Analytics & Visualizations
            </h3>
            <div className="h-60 rounded-xl border border-white/[0.07] bg-zinc-950/60 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartSummaryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={11} />
                  <YAxis stroke="#71717a" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111115', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="value" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Section 4: ML Results */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
              4. Machine Learning Results
            </h3>
            {latestMlSnapshot && latestMlSnapshot.datasetId === activeDataset.id ? (
              <div className="rounded-xl border border-white/[0.08] bg-zinc-900/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-zinc-100">
                    {latestMlSnapshot.metrics.algorithm} ({latestMlSnapshot.metrics.problemType}) on{' '}
                    <span className="font-mono text-cyan-300">{latestMlSnapshot.targetColumn}</span>
                  </div>
                  <Badge variant="emerald">Trained {latestMlSnapshot.trainedAt}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {latestMlSnapshot.metrics.problemType === 'classification' ? (
                    <>
                      <div>
                        <div className="text-[11px] text-zinc-400">Accuracy</div>
                        <div className="font-mono text-base font-semibold text-zinc-100">
                          {((latestMlSnapshot.metrics.accuracy || 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-400">Precision</div>
                        <div className="font-mono text-base font-semibold text-zinc-100">
                          {((latestMlSnapshot.metrics.precision || 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-400">Recall</div>
                        <div className="font-mono text-base font-semibold text-zinc-100">
                          {((latestMlSnapshot.metrics.recall || 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-400">F1-Score</div>
                        <div className="font-mono text-base font-semibold text-zinc-100">
                          {((latestMlSnapshot.metrics.f1Score || 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="text-[11px] text-zinc-400">R² Score</div>
                        <div className="font-mono text-base font-semibold text-zinc-100">
                          {latestMlSnapshot.metrics.r2Score}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-400">RMSE</div>
                        <div className="font-mono text-base font-semibold text-zinc-100">
                          {latestMlSnapshot.metrics.rmse}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-400">MAE</div>
                        <div className="font-mono text-base font-semibold text-zinc-100">
                          {latestMlSnapshot.metrics.mae}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-zinc-950/40 p-4 text-xs text-zinc-400">
                No ML model has been trained on {activeDataset.name} yet. Run the Machine Learning Agent to include
                model metrics and feature importance in this report.
              </div>
            )}
          </section>
        </div>

        <CardHeader
          title="Export Ready"
          subtitle="Click Export PDF to save a clean print-formatted PDF document."
          action={
            <Button className="no-print" size="sm" variant="secondary" onClick={handleExportPdf}>
              <FileDown className="h-3.5 w-3.5" />
              Save as PDF
            </Button>
          }
          className="no-print border-t border-b-0"
        />
      </Card>
    </div>
  );
};
