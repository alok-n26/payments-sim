import { useState, useEffect, useCallback, useRef } from "react";
import type { NetworkState, RoundId } from "@/types";

const POLL_INTERVAL = 1000;

export function useAdmin() {
  const [state, setState] = useState<NetworkState | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/admin");
      if (res.ok) setState(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchState();
    pollRef.current = setInterval(fetchState, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchState]);

  const action = useCallback(async (act: string, payload?: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act, payload }),
      });
      const data = await res.json();
      if (data.state) setState(data.state);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const setRound = (round: RoundId) => action("set_round", { round });
  const reset = () => action("reset");
  const seedParticipants = (count = 8) => action("seed_participants", { count });
  const simulateAll = () => action("simulate_all");
  const generateTasks = () => action("generate_tasks");
  const assignCorrespondents = () => action("assign_correspondents");
  const triggerLostKey = (participantId?: string) => action("trigger_lost_key", participantId ? { participantId } : {});
  const triggerFraud = () => action("trigger_fraud");
  const triggerSanctioned = (participantId?: string) => action("trigger_sanctioned", participantId ? { participantId } : {});
  const triggerChainSplit = () => action("trigger_chain_split");
  const releasePayment = (paymentId: string) => action("release_payment", { paymentId });
  const blockPayment = (paymentId: string) => action("block_payment", { paymentId });

  return {
    state,
    loading,
    setRound,
    reset,
    seedParticipants,
    simulateAll,
    generateTasks,
    assignCorrespondents,
    triggerLostKey,
    triggerFraud,
    triggerSanctioned,
    triggerChainSplit,
    releasePayment,
    blockPayment,
  };
}
