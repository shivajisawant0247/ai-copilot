import React from 'react';
import { Loader2 } from 'lucide-react';
import type { AgentStatus } from '../../types';

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div
    className={`rounded-xl border border-white/[0.08] bg-[#111115]/90 backdrop-blur-md transition-colors duration-200 ${className}`}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, action, className = '' }) => (
  <div className={`flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4 ${className}`}>
    <div>
      <h3 className="text-sm font-semibold tracking-tight text-zinc-100">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-zinc-400">{subtitle}</p>}
    </div>
    {action && <div className="flex items-center gap-2">{action}</div>}
  </div>
);

export const Badge: React.FC<{
  children: React.ReactNode;
  variant?: 'default' | 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose' | 'blue';
  className?: string;
}> = ({ children, variant = 'default', className = '' }) => {
  const styles: Record<string, string> = {
    default: 'border-white/10 bg-zinc-800/80 text-zinc-300',
    cyan: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300',
    blue: 'border-blue-500/25 bg-blue-500/10 text-blue-300',
    violet: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
    emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    rose: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export const AgentStatusBadge: React.FC<{ status: AgentStatus }> = ({ status }) => {
  if (status === 'Processing') {
    return (
      <Badge variant="cyan">
        <Loader2 className="h-3 w-3 animate-spin" />
        Processing
      </Badge>
    );
  }
  if (status === 'Completed') {
    return (
      <Badge variant="emerald">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Completed
      </Badge>
    );
  }
  if (status === 'Error') {
    return (
      <Badge variant="rose">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        Error
      </Badge>
    );
  }
  return (
    <Badge variant="default">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
      Idle
    </Badge>
  );
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md';
    loading?: boolean;
  }
> = ({ variant = 'primary', size = 'md', loading = false, children, className = '', disabled, ...props }) => {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50';
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  };
  const variants = {
    primary: 'bg-cyan-500 text-zinc-950 hover:bg-cyan-400 shadow-sm shadow-cyan-500/10',
    secondary: 'border border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:border-white/20',
    ghost: 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100',
    danger: 'border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
  };

  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
};

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-zinc-950/40 px-6 py-12 text-center">
    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-zinc-900 text-zinc-400">
      {icon}
    </div>
    <h4 className="text-sm font-semibold text-zinc-200">{title}</h4>
    <p className="mt-1 max-w-sm text-xs text-zinc-400">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const MockDataPill: React.FC<{ label?: string }> = ({ label = 'Mock / Local Preview' }) => (
  <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">
    {label}
  </span>
);
