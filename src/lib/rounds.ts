import type { RoundConfig, RoundId } from "@/types";

export const ROUND_CONFIGS: Record<RoundId, RoundConfig> = {
  0: {
    id: 0,
    title: "Join the network",
    concept: "Everyone is joining as a bank. Wait for participants to connect.",
    debriefText: "This is the lobby. Get everyone scanned and joined before starting Round 1.",
    presenterNotes: "Show the QR code on screen. Watch the participant count grow. Once you have enough people, advance to Round 1. Seed participants if testing alone.",
  },
  1: {
    id: 1,
    title: "Everyone connects to everyone",
    concept: "Direct settlement: banks must have a direct relationship to pay each other.",
    debriefText: "Most payments fail because banks don't have direct connections. This is why correspondent banking exists.",
    presenterNotes: "Click 'Generate Tasks' to assign each participant a payment target. Watch payments fail with 'no direct relationship'. Point out that N banks need N² connections. That's why we don't do this at scale.",
  },
  2: {
    id: 2,
    title: "The rise of correspondent banking",
    concept: "Correspondent banks act as intermediaries — but every hop costs money and time.",
    debriefText: "Payments now route through correspondents. Participants receive less than was sent. Each hop adds €1 fee and a 2-second delay.",
    presenterNotes: "Assign correspondents first (3-5 participants become correspondent banks). Then generate tasks. Watch the route display: Bank #4 → Correspondent A → Bank #22. Ask the audience: who absorbs the fees?",
  },
  3: {
    id: 3,
    title: "SWIFT: the message is not the money",
    concept: "SWIFT moves payment instructions, not funds. Settlement is a separate step.",
    debriefText: "Payments split into two phases: message delivery and fund settlement. Recipients see 'message received' before funds arrive.",
    presenterNotes: "Emphasise the gap between message and settlement. This is why a SWIFT payment can 'arrive' on Tuesday but funds aren't available until Thursday. The message is like a cheque in the post.",
  },
  4: {
    id: 4,
    title: "Compliance ruins the party",
    concept: "AML, KYC and sanctions checks block or delay payments — for good reasons.",
    debriefText: "Some payments get flagged for compliance review. Participants must answer a compliance question. Wrong answers block the payment permanently.",
    presenterNotes: "Trigger compliance checks from the admin panel. Watch some payments get stuck. Manually release or block them. Ask the audience: should a bank process a payment just because it technically can?",
  },
  5: {
    id: 5,
    title: "Blockchain enters the chat",
    concept: "A shared ledger removes reconciliation delays and intermediaries.",
    debriefText: "Payments update instantly across all participants. No correspondent banks. No settlement delay. The ledger is the single source of truth.",
    presenterNotes: "Toggle blockchain mode. Generate new tasks. Show how payments settle instantly. Highlight what's missing: identity, governance, compliance. Ask: does fast settlement solve everything?",
  },
  6: {
    id: 6,
    title: "The trap: payments are not just a database problem",
    concept: "Blockchain solves reconciliation. It doesn't solve identity, governance, compliance, or reversibility.",
    debriefText: "\"The hardest part of moving money isn't moving money.\" Use the admin triggers to demonstrate each failure mode.",
    presenterNotes: "Trigger events one at a time for drama. Lost key → participant is frozen. Fraud payment → audience votes on reversal (blockchain says no). Sanctioned wallet → payments blocked. Chain split → cross-chain payments need a bridge. Each trigger is a discussion prompt.",
  },
};

export const STARTING_BALANCE = 1000;
export const CORRESPONDENT_FEE = 1;
export const CORRESPONDENT_DELAY_MS = 2000;
export const COMPLIANCE_QUESTIONS = [
  {
    question: "What is the purpose of this payment?",
    options: ["Salary", "Invoice", "Gift", "Suspiciously vague crypto thing"],
    passingOptions: ["Salary", "Invoice", "Gift"],
  },
  {
    question: "Who is the ultimate beneficiary?",
    options: ["My employer", "A registered business", "A friend", "None of your business"],
    passingOptions: ["My employer", "A registered business", "A friend"],
  },
  {
    question: "Source of funds?",
    options: ["Employment income", "Business revenue", "Inheritance", "Definitely not ransomware"],
    passingOptions: ["Employment income", "Business revenue", "Inheritance"],
  },
];
