import { useState } from "react";
import type { Payment, ClientState } from "@/types";
import { FX_SPREAD } from "@/lib/rounds";
import { StatusBadge } from "./StatusBadge";
import { RouteDisplay } from "./RouteDisplay";

interface Props {
  payment: Payment;
  participantId: string;
  allParticipants: ClientState["allParticipants"];
  onAnswerCompliance?: (paymentId: string, answer: string) => Promise<void>;
}

function pName(id: string, all: ClientState["allParticipants"]) {
  return all.find((p) => p.id === id)?.displayName ?? `Bank #?`;
}

export function PaymentCard({ payment, participantId, allParticipants, onAnswerCompliance }: Props) {
  const [answering, setAnswering] = useState(false);
  const isOutgoing = payment.fromId === participantId;
  const isIncoming = payment.toId === participantId;

  const handleAnswer = async (answer: string) => {
    if (!onAnswerCompliance) return;
    setAnswering(true);
    try {
      await onAnswerCompliance(payment.id, answer);
    } finally {
      setAnswering(false);
    }
  };

  return (
    <div className="card-sm space-y-2 animate-fade-in">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm">
          <span className={isOutgoing ? "text-red-400" : "text-emerald-400"}>
            {isOutgoing ? "↑ Sent" : "↓ Received"}
          </span>
          {" "}
          <span className="font-bold text-lg">
            {isOutgoing
              ? `${payment.fromCurrency === "USD" ? "$" : "€"}${payment.amount}`
              : `${payment.toCurrency === "USD" ? "$" : "€"}${payment.netAmount}`}
          </span>
          {payment.fromCurrency && payment.toCurrency && payment.fromCurrency !== payment.toCurrency && isIncoming && (
            <span className="text-xs text-slate-500 ml-1">
              (sent: {payment.fromCurrency === "USD" ? "$" : "€"}{payment.amount})
            </span>
          )}
          {payment.fromCurrency && payment.toCurrency && payment.fromCurrency !== payment.toCurrency && isOutgoing && (
            <span className="text-xs text-slate-500 ml-1">
              → recipient gets {payment.toCurrency === "USD" ? "$" : "€"}{payment.netAmount}
            </span>
          )}
        </div>
        <StatusBadge status={payment.status} />
      </div>

      <div className="text-xs text-slate-400">
        {isOutgoing
          ? <>To: <span className="text-slate-200">{pName(payment.toId, allParticipants)}</span></>
          : <>From: <span className="text-slate-200">{pName(payment.fromId, allParticipants)}</span></>
        }
      </div>

      {payment.route && (
        <RouteDisplay route={payment.route} allParticipants={allParticipants} />
      )}

      {payment.fromCurrency && payment.toCurrency && payment.fromCurrency !== payment.toCurrency && payment.fxRate && (
        <div className="text-xs text-amber-300 bg-amber-900/20 rounded-lg px-2 py-1">
          💱 FX: 1 {payment.fromCurrency} = {payment.fxRate} {payment.toCurrency} · spread: {payment.toCurrency === "USD" ? "$" : "€"}{FX_SPREAD} {payment.toCurrency}
        </div>
      )}

      {payment.status === "message_sent" && (
        <div className="text-xs text-sky-400 bg-sky-900/30 rounded-lg px-2 py-1">
          💬 SWIFT message received. Waiting for fund settlement…
        </div>
      )}

      {payment.status === "failed" && payment.failReason && (
        <div className="text-xs text-red-400 bg-red-900/20 rounded-lg px-2 py-1">
          {payment.failReason}
        </div>
      )}

      {payment.status === "blocked" && (
        <div className="text-xs text-red-400 bg-red-900/20 rounded-lg px-2 py-1">
          🚫 {payment.failReason ?? "Payment blocked"}
        </div>
      )}

      {payment.isFraud && payment.status === "settled" && (
        <div className="text-xs text-amber-400 bg-amber-900/20 rounded-lg px-2 py-1">
          ⚠️ This payment was marked as fraudulent. On this blockchain, it cannot be reversed.
        </div>
      )}

      {payment.status === "compliance_hold" && payment.complianceQuestion && isOutgoing && (
        <div className="mt-2 space-y-2">
          <div className="text-xs text-amber-300 font-semibold">
            🔍 Compliance check required:
          </div>
          <div className="text-sm text-slate-200">{payment.complianceQuestion.question}</div>
          <div className="grid grid-cols-2 gap-1">
            {payment.complianceQuestion.options.map((opt) => (
              <button
                key={opt}
                disabled={answering}
                onClick={() => handleAnswer(opt)}
                className="btn-ghost text-xs py-1.5 text-left"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {payment.status === "compliance_hold" && !isOutgoing && (
        <div className="text-xs text-amber-400">
          ⏳ Sender is completing a compliance check…
        </div>
      )}
    </div>
  );
}
