// ─── Core domain types ──────────────────────────────────────────────────────

export type RoundId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Participant {
  id: string;           // uuid
  bankId: number;       // e.g. 17  → "Bank #17"
  displayName: string;  // user-entered or auto-generated
  balance: number;      // current balance in €
  isCorrespondent: boolean;
  isFrozen: boolean;    // lost private key / sanctioned
  isSanctioned: boolean;
  chainId?: "A" | "B";  // round 7 fragmented chains
  currency?: "EUR" | "USD";  // round 4 cross-border FX
  joinedAt: number;     // epoch ms
  lastSeenAt: number;
}

export type PaymentStatus =
  | "pending"
  | "routing"
  | "message_sent"     // Round 3 SWIFT: message delivered, not settled
  | "compliance_hold"  // Round 4: awaiting compliance answer
  | "settled"
  | "failed"
  | "blocked"          // sanctioned / compliance-rejected
  | "reversed";

export interface PaymentRoute {
  hops: string[];      // participant ids
  fees: number;        // total fees in €
  delayMs: number;     // total simulated delay
}

export interface Payment {
  id: string;
  fromId: string;      // participant id
  toId: string;
  amount: number;      // original amount
  netAmount: number;   // after fees
  status: PaymentStatus;
  route?: PaymentRoute;
  complianceQuestion?: ComplianceQuestion;
  complianceAnswer?: string;
  createdAt: number;
  settledAt?: number;
  failReason?: string;
  isFraud?: boolean;
  roundId: RoundId;
  fromCurrency?: "EUR" | "USD";
  toCurrency?: "EUR" | "USD";
  fxRate?: number;
}

export interface ComplianceQuestion {
  question: string;
  options: string[];
  passingOptions: string[];
}

export type EventKind =
  | "round_change"
  | "participant_joined"
  | "payment_initiated"
  | "payment_settled"
  | "payment_failed"
  | "payment_blocked"
  | "compliance_check"
  | "compliance_passed"
  | "compliance_failed"
  | "key_lost"
  | "fraud_detected"
  | "wallet_sanctioned"
  | "ledger_updated"
  | "chain_split"
  | "bridge_attempt"
  | "fx_conversion"
  | "system";

export interface SimEvent {
  id: string;
  kind: EventKind;
  message: string;
  participantId?: string;
  paymentId?: string;
  timestamp: number;
}

export interface NetworkConnection {
  fromId: string;
  toId: string;
}

export interface RoundConfig {
  id: RoundId;
  title: string;
  concept: string;
  debriefText: string;
  presenterNotes: string;
}

export interface NetworkState {
  round: RoundId;
  participants: Participant[];
  payments: Payment[];
  events: SimEvent[];
  connections: NetworkConnection[];   // Round 1 direct connections
  correspondentIds: string[];          // Round 2
  blockchainMode: boolean;            // Round 5+
  chainSplit: boolean;                // Round 6
  startedAt?: number;
  lastResetAt: number;
}

// ─── API request/response shapes ────────────────────────────────────────────

export interface JoinRequest {
  displayName?: string;
  participantId?: string;  // from localStorage, for re-join
}

export interface JoinResponse {
  participant: Participant;
  state: ClientState;
}

export interface ClientState {
  round: RoundId;
  participant: Participant;
  myPayments: Payment[];
  recentEvents: SimEvent[];
  connections: string[];         // bank ids I'm directly connected to
  correspondents: string[];      // bank ids that are correspondents
  blockchainMode: boolean;
  chainSplit: boolean;
  participantCount: number;
  allParticipants: Pick<Participant, "id" | "bankId" | "displayName" | "isCorrespondent" | "isFrozen" | "isSanctioned" | "chainId" | "currency">[];
}

export interface SendPaymentRequest {
  participantId: string;
  toId: string;         // participant id of recipient
  amount: number;
}

export interface ComplianceAnswerRequest {
  participantId: string;
  paymentId: string;
  answer: string;
}

export interface AdminActionRequest {
  action:
    | "reset"
    | "set_round"
    | "seed_participants"
    | "simulate_all"
    | "assign_correspondents"
    | "trigger_lost_key"
    | "trigger_fraud"
    | "trigger_sanctioned"
    | "trigger_chain_split"
    | "release_payment"
    | "block_payment"
    | "generate_tasks";
  payload?: Record<string, unknown>;
}
