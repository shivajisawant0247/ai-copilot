import React, { useState } from 'react';
import {
  Bot,
  MessageSquareCode,
  Send,
  Sparkles,
  User,
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
import { Badge, Button, Card, MockDataPill } from '../components/ui/Primitives';
import { useCopilot } from '../context/CopilotContext';
import { sendChatPrompt } from '../services/api';
import type { ChatMessage } from '../types';

const SUGGESTED_PROMPTS = [
  'Show top revenue or spend breakdown with a chart',
  'Audit data quality and missing values',
  'Summarize the schema and first 5 rows',
];

export const AiChatPage: React.FC = () => {
  const { activeDataset, setAgentStatus, logActivity } = useCopilot();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: `Connected to **${activeDataset.name}** (${activeDataset.rowCount} rows, ${activeDataset.columnCount} columns). Ask any question to receive structured answers, tables, charts, and analytical insights.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      insights: [
        `Active dataset quality score: ${activeDataset.quality.overallScore}%.`,
        'Try one of the suggested prompts below to generate a chart or audit.',
      ],
      isMocked: true,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (promptText?: string) => {
    const query = (promptText ?? input).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setAgentStatus('analytics', 'Processing', 'Answering data chat query');

    try {
      const { message } = await sendChatPrompt(query, activeDataset);
      setMessages((prev) => [...prev, message]);
      setAgentStatus('analytics', 'Completed', 'Chat response generated');
      logActivity({
        agent: 'analytics',
        action: 'Answered AI Data Chat query',
        datasetName: activeDataset.fileName,
        status: 'info',
        details: query,
      });
    } catch {
      setAgentStatus('analytics', 'Error', 'Chat response failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-11.5rem)] min-h-[540px] flex-col gap-4">
      <Card className="flex flex-1 flex-col overflow-hidden">
        {/* Chat Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <MessageSquareCode className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-semibold text-zinc-100">Conversational Data Copilot</span>
            <Badge variant="cyan">{activeDataset.name}</Badge>
          </div>
          <MockDataPill label="Simulated LangGraph Chat" />
        </div>

        {/* Message Stream */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-3xl space-y-3 rounded-xl border p-4 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'border-cyan-500/30 bg-cyan-500/10 text-zinc-100'
                    : 'border-white/[0.08] bg-zinc-900/70 text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between gap-4 text-[10px] text-zinc-500">
                  <span className="font-semibold uppercase tracking-wider">
                    {msg.role === 'user' ? 'You' : 'DataCopilot Agent'}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                <p className="whitespace-pre-wrap text-xs text-zinc-200">
                  {msg.content.replace(/\*\*/g, '')}
                </p>

                {/* Inline Insights */}
                {msg.insights && msg.insights.length > 0 && (
                  <div className="space-y-1 rounded-lg border border-violet-500/20 bg-violet-500/[0.07] p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-300">
                      <Sparkles className="h-3 w-3" /> Key Insights
                    </div>
                    <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-zinc-300">
                      {msg.insights.map((ins, i) => (
                        <li key={i}>{ins}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Inline Chart */}
                {msg.chart && (
                  <div className="rounded-lg border border-white/[0.07] bg-zinc-950/70 p-3">
                    <div className="mb-2 text-[11px] font-semibold text-zinc-300">{msg.chart.title}</div>
                    <div className="h-48 w-full min-w-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={msg.chart.data}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey={msg.chart.xKey} stroke="#71717a" fontSize={10} />
                          <YAxis stroke="#71717a" fontSize={10} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#111115', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                          />
                          <Bar dataKey={msg.chart.yKey} fill="#06b6d4" radius={[5, 5, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Inline Table */}
                {msg.table && (
                  <div className="overflow-x-auto rounded-lg border border-white/[0.07] bg-zinc-950/70">
                    <table className="w-full text-left text-[11px]">
                      <thead className="border-b border-white/[0.06] bg-zinc-900 text-zinc-400">
                        <tr>
                          {msg.table.columns.map((c) => (
                            <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {msg.table.rows.map((r, rIdx) => (
                          <tr key={rIdx}>
                            {msg.table!.columns.map((c) => (
                              <td key={c} className="whitespace-nowrap px-3 py-1.5 font-mono text-zinc-300">
                                {r[c] === null || r[c] === undefined ? 'NULL' : String(r[c])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-800 text-zinc-300">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Bot className="h-4 w-4 animate-pulse text-cyan-400" />
              <span>Analyzing {activeDataset.name} via LangGraph...</span>
            </div>
          )}
        </div>

        {/* Suggested Prompts & Input Bar */}
        <div className="border-t border-white/[0.06] bg-zinc-950/70 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => void handleSend(p)}
                className="rounded-lg border border-white/[0.08] bg-zinc-900/70 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-cyan-500/30 hover:text-cyan-300"
              >
                {p}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask a question about ${activeDataset.name}...`}
              className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-500/50 focus:outline-none"
            />
            <Button type="submit" loading={isLoading} disabled={!input.trim()}>
              <Send className="h-4 w-4" />
              Send
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};
