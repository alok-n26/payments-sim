import { v4 as uuidv4 } from "uuid";
import type {
  NetworkState,
  Participant,
  Payment,
  SimEvent,
  RoundId,
  NetworkConnection,
  PaymentRoute,
  EventKind,
} from "@/types";
import {
  STARTING_BALANCE,
  CORRESPONDENT_FEE,
  CORRESPONDENT_DELAY_MS,
  COMPLIANCE_QUESTIONS,
  FX_RATE,
  FX_SPREAD,
} from "./rounds";

// ─── HMR-safe singleton ───────────────────────────────────────────────────────
// Next.js dev mode re-executes modules on every hot reload, resetting any
// module-level variables. Pinning to `global` survives those reloads.

declare global {
  // eslint-disable-next-line no-var
  var __paySimStore: { state: NetworkState; bankCounter: number } | undefined;
}

function createInitialState(): NetworkState {
  return {
    round: 0,
    participants: [],
    payments: [],
    events: [],
    connections: [],
    correspondentIds: [],
    blockchainMode: false,
    chainSplit: false,
    lastResetAt: Date.now(),
  };
}

if (!global.__paySimStore) {
  global.__paySimStore = { state: createInitialState(), bankCounter: 1 };
}

function st(): NetworkState {
  return global.__paySimStore!.state;
}

function broadcast() {
  // Polling-based — no active push needed; kept for future SSE use
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addEvent(kind: EventKind, message: string, participantId?: string, paymentId?: string) {
  const ev: SimEvent = {
    id: uuidv4(),
    kind,
    message,
    participantId,
    paymentId,
    timestamp: Date.now(),
  };
  const s = st();
  s.events.unshift(ev);
  if (s.events.length > 200) s.events = s.events.slice(0, 200);
  return ev;
}

function getParticipant(id: string): Participant | undefined {
  return st().participants.find((p) => p.id === id);
}

function getConnectedIds(participantId: string): string[] {
  return st().connections
    .filter((c) => c.fromId === participantId || c.toId === participantId)
    .map((c) => (c.fromId === participantId ? c.toId : c.fromId));
}

// ─── Public state ─────────────────────────────────────────────────────────────

export function getPublicState(): NetworkState {
  return st();
}

export function getState(): NetworkState {
  return st();
}

// ─── Participant management ───────────────────────────────────────────────────

export function joinOrRejoin(participantId: string | undefined, displayName?: string): Participant {
  const s = st();

  if (participantId) {
    const existing = s.participants.find((p) => p.id === participantId);
    if (existing) {
      existing.lastSeenAt = Date.now();
      if (displayName) existing.displayName = displayName;
      return existing;
    }
  }

  const id = uuidv4();
  const bankId = global.__paySimStore!.bankCounter++;
  const name = displayName?.trim() || `Bank #${bankId}`;

  const participant: Participant = {
    id,
    bankId,
    displayName: name,
    balance: STARTING_BALANCE,
    isCorrespondent: false,
    isFrozen: false,
    isSanctioned: false,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  };

  if (s.chainSplit) {
    participant.chainId = s.participants.length % 2 === 0 ? "A" : "B";
  }

  s.participants.push(participant);

  // Late-joiners in round 4 get a currency and a correspondent connection
  if (s.round === 4) {
    const eurCount = s.participants.filter((p) => !p.isCorrespondent && p.currency === "EUR").length;
    const usdCount = s.participants.filter((p) => !p.isCorrespondent && p.currency === "USD").length;
    participant.currency = eurCount <= usdCount ? "EUR" : "USD";
    if (s.correspondentIds.length > 0) {
      const correspondents = s.participants.filter((p) => p.isCorrespondent);
      const c = correspondents[Math.floor(Math.random() * correspondents.length)];
      if (c) s.connections.push({ fromId: id, toId: c.id });
    }
  }

  // Late-joiners in round 2 get connected to a random correspondent
  if (s.round === 2 && s.correspondentIds.length > 0) {
    const correspondents = s.participants.filter((p) => p.isCorrespondent);
    if (correspondents.length > 0) {
      const c = correspondents[Math.floor(Math.random() * correspondents.length)];
      s.connections.push({ fromId: id, toId: c.id });
    }
  }

  addEvent("participant_joined", `${name} joined the network`, id);
  return participant;
}

// ─── Round management ─────────────────────────────────────────────────────────

export function setRound(round: RoundId) {
  const s = st();
  s.round = round;

  if (round === 6 || round === 7) {
    s.blockchainMode = true;
  } else {
    s.blockchainMode = false;
  }

  if (round !== 7) {
    s.chainSplit = false;
  }

  if (round === 1) {
    generateSparseConnections();
  }

  if (round === 2) {
    if (s.correspondentIds.length === 0) assignCorrespondents();
    else generateCorrespondentConnections(); // re-wire if correspondents already assigned
  }

  if (round === 4) {
    // Ensure correspondent network exists (may have skipped round 2)
    if (s.correspondentIds.length === 0) assignCorrespondents();
    else if (s.connections.length === 0) generateCorrespondentConnections();
    assignCurrencies();
  }

  addEvent("round_change", `Advanced to Round ${round}`);
}

// ─── Connections (Round 1) ────────────────────────────────────────────────────

function generateSparseConnections() {
  const s = st();
  const ids = s.participants.map((p) => p.id);
  const conns: NetworkConnection[] = [];

  for (const id of ids) {
    const others = ids.filter((x) => x !== id);
    const count = Math.random() < 0.4 ? 2 : 1;
    const shuffled = others.sort(() => Math.random() - 0.5).slice(0, count);
    for (const other of shuffled) {
      const exists = conns.some(
        (c) => (c.fromId === id && c.toId === other) || (c.fromId === other && c.toId === id)
      );
      if (!exists) conns.push({ fromId: id, toId: other });
    }
  }

  s.connections = conns;
}

// ─── Connections (Round 2) ────────────────────────────────────────────────────
// Hub-and-spoke: each regular bank gets one home correspondent.
// Correspondents form a full mesh with each other (nostro/vostro accounts).

function generateCorrespondentConnections() {
  const s = st();
  const correspondents = s.participants.filter((p) => p.isCorrespondent);
  if (correspondents.length === 0) return;

  const conns: NetworkConnection[] = [];

  for (const bank of s.participants.filter((p) => !p.isCorrespondent)) {
    const c = correspondents[Math.floor(Math.random() * correspondents.length)];
    conns.push({ fromId: bank.id, toId: c.id });
  }

  for (let i = 0; i < correspondents.length; i++) {
    for (let j = i + 1; j < correspondents.length; j++) {
      conns.push({ fromId: correspondents[i].id, toId: correspondents[j].id });
    }
  }

  s.connections = conns;
}

// ─── Currency assignment (Round 4) ────────────────────────────────────────────

function assignCurrencies() {
  const s = st();
  const regularBanks = s.participants.filter((p) => !p.isCorrespondent);
  regularBanks.forEach((p, i) => {
    p.currency = i % 2 === 0 ? "EUR" : "USD";
  });
  // Correspondents hold both — no currency restriction
  s.participants.filter((p) => p.isCorrespondent).forEach((p) => {
    p.currency = undefined;
  });
  addEvent("system", `Currencies assigned: ${regularBanks.filter((p) => p.currency === "EUR").length} EUR banks, ${regularBanks.filter((p) => p.currency === "USD").length} USD banks`);
}

// ─── Correspondents (Round 2) ─────────────────────────────────────────────────

export function assignCorrespondents(ids?: string[]) {
  const s = st();
  s.participants.forEach((p) => (p.isCorrespondent = false));

  let targets: Participant[];
  if (ids && ids.length > 0) {
    targets = s.participants.filter((p) => ids.includes(p.id));
  } else {
    const shuffled = [...s.participants].sort(() => Math.random() - 0.5);
    const count = Math.min(Math.max(3, Math.floor(s.participants.length * 0.2)), 5);
    targets = shuffled.slice(0, count);
  }

  targets.forEach((p) => (p.isCorrespondent = true));
  s.correspondentIds = targets.map((p) => p.id);
  addEvent("system", `${targets.length} correspondent banks assigned`);
  generateCorrespondentConnections();
}

// ─── Payment routing helpers ──────────────────────────────────────────────────

function findRouteViaCorrespondents(fromId: string, toId: string): PaymentRoute | null {
  const s = st();
  const allCorrespondents = s.participants.filter((p) => p.isCorrespondent && !p.isFrozen && !p.isSanctioned);
  if (allCorrespondents.length === 0) return null;

  const sender    = getParticipant(fromId);
  const recipient = getParticipant(toId);

  // Return the correspondent(s) a given participant connects to
  function homeCorrespondents(participantId: string): string[] {
    return allCorrespondents
      .filter((c) => s.connections.some(
        (conn) => (conn.fromId === participantId && conn.toId === c.id) ||
                  (conn.fromId === c.id && conn.toId === participantId)
      ))
      .map((c) => c.id);
  }

  // Correspondents route directly to each other
  if (sender?.isCorrespondent && recipient?.isCorrespondent) {
    return { hops: [fromId, toId], fees: CORRESPONDENT_FEE, delayMs: CORRESPONDENT_DELAY_MS };
  }

  // One side is a correspondent — one hop through the non-correspondent's home
  if (sender?.isCorrespondent) {
    const recipientHomes = homeCorrespondents(toId);
    if (recipientHomes.length === 0) return null;
    return { hops: [fromId, recipientHomes[0], toId], fees: CORRESPONDENT_FEE, delayMs: CORRESPONDENT_DELAY_MS };
  }
  if (recipient?.isCorrespondent) {
    const senderHomes = homeCorrespondents(fromId);
    if (senderHomes.length === 0) return null;
    return { hops: [fromId, senderHomes[0], toId], fees: CORRESPONDENT_FEE, delayMs: CORRESPONDENT_DELAY_MS };
  }

  // Both are regular banks — route through their home correspondents
  const senderHomes    = homeCorrespondents(fromId);
  const recipientHomes = homeCorrespondents(toId);
  if (senderHomes.length === 0 || recipientHomes.length === 0) return null;

  // 1-hop: shared home correspondent
  const shared = senderHomes.find((c) => recipientHomes.includes(c));
  if (shared) {
    return { hops: [fromId, shared, toId], fees: CORRESPONDENT_FEE, delayMs: CORRESPONDENT_DELAY_MS };
  }

  // 2-hop: different home correspondents (they connect to each other in the mesh)
  return {
    hops: [fromId, senderHomes[0], recipientHomes[0], toId],
    fees: CORRESPONDENT_FEE * 2,
    delayMs: CORRESPONDENT_DELAY_MS * 2,
  };
}

// ─── Payment initiation ───────────────────────────────────────────────────────

export function initiatePayment(fromId: string, toId: string, amount: number): Payment {
  const s = st();
  const sender = getParticipant(fromId);
  const recipient = getParticipant(toId);

  if (!sender || !recipient) throw new Error("Participant not found");
  if (sender.isFrozen) throw new Error("Your account is frozen");
  if (sender.isSanctioned) throw new Error("Sender is sanctioned");
  if (recipient.isSanctioned) throw new Error("Recipient is sanctioned");
  if (sender.balance < amount) throw new Error("Insufficient balance");

  const paymentId = uuidv4();
  const payment: Payment = {
    id: paymentId,
    fromId,
    toId,
    amount,
    netAmount: amount,
    status: "pending",
    createdAt: Date.now(),
    roundId: s.round,
  };

  if (s.round === 1) {
    const connected = getConnectedIds(fromId);
    if (!connected.includes(toId)) {
      payment.status = "failed";
      payment.failReason = "No direct relationship with recipient bank";
    } else {
      sender.balance -= amount;
      recipient.balance += amount;
      payment.status = "settled";
      payment.settledAt = Date.now();
      addEvent("payment_settled", `${sender.displayName} paid ${recipient.displayName} €${amount}`, fromId, paymentId);
    }
  } else if (s.round === 2) {
    const route = findRouteViaCorrespondents(fromId, toId);
    if (!route) {
      payment.status = "failed";
      payment.failReason = "No route found — even through correspondents";
    } else {
      payment.route = route;
      payment.netAmount = amount - route.fees;
      payment.status = "routing";
      sender.balance -= amount;

      setTimeout(() => {
        const currentPayment = st().payments.find((p) => p.id === paymentId);
        const currentRecipient = getParticipant(toId);
        if (currentPayment && currentRecipient && currentPayment.status === "routing") {
          currentRecipient.balance += currentPayment.netAmount;
          currentPayment.status = "settled";
          currentPayment.settledAt = Date.now();
          addEvent(
            "payment_settled",
            `${sender.displayName} → ${recipient.displayName}: €${amount} sent, €${currentPayment.netAmount} received (${route.hops.length - 2} hop(s), €${route.fees} fees)`,
            fromId,
            paymentId
          );
        }
      }, route.delayMs);

      addEvent("payment_initiated", `${sender.displayName} routing €${amount} via ${route.hops.length - 2} correspondent(s)`, fromId, paymentId);
    }
  } else if (s.round === 3) {
    payment.status = "message_sent";
    sender.balance -= amount;
    addEvent("payment_initiated", `SWIFT message sent: ${sender.displayName} → ${recipient.displayName} €${amount}. Funds not yet settled.`, fromId, paymentId);

    setTimeout(() => {
      const currentPayment = st().payments.find((p) => p.id === paymentId);
      const currentRecipient = getParticipant(toId);
      if (currentPayment && currentRecipient && currentPayment.status === "message_sent") {
        currentRecipient.balance += amount;
        currentPayment.status = "settled";
        currentPayment.settledAt = Date.now();
        addEvent("payment_settled", `SWIFT settlement: ${recipient.displayName} received €${amount}`, toId, paymentId);
      }
    }, 5000 + Math.random() * 5000);
  } else if (s.round === 4) {
    // Cross-border FX: route via correspondents, convert currency if needed
    const route = findRouteViaCorrespondents(fromId, toId);
    if (!route) {
      payment.status = "failed";
      payment.failReason = "No correspondent route found";
    } else {
      const fromCurrency = sender.currency ?? "EUR";
      const toCurrency = recipient.currency ?? "EUR";
      const isCrossCurrency = !recipient.isCorrespondent && !sender.isCorrespondent && fromCurrency !== toCurrency;

      payment.fromCurrency = fromCurrency;
      payment.toCurrency = toCurrency;
      payment.fxRate = isCrossCurrency ? FX_RATE : 1;
      payment.route = route;
      payment.status = "routing";
      sender.balance -= amount;

      if (isCrossCurrency) {
        // EUR→USD: multiply by FX_RATE then subtract spread fee
        // USD→EUR: divide by FX_RATE then subtract spread fee
        const converted = fromCurrency === "EUR"
          ? Math.round(amount * FX_RATE * 100) / 100
          : Math.round((amount / FX_RATE) * 100) / 100;
        payment.netAmount = Math.max(0, converted - FX_SPREAD);
      } else {
        payment.netAmount = amount - route.fees;
      }

      const fxLabel = isCrossCurrency
        ? ` (FX: 1 ${fromCurrency} = ${FX_RATE} ${toCurrency}, spread: ${FX_SPREAD} ${toCurrency})`
        : "";

      addEvent(
        isCrossCurrency ? "fx_conversion" : "payment_initiated",
        `${sender.displayName} sending ${fromCurrency === "EUR" ? "€" : "$"}${amount} → ${recipient.displayName} receives ${toCurrency === "EUR" ? "€" : "$"}${payment.netAmount}${fxLabel}`,
        fromId,
        paymentId
      );

      setTimeout(() => {
        const currentPayment = st().payments.find((p) => p.id === paymentId);
        const currentRecipient = getParticipant(toId);
        if (currentPayment && currentRecipient && currentPayment.status === "routing") {
          currentRecipient.balance += currentPayment.netAmount;
          currentPayment.status = "settled";
          currentPayment.settledAt = Date.now();
          const sentLabel = `${fromCurrency === "EUR" ? "€" : "$"}${amount}`;
          const receivedLabel = `${toCurrency === "EUR" ? "€" : "$"}${currentPayment.netAmount}`;
          addEvent("payment_settled", `Settled: ${sender.displayName} sent ${sentLabel} → ${recipient.displayName} received ${receivedLabel}`, toId, paymentId);
        }
      }, route.delayMs);
    }
  } else if (s.round === 5) {
    if (Math.random() < 0.4) {
      const q = COMPLIANCE_QUESTIONS[Math.floor(Math.random() * COMPLIANCE_QUESTIONS.length)];
      payment.status = "compliance_hold";
      payment.complianceQuestion = q;
      sender.balance -= amount;
      addEvent("compliance_check", `Payment from ${sender.displayName} flagged for compliance review`, fromId, paymentId);
    } else {
      sender.balance -= amount;
      recipient.balance += amount;
      payment.status = "settled";
      payment.settledAt = Date.now();
      addEvent("payment_settled", `${sender.displayName} → ${recipient.displayName} €${amount} (compliance passed)`, fromId, paymentId);
    }
  } else if (s.round === 6 || s.round === 7) {
    if (s.chainSplit && sender.chainId !== recipient.chainId) {
      const bridgeFee = 3;
      payment.netAmount = amount - bridgeFee;
      payment.route = { hops: [fromId, "bridge", toId], fees: bridgeFee, delayMs: 4000 };
      payment.status = "routing";
      sender.balance -= amount;
      addEvent("bridge_attempt", `Cross-chain bridge: ${sender.displayName} (Chain ${sender.chainId}) → ${recipient.displayName} (Chain ${recipient.chainId}). Fee: €${bridgeFee}`, fromId, paymentId);

      setTimeout(() => {
        const currentPayment = st().payments.find((p) => p.id === paymentId);
        const currentRecipient = getParticipant(toId);
        if (currentPayment && currentPayment.status === "routing") {
          if (Math.random() < 0.2) {
            currentPayment.status = "failed";
            currentPayment.failReason = "Bridge failure — cross-chain liquidity exhausted";
            sender.balance += amount;
            addEvent("payment_failed", `Bridge failure: ${sender.displayName} refunded €${amount}`, fromId, paymentId);
          } else if (currentRecipient) {
            currentRecipient.balance += currentPayment.netAmount;
            currentPayment.status = "settled";
            currentPayment.settledAt = Date.now();
            addEvent("ledger_updated", `Cross-chain settled: ${recipient.displayName} received €${currentPayment.netAmount}`, toId, paymentId);
          }
        }
      }, 4000);
    } else {
      sender.balance -= amount;
      recipient.balance += amount;
      payment.status = "settled";
      payment.settledAt = Date.now();
      const label = s.chainSplit ? ` (Chain ${sender.chainId})` : "";
      addEvent("ledger_updated", `Shared ledger updated: ${sender.displayName} → ${recipient.displayName} €${amount}${label}`, fromId, paymentId);
    }
  }

  if (payment.status === "failed") {
    addEvent("payment_failed", `Payment failed: ${payment.failReason}`, fromId, paymentId);
  }

  s.payments.unshift(payment);
  return payment;
}

// ─── Compliance answer ────────────────────────────────────────────────────────

export function answerCompliance(participantId: string, paymentId: string, answer: string): Payment {
  const s = st();
  const payment = s.payments.find((p) => p.id === paymentId);
  if (!payment) throw new Error("Payment not found");
  if (payment.fromId !== participantId) throw new Error("Not your payment");
  if (payment.status !== "compliance_hold") throw new Error("Payment not in compliance hold");

  payment.complianceAnswer = answer;
  const passes = payment.complianceQuestion?.passingOptions.includes(answer) ?? false;

  const sender = getParticipant(participantId);
  const recipient = getParticipant(payment.toId);

  if (passes && recipient) {
    recipient.balance += payment.amount;
    payment.status = "settled";
    payment.settledAt = Date.now();
    addEvent("compliance_passed", `Compliance passed: ${sender?.displayName} → ${recipient.displayName} €${payment.amount}`, participantId, paymentId);
  } else {
    if (sender) sender.balance += payment.amount;
    payment.status = "blocked";
    payment.failReason = `Compliance failed: answer "${answer}" did not pass review`;
    addEvent("compliance_failed", `Compliance failed for ${sender?.displayName}: payment blocked`, participantId, paymentId);
  }

  return payment;
}

// ─── Admin actions ────────────────────────────────────────────────────────────

export function resetSimulation() {
  global.__paySimStore!.state = createInitialState();
  global.__paySimStore!.bankCounter = 1;
  addEvent("system", "Simulation reset");
}

export function generateTasks() {
  const participants = st().participants.filter((p) => !p.isFrozen && !p.isSanctioned);
  if (participants.length < 2) return;

  for (const p of participants) {
    const others = participants.filter((x) => x.id !== p.id);
    const target = others[Math.floor(Math.random() * others.length)];
    try { initiatePayment(p.id, target.id, 100); } catch {}
  }
}

export function simulateAllParticipants() {
  generateTasks();
}

export function seedDemoParticipants(count = 8) {
  const names = ["Alice Bank", "Bob Credit", "Carol Finance", "Dave Trust", "Eve Capital", "Frank Savings", "Grace Payments", "Hank Exchange", "Iris Clearing", "Jack Settlement"];
  for (let i = 0; i < count; i++) {
    const name = names[i % names.length] + (i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : "");
    joinOrRejoin(undefined, name);
  }
  const s = st();
  if (s.round === 1) generateSparseConnections();
  if (s.round === 2 && s.correspondentIds.length === 0) assignCorrespondents();
}

export function triggerLostKey(participantId?: string) {
  const targets = st().participants.filter((p) => !p.isFrozen && !p.isSanctioned);
  if (targets.length === 0) return;
  const target = participantId
    ? targets.find((p) => p.id === participantId)
    : targets[Math.floor(Math.random() * targets.length)];
  if (!target) return;
  target.isFrozen = true;
  addEvent("key_lost", `Private key lost: ${target.displayName}'s funds are now inaccessible. ${target.balance > 0 ? `€${target.balance} locked forever.` : ""}`, target.id);
}

export function triggerFraudPayment() {
  const s = st();
  const participants = s.participants.filter((p) => !p.isFrozen && !p.isSanctioned && p.balance >= 200);
  if (participants.length < 2) return;
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  const from = shuffled[0];
  const to = shuffled[1];

  const payment: Payment = {
    id: uuidv4(),
    fromId: from.id,
    toId: to.id,
    amount: 200,
    netAmount: 200,
    status: "settled",
    createdAt: Date.now(),
    settledAt: Date.now(),
    isFraud: true,
    roundId: s.round,
  };

  from.balance -= 200;
  to.balance += 200;
  s.payments.unshift(payment);
  addEvent("fraud_detected", `Fraud payment detected: ${from.displayName} → ${to.displayName} €200. On a blockchain, this CANNOT be reversed.`, from.id, payment.id);
}

export function triggerSanctionedWallet(participantId?: string) {
  const s = st();
  const targets = s.participants.filter((p) => !p.isSanctioned && !p.isFrozen);
  if (targets.length === 0) return;
  const target = participantId
    ? targets.find((p) => p.id === participantId)
    : targets[Math.floor(Math.random() * targets.length)];
  if (!target) return;
  target.isSanctioned = true;

  s.payments
    .filter((p) => (p.fromId === target.id || p.toId === target.id) && ["pending", "routing", "message_sent", "compliance_hold"].includes(p.status))
    .forEach((p) => { p.status = "blocked"; p.failReason = "Sanctioned wallet"; });

  addEvent("wallet_sanctioned", `Wallet sanctioned: ${target.displayName} is now on the sanctions list. All payments blocked.`, target.id);
}

export function triggerChainSplit() {
  const s = st();
  s.chainSplit = true;
  s.participants.forEach((p, i) => { p.chainId = i % 2 === 0 ? "A" : "B"; });
  addEvent("chain_split", "Network split into Chain A and Chain B. Cross-chain payments now require a bridge.");
}

export function adminReleasePayment(paymentId: string) {
  const s = st();
  const payment = s.payments.find((p) => p.id === paymentId);
  if (!payment) return;
  const recipient = getParticipant(payment.toId);
  if (recipient && payment.status === "compliance_hold") {
    recipient.balance += payment.amount;
    payment.status = "settled";
    payment.settledAt = Date.now();
    addEvent("compliance_passed", `Admin manually released payment ${paymentId.slice(0, 8)}…`);
  }
}

export function adminBlockPayment(paymentId: string) {
  const s = st();
  const payment = s.payments.find((p) => p.id === paymentId);
  if (!payment) return;
  if (["compliance_hold", "pending", "routing"].includes(payment.status)) {
    const sender = getParticipant(payment.fromId);
    if (sender && payment.status === "compliance_hold") sender.balance += payment.amount;
    payment.status = "blocked";
    payment.failReason = "Manually blocked by admin";
    addEvent("payment_blocked", `Admin blocked payment ${paymentId.slice(0, 8)}…`);
  }
}
