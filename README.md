# Payments Sim

**"Wasn't blockchain meant to fix everything by now?"**

An interactive live audience simulation of how money moves through payment networks. Built for a 45-minute internal talk. Each attendee becomes a bank.

---

## Quick Start

```bash
npm install
npm run dev
```

Then open:
- **Participants**: http://localhost:3000 (or scan QR code on presenter screen)
- **Admin/Presenter**: http://localhost:3000/admin

---

## Architecture

```
src/
  lib/
    state.ts      — In-memory singleton state + all business logic
    rounds.ts     — Round configs, debrief text, constants
  pages/
    index.tsx     — Participant view
    admin.tsx     — Admin/presenter view
    api/
      join.ts     — POST: join or rejoin simulation
      poll.ts     — GET: polling endpoint for client state sync
      pay.ts      — POST: initiate a payment
      compliance.ts — POST: answer a compliance question
      admin.ts    — GET/POST: admin state + actions
  components/
    BankCard.tsx      — Participant's bank identity card
    PaymentCard.tsx   — Individual payment with compliance UI
    RouteDisplay.tsx  — Hop-by-hop route visualisation
    RoundBanner.tsx   — Current round title + concept
    StatusBadge.tsx   — Payment status pill
    EventLog.tsx      — Network event feed
  hooks/
    useParticipant.ts — Polling + state for participant view
    useAdmin.ts       — Polling + actions for admin view
  types/index.ts      — All TypeScript types
```

**State sync**: Simple polling at 1–1.5s intervals. No WebSocket needed for a room of ~50 people. Server state lives in a Node.js module singleton (reset on process restart).

**Persistence**: Participant identity is stored in `localStorage` so page refreshes don't create duplicate banks.

---

## Presenter Guide

### Before the session

1. Run `npm install && npm run dev` on a laptop connected to the same network as participants.
2. Open `/admin` on your presenter screen.
3. Put `http://[your-ip]:3000` as a QR code on the title slide — participants scan to join.
4. Seed demo participants on `/admin` if you want to test flows solo.

---

### Round 0 — Lobby: "Join the Network"

**Goal**: get everyone joined before starting.

- Share the URL/QR code. Watch the participant count tick up on `/admin`.
- Admin stats show live count.
- Participants see: "Waiting for the simulation to begin."
- When ready, hit **Next Round →**

---

### Round 1 — "Everyone connects to everyone"

**Goal**: experience why direct settlement doesn't scale.

1. Hit **Generate Tasks** — each bank gets a random payment task.
2. Participants try to send €100 to their assigned target.
3. Most will fail: "No direct relationship with recipient bank."
4. Show the admin Payments tab — sea of red Failed badges.

**Debrief**: "If N banks each need a direct connection to every other bank, you need N² relationships. That's why we invented intermediaries."

---

### Round 2 — "The rise of correspondent banking"

**Goal**: show how routing solves reach but adds cost and delay.

1. Click **Assign Correspondents** (auto-assigns 3–5 banks as correspondents).
2. Click **Generate Tasks**.
3. Payments now route. Each hop costs €1 and takes 2 seconds.
4. Participants see the route: `Bank #4 → ★ Correspondent A → Bank #22`.
5. Recipients notice they received less than was sent.

**Debrief**: "You've just discovered correspondent banking. It works — but every hop takes a cut and adds delay. A cross-border payment might touch 4 banks and take 3 days."

---

### Round 3 — "SWIFT: the message is not the money"

**Goal**: show the message/settlement gap.

1. Generate Tasks.
2. Participants immediately see: "SWIFT message sent. Funds not settled yet."
3. After 5–10 seconds, funds arrive.
4. Admin Payments tab shows `message_sent` vs `settled` states.

**Debrief**: "SWIFT is basically secure banking WhatsApp. It moves instructions, not money. Settlement still goes through correspondent accounts. That's why a 'sent' payment can take days to clear."

---

### Round 4 — "Compliance ruins the party"

**Goal**: make compliance friction tangible.

1. Generate Tasks. ~40% get flagged automatically.
2. Flagged participants see a compliance question they must answer.
3. Some answers pass. Others block the payment permanently.
4. Admin can see the Payments tab and manually Release or Block holds.
5. Use **Payments** tab to trigger discussion: "Should I release this one?"

**Debrief**: "Compliance isn't bureaucracy for its own sake. AML, sanctions, and fraud checks exist because the alternative is worse. But friction has real costs."

---

### Round 5 — "Blockchain enters the chat"

**Goal**: show what shared ledger actually solves.

1. Advance to Round 5 (blockchain mode auto-enables).
2. Generate Tasks.
3. Payments settle instantly. No routing. No delay. No fees.
4. Event log shows "📒 Shared ledger updated" for every payment.

**Debrief**: "This is the genuine promise. A shared ledger eliminates reconciliation. Settlement is instant. No correspondent banks needed. So why haven't we replaced everything?"

---

### Round 6 — "The trap"

**Goal**: demonstrate what blockchain doesn't solve.

Trigger events **one at a time** — each is a discussion prompt:

| Trigger | What happens | Discussion |
|---------|-------------|------------|
| 🔐 Lost Private Key | One bank is frozen. Funds inaccessible forever. | "Who do you call? There's no customer support." |
| ⚠️ Fraud Payment | €200 moves between banks, marked as fraud. | "Can we reverse it?" (blockchain says no) |
| 🚫 Sanction Wallet | One bank's wallet added to sanctions list. | "We can see the wallet, but not who owns it." |
| ⛓ Split Chains | Participants split to Chain A and Chain B. | Cross-chain payments need a bridge — fees, delays, failure risk return. |

**Closing line**: *"The hardest part of moving money isn't moving money."*

---

## Tips

- **Testing solo**: Use "Seed 8 Demo Banks" + "Simulate All" to run a full round without real participants.
- **Reset**: The big red reset button on `/admin` wipes all state. Use between rehearsal runs.
- **Screen sharing**: The participant view is optimised for mobile (max-width 448px). The admin view works best on a full laptop screen.
- **Multiple rounds same session**: Advance rounds mid-session — participant state (balances, payments) carries forward.
