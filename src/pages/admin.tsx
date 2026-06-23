import Head from "next/head";
import { useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { EventLog } from "@/components/EventLog";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUND_CONFIGS } from "@/lib/rounds";
import type { RoundId, Participant, Payment } from "@/types";

const ROUND_IDS: RoundId[] = [0, 1, 2, 3, 4, 5, 6, 7];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function Stat({ label, value, color = "text-white" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-3 text-center">
      <div className={`text-2xl font-black ${color}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function ParticipantRow({ p, onFreeze, onSanction }: {
  p: Participant;
  onFreeze: () => void;
  onSanction: () => void;
}) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-slate-800 text-sm">
      <div className="w-6 text-slate-500 text-xs">#{p.bankId}</div>
      <div className="flex-1 min-w-0">
        <span className="text-white truncate block">{p.displayName}</span>
        {p.isCorrespondent && <span className="text-amber-400 text-xs">★ Correspondent</span>}
        {p.chainId && <span className="text-sky-400 text-xs"> · Chain {p.chainId}</span>}
        {p.currency && !p.isCorrespondent && <span className={`text-xs ml-1 ${p.currency === "EUR" ? "text-blue-400" : "text-green-400"}`}>{p.currency === "EUR" ? "€" : "$"} {p.currency}</span>}
      </div>
      <div className="font-mono text-emerald-300 w-16 text-right">€{p.balance}</div>
      <div className="flex gap-1">
        {p.isFrozen ? (
          <span className="badge-gray text-xs">🔐 Frozen</span>
        ) : p.isSanctioned ? (
          <span className="badge-red text-xs">🚫 Sanctioned</span>
        ) : (
          <>
            <button onClick={onFreeze} className="text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-red-900 text-slate-300 hover:text-red-300 transition-colors">
              🔐
            </button>
            <button onClick={onSanction} className="text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-red-900 text-slate-300 hover:text-red-300 transition-colors">
              🚫
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PaymentRow({ payment, participants, onRelease, onBlock }: {
  payment: Payment;
  participants: Participant[];
  onRelease: () => void;
  onBlock: () => void;
}) {
  const from = participants.find((p) => p.id === payment.fromId);
  const to = participants.find((p) => p.id === payment.toId);
  return (
    <div className="flex items-center gap-2 py-2 border-b border-slate-800 text-xs">
      <div className="flex-1 min-w-0">
        <span className="text-slate-300">{from?.displayName ?? "?"}</span>
        <span className="text-slate-600"> → </span>
        <span className="text-slate-300">{to?.displayName ?? "?"}</span>
        {payment.isFraud && <span className="ml-1 text-amber-400">⚠️fraud</span>}
      </div>
      <div className="font-mono text-slate-300 w-12 text-right">€{payment.amount}</div>
      <StatusBadge status={payment.status} />
      {payment.status === "compliance_hold" && (
        <div className="flex gap-1">
          <button onClick={onRelease} className="text-xs px-2 py-0.5 rounded bg-emerald-900/60 hover:bg-emerald-700 text-emerald-300 transition-colors">Release</button>
          <button onClick={onBlock} className="text-xs px-2 py-0.5 rounded bg-red-900/60 hover:bg-red-700 text-red-300 transition-colors">Block</button>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const admin = useAdmin();
  const { state, loading } = admin;
  const [activeTab, setActiveTab] = useState<"control" | "participants" | "payments" | "events">("control");
  const [confirmReset, setConfirmReset] = useState(false);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading admin…</div>
      </div>
    );
  }

  const round = state.round;
  const roundConfig = ROUND_CONFIGS[round];
  const totalBalance = state.participants.reduce((sum, p) => sum + p.balance, 0);
  const settledPayments = state.payments.filter((p) => p.status === "settled").length;
  const flaggedPayments = state.payments.filter((p) => ["compliance_hold", "blocked"].includes(p.status));
  const messagePayments = state.payments.filter((p) => p.status === "message_sent");

  return (
    <>
      <Head><title>Admin — Payments Sim</title></Head>
      <div className="min-h-screen bg-slate-950 text-slate-100">

        {/* Header */}
        <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 bg-slate-950/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black text-white">⚡ Admin</span>
            <span className="badge-blue">Round {round}</span>
            {state.blockchainMode && <span className="badge-purple">⛓ Blockchain</span>}
            {state.chainSplit && <span className="badge-red">⛓ Split</span>}
            <a
              href="/network"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost text-xs py-1 px-3"
            >
              🕸 Network View ↗
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>{state.participants.length} banks</span>
            {loading && <span className="text-sky-400 animate-pulse">●</span>}
          </div>
        </div>

        <div className="max-w-5xl mx-auto p-4 space-y-4">

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Participants" value={state.participants.length} color="text-sky-300" />
            <Stat label="Settled" value={settledPayments} color="text-emerald-300" />
            <Stat label="Flagged" value={flaggedPayments.length} color={flaggedPayments.length > 0 ? "text-amber-300" : "text-slate-400"} />
            <Stat label="Total € in system" value={`€${totalBalance}`} color="text-white" />
          </div>

          {/* Round title */}
          <div className="card border-l-4 border-sky-600 space-y-1">
            <div className="text-xs text-slate-500 uppercase tracking-widest">
              {round === 0 ? "Lobby" : `Round ${round} of 6`}
            </div>
            <div className="text-xl font-black text-white">{roundConfig.title}</div>
            <div className="text-sm text-slate-400">{roundConfig.concept}</div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-800">
            {(["control", "participants", "payments", "events"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? "text-white border-b-2 border-sky-500"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab}
                {tab === "payments" && flaggedPayments.length > 0 && (
                  <span className="ml-1 bg-amber-600 text-white rounded-full text-xs px-1.5">{flaggedPayments.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── CONTROL TAB ─────────────────────────────────────────────────── */}
          {activeTab === "control" && (
            <div className="space-y-4">

              {/* Round navigation */}
              <div className="card space-y-3">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Round Navigation</h2>
                <div className="grid grid-cols-7 gap-1">
                  {ROUND_IDS.map((r) => (
                    <button
                      key={r}
                      onClick={() => admin.setRound(r)}
                      className={`rounded-xl py-2 text-sm font-bold transition-all ${
                        round === r
                          ? "bg-sky-500 text-white shadow-lg shadow-sky-900/40"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      {r === 0 ? "Lobby" : r}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {round < 6 && (
                    <button
                      onClick={() => admin.setRound((round + 1) as RoundId)}
                      className="btn-primary"
                    >
                      Next Round →
                    </button>
                  )}
                  {round > 0 && (
                    <button
                      onClick={() => admin.setRound((round - 1) as RoundId)}
                      className="btn-ghost"
                    >
                      ← Previous
                    </button>
                  )}
                </div>
              </div>

              {/* Presenter debrief */}
              <div className="card border-amber-800/50 bg-amber-950/20 space-y-2">
                <div className="text-xs text-amber-400 uppercase tracking-wider font-semibold">💡 Presenter Notes</div>
                <p className="text-sm text-amber-200">{roundConfig.presenterNotes}</p>
                <div className="border-t border-amber-800/30 pt-2">
                  <div className="text-xs text-amber-600 uppercase tracking-wider font-semibold mb-1">Debrief Point</div>
                  <p className="text-sm text-amber-300">{roundConfig.debriefText}</p>
                </div>
              </div>

              {/* Round-specific actions */}
              <div className="card space-y-3">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Actions</h2>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => admin.generateTasks()} className="btn-primary">
                    📋 Generate Tasks
                  </button>
                  <button onClick={() => admin.simulateAll()} className="btn-ghost">
                    🤖 Simulate All
                  </button>
                  <button onClick={() => admin.seedParticipants(8)} className="btn-ghost">
                    🌱 Seed 8 Demo Banks
                  </button>
                  {round === 2 && (
                    <button onClick={() => admin.assignCorrespondents()} className="btn-warning">
                      ★ Assign Correspondents
                    </button>
                  )}
                </div>
              </div>

              {/* Round 7 triggers */}
              {round === 7 && (
                <div className="card border-rose-800/50 space-y-3">
                  <h2 className="text-sm font-semibold text-rose-400 uppercase tracking-wider">⚠️ Round 7 Chaos Triggers</h2>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => admin.triggerLostKey()} className="btn-danger">
                      🔐 Lost Private Key
                    </button>
                    <button onClick={() => admin.triggerFraud()} className="btn-danger">
                      ⚠️ Fraud Payment
                    </button>
                    <button onClick={() => admin.triggerSanctioned()} className="btn-danger">
                      🚫 Sanction Wallet
                    </button>
                    {!state.chainSplit && (
                      <button onClick={() => admin.triggerChainSplit()} className="btn-danger">
                        ⛓ Split Chains
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Each trigger is a discussion prompt. Trigger one at a time for maximum dramatic effect.</p>
                </div>
              )}

              {/* SWIFT message status (Round 3) */}
              {round === 3 && messagePayments.length > 0 && (
                <div className="card border-blue-800/50 space-y-2">
                  <h2 className="text-sm font-semibold text-blue-400">SWIFT Messages Pending Settlement</h2>
                  {messagePayments.map((p) => {
                    const from = state.participants.find((x) => x.id === p.fromId);
                    const to = state.participants.find((x) => x.id === p.toId);
                    return (
                      <div key={p.id} className="flex items-center gap-2 text-xs py-1 border-b border-slate-800">
                        <span className="text-blue-300">💬</span>
                        <span className="flex-1 text-slate-300">{from?.displayName} → {to?.displayName}: €{p.amount}</span>
                        <StatusBadge status={p.status} />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reset */}
              <div className="card border-red-900/50 space-y-2">
                <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Danger Zone</h2>
                {!confirmReset ? (
                  <button onClick={() => setConfirmReset(true)} className="btn-danger">
                    🗑 Reset Simulation
                  </button>
                ) : (
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-red-300">Are you sure? This wipes all state.</span>
                    <button
                      onClick={() => { admin.reset(); setConfirmReset(false); }}
                      className="btn-danger"
                    >
                      Yes, reset
                    </button>
                    <button onClick={() => setConfirmReset(false)} className="btn-ghost">Cancel</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PARTICIPANTS TAB ─────────────────────────────────────────────── */}
          {activeTab === "participants" && (
            <div className="card space-y-1">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-white">
                  {state.participants.length} Banks
                </h2>
                <div className="text-xs text-slate-500">
                  🔐 = freeze key  🚫 = sanction
                </div>
              </div>
              {state.participants.length === 0 ? (
                <p className="text-slate-500 text-sm py-4 text-center">No participants yet. Share the QR code or seed demo banks.</p>
              ) : (
                state.participants.map((p) => (
                  <ParticipantRow
                    key={p.id}
                    p={p}
                    onFreeze={() => admin.triggerLostKey(p.id)}
                    onSanction={() => admin.triggerSanctioned(p.id)}
                  />
                ))
              )}
            </div>
          )}

          {/* ── PAYMENTS TAB ─────────────────────────────────────────────────── */}
          {activeTab === "payments" && (
            <div className="card space-y-2">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-white">
                  {state.payments.length} Payments
                </h2>
                <div className="flex gap-2 text-xs text-slate-500">
                  <span className="text-emerald-400">{settledPayments} settled</span>
                  <span className="text-amber-400">{flaggedPayments.length} flagged</span>
                </div>
              </div>
              {state.payments.length === 0 ? (
                <p className="text-slate-500 text-sm py-4 text-center">No payments yet.</p>
              ) : (
                state.payments.slice(0, 50).map((p) => (
                  <PaymentRow
                    key={p.id}
                    payment={p}
                    participants={state.participants}
                    onRelease={() => admin.releasePayment(p.id)}
                    onBlock={() => admin.blockPayment(p.id)}
                  />
                ))
              )}
            </div>
          )}

          {/* ── EVENTS TAB ──────────────────────────────────────────────────── */}
          {activeTab === "events" && (
            <div className="card">
              <h2 className="text-sm font-semibold text-white mb-3">Network Event Log</h2>
              <EventLog events={state.events} maxItems={100} />
            </div>
          )}

        </div>

        <div className="text-center text-xs text-slate-800 py-6">
          The hardest part of moving money isn&apos;t moving money.
        </div>
      </div>
    </>
  );
}
