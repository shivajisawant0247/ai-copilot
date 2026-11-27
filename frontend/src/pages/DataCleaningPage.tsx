import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  CopyX,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { Badge, Button, Card, CardHeader, MockDataPill } from '../components/ui/Primitives';
import { useCopilot } from '../context/CopilotContext';
import { analyzeCleaningIssues, applyCleaningPlan } from '../services/api';
import type { CleaningRecommendation, Dataset } from '../types';
import { applyCleaningToDataset } from '../utils/dataHelpers';

export const DataCleaningPage: React.FC = () => {
  const { activeDataset, updateDataset, setAgentStatus, logActivity, notify } = useCopilot();

  const [recommendations, setRecommendations] = useState<CleaningRecommendation[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [previewMode, setPreviewMode] = useState<'before' | 'after' | 'split'>('split');
  const [beforeSnapshot, setBeforeSnapshot] = useState<Dataset | null>(null);

  const runScan = async () => {
    setIsScanning(true);
    setAgentStatus('cleaning', 'Processing', `Scanning ${activeDataset.name}`);
    try {
      const { recommendations: recs } = await analyzeCleaningIssues(activeDataset);
      setRecommendations(recs);
      setBeforeSnapshot(activeDataset);
      setAgentStatus('cleaning', 'Completed', `Found ${recs.length} issue(s)`);
    } catch {
      setAgentStatus('cleaning', 'Error', 'Scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    void runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDataset.id]);

  const simulatedAfterDataset = useMemo(() => {
    if (!beforeSnapshot) return activeDataset;
    return applyCleaningToDataset(beforeSnapshot, recommendations);
  }, [beforeSnapshot, activeDataset, recommendations]);

  const toggleRecommendation = (id: string) => {
    setRecommendations((prev) => prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)));
  };

  const handleApplyCleaning = async () => {
    const selectedCount = recommendations.filter((r) => r.selected).length;
    if (selectedCount === 0) {
      notify('warning', 'No cleaning rules selected', 'Select at least one recommendation to apply.');
      return;
    }

    setIsApplying(true);
    setAgentStatus('cleaning', 'Processing', `Applying ${selectedCount} cleaning transformations`);
    try {
      const sourceToClean = beforeSnapshot || activeDataset;
      const { cleanedDataset, isMocked } = await applyCleaningPlan(sourceToClean, recommendations);
      updateDataset(cleanedDataset);
      setRecommendations((prev) => prev.map((r) => (r.selected ? { ...r, applied: true } : r)));
      setAgentStatus('cleaning', 'Completed', `Quality improved to ${cleanedDataset.quality.overallScore}%`);
      logActivity({
        agent: 'cleaning',
        action: `Cleaned ${cleanedDataset.name}`,
        datasetName: cleanedDataset.fileName,
        status: 'success',
        details: `Applied ${selectedCount} rules${isMocked ? ' (Local Engine)' : ''}. Quality score: ${cleanedDataset.quality.overallScore}%.`,
      });
      notify(
        'success',
        'Cleaning applied successfully',
        `Dataset quality score updated to ${cleanedDataset.quality.overallScore}%.`
      );
    } catch (err) {
      setAgentStatus('cleaning', 'Error', 'Failed to apply cleaning');
      notify('error', 'Cleaning failed', err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setIsApplying(false);
    }
  };

  const beforeDataset = beforeSnapshot || activeDataset;
  const displayCols = beforeDataset.schema.slice(0, 7).map((s) => s.name);

  return (
    <div className="space-y-6">
      {/* Top Diagnostic Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Quality Score</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-zinc-100">
              {activeDataset.quality.overallScore}%
            </span>
            {simulatedAfterDataset.quality.overallScore > activeDataset.quality.overallScore && (
              <span className="font-mono text-xs text-emerald-400">
                → {simulatedAfterDataset.quality.overallScore}%
              </span>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Missing Values</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-zinc-100">
            {activeDataset.quality.missingCells}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">cells across columns</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Duplicate Rows</span>
            <CopyX className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-zinc-100">
            {activeDataset.quality.duplicateRows}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">exact row matches</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Outliers (&gt;2.4σ)</span>
            <Sparkles className="h-4 w-4 text-violet-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-zinc-100">
            {activeDataset.quality.outlierCount}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">numeric anomalies</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Type Mismatches</span>
            <Wrench className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-zinc-100">
            {activeDataset.quality.typeMismatchCount}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">malformed values</div>
        </Card>
      </div>

      {/* AI Recommended Cleaning Plan */}
      <Card>
        <CardHeader
          title="AI Recommended Cleaning Plan"
          subtitle="Review LangGraph Data Cleaning Agent suggestions before committing changes"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <MockDataPill />
              <Button size="sm" variant="secondary" onClick={() => void runScan()} loading={isScanning}>
                <RefreshCw className="h-3.5 w-3.5" />
                Re-scan Dataset
              </Button>
              <Button
                size="sm"
                onClick={() => void handleApplyCleaning()}
                loading={isApplying}
                disabled={recommendations.length === 0}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Apply Cleaning
              </Button>
            </div>
          }
        />
        <div className="p-5">
          {recommendations.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <div className="font-semibold">Dataset is clean!</div>
                <div className="text-emerald-300/80">
                  No missing values, exact duplicates, type mismatches, or severe outliers were detected.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recommendations.map((rec) => (
                <label
                  key={rec.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                    rec.selected
                      ? 'border-cyan-500/30 bg-cyan-500/[0.04]'
                      : 'border-white/[0.06] bg-zinc-900/40 hover:border-white/15'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={rec.selected}
                    onChange={() => toggleRecommendation(rec.id)}
                    className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-cyan-500 focus:ring-cyan-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-zinc-100">{rec.column}</span>
                      <Badge
                        variant={
                          rec.severity === 'high' ? 'rose' : rec.severity === 'medium' ? 'amber' : 'blue'
                        }
                      >
                        {rec.category} · {rec.severity}
                      </Badge>
                      {rec.applied && <Badge variant="emerald">Applied</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">{rec.description}</p>
                    <p className="mt-1 text-[11px] font-medium text-cyan-300">
                      Recommended: {rec.suggestedAction}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Before / After Preview */}
      <Card>
        <CardHeader
          title="Before / After Data Preview"
          subtitle="Compare raw records against proposed cleaning transformations"
          action={
            <div className="inline-flex rounded-lg border border-white/10 bg-zinc-900 p-0.5 text-xs">
              {(['split', 'before', 'after'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPreviewMode(mode)}
                  className={`rounded-md px-3 py-1 capitalize transition-colors ${
                    previewMode === mode ? 'bg-cyan-500 text-zinc-950 font-medium' : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {mode === 'split' ? (
                    <span className="inline-flex items-center gap-1">
                      <ArrowLeftRight className="h-3 w-3" /> Split
                    </span>
                  ) : (
                    mode
                  )}
                </button>
              ))}
            </div>
          }
        />

        <div className={`grid gap-4 p-4 ${previewMode === 'split' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
          {(previewMode === 'split' || previewMode === 'before') && (
            <div className="overflow-hidden rounded-lg border border-white/[0.07]">
              <div className="flex items-center justify-between border-b border-white/[0.06] bg-zinc-900/80 px-3.5 py-2 text-xs">
                <span className="font-semibold text-zinc-300">Before Cleaning ({beforeDataset.rowCount} rows)</span>
                <Badge variant="amber">Quality {beforeDataset.quality.overallScore}%</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b border-white/[0.06] bg-zinc-950 text-zinc-400">
                    <tr>
                      {displayCols.map((c) => (
                        <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {beforeDataset.rows.slice(0, 8).map((row, idx) => (
                      <tr key={idx}>
                        {displayCols.map((c) => {
                          const val = row[c];
                          const isNull = val === null || val === undefined || val === '';
                          return (
                            <td key={c} className="whitespace-nowrap px-3 py-2 font-mono text-zinc-300">
                              {isNull ? (
                                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-300">NULL</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(previewMode === 'split' || previewMode === 'after') && (
            <div className="overflow-hidden rounded-lg border border-emerald-500/20">
              <div className="flex items-center justify-between border-b border-white/[0.06] bg-emerald-950/20 px-3.5 py-2 text-xs">
                <span className="font-semibold text-emerald-200">
                  After Cleaning ({simulatedAfterDataset.rowCount} rows)
                </span>
                <Badge variant="emerald">Quality {simulatedAfterDataset.quality.overallScore}%</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b border-white/[0.06] bg-zinc-950 text-zinc-400">
                    <tr>
                      {displayCols.map((c) => (
                        <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {simulatedAfterDataset.rows.slice(0, 8).map((row, idx) => (
                      <tr key={idx}>
                        {displayCols.map((c) => (
                          <td key={c} className="whitespace-nowrap px-3 py-2 font-mono text-emerald-100/90">
                            {row[c] === null || row[c] === undefined ? '—' : String(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
