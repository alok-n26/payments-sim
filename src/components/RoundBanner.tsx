import type { RoundId } from "@/types";
import { ROUND_CONFIGS } from "@/lib/rounds";

const ROUND_COLORS: Record<RoundId, string> = {
  0: "from-slate-900 to-slate-800 border-slate-700",
  1: "from-sky-950 to-slate-900 border-sky-800",
  2: "from-amber-950 to-slate-900 border-amber-800",
  3: "from-blue-950 to-slate-900 border-blue-800",
  4: "from-red-950 to-slate-900 border-red-800",
  5: "from-purple-950 to-slate-900 border-purple-800",
  6: "from-rose-950 to-slate-900 border-rose-800",
};

export function RoundBanner({ round }: { round: RoundId }) {
  const config = ROUND_CONFIGS[round];
  return (
    <div className={`bg-gradient-to-r ${ROUND_COLORS[round]} border rounded-2xl p-4 animate-fade-in`}>
      <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">
        {round === 0 ? "Lobby" : `Round ${round}`}
      </div>
      <div className="text-lg font-bold text-white">{config.title}</div>
      <div className="text-sm text-slate-400 mt-1">{config.concept}</div>
    </div>
  );
}
