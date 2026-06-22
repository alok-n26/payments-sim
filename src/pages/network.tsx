import Head from "next/head";
import { useEffect, useState, useRef, useCallback } from "react";
import { useForceLayout } from "@/hooks/useForceLayout";
import { usePaymentParticles } from "@/hooks/usePaymentParticles";
import type { NetworkState, Participant, RoundId } from "@/types";
import { ROUND_CONFIGS } from "@/lib/rounds";
import type { Particle } from "@/hooks/usePaymentParticles";

// ─── Dimensions ───────────────────────────────────────────────────────────────

const W = 1400;
const H = 900;
const NODE_R = 32;

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

// Convert a client mouse position to SVG viewBox coordinates
function clientToSVG(clientX: number, clientY: number, svgEl: SVGSVGElement): { x: number; y: number } {
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const m = svgEl.getScreenCTM();
  if (!m) return { x: clientX, y: clientY };
  const svgPt = pt.matrixTransform(m.inverse());
  return { x: svgPt.x, y: svgPt.y };
}

// Convert SVG viewBox coordinates to world (force layout) coordinates
function svgToWorld(svgX: number, svgY: number, tx: number, ty: number, scale: number) {
  return { x: (svgX - tx) / scale, y: (svgY - ty) / scale };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Viewport { x: number; y: number; scale: number }

export default function NetworkPage() {
  const [simState, setSimState] = useState<NetworkState | null>(null);
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [particles, setParticles] = useState<Particle[]>([]);
  const [vp, setVp] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [cursor, setCursor] = useState("default");
  const [settling, setSettling] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const vpRef = useRef<Viewport>({ x: 0, y: 0, scale: 1 });
  const prevRoundRef = useRef<number>(-1);
  const lastTickRef = useRef<number>(performance.now());
  const animRafRef = useRef<number | null>(null);

  // Keep vpRef in sync with state (for use inside event handlers)
  useEffect(() => { vpRef.current = vp; }, [vp]);

  // Drag state: null when idle, otherwise tracks what's being dragged
  const dragRef = useRef<{
    mode: "pan" | "node";
    startSVGX: number; startSVGY: number;
    startTX: number; startTY: number;
    nodeId?: string;
  } | null>(null);

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
        if (res.ok && !cancelled) setSimState(await res.json());
      } catch {}
      if (!cancelled) setTimeout(poll, 1000);
    }
    poll();
    return () => { cancelled = true; };
  }, []);

  // ── Sync force layout nodes/edges ──────────────────────────────────────────
  useEffect(() => {
    if (!simState) return;
    const ids = simState.participants.map((p) => p.id);
    forceLayout.setNodes(ids);

    const edges = simState.connections.map((c) => ({ source: c.fromId, target: c.toId }));
    const routeEdgeSeen = new Set<string>();
    for (const p of simState.payments) {
      const hops = p.route?.hops ?? [];
      for (let i = 0; i < hops.length - 1; i++) {
        const a = hops[i]; const b = hops[i + 1];
        if (a === "bridge" || b === "bridge") continue;
        const key = [a, b].sort().join(":");
        if (!routeEdgeSeen.has(key)) { routeEdgeSeen.add(key); edges.push({ source: a, target: b }); }
      }
    }
    forceLayout.setEdges(edges);

    // Only re-settle when the round changes (or on first load)
    if (simState.round !== prevRoundRef.current) {
      prevRoundRef.current = simState.round;
      setSettling(true);
      forceLayout.settle();
      // Clear the "settling" indicator after the simulation cools (~5s)
      setTimeout(() => setSettling(false), 5500);
    }

    const nodeIds = new Set(ids);
    syncPayments(simState.payments, nodeIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simState]);

  // ── Particle animation loop ─────────────────────────────────────────────────
  useEffect(() => {
    function animLoop(now: number) {
      const dt = Math.min(now - lastTickRef.current, 50) / 1000;
      lastTickRef.current = now;
      setParticles(tickParticles(dt));
      animRafRef.current = requestAnimationFrame(animLoop);
    }
    animRafRef.current = requestAnimationFrame(animLoop);
    return () => { if (animRafRef.current) cancelAnimationFrame(animRafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (simState?.payments.length === 0) clear();
  }, [simState?.payments.length, clear]);

  // ── Zoom (wheel) ────────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const cur = vpRef.current;
      const pt = clientToSVG(e.clientX, e.clientY, svg!);
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newScale = Math.max(0.2, Math.min(6, cur.scale * factor));
      const ratio = newScale / cur.scale;
      const newX = cur.x + (pt.x - cur.x) * (1 - ratio);
      const newY = cur.y + (pt.y - cur.y) * (1 - ratio);
      const next = { x: newX, y: newY, scale: newScale };
      vpRef.current = next;
      setVp(next);
    }
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // ── Pan & node-drag (mouse) ─────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    const svgPt = clientToSVG(e.clientX, e.clientY, svg);
    const cur = vpRef.current;

    // Check if clicking on a node
    const worldPt = svgToWorld(svgPt.x, svgPt.y, cur.x, cur.y, cur.scale);
    let hitNodeId: string | null = null;
    for (const [id, pos] of nodePositions) {
      const dx = worldPt.x - pos.x;
      const dy = worldPt.y - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) <= NODE_R + 6) { hitNodeId = id; break; }
    }

    if (hitNodeId) {
      forceLayout.pinNode(hitNodeId);
      dragRef.current = { mode: "node", startSVGX: svgPt.x, startSVGY: svgPt.y, startTX: cur.x, startTY: cur.y, nodeId: hitNodeId };
      setCursor("grabbing");
    } else {
      dragRef.current = { mode: "pan", startSVGX: svgPt.x, startSVGY: svgPt.y, startTX: cur.x, startTY: cur.y };
      setCursor("grabbing");
    }
    e.preventDefault();
  }, [nodePositions, forceLayout]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;

    const svgPt = clientToSVG(e.clientX, e.clientY, svg);
    const cur = vpRef.current;

    if (drag.mode === "pan") {
      const dx = svgPt.x - drag.startSVGX;
      const dy = svgPt.y - drag.startSVGY;
      const next = { ...cur, x: drag.startTX + dx, y: drag.startTY + dy };
      vpRef.current = next;
      setVp(next);
    } else if (drag.mode === "node" && drag.nodeId) {
      const world = svgToWorld(svgPt.x, svgPt.y, cur.x, cur.y, cur.scale);
      const node = forceLayout.nodesRef.current.get(drag.nodeId);
      if (node) {
        node.x = world.x; node.y = world.y; node.vx = 0; node.vy = 0;
        forceLayout.nudge(); // push updated position into React state when sim is stopped
      }
    }
  }, [forceLayout]);

  const handleMouseUp = useCallback(() => {
    const drag = dragRef.current;
    if (drag?.mode === "node" && drag.nodeId) {
      forceLayout.unpinNode(drag.nodeId);
    }
    dragRef.current = null;
    setCursor("default");
  }, [forceLayout]);

  // Release drag if mouse leaves the window
  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseUp]);

  // ── Zoom controls ───────────────────────────────────────────────────────────
  const zoomBy = useCallback((factor: number) => {
    setVp((prev) => {
      const newScale = Math.max(0.2, Math.min(6, prev.scale * factor));
      const ratio = newScale / prev.scale;
      const cx = W / 2; const cy = H / 2;
      const next = { x: prev.x + (cx - prev.x) * (1 - ratio), y: prev.y + (cy - prev.y) * (1 - ratio), scale: newScale };
      vpRef.current = next;
      return next;
    });
  }, []);

  const resetView = useCallback(() => {
    const next = { x: 0, y: 0, scale: 1 };
    vpRef.current = next;
    setVp(next);
  }, []);

  const handleSettle = useCallback(() => {
    setSettling(true);
    forceLayout.settle();
    setTimeout(() => setSettling(false), 5500);
  }, [forceLayout]);

  // ── Hover cursor on nodes ───────────────────────────────────────────────────
  const handleMouseMoveForCursor = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    handleMouseMove(e);
    if (dragRef.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const svgPt = clientToSVG(e.clientX, e.clientY, svg);
    const cur = vpRef.current;
    const world = svgToWorld(svgPt.x, svgPt.y, cur.x, cur.y, cur.scale);
    for (const pos of nodePositions.values()) {
      const dx = world.x - pos.x; const dy = world.y - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) <= NODE_R + 6) { setCursor("grab"); return; }
    }
    setCursor("default");
  }, [handleMouseMove, nodePositions]);

  // ── Render ──────────────────────────────────────────────────────────────────
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

  const vpTransform = `translate(${vp.x},${vp.y}) scale(${vp.scale})`;

  return (
    <>
      <Head><title>Network — Payments Sim</title></Head>
      <div className={`h-screen bg-gradient-to-br ${ROUND_GRADIENT[round]} flex flex-col overflow-hidden`}>

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 flex-shrink-0">
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
            {simState.blockchainMode && <span className="badge-purple text-xs">⛓ Blockchain</span>}
            {simState.chainSplit && <span className="badge-red text-xs">⛓ Chain Split</span>}
          </div>
        </div>

        {/* SVG canvas */}
        <div className="flex-1 relative overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-full"
            style={{ cursor, display: "block" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMoveForCursor}
            onMouseUp={handleMouseUp}
          >
            <defs>
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
            </defs>

            {/* Static background grid — not affected by viewport transform */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            </pattern>
            <rect width={W} height={H} fill="url(#grid)" />

            {/* ── Viewport group — zoom/pan applied here ── */}
            <g transform={vpTransform}>

              {/* Edges */}
              <g>
                {simState.connections.map((c) => {
                  const a = nodePositions.get(c.fromId);
                  const b = nodePositions.get(c.toId);
                  if (!a || !b) return null;
                  return (
                    <line
                      key={`${c.fromId}-${c.toId}`}
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke="rgba(148,163,184,0.2)"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                    />
                  );
                })}

                {/* Route edges */}
                {(() => {
                  const routeEdges: { a: string; b: string }[] = [];
                  const seen = new Set<string>();
                  for (const p of simState.payments) {
                    if (!p.route) continue;
                    const hops = p.route.hops.filter((h) => h !== "bridge");
                    for (let i = 0; i < hops.length - 1; i++) {
                      const key = [hops[i], hops[i + 1]].sort().join(":");
                      if (!seen.has(key)) { seen.add(key); routeEdges.push({ a: hops[i], b: hops[i + 1] }); }
                    }
                  }
                  return routeEdges.map(({ a, b }) => {
                    const pa = nodePositions.get(a); const pb = nodePositions.get(b);
                    if (!pa || !pb) return null;
                    return (
                      <line
                        key={`route-${a}-${b}`}
                        x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                        stroke="rgba(251,191,36,0.25)"
                        strokeWidth={2}
                      />
                    );
                  });
                })()}
              </g>

              {/* Particles */}
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
                      <line
                        x1={from.x + (to.x - from.x) * Math.max(0, t - 0.15)}
                        y1={from.y + (to.y - from.y) * Math.max(0, t - 0.15)}
                        x2={x} y2={y}
                        stroke={particle.color} strokeWidth={2} strokeOpacity={0.4} strokeLinecap="round"
                      />
                      <circle cx={x} cy={y} r={8} fill={particle.color} opacity={0.2} />
                      <circle cx={x} cy={y} r={4} fill={particle.color} />
                      <circle cx={x} cy={y} r={2} fill="white" opacity={0.8} />
                      <text x={x + 10} y={y - 8} fill={particle.color} fontSize={10} fontWeight="bold" fontFamily="monospace">
                        €{particle.amount}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* Nodes */}
              <g>
                {simState.participants.map((p) => {
                  const pos = nodePositions.get(p.id);
                  if (!pos) return null;
                  const fill = nodeColor(p, simState.blockchainMode);
                  const stroke = nodeStroke(p, simState.blockchainMode);
                  const isActive = simState.payments.some(
                    (pay) => (pay.fromId === p.id || pay.toId === p.id) &&
                      ["routing", "message_sent", "compliance_hold"].includes(pay.status)
                  );
                  return (
                    <g key={p.id} transform={`translate(${pos.x},${pos.y})`} style={{ cursor: "grab" }}>
                      {isActive && (
                        <circle r={NODE_R + 8} fill="none" stroke={stroke} strokeWidth={1.5} opacity={0.4}>
                          <animate attributeName="r" values={`${NODE_R + 4};${NODE_R + 14};${NODE_R + 4}`} dur="1.5s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.6;0;0.6" dur="1.5s" repeatCount="indefinite" />
                        </circle>
                      )}
                      <circle r={NODE_R} fill={fill} stroke={stroke} strokeWidth={p.isCorrespondent ? 3 : 2} />
                      {p.isFrozen && <circle r={NODE_R} fill="none" stroke="#94a3b8" strokeWidth={8} strokeOpacity={0.3} />}
                      {p.isCorrespondent && <text textAnchor="middle" dy={-NODE_R - 6} fill="#f59e0b" fontSize={14}>★</text>}
                      <text textAnchor="middle" dy={-6} fill="white" fontSize={p.displayName.length > 10 ? 9 : 10} fontWeight="600">
                        {p.displayName.length > 14 ? p.displayName.slice(0, 13) + "…" : p.displayName}
                      </text>
                      <text textAnchor="middle" dy={9} fill={p.isFrozen ? "#64748b" : "#a5f3fc"} fontSize={11} fontWeight="700" fontFamily="monospace">
                        {p.isFrozen ? "🔐" : `€${p.balance}`}
                      </text>
                      {p.isSanctioned && <text textAnchor="middle" dy={22} fill="#fca5a5" fontSize={9}>SANCTIONED</text>}
                      {p.chainId && (
                        <text textAnchor="middle" dy={22} fill={p.chainId === "A" ? "#93c5fd" : "#c4b5fd"} fontSize={9} fontWeight="bold">
                          Chain {p.chainId}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>

              {simState.participants.length === 0 && (
                <text x={W / 2} y={H / 2} textAnchor="middle" fill="#475569" fontSize={18}>
                  Waiting for participants to join…
                </text>
              )}

            </g>{/* end viewport group */}
          </svg>

          {/* ── Controls overlay ── */}
          <div className="absolute bottom-16 right-4 flex flex-col gap-1">
            <button
              onClick={handleSettle}
              disabled={settling}
              className="px-2 h-9 bg-slate-800/90 hover:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors select-none whitespace-nowrap"
              title="Re-run layout"
            >
              {settling ? (
                <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
              ) : "↺"}
              Reorganise
            </button>
            <div className="flex gap-1">
              <button
                onClick={() => zoomBy(1.25)}
                className="flex-1 h-9 bg-slate-800/90 hover:bg-slate-700 text-white rounded-lg text-lg font-bold leading-none flex items-center justify-center border border-slate-700 transition-colors select-none"
                title="Zoom in"
              >+</button>
              <button
                onClick={() => zoomBy(1 / 1.25)}
                className="flex-1 h-9 bg-slate-800/90 hover:bg-slate-700 text-white rounded-lg text-lg font-bold leading-none flex items-center justify-center border border-slate-700 transition-colors select-none"
                title="Zoom out"
              >−</button>
              <button
                onClick={resetView}
                className="flex-1 h-9 bg-slate-800/90 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold leading-none flex items-center justify-center border border-slate-700 transition-colors select-none"
                title="Reset view"
              >⊡</button>
            </div>
          </div>

          {/* Hint */}
          <div className="absolute bottom-4 right-4 text-xs text-slate-700 select-none">
            scroll to zoom · drag to pan · drag nodes to move
          </div>
        </div>

        {/* Bottom bar */}
        <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-slate-400 italic">{roundConfig.concept}</div>
          <div className="text-xs text-slate-700">The hardest part of moving money isn&apos;t moving money.</div>
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
