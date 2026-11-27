import React, { useMemo, useState } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  Play,
  Sparkles,
  Target,
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
import { Badge, Button, Card, CardHeader, EmptyState, MockDataPill } from '../components/ui/Primitives';
import { useCopilot } from '../context/CopilotContext';
import { runMlPrediction, runMlTraining } from '../services/api';
import type { FeatureImportanceItem, MlMetrics, MlProblemType } from '../types';

export const MachineLearningPage: React.FC = () => {
  const { activeDataset, setAgentStatus, logActivity, notify, setLatestMlSnapshot } = useCopilot();

  const defaultTarget =
    activeDataset.schema.find((s) => s.name === 'churned' || s.name === 'returned' || s.name === 'revenue')?.name ||
    activeDataset.schema[activeDataset.schema.length - 1]?.name ||
    '';

  const [targetColumn, setTargetColumn] = useState(defaultTarget);
  const [algorithm, setAlgorithm] = useState('XGBoost');
  const [isTraining, setIsTraining] = useState(false);
  const [metrics, setMetrics] = useState<MlMetrics | null>(null);
  const [featureImportance, setFeatureImportance] = useState<FeatureImportanceItem[]>([]);

  // Prediction state
  const [predictionInputs, setPredictionInputs] = useState<Record<string, string>>({});
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState<{ prediction: string | number; confidence: number } | null>(
    null
  );

  const activeTarget = activeDataset.schema.some((s) => s.name === targetColumn) ? targetColumn : defaultTarget;

  const detectedProblemType: MlProblemType = useMemo(() => {
    const col = activeDataset.schema.find((s) => s.name === activeTarget);
    const nonNull = activeDataset.rows.map((r) => r[activeTarget]).filter((v) => v !== null && v !== undefined);
    const uniqueCount = new Set(nonNull.map(String)).size;
    if (col?.type === 'boolean' || col?.type === 'categorical' || col?.type === 'string' || uniqueCount <= 5) {
      return 'classification';
    }
    return 'regression';
  }, [activeDataset, activeTarget]);

  const featureColumns = useMemo(
    () => activeDataset.schema.filter((s) => s.name !== activeTarget && !s.name.endsWith('_id') && !s.name.includes('date')).slice(0, 6),
    [activeDataset, activeTarget]
  );

  const handleTrainModel = async () => {
    if (!activeTarget) return;
    setIsTraining(true);
    setPredictionResult(null);
    setAgentStatus('ml', 'Processing', `Training ${algorithm} on ${activeTarget}`);

    try {
      const res = await runMlTraining(activeDataset, activeTarget, algorithm);
      setMetrics(res.metrics);
      setFeatureImportance(res.featureImportance);

      // Seed prediction inputs from row 0
      const defaults: Record<string, string> = {};
      featureColumns.forEach((col) => {
        const sample = activeDataset.rows[0]?.[col.name];
        defaults[col.name] = sample !== null && sample !== undefined ? String(sample) : '';
      });
      setPredictionInputs(defaults);

      setLatestMlSnapshot({
        datasetId: activeDataset.id,
        targetColumn: activeTarget,
        metrics: res.metrics,
        featureImportance: res.featureImportance,
        trainedAt: new Date().toLocaleTimeString(),
      });

      setAgentStatus('ml', 'Completed', `${res.metrics.problemType} model ready`);
      logActivity({
        agent: 'ml',
        action: `Trained ${algorithm} (${res.metrics.problemType})`,
        datasetName: activeDataset.fileName,
        status: 'success',
        details:
          res.metrics.problemType === 'classification'
            ? `Target: ${activeTarget} · Accuracy ${((res.metrics.accuracy || 0) * 100).toFixed(1)}%`
            : `Target: ${activeTarget} · R² ${res.metrics.r2Score}`,
      });
      notify('success', 'Model training complete', `${algorithm} evaluated on ${activeDataset.name}.`);
    } catch (err) {
      setAgentStatus('ml', 'Error', 'Training failed');
      notify('error', 'Training error', err instanceof Error ? err.message : 'Unable to train model.');
    } finally {
      setIsTraining(false);
    }
  };

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metrics) return;
    setIsPredicting(true);
    try {
      const parsed: Record<string, string | number | boolean> = {};
      Object.entries(predictionInputs).forEach(([k, v]) => {
        if (v === 'true') parsed[k] = true;
        else if (v === 'false') parsed[k] = false;
        else if (v !== '' && !Number.isNaN(Number(v))) parsed[k] = Number(v);
        else parsed[k] = v;
      });
      const res = await runMlPrediction(activeDataset.id, activeTarget, metrics.problemType, parsed);
      setPredictionResult({ prediction: res.prediction, confidence: res.confidence });
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                <Target className="h-3 w-3 text-cyan-400" /> Target Column
              </label>
              <select
                value={activeTarget}
                onChange={(e) => {
                  setTargetColumn(e.target.value);
                  setMetrics(null);
                }}
                className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:outline-none"
              >
                {activeDataset.schema.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-400">Detected Task Type</label>
              <div className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2">
                <Badge variant={detectedProblemType === 'classification' ? 'violet' : 'cyan'}>
                  Auto-detected: {detectedProblemType === 'classification' ? 'Classification' : 'Regression'}
                </Badge>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-400">Algorithm</label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:outline-none"
              >
                <option value="XGBoost">XGBoost</option>
                <option value="Random Forest">Random Forest</option>
                <option value="LightGBM">LightGBM</option>
                <option value="Linear / Logistic Baseline">Linear / Logistic Baseline</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MockDataPill label="Simulated AutoML" />
            <Button onClick={() => void handleTrainModel()} loading={isTraining}>
              <Play className="h-4 w-4" />
              Train Model
            </Button>
          </div>
        </div>
      </Card>

      {metrics ? (
        <>
          {/* Evaluation Metrics */}
          {metrics.problemType === 'classification' ? (
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Card className="p-4">
                <div className="text-xs text-zinc-400">Accuracy</div>
                <div className="mt-1.5 font-mono text-2xl font-semibold text-emerald-400">
                  {((metrics.accuracy || 0) * 100).toFixed(1)}%
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">Test split ({metrics.testRows} rows)</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-zinc-400">Precision</div>
                <div className="mt-1.5 font-mono text-2xl font-semibold text-cyan-300">
                  {((metrics.precision || 0) * 100).toFixed(1)}%
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">Weighted macro</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-zinc-400">Recall</div>
                <div className="mt-1.5 font-mono text-2xl font-semibold text-blue-300">
                  {((metrics.recall || 0) * 100).toFixed(1)}%
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">Sensitivity score</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-zinc-400">F1-Score</div>
                <div className="mt-1.5 font-mono text-2xl font-semibold text-violet-300">
                  {((metrics.f1Score || 0) * 100).toFixed(1)}%
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">Trained in {metrics.trainingTimeSec}s</div>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Card className="p-4">
                <div className="text-xs text-zinc-400">R² Score</div>
                <div className="mt-1.5 font-mono text-2xl font-semibold text-emerald-400">{metrics.r2Score}</div>
                <div className="mt-1 text-[11px] text-zinc-500">Variance explained</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-zinc-400">RMSE</div>
                <div className="mt-1.5 font-mono text-2xl font-semibold text-cyan-300">{metrics.rmse}</div>
                <div className="mt-1 text-[11px] text-zinc-500">Root mean squared error</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-zinc-400">MAE</div>
                <div className="mt-1.5 font-mono text-2xl font-semibold text-blue-300">{metrics.mae}</div>
                <div className="mt-1 text-[11px] text-zinc-500">Mean absolute error</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-zinc-400">Train / Test Split</div>
                <div className="mt-1.5 font-mono text-2xl font-semibold text-violet-300">
                  {metrics.trainRows} / {metrics.testRows}
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">Trained in {metrics.trainingTimeSec}s</div>
              </Card>
            </div>
          )}

          {/* Feature Importance + Inference Interface */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Feature Importance"
                subtitle={`Top predictive drivers for ${activeTarget}`}
                action={<Badge variant="cyan">{metrics.algorithm}</Badge>}
              />
              <div className="h-72 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={featureImportance} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" stroke="#71717a" fontSize={11} unit="%" />
                    <YAxis type="category" dataKey="feature" stroke="#a1a1aa" fontSize={11} width={115} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111115', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Bar dataKey="importance" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Prediction Interface"
                subtitle={`Test live inference for ${activeTarget}`}
                action={<Sparkles className="h-4 w-4 text-cyan-400" />}
              />
              <form onSubmit={(e) => void handlePredict(e)} className="space-y-4 p-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {featureColumns.map((col) => (
                    <div key={col.name}>
                      <label className="mb-1 block font-mono text-[11px] text-zinc-400">{col.name}</label>
                      <input
                        type="text"
                        value={predictionInputs[col.name] ?? ''}
                        onChange={(e) =>
                          setPredictionInputs((prev) => ({ ...prev, [col.name]: e.target.value }))
                        }
                        className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-100 focus:border-cyan-500/40 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
                  <Button type="submit" loading={isPredicting}>
                    Run Prediction
                  </Button>

                  {predictionResult && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-zinc-300">Predicted {activeTarget}:</span>
                      <span className="font-mono font-semibold text-emerald-300">
                        {String(predictionResult.prediction)}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        ({Math.round(predictionResult.confidence * 100)}% conf.)
                      </span>
                    </div>
                  )}
                </div>
              </form>
            </Card>
          </div>
        </>
      ) : (
        <EmptyState
          icon={<BrainCircuit className="h-5 w-5" />}
          title="No trained model yet"
          description={`Select a target column from ${activeDataset.name} and click Train Model to evaluate metrics, feature importance, and live predictions.`}
          action={
            <Button onClick={() => void handleTrainModel()} loading={isTraining}>
              <Play className="h-4 w-4" />
              Train {algorithm} Now
            </Button>
          }
        />
      )}
    </div>
  );
};
