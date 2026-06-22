import type { NextApiRequest, NextApiResponse } from "next";
import { answerCompliance } from "@/lib/state";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { participantId, paymentId, answer } = req.body as {
    participantId: string;
    paymentId: string;
    answer: string;
  };

  try {
    const payment = answerCompliance(participantId, paymentId, answer);
    res.status(200).json({ payment });
  } catch (e: unknown) {
    res.status(400).json({ error: (e as Error).message });
  }
}
