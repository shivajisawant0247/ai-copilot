import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Database,
  FileCode2,
  GitBranch,
  Loader2,
  Play,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Badge, Button, Card, CardHeader, MockDataPill } from '../components/ui/Primitives';
import { useCopilot } from '../context/CopilotContext';
import { runPipelineOnBackend } from '../services/api';
import type { PipelineLogEntry, PipelineStageConfig, PipelineStageId } from '../types';

const STAGE_ICONS: Record<PipelineStageId, React.FC<{ className?: string }>> = {
  source: FileCode2,
  cleaning: Sparkles,
  transformation: GitBranch,
  validation: ShieldCheck,
  database: Database,
};

export const EtlPipelinePage: React.FC = () => {
  const { activeDataset, pipelines, savePipeline, setAgentStatus, logActivity, notify } = useCopilot();

  const [pipelineName, setPipelineName] = useState(pipelines[0]?.name || 'Custom ETL Pipeline');
  const [schedule, setSchedule] = useState(pipelines[0]?.schedule || 'Daily at 02:00 UTC');
  const [stages, setStages] = useState<PipelineStageConfig[]>(
    pipelines[0]?.stages || []
  );
  const [selectedStageId, setSelectedStageId] = useState<PipelineStageId>('source');
  const [isRunning, setIsRunning] = useState(false);
  const [simulateError, setSimulateError] = useState(false);
  const [logs, setLogs] = useState<PipelineLogEntry[]>([
    {
      id: 'log-init',
      timestamp: new Date().toLocaleTimeString(),
      stage: 'orchestrator',
      level: 'INFO',
      message: 'Pipeline DAG initialized. Ready to execute 5 stages.',
    },
  ]);

  const appendLog = (stage: PipelineLogEntry['stage'], level: PipelineLogEntry['level'], message: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString(),
        stage,
        level,
        message,
      },
    ]);
  };

  const handleRunPipeline = async () => {
    setIsRunning(true);
    setAgentStatus('etl', 'Processing', `Executing ${pipelineName}`);
    setLogs([]);
    appendLog('orchestrator', 'INFO', `Starting ETL run for "${pipelineName}" on ${activeDataset.fileName}`);

    // Reset all stages to idle
    setStages((prev) => prev.map((s) => ({ ...s, status: 'idle', durationMs: undefined })));

    await runPipelineOnBackend(activeDataset.id, stages);

    let currentRows = activeDataset.rowCount;
    let failed = false;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      setStages((prev) => prev.map((s) => (s.id === stage.id ? { ...s, status: 'running' } : s)));
      appendLog(stage.id, 'INFO', `Running stage [${stage.label}]...`);

      await new Promise((r) => setTimeout(r, 550));

      if (simulateError && stage.id === 'validation') {
        setStages((prev) => prev.map((s) => (s.id === stage.id ? { ...s, status: 'error' } : s)));
        appendLog(
          'validation',
          'ERROR',
          `Validation gate failed: Quality score ${activeDataset.quality.overallScore}% is below 95% threshold.`
        );
        failed = true;
        break;
      }

      const outRows = stage.id === 'cleaning' ? Math.max(1, currentRows - activeDataset.quality.duplicateRows) : currentRows;
      const durationMs = 140 + i * 75;

      setStages((prev) =>
        prev.map((s) =>
          s.id === stage.id
            ? { ...s, status: 'completed', durationMs, recordsIn: currentRows, recordsOut: outRows }
            : s
        )
      );
      appendLog(
        stage.id,
        'SUCCESS',
        `Completed [${stage.label}] in ${durationMs} ms (${currentRows} → ${outRows} rows).`
      );
      currentRows = outRows;
    }

    if (failed) {
      setAgentStatus('etl', 'Error', 'Validation gate failed');
      logActivity({
        agent: 'etl',
        action: `Pipeline "${pipelineName}" failed`,
        datasetName: activeDataset.fileName,
        status: 'error',
        details: 'Stopped at Validation stage due to quality threshold.',
      });
      notify('error', 'Pipeline failed at Validation', 'Check execution logs or clean the dataset first.');
    } else {
      setAgentStatus('etl', 'Completed', `${currentRows} rows loaded`);
      appendLog('orchestrator', 'SUCCESS', `ETL pipeline finished cleanly. ${currentRows} records committed.`);
      logActivity({
        agent: 'etl',
        action: `Ran pipeline "${pipelineName}"`,
        datasetName: activeDataset.fileName,
        status: 'success',
        details: `All 5 stages passed; ${currentRows} rows synced.`,
      });
      notify('success', 'ETL pipeline completed', `All 5 stages succeeded for ${activeDataset.name}.`);
    }

    setIsRunning(false);
  };

  const handleSavePipeline = () => {
    savePipeline({
      id: `pipe-${Date.now()}`,
      name: pipelineName,
      datasetId: activeDataset.id,
      schedule,
      lastRunAt: new Date().toLocaleTimeString(),
      status: 'Active',
      stages,
    });
    notify('success', 'Pipeline saved', `"${pipelineName}" scheduled (${schedule}).`);
  };

  const selectedStage = stages.find((s) => s.id === selectedStageId) || stages[0];

  return (
    <div className="space-y-6">
      {/* Top Pipeline Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-400">Pipeline Name</label>
              <input
                type="text"
                value={pipelineName}
                onChange={(e) => setPipelineName(e.target.value)}
                className="w-64 rounded-lg border border-white/10 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 focus:border-cyan-500/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                <CalendarClock className="h-3 w-3" /> Schedule
              </label>
              <select
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              >
                <option value="Manual Trigger">Manual Trigger</option>
                <option value="Hourly">Hourly</option>
                <option value="Daily at 02:00 UTC">Daily at 02:00 UTC</option>
                <option value="Weekly (Mon 00:00 UTC)">Weekly (Mon 00:00 UTC)</option>
              </select>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={simulateError}
                onChange={(e) => setSimulateError(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-rose-500"
              />
              Simulate Validation Error
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <MockDataPill label="Simulated DAG" />
            <Button size="sm" variant="secondary" onClick={handleSavePipeline}>
              <Save className="h-3.5 w-3.5" />
              Save & Schedule
            </Button>
            <Button size="sm" onClick={() => void handleRunPipeline()} loading={isRunning}>
              <Play className="h-3.5 w-3.5" />
              Run Pipeline
            </Button>
          </div>
        </div>
      </Card>

      {/* Visual Workflow DAG */}
      <Card>
        <CardHeader
          title="Visual ETL Workflow"
          subtitle="Data Source → Cleaning → Transformation → Validation → Database"
        />
        <div className="overflow-x-auto p-6">
          <div className="flex min-w-[780px] items-center justify-between gap-2">
            {stages.map((stage, idx) => {
              const Icon = STAGE_ICONS[stage.id];
              const isSelected = stage.id === selectedStageId;
              const statusColors = {
                idle: 'border-white/10 bg-zinc-900/70',
                running: 'border-cyan-400/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/10',
                completed: 'border-emerald-500/40 bg-emerald-500/[0.07]',
                error: 'border-rose-500/50 bg-rose-500/10',
                skipped: 'border-zinc-700 bg-zinc-900/30',
              };

              return (
                <React.Fragment key={stage.id}>
                  <button
                    onClick={() => setSelectedStageId(stage.id)}
                    className={`flex w-44 flex-col rounded-xl border p-3.5 text-left transition-all ${
                      statusColors[stage.status]
                    } ${isSelected ? 'ring-2 ring-cyan-500/40' : 'hover:border-white/25'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-zinc-950 text-cyan-400">
                        <Icon className="h-4 w-4" />
                      </div>
                      {stage.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />}
                      {stage.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                      {stage.status === 'error' && <AlertCircle className="h-4 w-4 text-rose-400" />}
                    </div>
                    <div className="mt-3 text-xs font-semibold text-zinc-100">{stage.label}</div>
                    <div className="mt-1 truncate text-[11px] text-zinc-400">{stage.configSummary}</div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.06] pt-2 text-[10px] text-zinc-500">
                      <span className="uppercase">{stage.status}</span>
                      <span className="font-mono">{stage.durationMs ? `${stage.durationMs}ms` : '—'}</span>
                    </div>
                  </button>

                  {idx < stages.length - 1 && (
                    <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Stage Configuration + Logs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={`Stage Inspector: ${selectedStage?.label || ''}`}
            subtitle={selectedStage?.description}
            action={<Badge variant="cyan">{selectedStage?.status}</Badge>}
          />
          {selectedStage && (
            <div className="space-y-3 p-5">
              <div className="text-xs font-medium text-zinc-300">Stage Parameters</div>
              <div className="space-y-2">
                {Object.entries(selectedStage.parameters).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3.5 py-2 text-xs"
                  >
                    <span className="font-mono text-zinc-400">{k}</span>
                    <span className="font-mono font-medium text-zinc-100">{String(v)}</span>
                  </div>
                ))}
              </div>
              {selectedStage.recordsIn !== undefined && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-2.5 text-xs text-emerald-300">
                  Throughput: {selectedStage.recordsIn} rows in → {selectedStage.recordsOut} rows out
                </div>
              )}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Execution Logs & Error Handling"
            subtitle="Real-time LangGraph ETL orchestrator stream"
          />
          <div className="h-64 space-y-1.5 overflow-y-auto bg-[#09090c] p-4 font-mono text-[11px]">
            {logs.map((log) => {
              const color =
                log.level === 'ERROR'
                  ? 'text-rose-400'
                  : log.level === 'SUCCESS'
                  ? 'text-emerald-400'
                  : log.level === 'WARN'
                  ? 'text-amber-400'
                  : 'text-zinc-300';
              return (
                <div key={log.id} className="flex gap-2">
                  <span className="shrink-0 text-zinc-600">[{log.timestamp}]</span>
                  <span className="shrink-0 text-cyan-400">[{log.stage}]</span>
                  <span className={color}>{log.message}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};
