import Head from "next/head";
import { useEffect, useState, useRef, useCallback } from "react";
import { useForceLayout } from "@/hooks/useForceLayout";
import { usePaymentParticles } from "@/hooks/usePaymentParticles";
import type { NetworkState, Participant, RoundId } from "@/types";
import { ROUND_CONFIGS } from "@/lib/rounds";
import type { Particle } from "@/hooks/usePaymentParticles";

// ─── Dimensions ───────────────────────────────────────────────────────────────

const W = 1200;
const H = 700;
const NODE_R = 28;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nodeColor(p: Participant, blockchainMode: boolean) {
  if (p.isFrozen) return "#475569";
  if (p.isSanctioned) return "#991b1b";
  if (p.isCorrespondent) return "#92400e";
  if (p.chainId === "A") return "#1e40af";
  if (p.chainId === "B") return "#5b21b6";
  if (blockchainMode) return "#4c1d95";
  return "#0c4a6e";
}

function nodeStroke(p: Participant, blockchainMode: boolean) {
  if (p.isFrozen) return "#64748b";
  if (p.isSanctioned) return "#ef4444";
  if (p.isCorrespondent) return "#f59e0b";
  if (p.chainId === "A") return "#3b82f6";
  if (p.chainId === "B") return "#8b5cf6";
  if (blockchainMode) return "#a78bfa";
  return "#38bdf8";
}

const ROUND_GRADIENT: Record<RoundId, string> = {
  0: "from-slate-950 to-slate-900",
  1: "from-slate-950 to-sky-950",
  2: "from-slate-950 to-amber-950",
  3: "from-slate-950 to-blue-950",
  4: "from-slate-950 to-red-950",
  5: "from-slate-950 to-purple-950",
  6: "from-slate-950 to-rose-950",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function NetworkPage() {
  const [simState, setSimState] = useState<NetworkState | null>(null);
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [particles, setParticles] = useState<Particle[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const lastTickRef = useRef<number>(performance.now());
  const animRafRef = useRef<number | null>(null);

  const { syncPayments, tickParticles, clear } = usePaymentParticles();

  const handleTick = useCallback((nodes: Map<string, { x: number; y: number }>) => {
    setNodePositions(new Map(Array.from(nodes.entries()).map(([id, n]) => [id, { x: n.x, y: n.y }])));
  }, []);

  const forceLayout = useForceLayout({ width: W, height: H, onTick: handleTick });

  // ── Poll server state ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/admin");
        if (res.ok && !cancelled) {
          const data: NetworkState = await res.json();
          setSimState(data);
        }
      } catch {}
      if (!cancelled) setTimeout(poll, 1000);
    }
    poll();
    return () => { cancelled = true; };
  }, []);

  // ── Sync force layout nodes/edges when state changes ───────────────────────
  useEffect(() => {
    if (!simState) return;

    const ids = simState.participants.map((p) => p.id);
    forceLayout.setNodes(ids);

    const edges = simState.connections.map((c) => ({ source: c.fromId, target: c.toId }));
    // Also add payment route edges (unique)
    const routeEdgeSeen = new Set<string>();
    for (const p of simState.payments) {
      const hops = p.route?.hops ?? [];
      for (let i = 0; i < hops.length - 1; i++) {
        const a = hops[i]; const b = hops[i + 1];
        if (a === "bridge" || b === "bridge") continue;
        const key = [a, b].sort().join(":");
        if (!routeEdgeSeen.has(key)) {
          routeEdgeSeen.add(key);
          edges.push({ source: a, target: b });
        }
      }
    }
    forceLayout.setEdges(edges);
    forceLayout.start();

    const nodeIds = new Set(ids);
    syncPayments(simState.payments, nodeIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simState]);

  // ── Particle animation loop ─────────────────────────────────────────────────
  useEffect(() => {
    function animLoop(now: number) {
      const dt = Math.min(now - lastTickRef.current, 50) / 1000; // seconds, capped
      lastTickRef.current = now;
      setParticles(tickParticles(dt));
      animRafRef.current = requestAnimationFrame(animLoop);
    }
    animRafRef.current = requestAnimationFrame(animLoop);
    return () => { if (animRafRef.current) cancelAnimationFrame(animRafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear particles on reset
  useEffect(() => {
    if (simState?.payments.length === 0) clear();
  }, [simState?.payments.length, clear]);

  if (!simState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-slate-400 text-lg">Connecting to simulation…</div>
      </div>
    );
  }

  const round = simState.round;
  const roundConfig = ROUND_CONFIGS[round];
  const totalSettled = simState.payments.filter((p) => p.status === "settled").length;
  const inFlight = simState.payments.filter((p) => ["routing", "message_sent"].includes(p.status)).length;
  const flagged = simState.payments.filter((p) => ["compliance_hold", "blocked"].includes(p.status)).length;

  return (
    <>
      <Head><title>Network — Payments Sim</title></Head>
      <div className={`min-h-screen bg-gradient-to-br ${ROUND_GRADIENT[round]} flex flex-col overflow-hidden`}>

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-500 uppercase tracking-widest">
              {round === 0 ? "Lobby" : `Round ${round}`}
            </div>
            <div className="text-xl font-black text-white">{roundConfig.title}</div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Stat label="Banks" value={simState.participants.length} color="text-sky-300" />
            <Stat label="Settled" value={totalSettled} color="text-emerald-300" />
            {inFlight > 0 && <Stat label="In flight" value={inFlight} color="text-blue-300" />}
            {flagged > 0 && <Stat label="Flagged" value={flagged} color="text-amber-300" />}
            {simState.blockchainMode && (
              <span className="badge-purple text-xs">⛓ Blockchain</span>
            )}
            {simState.chainSplit && (
              <span className="badge-red text-xs">⛓ Chain Split</span>
            )}
          </div>
        </div>

        {/* SVG canvas */}
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-full max-w-[1200px]"
            style={{ maxHeight: "calc(100vh - 120px)" }}
          >
            <defs>
              {/* Glow filters */}
              <filter id="glow-blue">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-green">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-amber">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              {/* Particle gradient */}
              <radialGradient id="particle-grad">
                <stop offset="0%" stopColor="white" stopOpacity="1" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Background grid (subtle) */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            </pattern>
            <rect width={W} height={H} fill="url(#grid)" />

            {/* ── Edges ───────────────────────────────────────────────────── */}
            <g>
              {simState.connections.map((c) => {
                const a = nodePositions.get(c.fromId);
                const b = nodePositions.get(c.toId);
                if (!a || !b) return null;
                return (
                  <line
                    key={`${c.fromId}-${c.toId}`}
                    x1={a.x} y1={a.y}
                    x2={b.x} y2={b.y}
                    stroke="rgba(148,163,184,0.2)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* Correspondent/route edges */}
              {(() => {
                const routeEdges: { a: string; b: string }[] = [];
                const seen = new Set<string>();
                for (const p of simState.payments) {
                  if (!p.route) continue;
                  const hops = p.route.hops.filter((h) => h !== "bridge");
                  for (let i = 0; i < hops.length - 1; i++) {
                    const key = [hops[i], hops[i + 1]].sort().join(":");
                    if (!seen.has(key)) {
                      seen.add(key);
                      routeEdges.push({ a: hops[i], b: hops[i + 1] });
                    }
                  }
                }
                return routeEdges.map(({ a, b }) => {
                  const pa = nodePositions.get(a);
                  const pb = nodePositions.get(b);
                  if (!pa || !pb) return null;
                  return (
                    <line
                      key={`route-${a}-${b}`}
                      x1={pa.x} y1={pa.y}
                      x2={pb.x} y2={pb.y}
                      stroke="rgba(251,191,36,0.25)"
                      strokeWidth={2}
                    />
                  );
                });
              })()}
            </g>

            {/* ── Particles ──────────────────────────────────────────────── */}
            <g>
              {particles.map((particle) => {
                const from = nodePositions.get(particle.fromId);
                const to = nodePositions.get(particle.toId);
                if (!from || !to) return null;
                const t = Math.min(particle.progress, 1);
                const x = from.x + (to.x - from.x) * t;
                const y = from.y + (to.y - from.y) * t;
                const opacity = particle.progress > 1 ? Math.max(0, 1.5 - particle.progress) : 1;

                return (
                  <g key={particle.id} opacity={opacity}>
                    {/* Trail */}
                    <line
                      x1={from.x + (to.x - from.x) * Math.max(0, t - 0.15)}
                      y1={from.y + (to.y - from.y) * Math.max(0, t - 0.15)}
                      x2={x}
                      y2={y}
                      stroke={particle.color}
                      strokeWidth={2}
                      strokeOpacity={0.4}
                      strokeLinecap="round"
                    />
                    {/* Glow outer */}
                    <circle cx={x} cy={y} r={8} fill={particle.color} opacity={0.2} />
                    {/* Core */}
                    <circle cx={x} cy={y} r={4} fill={particle.color} />
                    {/* White hot center */}
                    <circle cx={x} cy={y} r={2} fill="white" opacity={0.8} />
                    {/* Amount label */}
                    <text
                      x={x + 10} y={y - 8}
                      fill={particle.color}
                      fontSize={10}
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      €{particle.amount}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* ── Nodes ──────────────────────────────────────────────────── */}
            <g>
              {simState.participants.map((p) => {
                const pos = nodePositions.get(p.id);
                if (!pos) return null;
                const fill = nodeColor(p, simState.blockchainMode);
                const stroke = nodeStroke(p, simState.blockchainMode);
                const isActive = simState.payments.some(
                  (pay) =>
                    (pay.fromId === p.id || pay.toId === p.id) &&
                    ["routing", "message_sent", "compliance_hold"].includes(pay.status)
                );

                return (
                  <g key={p.id} transform={`translate(${pos.x},${pos.y})`}>
                    {/* Active pulse ring */}
                    {isActive && (
                      <circle r={NODE_R + 8} fill="none" stroke={stroke} strokeWidth={1.5} opacity={0.4}>
                        <animate attributeName="r" values={`${NODE_R + 4};${NODE_R + 14};${NODE_R + 4}`} dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.6;0;0.6" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {/* Node circle */}
                    <circle
                      r={NODE_R}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={p.isCorrespondent ? 3 : 2}
                    />
                    {/* Frozen overlay */}
                    {p.isFrozen && (
                      <circle r={NODE_R} fill="none" stroke="#94a3b8" strokeWidth={8} strokeOpacity={0.3} />
                    )}
                    {/* Correspondent star */}
                    {p.isCorrespondent && (
                      <text textAnchor="middle" dy={-NODE_R - 6} fill="#f59e0b" fontSize={14}>★</text>
                    )}
                    {/* Bank name */}
                    <text
                      textAnchor="middle"
                      dy={-6}
                      fill="white"
                      fontSize={p.displayName.length > 10 ? 8 : 9}
                      fontWeight="600"
                    >
                      {p.displayName.length > 14 ? p.displayName.slice(0, 13) + "…" : p.displayName}
                    </text>
                    {/* Balance */}
                    <text
                      textAnchor="middle"
                      dy={8}
                      fill={p.isFrozen ? "#64748b" : "#a5f3fc"}
                      fontSize={10}
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      {p.isFrozen ? "🔐" : `€${p.balance}`}
                    </text>
                    {/* Sanctioned */}
                    {p.isSanctioned && (
                      <text textAnchor="middle" dy={20} fill="#fca5a5" fontSize={9}>SANCTIONED</text>
                    )}
                    {/* Chain label */}
                    {p.chainId && (
                      <text textAnchor="middle" dy={20} fill={p.chainId === "A" ? "#93c5fd" : "#c4b5fd"} fontSize={9} fontWeight="bold">
                        Chain {p.chainId}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>

            {/* ── Empty state ─────────────────────────────────────────────── */}
            {simState.participants.length === 0 && (
              <text x={W / 2} y={H / 2} textAnchor="middle" fill="#475569" fontSize={18}>
                Waiting for participants to join…
              </text>
            )}
          </svg>
        </div>

        {/* Bottom bar */}
        <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between">
          <div className="text-sm text-slate-400 italic">
            {roundConfig.concept}
          </div>
          <div className="text-xs text-slate-700">
            The hardest part of moving money isn&apos;t moving money.
          </div>
        </div>

      </div>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-black ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
