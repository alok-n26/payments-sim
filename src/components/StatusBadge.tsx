import type { PaymentStatus } from "@/types";

const CONFIG: Record<PaymentStatus, { label: string; cls: string; dot: string }> = {
  pending:          { label: "Pending",          cls: "badge-gray",   dot: "bg-slate-400" },
  routing:          { label: "Routing…",         cls: "badge-blue",   dot: "bg-sky-400 animate-pulse" },
  message_sent:     { label: "Message Sent",     cls: "badge-blue",   dot: "bg-sky-400 animate-pulse" },
  compliance_hold:  { label: "Compliance Hold",  cls: "badge-yellow", dot: "bg-amber-400 animate-pulse" },
  settled:          { label: "Settled",          cls: "badge-green",  dot: "bg-emerald-400" },
  failed:           { label: "Failed",           cls: "badge-red",    dot: "bg-red-400" },
  blocked:          { label: "Blocked",          cls: "badge-red",    dot: "bg-red-500" },
  reversed:         { label: "Reversed",         cls: "badge-purple", dot: "bg-purple-400" },
};

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const c = CONFIG[status];
  return (
    <span className={c.cls}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
