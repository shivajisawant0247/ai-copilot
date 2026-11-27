import React from 'react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { useCopilot } from '../../context/CopilotContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useCopilot();

  if (toasts.length === 0) return null;

  return (
    <div className="no-print fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
      {toasts.map((toast) => {
        const iconMap = {
          success: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />,
          error: <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />,
          warning: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />,
          info: <Info className="h-4 w-4 shrink-0 text-cyan-400" />,
        };
        const borderMap = {
          success: 'border-emerald-500/30',
          error: 'border-rose-500/30',
          warning: 'border-amber-500/30',
          info: 'border-cyan-500/30',
        };
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-xl border ${borderMap[toast.type]} bg-zinc-900/95 p-3.5 shadow-xl backdrop-blur-md`}
          >
            <div className="mt-0.5">{iconMap[toast.type]}</div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-zinc-100">{toast.title}</div>
              {toast.message && <div className="mt-0.5 text-[11px] text-zinc-400">{toast.message}</div>}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="rounded p-0.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
