import React, { useState } from 'react';
import {
  Clock,
  DatabaseZap,
  Download,
  History,
  Play,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { Badge, Button, Card, CardHeader, EmptyState, MockDataPill } from '../components/ui/Primitives';
import { useCopilot } from '../context/CopilotContext';
import { executeSqlQuery, generateSqlFromNaturalLanguage } from '../services/api';
import type { SqlExecutionResult } from '../types';
import { exportRowsToCsv } from '../utils/dataHelpers';

const SUGGESTED_NL_PROMPTS = [
  'Show total revenue and record count grouped by region',
  'Calculate average unit price by category',
  'List top 10 records sorted descending',
];

export const SqlAgentPage: React.FC = () => {
  const { activeDataset, sqlHistory, addSqlHistory, setAgentStatus, logActivity, notify } = useCopilot();

  const [nlPrompt, setNlPrompt] = useState('');
  const [sql, setSql] = useState(
    `SELECT ${activeDataset.schema.slice(0, 5).map((s) => s.name).join(', ')}\nFROM ${activeDataset.id.replace(/-/g, '_')}\nLIMIT 12;`
  );
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<SqlExecutionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerateSql = async (customPrompt?: string) => {
    const queryPrompt = (customPrompt ?? nlPrompt).trim();
    if (!queryPrompt) {
      notify('warning', 'Enter a question first', 'Describe what you want to query in plain English.');
      return;
    }
    setNlPrompt(queryPrompt);
    setIsGenerating(true);
    setErrorMsg(null);
    setAgentStatus('sql', 'Processing', 'Translating NL to DuckDB SQL');

    try {
      const res = await generateSqlFromNaturalLanguage(queryPrompt, activeDataset);
      setSql(res.sql);
      setExplanation(res.explanation);
      setAgentStatus('sql', 'Completed', 'SQL generated');
      notify('info', 'SQL generated', res.isMocked ? 'Generated via Mock SQL Agent.' : 'Generated via LangGraph SQL Agent.');
    } catch (err) {
      setAgentStatus('sql', 'Error', 'Generation failed');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate SQL');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecuteSql = async () => {
    if (!sql.trim()) return;
    setIsExecuting(true);
    setErrorMsg(null);
    setAgentStatus('sql', 'Processing', 'Executing SQL query');

    try {
      const res = await executeSqlQuery(sql, activeDataset);
      setResult(res);
      setAgentStatus('sql', 'Completed', `Returned ${res.rowCount} rows in ${res.executionTimeMs}ms`);
      addSqlHistory({
        id: `sql-${Date.now()}`,
        prompt: nlPrompt || undefined,
        sql,
        executedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        executionTimeMs: res.executionTimeMs,
        rowCount: res.rowCount,
        status: 'success',
      });
      logActivity({
        agent: 'sql',
        action: 'Executed SQL query',
        datasetName: activeDataset.fileName,
        status: 'success',
        details: `${res.rowCount} rows returned in ${res.executionTimeMs} ms.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SQL execution failed';
      setErrorMsg(msg);
      setAgentStatus('sql', 'Error', msg);
      addSqlHistory({
        id: `sql-${Date.now()}`,
        prompt: nlPrompt || undefined,
        sql,
        executedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        executionTimeMs: 0,
        rowCount: 0,
        status: 'error',
        errorMessage: msg,
      });
      notify('error', 'Query error', msg);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Natural Language to SQL bar */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Natural Language to SQL</h2>
          </div>
          <MockDataPill label="DuckDB / PostgreSQL Dialect" />
        </div>

        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
          <input
            type="text"
            value={nlPrompt}
            onChange={(e) => setNlPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleGenerateSql();
            }}
            placeholder={`Ask about ${activeDataset.name} (e.g., "Show total revenue by region")...`}
            className="flex-1 rounded-lg border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-500/50 focus:outline-none"
          />
          <Button onClick={() => void handleGenerateSql()} loading={isGenerating}>
            <Sparkles className="h-4 w-4" />
            Generate SQL
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-zinc-500">Try:</span>
          {SUGGESTED_NL_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => void handleGenerateSql(p)}
              className="rounded-md border border-white/[0.08] bg-zinc-900/70 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-cyan-500/30 hover:text-cyan-300"
            >
              {p}
            </button>
          ))}
        </div>

        {explanation && (
          <div className="mt-3 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3.5 py-2 text-xs text-violet-200">
            {explanation}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* SQL Editor + Result Table */}
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="SQL Editor"
              subtitle={`Target table: ${activeDataset.id.replace(/-/g, '_')} (${activeDataset.rowCount} rows)`}
              action={
                <div className="flex items-center gap-2">
                  {result && (
                    <Badge variant="emerald">
                      <Clock className="h-3 w-3" />
                      {result.executionTimeMs} ms
                    </Badge>
                  )}
                  <Button size="sm" onClick={() => void handleExecuteSql()} loading={isExecuting}>
                    <Play className="h-3.5 w-3.5" />
                    Execute Query
                  </Button>
                </div>
              }
            />
            <div className="p-4">
              <textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                rows={6}
                spellCheck={false}
                className="w-full rounded-lg border border-white/10 bg-[#09090c] p-3.5 font-mono text-xs leading-relaxed text-cyan-200 focus:border-cyan-500/40 focus:outline-none"
              />
              {errorMsg && (
                <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
                  {errorMsg}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Query Results"
              subtitle={
                result
                  ? `${result.rowCount} rows returned in ${result.executionTimeMs} ms`
                  : 'Execute a SQL query to inspect results'
              }
              action={
                result && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      exportRowsToCsv(result.columns, result.rows, `${activeDataset.id}_query_result.csv`);
                      notify('success', 'CSV exported', 'Query results downloaded.');
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </Button>
                )
              }
            />
            {result ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.06] bg-zinc-900/70 text-[11px] uppercase tracking-wider text-zinc-400">
                    <tr>
                      {result.columns.map((c) => (
                        <th key={c} className="whitespace-nowrap px-4 py-2.5 font-medium">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {result.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        {result.columns.map((c) => (
                          <td key={c} className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-zinc-200">
                            {row[c] === null || row[c] === undefined ? 'NULL' : String(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={<Terminal className="h-5 w-5" />}
                  title="No query executed yet"
                  description="Write a SELECT statement or generate one from natural language, then click Execute Query."
                />
              </div>
            )}
          </Card>
        </div>

        {/* Query History & Schema Reference */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Query History"
              subtitle="Click any past query to reload it"
              action={<History className="h-4 w-4 text-zinc-400" />}
            />
            <div className="max-h-80 divide-y divide-white/[0.06] overflow-y-auto">
              {sqlHistory.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSql(item.sql);
                    if (item.prompt) setNlPrompt(item.prompt);
                  }}
                  className="w-full px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={item.status === 'success' ? 'emerald' : 'rose'}>
                      {item.status === 'success' ? `${item.executionTimeMs} ms` : 'Error'}
                    </Badge>
                    <span className="text-[10px] text-zinc-500">{item.executedAt}</span>
                  </div>
                  {item.prompt && <div className="mt-1.5 truncate text-xs font-medium text-zinc-200">{item.prompt}</div>}
                  <pre className="mt-1 truncate font-mono text-[10px] text-zinc-400">{item.sql}</pre>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Available Columns"
              subtitle={activeDataset.fileName}
              action={<DatabaseZap className="h-4 w-4 text-cyan-400" />}
            />
            <div className="max-h-64 divide-y divide-white/[0.05] overflow-y-auto px-4 py-1">
              {activeDataset.schema.map((col) => (
                <div key={col.name} className="flex items-center justify-between py-2 text-xs">
                  <span className="font-mono text-zinc-200">{col.name}</span>
                  <span className="text-[11px] text-zinc-500">{col.type}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
