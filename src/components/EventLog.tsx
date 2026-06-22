import type { SimEvent, EventKind } from "@/types";

const KIND_ICON: Record<EventKind, string> = {
  round_change:       "🔄",
  participant_joined: "👋",
  payment_initiated:  "📤",
  payment_settled:    "✅",
  payment_failed:     "❌",
  payment_blocked:    "🚫",
  compliance_check:   "🔍",
  compliance_passed:  "✅",
  compliance_failed:  "❌",
  key_lost:           "🔐",
  fraud_detected:     "⚠️",
  wallet_sanctioned:  "🚫",
  ledger_updated:     "📒",
  chain_split:        "⛓️",
  bridge_attempt:     "🌉",
  system:             "ℹ️",
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface Props {
  events: SimEvent[];
  maxItems?: number;
  compact?: boolean;
}

export function EventLog({ events, maxItems = 20, compact = false }: Props) {
  const shown = events.slice(0, maxItems);

  return (
    <div className={`space-y-1 ${compact ? "" : "max-h-64 overflow-y-auto"}`}>
      {shown.length === 0 && (
        <p className="text-slate-500 text-sm italic">No events yet.</p>
      )}
      {shown.map((ev) => (
        <div
          key={ev.id}
          className="flex gap-2 items-start text-xs animate-slide-in"
        >
          <span className="shrink-0 mt-0.5">{KIND_ICON[ev.kind]}</span>
          <div className="flex-1 min-w-0">
            <span className="text-slate-300 break-words">{ev.message}</span>
          </div>
          <span className="shrink-0 text-slate-600 tabular-nums">{formatTime(ev.timestamp)}</span>
        </div>
      ))}
    </div>
  );
}
