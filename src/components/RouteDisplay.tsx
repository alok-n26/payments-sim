import type { PaymentRoute, ClientState } from "@/types";

interface Props {
  route: PaymentRoute;
  allParticipants: ClientState["allParticipants"];
}

function label(id: string, all: ClientState["allParticipants"]) {
  if (id === "bridge") return "🌉 Bridge";
  const p = all.find((x) => x.id === id);
  return p ? (p.isCorrespondent ? `★ ${p.displayName}` : p.displayName) : id.slice(0, 8);
}

export function RouteDisplay({ route, allParticipants }: Props) {
  return (
    <div className="flex items-center flex-wrap gap-1 text-xs text-slate-400">
      {route.hops.map((hop, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-slate-600">→</span>}
          <span className={`px-2 py-0.5 rounded-full border ${
            hop === "bridge"
              ? "bg-purple-900/40 border-purple-600/50 text-purple-300"
              : allParticipants.find((p) => p.id === hop)?.isCorrespondent
              ? "bg-amber-900/40 border-amber-600/50 text-amber-300"
              : "bg-slate-800 border-slate-600 text-slate-300"
          }`}>
            {label(hop, allParticipants)}
          </span>
        </span>
      ))}
      {route.fees > 0 && (
        <span className="ml-2 text-red-400">−€{route.fees} fees</span>
      )}
    </div>
  );
}
