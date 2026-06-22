// @refresh reset
import { useRef, useEffect, useCallback } from "react";

export interface ForceNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface ForceEdge {
  source: string;
  target: string;
}

interface Options {
  width: number;
  height: number;
  onTick: (nodes: Map<string, ForceNode>) => void;
}

export function useForceLayout({ width, height, onTick }: Options) {
  const nodesRef = useRef<Map<string, ForceNode>>(new Map());
  const edgesRef = useRef<ForceEdge[]>([]);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  const tick = useCallback(() => {
    if (!runningRef.current) return;
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const nodeArr = Array.from(nodes.values());
    const cx = width / 2;
    const cy = height / 2;

    // Reset forces
    for (const n of nodeArr) {
      (n as ForceNode & { fx: number; fy: number }).fx = 0;
      (n as ForceNode & { fx: number; fy: number }).fy = 0;
    }

    // Repulsion between all pairs
    const repulsion = 4000;
    for (let i = 0; i < nodeArr.length; i++) {
      for (let j = i + 1; j < nodeArr.length; j++) {
        const a = nodeArr[i] as ForceNode & { fx: number; fy: number };
        const b = nodeArr[j] as ForceNode & { fx: number; fy: number };
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.fx += fx; a.fy += fy;
        b.fx -= fx; b.fy -= fy;
      }
    }

    // Spring attraction along edges
    const springLen = Math.min(width, height) * 0.28;
    const springK = 0.04;
    for (const edge of edges) {
      const a = nodes.get(edge.source) as (ForceNode & { fx: number; fy: number }) | undefined;
      const b = nodes.get(edge.target) as (ForceNode & { fx: number; fy: number }) | undefined;
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const stretch = dist - springLen;
      const fx = (dx / dist) * stretch * springK;
      const fy = (dy / dist) * stretch * springK;
      a.fx += fx; a.fy += fy;
      b.fx -= fx; b.fy -= fy;
    }

    // Center gravity
    const gravity = 0.015;
    for (const n of nodeArr) {
      const nn = n as ForceNode & { fx: number; fy: number };
      nn.fx += (cx - n.x) * gravity;
      nn.fy += (cy - n.y) * gravity;
    }

    // Integrate
    const damping = 0.85;
    const padding = 60;
    for (const n of nodeArr) {
      const nn = n as ForceNode & { fx: number; fy: number };
      n.vx = (n.vx + nn.fx) * damping;
      n.vy = (n.vy + nn.fy) * damping;
      n.x = Math.max(padding, Math.min(width - padding, n.x + n.vx));
      n.y = Math.max(padding, Math.min(height - padding, n.y + n.vy));
    }

    onTick(nodes);
    rafRef.current = requestAnimationFrame(tick);
  }, [width, height, onTick]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const setNodes = useCallback((ids: string[]) => {
    const existing = nodesRef.current;
    const next = new Map<string, ForceNode>();
    const cx = width / 2;
    const cy = height / 2;
    for (const id of ids) {
      if (existing.has(id)) {
        next.set(id, existing.get(id)!);
      } else {
        // Place new nodes in a circle with jitter
        const angle = Math.random() * Math.PI * 2;
        const r = Math.min(width, height) * 0.3;
        next.set(id, {
          id,
          x: cx + Math.cos(angle) * r + (Math.random() - 0.5) * 40,
          y: cy + Math.sin(angle) * r + (Math.random() - 0.5) * 40,
          vx: 0,
          vy: 0,
        });
      }
    }
    nodesRef.current = next;
  }, [width, height]);

  const setEdges = useCallback((edges: ForceEdge[]) => {
    edgesRef.current = edges;
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { start, stop, setNodes, setEdges, nodesRef };
}
