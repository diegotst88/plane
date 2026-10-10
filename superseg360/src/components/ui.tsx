import Link from "next/link";
import type { QuoteDisplayStatus } from "@/lib/quote-status";
import { STATUS_LABEL } from "@/lib/quote-status";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<QuoteDisplayStatus, string> = {
  elaboracao: "bg-slate-100 text-slate-700 ring-slate-300",
  enviada: "bg-brand-50 text-brand-700 ring-brand-100",
  aprovada: "bg-accent-50 text-accent-600 ring-accent-500/30",
  recusada: "bg-red-50 text-red-700 ring-red-200",
  vencida: "bg-amber-50 text-amber-800 ring-amber-200",
};

export function StatusBadge({ status }: { status: QuoteDisplayStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success" | "warning" | "info"; children: React.ReactNode }) {
  const cls = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-accent-500/30 bg-accent-50 text-accent-600",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-brand-100 bg-brand-50 text-brand-700",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`mb-4 rounded-md border px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-3 inline-block text-sm text-brand-600 hover:underline">
      ← {children}
    </Link>
  );
}
