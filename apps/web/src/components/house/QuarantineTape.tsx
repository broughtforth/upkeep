"use client";

import { useMemo } from "react";
import { CanvasTexture, DoubleSide, RepeatWrapping } from "three";
import type { RoomLabel } from "@/lib/store";

// Diagonal yellow/black stripe texture. Generated on a high-res canvas
// (256×128) with thick, saturated stripes so the tape reads at any zoom.
// The texture is reused across every tape strip on screen.
function makeTapeTexture(): CanvasTexture {
  const W = 256;
  const H = 128;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  // Saturated cadmium yellow base.
  ctx.fillStyle = "#FFE100";
  ctx.fillRect(0, 0, W, H);
  // Thick diagonal black stripes — about 50:50 ratio with yellow.
  ctx.fillStyle = "#0A0A0A";
  const stripeWidth = 56;   // half a stripe-cycle of black
  const gap = 112;          // one full cycle (yellow + black)
  const skew = 70;          // diagonal lean over the full height
  for (let x = -W; x < W * 2; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeWidth, 0);
    ctx.lineTo(x + stripeWidth + skew, H);
    ctx.lineTo(x + skew, H);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
}

let tapeTexCache: CanvasTexture | null = null;
function tapeTexture(): CanvasTexture {
  if (!tapeTexCache) tapeTexCache = makeTapeTexture();
  return tapeTexCache;
}

/**
 * Biohazard tape ribbon around a quarantined room. Each polygon edge gets
 * one striped plane plus a thin black rim above and below it so the tape
 * reads against either a light or dark canvas. Slightly above chest height
 * so it floats above furniture.
 */
export function QuarantineTape({ label }: { label: RoomLabel }) {
  const points = useMemo<[number, number][]>(() => {
    if (label.shape && label.shape.length >= 3) return label.shape;
    const px = label.position[0];
    const pz = label.position[2];
    const hw = label.size[0] / 2;
    const hd = label.size[2] / 2;
    return [
      [px - hw, pz - hd],
      [px + hw, pz - hd],
      [px + hw, pz + hd],
      [px - hw, pz + hd],
    ];
  }, [label]);

  const walls = useMemo(() => {
    return points.map(([x1, z1], i) => {
      const [x2, z2] = points[(i + 1) % points.length];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const length = Math.hypot(dx, dz);
      return {
        midX: (x1 + x2) / 2,
        midZ: (z1 + z2) / 2,
        length,
        angle: Math.atan2(-dz, dx),
      };
    });
  }, [points]);

  const tex = useMemo(() => tapeTexture(), []);

  // Tape height bumped from 0.18m → 0.36m and lifted to 1.05m so it sits
  // around eye-level of the resident figures and clear of any furniture.
  const TAPE_Y = 1.05;
  const TAPE_H = 0.36;
  const RIM_H = 0.04; // thin solid black rim above + below for contrast

  return (
    <group>
      {walls.map((w, i) => {
        // Per-edge texture clone so the stripe repeat scales with length.
        // Roughly one stripe-cycle every 35cm of edge.
        const repeatTex = tex.clone();
        repeatTex.needsUpdate = true;
        repeatTex.wrapS = RepeatWrapping;
        repeatTex.wrapT = RepeatWrapping;
        repeatTex.repeat.set(Math.max(1, w.length / 0.35), 1);
        return (
          <group
            key={i}
            position={[w.midX, TAPE_Y, w.midZ]}
            rotation={[0, w.angle, 0]}
          >
            {/* Top rim — solid black so the tape reads against light bg */}
            <mesh position={[0, TAPE_H / 2 + RIM_H / 2, 0]} renderOrder={15}>
              <planeGeometry args={[w.length, RIM_H]} />
              <meshBasicMaterial
                color="#0A0A0A"
                side={DoubleSide}
                depthWrite={false}
                depthTest={false}
              />
            </mesh>

            {/* The striped ribbon itself */}
            <mesh renderOrder={16}>
              <planeGeometry args={[w.length, TAPE_H]} />
              <meshBasicMaterial
                map={repeatTex}
                side={DoubleSide}
                transparent={false}
                depthWrite={false}
                depthTest={false}
                toneMapped={false}
              />
            </mesh>

            {/* Bottom rim */}
            <mesh position={[0, -(TAPE_H / 2 + RIM_H / 2), 0]} renderOrder={15}>
              <planeGeometry args={[w.length, RIM_H]} />
              <meshBasicMaterial
                color="#0A0A0A"
                side={DoubleSide}
                depthWrite={false}
                depthTest={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
