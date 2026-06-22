import type { NextApiRequest, NextApiResponse } from "next";
import { joinOrRejoin, getState } from "@/lib/state";
import type { JoinResponse, ClientState } from "@/types";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { displayName, participantId } = req.body as { displayName?: string; participantId?: string };
  const participant = joinOrRejoin(participantId, displayName);
  const state = getState();

  const myPayments = state.payments.filter(
    (p) => p.fromId === participant.id || p.toId === participant.id
  );

  const myConnectionIds = state.connections
    .filter((c) => c.fromId === participant.id || c.toId === participant.id)
    .map((c) => (c.fromId === participant.id ? c.toId : c.fromId));

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
    })),
  };

  const response: JoinResponse = { participant, state: clientState };
  res.status(200).json(response);
}
