import type { Participant, RoundId } from "@/types";
import { ROUND_CONFIGS } from "@/lib/rounds";

interface Props {
  participant: Participant;
  round: RoundId;
  blockchainMode: boolean;
  chainSplit: boolean;
  participantCount: number;
}

export function BankCard({ participant, round, blockchainMode, chainSplit, participantCount }: Props) {
  const roundConfig = ROUND_CONFIGS[round];

  return (
    <div className={`card relative overflow-hidden ${
      participant.isFrozen ? "border-slate-600 opacity-75" :
      participant.isSanctioned ? "border-red-700" :
      blockchainMode ? "border-purple-700" :
      "border-sky-800"
    }`}>
      {/* Background glow */}
      <div className={`absolute inset-0 opacity-10 ${
        participant.isFrozen ? "bg-slate-500" :
        participant.isSanctioned ? "bg-red-600" :
        blockchainMode ? "bg-purple-600" :
        "bg-sky-600"
      }`} />

      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Your bank</div>
            <div className="text-2xl font-black text-white">{participant.displayName}</div>
            <div className="text-sm text-slate-400">Bank #{participant.bankId}</div>
          </div>
          <div className="text-right">
            {participant.isFrozen ? (
              <div className="badge-red text-sm px-3 py-1">🔐 Frozen</div>
            ) : participant.isSanctioned ? (
              <div className="badge-red text-sm px-3 py-1">🚫 Sanctioned</div>
            ) : participant.isCorrespondent ? (
              <div className="badge-yellow text-sm px-3 py-1">★ Correspondent</div>
            ) : blockchainMode ? (
              <div className="badge-purple text-sm px-3 py-1">⛓ On-chain</div>
            ) : (
              <div className="badge-blue text-sm px-3 py-1">🏦 Active</div>
            )}
            {chainSplit && participant.chainId && (
              <div className={`mt-1 text-xs px-2 py-0.5 rounded-full ${
                participant.chainId === "A" ? "bg-sky-900/60 text-sky-300 border border-sky-700" : "bg-violet-900/60 text-violet-300 border border-violet-700"
              }`}>
                Chain {participant.chainId}
              </div>
            )}
            {round === 4 && participant.currency && !participant.isCorrespondent && (
              <div className={`mt-1 text-xs px-2 py-0.5 rounded-full font-mono ${
                participant.currency === "EUR"
                  ? "bg-blue-900/60 text-blue-300 border border-blue-700"
                  : "bg-green-900/60 text-green-300 border border-green-700"
              }`}>
                {participant.currency === "EUR" ? "€ EUR" : "$ USD"}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-4xl font-black text-white">
            {round === 4 && participant.currency === "USD" ? "$" : "€"}{participant.balance.toLocaleString()}
          </span>
          <span className="text-slate-400 text-sm">balance</span>
        </div>

        <div className="border-t border-slate-700/50 pt-2">
          <div className="text-xs text-slate-500">
            Round {round} · {participantCount} participant{participantCount !== 1 ? "s" : ""} · {roundConfig.title}
          </div>
        </div>
      </div>
    </div>
  );
}
