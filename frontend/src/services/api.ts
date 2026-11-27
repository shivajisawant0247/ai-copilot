import type {
  BackendHealthStatus,
  ChatChartConfig,
  ChatMessage,
  CleaningRecommendation,
  DataRow,
  Dataset,
  FeatureImportanceItem,
  MlMetrics,
  MlProblemType,
  PipelineStageConfig,
  SqlExecutionResult,
} from '../types';
import {
  applyCleaningToDataset,
  buildRecommendationsForDataset,
  executeLocalSqlPreview,
} from '../utils/dataHelpers';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8000/api';

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkBackendHealth(): Promise<BackendHealthStatus> {
  try {
    const res = await requestJson<{ status: string }>('/health');
    if (res.status === 'ok') {
      return {
        connected: true,
        mode: 'live',
        endpoint: API_BASE_URL,
        lastChecked: new Date().toLocaleTimeString(),
      };
    }
  } catch {
    // FastAPI backend not reachable — operate cleanly in Mock / Demo Mode
  }
  return {
    connected: false,
    mode: 'mock',
    endpoint: API_BASE_URL,
    lastChecked: new Date().toLocaleTimeString(),
  };
}

export async function uploadDatasetToBackend(
  file: File,
  parsedDataset: Dataset
): Promise<{ dataset: Dataset; isMocked: boolean }> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${API_BASE_URL}/datasets/upload`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { dataset: Dataset };
      return { dataset: data.dataset, isMocked: false };
    }
  } catch {
    // Fall back to client-parsed dataset
  }
  return { dataset: parsedDataset, isMocked: true };
}

export async function analyzeCleaningIssues(
  dataset: Dataset
): Promise<{ recommendations: CleaningRecommendation[]; isMocked: boolean }> {
  try {
    const res = await requestJson<{ recommendations: CleaningRecommendation[] }>('/agents/cleaning/analyze', {
      method: 'POST',
      body: JSON.stringify({ dataset_id: dataset.id, schema: dataset.schema, quality: dataset.quality }),
    });
    return { recommendations: res.recommendations, isMocked: false };
  } catch {
    await new Promise((r) => setTimeout(r, 650));
    return { recommendations: buildRecommendationsForDataset(dataset), isMocked: true };
  }
}

export async function applyCleaningPlan(
  dataset: Dataset,
  recommendations: CleaningRecommendation[]
): Promise<{ cleanedDataset: Dataset; isMocked: boolean }> {
  try {
    const res = await requestJson<{ dataset: Dataset }>('/agents/cleaning/apply', {
      method: 'POST',
      body: JSON.stringify({ dataset_id: dataset.id, recommendations }),
    });
    return { cleanedDataset: res.dataset, isMocked: false };
  } catch {
    await new Promise((r) => setTimeout(r, 850));
    return { cleanedDataset: applyCleaningToDataset(dataset, recommendations), isMocked: true };
  }
}

export async function generateSqlFromNaturalLanguage(
  prompt: string,
  dataset: Dataset
): Promise<{ sql: string; explanation: string; isMocked: boolean }> {
  try {
    const res = await requestJson<{ sql: string; explanation: string }>('/agents/sql/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        dataset_id: dataset.id,
        columns: dataset.schema.map((s) => ({ name: s.name, type: s.type })),
      }),
    });
    return { ...res, isMocked: false };
  } catch {
    await new Promise((r) => setTimeout(r, 600));
    const lower = prompt.toLowerCase();
    const catCol = dataset.schema.find((s) => s.type === 'categorical' || s.type === 'string')?.name || dataset.schema[0]?.name || 'id';
    const numCol = dataset.schema.find((s) => s.type === 'float' || s.type === 'integer')?.name || dataset.schema[1]?.name || catCol;
    const groupCol =
      dataset.schema.find((s) => lower.includes(s.name.toLowerCase()) && (s.type === 'categorical' || s.type === 'string'))?.name ||
      dataset.schema.find((s) => s.type === 'categorical')?.name ||
      catCol;

    if (lower.includes('average') || lower.includes('avg') || lower.includes('mean')) {
      return {
        sql: `SELECT ${groupCol}, COUNT(*) AS record_count, AVG(${numCol}) AS avg_${numCol}\nFROM ${dataset.id.replace(/-/g, '_')}\nGROUP BY ${groupCol}\nORDER BY avg_${numCol} DESC\nLIMIT 20;`,
        explanation: `Mock SQL Agent: Aggregated average ${numCol} grouped by ${groupCol}.`,
        isMocked: true,
      };
    }

    if (lower.includes('total') || lower.includes('sum') || lower.includes('by ') || lower.includes('group')) {
      return {
        sql: `SELECT ${groupCol}, COUNT(*) AS record_count, SUM(${numCol}) AS total_${numCol}\nFROM ${dataset.id.replace(/-/g, '_')}\nGROUP BY ${groupCol}\nORDER BY total_${numCol} DESC\nLIMIT 20;`,
        explanation: `Mock SQL Agent: Computed sum of ${numCol} and record counts by ${groupCol}.`,
        isMocked: true,
      };
    }

    const previewCols = dataset.schema.slice(0, 6).map((s) => s.name).join(', ');
    return {
      sql: `SELECT ${previewCols}\nFROM ${dataset.id.replace(/-/g, '_')}\nORDER BY ${numCol} DESC\nLIMIT 15;`,
      explanation: `Mock SQL Agent: Selected key columns ordered by ${numCol} descending.`,
      isMocked: true,
    };
  }
}

export async function executeSqlQuery(sql: string, dataset: Dataset): Promise<SqlExecutionResult> {
  try {
    const res = await requestJson<SqlExecutionResult>('/agents/sql/execute', {
      method: 'POST',
      body: JSON.stringify({ sql, dataset_id: dataset.id }),
    });
    return { ...res, isMocked: false };
  } catch {
    await new Promise((r) => setTimeout(r, 320));
    return executeLocalSqlPreview(sql, dataset);
  }
}

export async function runMlTraining(
  dataset: Dataset,
  targetColumn: string,
  algorithm: string
): Promise<{
  metrics: MlMetrics;
  featureImportance: FeatureImportanceItem[];
  isMocked: boolean;
}> {
  try {
    const res = await requestJson<{ metrics: MlMetrics; featureImportance: FeatureImportanceItem[] }>('/agents/ml/train', {
      method: 'POST',
      body: JSON.stringify({ dataset_id: dataset.id, target_column: targetColumn, algorithm }),
    });
    return { ...res, isMocked: false };
  } catch {
    await new Promise((r) => setTimeout(r, 1100));
    const targetSchema = dataset.schema.find((s) => s.name === targetColumn);
    const nonNull = dataset.rows.map((r) => r[targetColumn]).filter((v) => v !== null && v !== undefined);
    const uniqueVals = new Set(nonNull.map(String)).size;

    const isClassification: boolean =
      targetSchema?.type === 'boolean' ||
      targetSchema?.type === 'categorical' ||
      targetSchema?.type === 'string' ||
      uniqueVals <= 5;

    const problemType: MlProblemType = isClassification ? 'classification' : 'regression';
    const featureCols = dataset.schema.filter((s) => s.name !== targetColumn).slice(0, 7);

    // Deterministic pseudo-random weights from column names for realistic, consistent mock UI
    const rawWeights = featureCols.map((col, idx) => {
      const seed = col.name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      return { feature: col.name, raw: ((seed % 40) + 15) / (idx * 0.25 + 1) };
    });
    const totalWeight = rawWeights.reduce((a, b) => a + b.raw, 0) || 1;
    const featureImportance: FeatureImportanceItem[] = rawWeights
      .map((w) => ({
        feature: w.feature,
        importance: Number(((w.raw / totalWeight) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.importance - a.importance);

    const trainRows = Math.max(1, Math.round(dataset.rowCount * 0.8));
    const testRows = Math.max(1, dataset.rowCount - trainRows);

    const metrics: MlMetrics =
      problemType === 'classification'
        ? {
            problemType,
            algorithm,
            accuracy: 0.914,
            precision: 0.902,
            recall: 0.889,
            f1Score: 0.895,
            trainingTimeSec: 1.42,
            trainRows,
            testRows,
          }
        : {
            problemType,
            algorithm,
            r2Score: 0.876,
            rmse: 142.35,
            mae: 98.12,
            trainingTimeSec: 1.68,
            trainRows,
            testRows,
          };

    return { metrics, featureImportance, isMocked: true };
  }
}

export async function runMlPrediction(
  datasetId: string,
  targetColumn: string,
  problemType: MlProblemType,
  features: Record<string, string | number | boolean>
): Promise<{ prediction: string | number; confidence: number; isMocked: boolean }> {
  try {
    const res = await requestJson<{ prediction: string | number; confidence: number }>('/agents/ml/predict', {
      method: 'POST',
      body: JSON.stringify({ dataset_id: datasetId, target_column: targetColumn, features }),
    });
    return { ...res, isMocked: false };
  } catch {
    await new Promise((r) => setTimeout(r, 450));
    const numericSum = Object.values(features).reduce<number>((acc, val) => {
      const n = Number(val);
      return Number.isNaN(n) ? acc + String(val).length * 7 : acc + n;
    }, 0);

    if (problemType === 'classification') {
      const highTickets = Number(features.support_tickets || 0) >= 5 || features.returned === true || features.auto_renew === false;
      return {
        prediction: targetColumn.includes('churn') ? (highTickets ? '1 (Churn Risk)' : '0 (Retained)') : highTickets ? 'True' : 'False',
        confidence: highTickets ? 0.88 : 0.93,
        isMocked: true,
      };
    }

    const predictedVal = Number((numericSum * 1.35 + 120).toFixed(2));
    return {
      prediction: predictedVal,
      confidence: 0.86,
      isMocked: true,
    };
  }
}

export async function sendChatPrompt(
  prompt: string,
  dataset: Dataset
): Promise<{ message: ChatMessage; isMocked: boolean }> {
  try {
    const res = await requestJson<{ message: ChatMessage }>('/agents/chat', {
      method: 'POST',
      body: JSON.stringify({ prompt, dataset_id: dataset.id }),
    });
    return { message: res.message, isMocked: false };
  } catch {
    await new Promise((r) => setTimeout(r, 750));
    const lower = prompt.toLowerCase();
    const catCol = dataset.schema.find((s) => s.type === 'categorical')?.name || dataset.schema.find((s) => s.type === 'string')?.name || dataset.schema[0]?.name;
    const numCol = dataset.schema.find((s) => s.type === 'float' || s.type === 'integer')?.name;

    let chart: ChatChartConfig | undefined;
    let table: { columns: string[]; rows: DataRow[] } | undefined;
    let content = '';
    let insights: string[] = [];

    if (catCol && numCol && (lower.includes('chart') || lower.includes('top') || lower.includes('revenue') || lower.includes('breakdown') || lower.includes('compare') || lower.includes('spend'))) {
      const grouped = new Map<string, { sum: number; count: number }>();
      dataset.rows.forEach((r) => {
        const key = String(r[catCol] ?? 'Unknown');
        const val = Number(r[numCol]) || 0;
        const curr = grouped.get(key) || { sum: 0, count: 0 };
        grouped.set(key, { sum: curr.sum + val, count: curr.count + 1 });
      });

      const chartData = [...grouped.entries()]
        .map(([name, stats]) => ({
          name,
          value: Number(stats.sum.toFixed(2)),
          count: stats.count,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      chart = {
        type: 'bar',
        title: `${numCol} by ${catCol} (Simulated Preview)`,
        xKey: 'name',
        yKey: 'value',
        data: chartData,
      };

      table = {
        columns: [catCol, 'records', `total_${numCol}`],
        rows: chartData.map((d) => ({
          [catCol]: d.name,
          records: d.count,
          [`total_${numCol}`]: d.value,
        })),
      };

      const leader = chartData[0];
      content = `Based on **${dataset.name}** (${dataset.rowCount} rows), I aggregated \`${numCol}\` across \`${catCol}\`. **${leader?.name ?? 'N/A'}** leads with a total of **${leader?.value.toLocaleString() ?? 0}** across ${leader?.count ?? 0} records.`;
      insights = [
        `Top segment "${leader?.name}" accounts for a leading share of ${numCol}.`,
        `Dataset quality score is currently ${dataset.quality.overallScore}%.`,
      ];
    } else if (lower.includes('quality') || lower.includes('missing') || lower.includes('clean') || lower.includes('anomal')) {
      const issueCols = dataset.schema.filter((s) => s.missingCount > 0 || s.issue);
      content = `Data quality audit for **${dataset.name}** shows an overall score of **${dataset.quality.overallScore}%** with **${dataset.quality.missingCells}** missing cells, **${dataset.quality.duplicateRows}** duplicate rows, and **${dataset.quality.outlierCount}** statistical outliers.`;
      table = {
        columns: ['column', 'type', 'missing', 'issue'],
        rows: (issueCols.length > 0 ? issueCols : dataset.schema.slice(0, 5)).map((c) => ({
          column: c.name,
          type: c.type,
          missing: c.missingCount,
          issue: c.issue || 'Healthy',
        })),
      };
      insights = [
        `Completeness is ${dataset.quality.completeness}% and Uniqueness is ${dataset.quality.uniqueness}%.`,
        `Open the Data Cleaning Agent to apply automated imputation and deduplication.`,
      ];
    } else {
      const previewCols = dataset.schema.slice(0, 5).map((s) => s.name);
      content = `Here is a structural summary of **${dataset.name}**: **${dataset.rowCount} rows** and **${dataset.columnCount} columns**. Below are the first 5 records and detected schema highlights.`;
      table = {
        columns: previewCols,
        rows: dataset.rows.slice(0, 5).map((r) => {
          const obj: DataRow = {};
          previewCols.forEach((c) => {
            obj[c] = r[c];
          });
          return obj;
        }),
      };
      insights = [
        `Numeric columns detected: ${dataset.schema.filter((s) => s.type === 'integer' || s.type === 'float').map((s) => s.name).join(', ') || 'None'}.`,
        `Categorical dimensions: ${dataset.schema.filter((s) => s.type === 'categorical' || s.type === 'string').slice(0, 3).map((s) => s.name).join(', ')}.`,
      ];
    }

    return {
      isMocked: true,
      message: {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        table,
        chart,
        insights,
        isMocked: true,
      },
    };
  }
}

export async function runPipelineOnBackend(
  datasetId: string,
  stages: PipelineStageConfig[]
): Promise<{ ok: boolean; isMocked: boolean }> {
  try {
    await requestJson<{ ok: boolean }>('/agents/etl/run', {
      method: 'POST',
      body: JSON.stringify({ dataset_id: datasetId, stages }),
    });
    return { ok: true, isMocked: false };
  } catch {
    return { ok: true, isMocked: true };
  }
}

export async function generateExecutiveReportSummary(
  dataset: Dataset
): Promise<{ executiveSummary: string; recommendations: string[]; isMocked: boolean }> {
  try {
    const res = await requestJson<{ executiveSummary: string; recommendations: string[] }>('/agents/report/generate', {
      method: 'POST',
      body: JSON.stringify({ dataset_id: dataset.id }),
    });
    return { ...res, isMocked: false };
  } catch {
    await new Promise((r) => setTimeout(r, 800));
    return {
      executiveSummary: `Automated audit of ${dataset.name} (${dataset.rowCount} records, ${dataset.columnCount} features) yields an overall data readiness score of ${dataset.quality.overallScore}%. Completeness stands at ${dataset.quality.completeness}% with ${dataset.quality.missingCells} missing values and ${dataset.quality.duplicateRows} duplicate rows detected. Once cleaned, the dataset is suitable for warehouse ingestion into DuckDB/PostgreSQL and downstream predictive modeling.`,
      recommendations: [
        dataset.quality.missingCells > 0
          ? `Impute ${dataset.quality.missingCells} missing cells before warehouse promotion.`
          : 'Zero missing values detected; schema passes strict completeness checks.',
        dataset.quality.duplicateRows > 0
          ? `Deduplicate ${dataset.quality.duplicateRows} repeated record(s) on primary keys.`
          : 'Uniqueness check passed with 0 duplicate rows.',
        'Schedule incremental ETL validation via LangGraph ETL Pipeline Agent.',
      ],
      isMocked: true,
    };
  }
}
