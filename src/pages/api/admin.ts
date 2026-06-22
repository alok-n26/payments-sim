import type { NextApiRequest, NextApiResponse } from "next";
import {
  resetSimulation,
  setRound,
  seedDemoParticipants,
  generateTasks,
  simulateAllParticipants,
  assignCorrespondents,
  triggerLostKey,
  triggerFraudPayment,
  triggerSanctionedWallet,
  triggerChainSplit,
  adminReleasePayment,
  adminBlockPayment,
  getState,
} from "@/lib/state";
import type { AdminActionRequest, RoundId } from "@/types";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return res.status(200).json(getState());
  }

  if (req.method !== "POST") return res.status(405).end();

  const { action, payload } = req.body as AdminActionRequest;

  try {
    switch (action) {
      case "reset":
        resetSimulation();
        break;
      case "set_round":
        setRound((payload?.round as RoundId) ?? 0);
        break;
      case "seed_participants":
        seedDemoParticipants((payload?.count as number) ?? 8);
        break;
      case "simulate_all":
        simulateAllParticipants();
        break;
      case "assign_correspondents":
        assignCorrespondents(payload?.ids as string[] | undefined);
        break;
      case "generate_tasks":
        generateTasks();
        break;
      case "trigger_lost_key":
        triggerLostKey(payload?.participantId as string | undefined);
        break;
      case "trigger_fraud":
        triggerFraudPayment();
        break;
      case "trigger_sanctioned":
        triggerSanctionedWallet(payload?.participantId as string | undefined);
        break;
      case "trigger_chain_split":
        triggerChainSplit();
        break;
      case "release_payment":
        adminReleasePayment(payload?.paymentId as string);
        break;
      case "block_payment":
        adminBlockPayment(payload?.paymentId as string);
        break;
      default:
        return res.status(400).json({ error: "Unknown action" });
    }

    res.status(200).json({ ok: true, state: getState() });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}
