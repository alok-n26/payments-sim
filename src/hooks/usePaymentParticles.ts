import { useRef, useCallback } from "react";
import type { Payment } from "@/types";

export interface Particle {
  id: string;
  paymentId: string;
  fromId: string;
  toId: string;
  progress: number; // 0→1 along the path
  amount: number;
  status: Payment["status"];
  color: string;
  hops: string[]; // full route if multi-hop
  hopIndex: number;
}

const STATUS_COLOR: Record<string, string> = {
  routing: "#38bdf8",
  message_sent: "#818cf8",
  compliance_hold: "#fbbf24",
  settled: "#34d399",
  failed: "#f87171",
  blocked: "#f87171",
};

export function usePaymentParticles() {
  const particlesRef = useRef<Map<string, Particle>>(new Map());
  const seenPayments = useRef<Set<string>>(new Set());

  const syncPayments = useCallback((payments: Payment[], nodeIds: Set<string>) => {
    const particles = particlesRef.current;

    for (const p of payments) {
      if (!nodeIds.has(p.fromId) || !nodeIds.has(p.toId)) continue;

      const hops = p.route?.hops ?? [p.fromId, p.toId];
      const key = p.id;

      if (!seenPayments.current.has(key)) {
        // Brand new payment — spawn particle
        seenPayments.current.add(key);
        if (["pending", "routing", "message_sent", "settled", "compliance_hold"].includes(p.status)) {
          particles.set(key, {
            id: key,
            paymentId: p.id,
            fromId: hops[0],
            toId: hops[hops.length - 1],
            progress: 0,
            amount: p.amount,
            status: p.status,
            color: STATUS_COLOR[p.status] ?? "#94a3b8",
            hops: hops.filter((h) => h !== "bridge" && nodeIds.has(h)),
            hopIndex: 0,
          });
        }
      } else {
        // Update status color on existing particle
        const particle = particles.get(key);
        if (particle) {
          particle.status = p.status;
          particle.color = STATUS_COLOR[p.status] ?? particle.color;
        }
      }
    }

    // Clean up fully-completed particles that finished their animation
    // (handled in tickParticles)
  }, []);

  const tickParticles = useCallback((dt: number): Particle[] => {
    const particles = particlesRef.current;
    const speed = 0.5 * dt; // progress units per second (dt is in seconds)

    for (const [key, p] of particles) {
      p.progress += speed;
      if (p.progress >= 1) {
        if (p.hopIndex < p.hops.length - 2) {
          // Advance to next hop
          p.hopIndex++;
          p.progress = 0;
          p.fromId = p.hops[p.hopIndex];
          p.toId = p.hops[p.hopIndex + 1];
        } else {
          // Reached destination — linger briefly then remove
          if (p.progress >= 1.5) {
            particles.delete(key);
          }
        }
      }
    }
    return Array.from(particles.values());
  }, []);

  const clear = useCallback(() => {
    particlesRef.current.clear();
    seenPayments.current.clear();
  }, []);

  return { syncPayments, tickParticles, clear };
}
