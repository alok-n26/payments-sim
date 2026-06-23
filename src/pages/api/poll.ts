import type { NextApiRequest, NextApiResponse } from "next";
import { getState } from "@/lib/state";
import type { ClientState } from "@/types";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const { participantId } = req.query as { participantId?: string };
  const state = getState();

  if (!participantId) {
    return res.status(400).json({ error: "participantId required" });
  }

  const participant = state.participants.find((p) => p.id === participantId);
  if (!participant) {
    return res.status(404).json({ error: "Participant not found" });
  }

  participant.lastSeenAt = Date.now();

  const myPayments = state.payments.filter(
    (p) => p.fromId === participantId || p.toId === participantId
  );

  const myConnectionIds = state.connections
    .filter((c) => c.fromId === participantId || c.toId === participantId)
    .map((c) => (c.fromId === participantId ? c.toId : c.fromId));

  const clientState: ClientState = {
    round: state.round,
    participant,
    myPayments,
    recentEvents: state.events.slice(0, 50),
    connections: myConnectionIds,
    correspondents: state.correspondentIds,
    blockchainMode: state.blockchainMode,
    chainSplit: state.chainSplit,
    participantCount: state.participants.length,
    allParticipants: state.participants.map((p) => ({
      id: p.id,
      bankId: p.bankId,
      displayName: p.displayName,
      isCorrespondent: p.isCorrespondent,
      isFrozen: p.isFrozen,
      isSanctioned: p.isSanctioned,
      chainId: p.chainId,
      currency: p.currency,
    })),
  };

  res.status(200).json(clientState);
}
