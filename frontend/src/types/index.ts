export type PageId =
  | 'dashboard'
  | 'upload'
  | 'cleaning'
  | 'sql'
  | 'analytics'
  | 'etl'
  | 'ml'
  | 'chat'
  | 'reports';

export type AgentId = 'cleaning' | 'sql' | 'analytics' | 'etl' | 'ml' | 'report';

export type AgentStatus = 'Idle' | 'Processing' | 'Completed' | 'Error';

export interface AgentState {
  id: AgentId;
  name: string;
  shortName: string;
  description: string;
  status: AgentStatus;
  lastUpdated: string;
  currentTask?: string;
  errorMessage?: string;
}

export type ColumnDataType = 'string' | 'number' | 'integer' | 'float' | 'boolean' | 'date' | 'categorical';

export interface ColumnSchema {
  name: string;
  type: ColumnDataType;
  missingCount: number;
  uniqueCount: number;
  sampleValues: (string | number | boolean | null)[];
  issue?: string;
}

export type DataRow = Record<string, string | number | boolean | null>;

export interface DatasetQualityMetrics {
  overallScore: number;
  completeness: number;
  uniqueness: number;
  validity: number;
  consistency: number;
  missingCells: number;
  duplicateRows: number;
  outlierCount: number;
  typeMismatchCount: number;
}

export interface Dataset {
  id: string;
  name: string;
  fileName: string;
  format: 'CSV' | 'Excel' | 'JSON';
  sizeBytes: number;
  uploadedAt: string;
  rowCount: number;
  columnCount: number;
  schema: ColumnSchema[];
  rows: DataRow[];
  quality: DatasetQualityMetrics;
  isCleaned?: boolean;
  source: 'sample' | 'uploaded';
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  agent: AgentId | 'system';
  action: string;
  datasetName: string;
  status: 'success' | 'warning' | 'info' | 'error';
  details?: string;
}

export interface CleaningRecommendation {
  id: string;
  category: 'missing' | 'duplicates' | 'outliers' | 'types';
  column: string;
  severity: 'high' | 'medium' | 'low';
  affectedRows: number;
  description: string;
  suggestedAction: string;
  selected: boolean;
  applied?: boolean;
}

export interface SqlQueryRecord {
  id: string;
  prompt?: string;
  sql: string;
  executedAt: string;
  executionTimeMs: number;
  rowCount: number;
  status: 'success' | 'error';
  errorMessage?: string;
}

export interface SqlExecutionResult {
  columns: string[];
  rows: DataRow[];
  executionTimeMs: number;
  rowCount: number;
  isMocked: boolean;
}

export type PipelineStageId = 'source' | 'cleaning' | 'transformation' | 'validation' | 'database';

export type PipelineStageStatus = 'idle' | 'running' | 'completed' | 'error' | 'skipped';

export interface PipelineStageConfig {
  id: PipelineStageId;
  label: string;
  description: string;
  status: PipelineStageStatus;
  durationMs?: number;
  recordsIn?: number;
  recordsOut?: number;
  configSummary: string;
  parameters: Record<string, string | boolean | number>;
}

export interface PipelineLogEntry {
  id: string;
  timestamp: string;
  stage: PipelineStageId | 'orchestrator';
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
}

export interface SavedPipeline {
  id: string;
  name: string;
  datasetId: string;
  schedule: string;
  lastRunAt: string;
  status: 'Active' | 'Paused' | 'Failed';
  stages: PipelineStageConfig[];
}

export type MlProblemType = 'classification' | 'regression';

export interface MlMetrics {
  problemType: MlProblemType;
  algorithm: string;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  r2Score?: number;
  rmse?: number;
  mae?: number;
  trainingTimeSec: number;
  trainRows: number;
  testRows: number;
}

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
}

export interface ChatChartConfig {
  type: 'bar' | 'line' | 'area';
  title: string;
  xKey: string;
  yKey: string;
  data: Record<string, string | number>[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  table?: {
    columns: string[];
    rows: DataRow[];
  };
  chart?: ChatChartConfig;
  insights?: string[];
  isMocked?: boolean;
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

export interface BackendHealthStatus {
  connected: boolean;
  mode: 'mock' | 'live';
  endpoint: string;
  lastChecked: string;
}
