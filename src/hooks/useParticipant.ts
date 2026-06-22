// @refresh reset
import { useState, useEffect, useCallback, useRef } from "react";
import type { ClientState, Participant } from "@/types";

const POLL_INTERVAL = 1500;
const STORAGE_KEY = "payments_sim_participant_id";
const DISPLAY_NAME_KEY = "payments_sim_display_name";

export function useParticipant() {
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [clientState, setClientState] = useState<ClientState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track whether a rejoin is already in flight to avoid stacking attempts
  const rejoiningRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  // Core join — used both for first join and silent re-join after server restart
  const doJoin = useCallback(async (displayName: string, existingId?: string): Promise<Participant | null> => {
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, participantId: existingId }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.participant as Participant;
    } catch {
      return null;
    }
  }, []);

  const poll = useCallback(async (id: string) => {
    // Don't poll while a re-join is in flight
    if (rejoiningRef.current) return;

    try {
      const res = await fetch(`/api/poll?participantId=${encodeURIComponent(id)}`);

      if (res.status === 404 || res.status === 400) {
        // Server lost this participant (HMR restart or reset).
        // Silently rejoin with the stored display name — don't wipe the UI.
        rejoiningRef.current = true;
        stopPolling();

        const storedName = localStorage.getItem(DISPLAY_NAME_KEY) ?? "";
        const rejoined = await doJoin(storedName, undefined);

        if (rejoined) {
          localStorage.setItem(STORAGE_KEY, rejoined.id);
          setParticipant(rejoined);
          // Resume polling with the new id
          pollRef.current = setInterval(() => poll(rejoined.id), POLL_INTERVAL);
        } else {
          // Genuine failure — fall back to join screen
          localStorage.removeItem(STORAGE_KEY);
          setParticipant(null);
          setClientState(null);
        }
        rejoiningRef.current = false;
        return;
      }

      if (!res.ok) return;

      const state: ClientState = await res.json();
      setClientState(state);
      setParticipant(state.participant);
    } catch {
      // Network hiccup — next poll will retry
    }
  }, [doJoin, stopPolling]);

  const join = useCallback(async (displayName: string) => {
    setJoining(true);
    setError(null);
    try {
      const storedId = localStorage.getItem(STORAGE_KEY) ?? undefined;
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, participantId: storedId }),
      });
      if (!res.ok) throw new Error("Failed to join");
      const data = await res.json();

      localStorage.setItem(STORAGE_KEY, data.participant.id);
      if (displayName) localStorage.setItem(DISPLAY_NAME_KEY, displayName);

      setParticipant(data.participant);
      setClientState(data.state);

      stopPolling();
      pollRef.current = setInterval(() => poll(data.participant.id), POLL_INTERVAL);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setJoining(false);
    }
  }, [poll, stopPolling]);

  const sendPayment = useCallback(async (toId: string, amount: number) => {
    if (!participant) return;
    const res = await fetch("/api/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: participant.id, toId, amount }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.payment;
  }, [participant]);

  const answerCompliance = useCallback(async (paymentId: string, answer: string) => {
    if (!participant) return;
    const res = await fetch("/api/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: participant.id, paymentId, answer }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.payment;
  }, [participant]);

  // Auto-rejoin on mount if we have a stored ID
  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (storedId) {
      join(localStorage.getItem(DISPLAY_NAME_KEY) ?? "");
    }
    return stopPolling;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { participant, clientState, error, joining, join, sendPayment, answerCompliance };
}
