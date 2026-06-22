import type { NextApiRequest, NextApiResponse } from "next";
import { initiatePayment } from "@/lib/state";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { participantId, toId, amount } = req.body as {
    participantId: string;
    toId: string;
    amount: number;
  };

  try {
    const payment = initiatePayment(participantId, toId, amount);
    res.status(200).json({ payment });
  } catch (e: unknown) {
    res.status(400).json({ error: (e as Error).message });
  }
}
