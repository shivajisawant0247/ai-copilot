import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  INITIAL_ACTIVITIES,
  INITIAL_AGENTS,
  INITIAL_DATASETS,
  INITIAL_PIPELINES,
  INITIAL_SQL_HISTORY,
} from '../data/mockDatasets';
import { checkBackendHealth } from '../services/api';
import type {
  ActivityItem,
  AgentId,
  AgentState,
  AgentStatus,
  BackendHealthStatus,
  Dataset,
  FeatureImportanceItem,
  MlMetrics,
  PageId,
  SavedPipeline,
  SqlQueryRecord,
  ToastNotification,
} from '../types';

interface MlRunSnapshot {
  datasetId: string;
  targetColumn: string;
  metrics: MlMetrics;
  featureImportance: FeatureImportanceItem[];
  trainedAt: string;
}

interface CopilotContextValue {
  currentPage: PageId;
  setCurrentPage: (page: PageId) => void;
  datasets: Dataset[];
  activeDatasetId: string;
  activeDataset: Dataset;
  setActiveDatasetId: (id: string) => void;
  addDataset: (dataset: Dataset) => void;
  updateDataset: (dataset: Dataset) => void;
  agents: AgentState[];
  setAgentStatus: (id: AgentId, status: AgentStatus, task?: string, errorMessage?: string) => void;
  activities: ActivityItem[];
  logActivity: (item: Omit<ActivityItem, 'id' | 'timestamp'>) => void;
  sqlHistory: SqlQueryRecord[];
  addSqlHistory: (record: SqlQueryRecord) => void;
  pipelines: SavedPipeline[];
  savePipeline: (pipeline: SavedPipeline) => void;
  latestMlSnapshot: MlRunSnapshot | null;
  setLatestMlSnapshot: (snapshot: MlRunSnapshot) => void;
  toasts: ToastNotification[];
  notify: (type: ToastNotification['type'], title: string, message?: string) => void;
  dismissToast: (id: string) => void;
  backendHealth: BackendHealthStatus;
  refreshBackendHealth: () => Promise<void>;
}

const CopilotContext = createContext<CopilotContextValue | null>(null);

export const CopilotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [datasets, setDatasets] = useState<Dataset[]>(INITIAL_DATASETS);
  const [activeDatasetId, setActiveDatasetId] = useState<string>(INITIAL_DATASETS[0].id);
  const [agents, setAgents] = useState<AgentState[]>(INITIAL_AGENTS);
  const [activities, setActivities] = useState<ActivityItem[]>(INITIAL_ACTIVITIES);
  const [sqlHistory, setSqlHistory] = useState<SqlQueryRecord[]>(INITIAL_SQL_HISTORY);
  const [pipelines, setPipelines] = useState<SavedPipeline[]>(INITIAL_PIPELINES);
  const [latestMlSnapshot, setLatestMlSnapshot] = useState<MlRunSnapshot | null>(null);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [backendHealth, setBackendHealth] = useState<BackendHealthStatus>({
    connected: false,
    mode: 'mock',
    endpoint: 'http://localhost:8000/api',
    lastChecked: 'Checking...',
  });

  const refreshBackendHealth = useCallback(async () => {
    const status = await checkBackendHealth();
    setBackendHealth(status);
  }, []);

  useEffect(() => {
    void refreshBackendHealth();
  }, [refreshBackendHealth]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (type: ToastNotification['type'], title: string, message?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, type, title, message }]);
      setTimeout(() => {
        dismissToast(id);
      }, 4200);
    },
    [dismissToast]
  );

  const setAgentStatus = useCallback(
    (id: AgentId, status: AgentStatus, task?: string, errorMessage?: string) => {
      setAgents((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status,
                currentTask: task,
                errorMessage,
                lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              }
            : a
        )
      );
    },
    []
  );

  const logActivity = useCallback((item: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    setActivities((prev) => [
      {
        ...item,
        id: `act-${Date.now()}`,
        timestamp: 'Just now',
      },
      ...prev.slice(0, 14),
    ]);
  }, []);

  const addDataset = useCallback((dataset: Dataset) => {
    setDatasets((prev) => [dataset, ...prev]);
    setActiveDatasetId(dataset.id);
  }, []);

  const updateDataset = useCallback((updated: Dataset) => {
    setDatasets((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }, []);

  const addSqlHistory = useCallback((record: SqlQueryRecord) => {
    setSqlHistory((prev) => [record, ...prev.slice(0, 19)]);
  }, []);

  const savePipeline = useCallback((pipeline: SavedPipeline) => {
    setPipelines((prev) => {
      const exists = prev.some((p) => p.id === pipeline.id);
      if (exists) return prev.map((p) => (p.id === pipeline.id ? pipeline : p));
      return [pipeline, ...prev];
    });
  }, []);

  const activeDataset = datasets.find((d) => d.id === activeDatasetId) || datasets[0];

  return (
    <CopilotContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        datasets,
        activeDatasetId,
        activeDataset,
        setActiveDatasetId,
        addDataset,
        updateDataset,
        agents,
        setAgentStatus,
        activities,
        logActivity,
        sqlHistory,
        addSqlHistory,
        pipelines,
        savePipeline,
        latestMlSnapshot,
        setLatestMlSnapshot,
        toasts,
        notify,
        dismissToast,
        backendHealth,
        refreshBackendHealth,
      }}
    >
      {children}
    </CopilotContext.Provider>
  );
};

export function useCopilot(): CopilotContextValue {
  const ctx = useContext(CopilotContext);
  if (!ctx) {
    throw new Error('useCopilot must be used inside CopilotProvider');
  }
  return ctx;
}
