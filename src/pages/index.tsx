import { useState } from "react";
import Head from "next/head";
import { useParticipant } from "@/hooks/useParticipant";
import { BankCard } from "@/components/BankCard";
import { RoundBanner } from "@/components/RoundBanner";
import { PaymentCard } from "@/components/PaymentCard";
import { EventLog } from "@/components/EventLog";

export default function JoinPage() {
  const { participant, clientState, error, joining, join, sendPayment, answerCompliance } = useParticipant();
  const [nameInput, setNameInput] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("");
  const [payAmount, setPayAmount] = useState(100);
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    join(nameInput);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTarget) return;
    setPayError(null);
    setPaying(true);
    try {
      await sendPayment(selectedTarget, payAmount);
      setSelectedTarget("");
    } catch (err: unknown) {
      setPayError((err as Error).message);
    } finally {
      setPaying(false);
    }
  };

  const handleAnswerCompliance = async (paymentId: string, answer: string) => {
    await answerCompliance(paymentId, answer);
  };

  // ── Not joined yet ──────────────────────────────────────────────────────────
  if (!participant || !clientState) {
    return (
      <>
        <Head><title>Payments Sim — Join</title></Head>
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center space-y-2">
              <div className="text-5xl mb-2">🏦</div>
              <h1 className="text-3xl font-black text-white">Join the Network</h1>
              <p className="text-slate-400 text-sm">
                You&apos;re about to become a bank. Enter your name to join the payment simulation.
              </p>
            </div>

            <form onSubmit={handleJoin} className="card space-y-4">
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1">
                  Your bank name (optional)
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Alice Bank, Team Rocket…"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm"
                  maxLength={40}
                  autoFocus
                />
              </div>
              {error && (
                <div className="text-red-400 text-sm">{error}</div>
              )}
              <button
                type="submit"
                disabled={joining}
                className="btn-primary w-full justify-center py-3 text-base"
              >
                {joining ? "Joining…" : "Join the Network →"}
              </button>
            </form>

            <p className="text-center text-xs text-slate-600">
              Wasn&apos;t blockchain meant to fix everything by now?
            </p>
          </div>
        </div>
      </>
    );
  }

  const { round, myPayments, recentEvents, allParticipants, blockchainMode, chainSplit } = clientState;

  const otherParticipants = allParticipants.filter((p) => p.id !== participant.id && !p.isFrozen && !p.isSanctioned);
  const pendingCompliance = myPayments.filter((p) => p.status === "compliance_hold" && p.fromId === participant.id);
  const canSendPayment = round >= 1 && !participant.isFrozen && !participant.isSanctioned && participant.balance > 0;

  return (
    <>
      <Head><title>{participant.displayName} — Payments Sim</title></Head>
      <div className="min-h-screen p-3 max-w-md mx-auto space-y-3">

        {/* Round banner */}
        <RoundBanner round={round} />

        {/* Lobby state */}
        {round === 0 && (
          <div className="card text-center py-8 space-y-2">
            <div className="text-4xl">⏳</div>
            <div className="text-lg font-bold text-white">Waiting for the simulation to begin</div>
            <div className="text-slate-400 text-sm">
              The presenter will start the first round shortly.
            </div>
            <div className="text-slate-500 text-xs">
              {clientState.participantCount} participant{clientState.participantCount !== 1 ? "s" : ""} connected
            </div>
          </div>
        )}

        {/* Bank card */}
        <BankCard
          participant={participant}
          round={round}
          blockchainMode={blockchainMode}
          chainSplit={chainSplit}
          participantCount={clientState.participantCount}
        />

        {/* Frozen / Sanctioned warnings */}
        {participant.isFrozen && (
          <div className="card border-slate-600 text-center space-y-2 py-6">
            <div className="text-4xl">🔐</div>
            <div className="text-lg font-bold text-white">Private key lost</div>
            <div className="text-slate-400 text-sm">
              Your funds are permanently inaccessible. On a blockchain, there is no recovery option.
              €{participant.balance} is locked forever.
            </div>
          </div>
        )}

        {participant.isSanctioned && (
          <div className="card border-red-800 text-center space-y-2 py-6">
            <div className="text-4xl">🚫</div>
            <div className="text-lg font-bold text-red-400">Wallet sanctioned</div>
            <div className="text-slate-400 text-sm">
              Your wallet has been added to the sanctions list. All incoming and outgoing payments are blocked.
            </div>
          </div>
        )}

        {/* Blockchain mode indicator */}
        {blockchainMode && !participant.isFrozen && !participant.isSanctioned && round === 5 && (
          <div className="card border-purple-700 bg-purple-950/30 text-center space-y-1 py-4">
            <div className="text-2xl">⛓</div>
            <div className="text-purple-300 font-bold">Shared Ledger Active</div>
            <div className="text-xs text-slate-400">Payments settle instantly. No intermediaries. No delays.</div>
          </div>
        )}

        {/* Compliance checks */}
        {pendingCompliance.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
              ⚠️ Action Required
            </h2>
            {pendingCompliance.map((p) => (
              <PaymentCard
                key={p.id}
                payment={p}
                participantId={participant.id}
                allParticipants={allParticipants}
                onAnswerCompliance={handleAnswerCompliance}
              />
            ))}
          </div>
        )}

        {/* Send payment */}
        {canSendPayment && round > 0 && (
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-white">Send Payment</h2>
            <form onSubmit={handlePay} className="space-y-2">
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="">Select recipient bank…</option>
                {otherParticipants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                    {p.isCorrespondent ? " ★" : ""}
                    {chainSplit && p.chainId ? ` [Chain ${p.chainId}]` : ""}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={participant.balance}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  disabled={!selectedTarget || paying || participant.balance < payAmount}
                  className="btn-primary px-4"
                >
                  {paying ? "…" : "Send →"}
                </button>
              </div>
              {payError && <div className="text-red-400 text-xs">{payError}</div>}
            </form>
          </div>
        )}

        {/* Connection info (Round 1) */}
        {round === 1 && (
          <div className="card space-y-2">
            <h2 className="text-sm font-semibold text-white">Direct Connections</h2>
            {clientState.connections.length === 0 ? (
              <p className="text-slate-500 text-xs">No direct connections — you can&apos;t settle any payments.</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {clientState.connections.map((id) => {
                  const p = allParticipants.find((x) => x.id === id);
                  return (
                    <span key={id} className="badge-blue text-xs">
                      {p?.displayName ?? id.slice(0, 8)}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Payment history */}
        {myPayments.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-white">Payment Activity</h2>
            {myPayments.slice(0, 10).map((p) => (
              <PaymentCard
                key={p.id}
                payment={p}
                participantId={participant.id}
                allParticipants={allParticipants}
                onAnswerCompliance={handleAnswerCompliance}
              />
            ))}
          </div>
        )}

        {/* Event log */}
        {recentEvents.length > 0 && (
          <div className="card space-y-2">
            <h2 className="text-sm font-semibold text-slate-400">Network Events</h2>
            <EventLog events={recentEvents} maxItems={15} />
          </div>
        )}

        <div className="text-center text-xs text-slate-700 py-4">
          The hardest part of moving money isn&apos;t moving money.
        </div>
      </div>
    </>
  );
}
