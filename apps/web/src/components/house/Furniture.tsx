"use client";

import { Edges } from "@react-three/drei";
import type { RoomType } from "@/lib/types";

const EDGE = "#0a0a0a";
const WHITE = "#ffffff";
const OFFWHITE = "#fafafa";
const ACCENT = "#f5f5f4";
const DARK = "#1c1917";
const GLASS = "#dbeafe";

// ─── Primitives ──────────────────────────────────────────────────────────

interface FurnProps {
  x: number;
  z: number;
  size: [number, number, number];
  color?: string;
  edgeColor?: string;
  edgeWidth?: number;
  yOffset?: number;
}

function Furn({ x, z, size, color = WHITE, edgeColor = EDGE, edgeWidth = 1, yOffset = 0 }: FurnProps) {
  const [, h] = size;
  return (
    <mesh position={[x, h / 2 + yOffset, z]} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
      <Edges color={edgeColor} lineWidth={edgeWidth} threshold={15} />
    </mesh>
  );
}

function Rug({ x, z, w, d, color = "#e7e5e4" }: { x: number; z: number; w: number; d: number; color?: string }) {
  return (
    <mesh position={[x, 0.015, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={color} />
      <Edges color={EDGE} lineWidth={0.8} threshold={15} />
    </mesh>
  );
}

// A tall cupboard with visible shelf dividers on its front face.
function Cupboard({
  x, z, w, d, h, shelves = 4, facing = "front",
}: {
  x: number; z: number; w: number; d: number; h: number;
  shelves?: number;
  facing?: "front" | "back" | "left" | "right";
}) {
  // Front face plane offset by half-depth/width based on facing.
  const planeProps = (() => {
    switch (facing) {
      case "front": return { position: [0, 0, d / 2 + 0.005], rotation: [0, 0, 0] };
      case "back":  return { position: [0, 0, -d / 2 - 0.005], rotation: [0, Math.PI, 0] };
      case "left":  return { position: [-w / 2 - 0.005, 0, 0], rotation: [0, -Math.PI / 2, 0] };
      case "right": return { position: [w / 2 + 0.005, 0, 0], rotation: [0, Math.PI / 2, 0] };
    }
  })() as { position: [number, number, number]; rotation: [number, number, number] };

  const planeWidth = facing === "left" || facing === "right" ? d : w;

  return (
    <group position={[x, 0, z]}>
      <Furn x={0} z={0} size={[w, h, d]} color={OFFWHITE} edgeWidth={1.5} />
      {/* Shelf dividers on the front face */}
      <group position={[0, h / 2, 0]}>
        <group position={planeProps.position} rotation={planeProps.rotation}>
          {Array.from({ length: shelves - 1 }).map((_, i) => {
            const y = -h / 2 + ((i + 1) / shelves) * h;
            return (
              <mesh key={i} position={[0, y, 0]}>
                <planeGeometry args={[planeWidth - 0.06, 0.02]} />
                <meshBasicMaterial color={EDGE} />
              </mesh>
            );
          })}
          {/* Vertical handle line in the centre */}
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[0.025, h * 0.85]} />
            <meshBasicMaterial color="#525252" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// A simple bed: a thin mattress slab + a thicker base.
function Bed({ x, z, w = 1.6, d = 2.0 }: { x: number; z: number; w?: number; d?: number }) {
  return (
    <group position={[x, 0, z]}>
      <Furn x={0} z={0} size={[w, 0.3, d]} color={ACCENT} />
      <Furn x={0} z={-d / 2 + 0.25} size={[w * 0.85, 0.45, 0.4]} color={WHITE} />
      <Furn x={0} z={0.1} size={[w * 0.9, 0.05, d * 0.6]} color="#e5e7eb" yOffset={0.32} />
    </group>
  );
}

// A futon — rolled cylinder approximation using a flat low slab.
function Futon({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Furn x={0} z={0} size={[0.7, 0.25, 1.8]} color={ACCENT} />
    </group>
  );
}

// Toilet: bowl + tank (two boxes).
function Toilet({ x, z, rotateY = 0 }: { x: number; z: number; rotateY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotateY, 0]}>
      <Furn x={0} z={0} size={[0.42, 0.42, 0.55]} color={WHITE} />
      <Furn x={0} z={-0.27} size={[0.42, 0.7, 0.18]} color={WHITE} />
    </group>
  );
}

// Sink / vanity unit (wider than deep).
function Vanity({ x, z, w = 1.2, rotateY = 0 }: { x: number; z: number; w?: number; rotateY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotateY, 0]}>
      <Furn x={0} z={0} size={[w, 0.85, 0.5]} color={WHITE} />
      <Furn x={0} z={0.06} size={[w * 0.55, 0.06, 0.32]} color={GLASS} yOffset={0.85} />
      {/* Mirror on the wall behind */}
      <Furn x={0} z={-0.27} size={[w * 0.75, 0.7, 0.04]} color={GLASS} yOffset={0.9} />
    </group>
  );
}

// Shower stall — translucent glass walls
function Shower({ x, z, w = 1.2, d = 1.2 }: { x: number; z: number; w?: number; d?: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* tray */}
      <Furn x={0} z={0} size={[w, 0.06, d]} color="#f5f5f4" />
      {/* glass walls (semi-transparent boxes) */}
      <mesh position={[0, 0.9, d / 2 - 0.02]} castShadow>
        <boxGeometry args={[w, 1.8, 0.04]} />
        <meshStandardMaterial color={GLASS} transparent opacity={0.35} />
        <Edges color={EDGE} lineWidth={1} />
      </mesh>
      <mesh position={[w / 2 - 0.02, 0.9, 0]} castShadow>
        <boxGeometry args={[0.04, 1.8, d]} />
        <meshStandardMaterial color={GLASS} transparent opacity={0.35} />
        <Edges color={EDGE} lineWidth={1} />
      </mesh>
    </group>
  );
}

// Pegboard — a flat panel mounted against a wall, with small "tool" dots.
function Pegboard({ x, z, w = 2.0, h = 1.0, rotateY = 0 }: { x: number; z: number; w?: number; h?: number; rotateY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotateY, 0]}>
      <mesh position={[0, h / 2 + 0.2, 0]} castShadow>
        <boxGeometry args={[w, h, 0.05]} />
        <meshStandardMaterial color={OFFWHITE} />
        <Edges color={EDGE} lineWidth={1.5} />
      </mesh>
      {/* Tool silhouettes — small black squares */}
      {[-0.5, -0.2, 0.1, 0.4, 0.65].map((tx, i) => (
        <mesh key={i} position={[tx * (w / 1.5), 0.55 + (i % 2) * 0.25, 0.03]}>
          <planeGeometry args={[0.18, 0.18]} />
          <meshBasicMaterial color={DARK} />
        </mesh>
      ))}
    </group>
  );
}

// Monitor on a stand — box with a darker face.
function Monitor({ x, z, w = 0.8, rotateY = 0 }: { x: number; z: number; w?: number; rotateY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotateY, 0]}>
      <Furn x={0} z={0} size={[w, 0.5, 0.05]} color={DARK} yOffset={0.75} />
      <Furn x={0} z={0} size={[0.18, 0.1, 0.18]} color={ACCENT} yOffset={0.75} />
    </group>
  );
}

// Lantern — tall thin box (Zen Room).
function Lantern({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Furn x={0} z={0} size={[0.18, 0.6, 0.18]} color="#fde68a" />
      <Furn x={0} z={0} size={[0.06, 0.3, 0.06]} color={DARK} yOffset={0.6} />
    </group>
  );
}

// ─── Per-room layouts ────────────────────────────────────────────────────

export function RoomFurniture({ type, width, depth }: { type: RoomType; width: number; depth: number }) {
  const w2 = width / 2;
  const d2 = depth / 2;

  switch (type) {
    case "corridor": {
      // Long runner with a console table at one end + a potted plant at the other.
      return (
        <>
          <Rug x={0} z={0} w={width - 1} d={Math.max(0.6, depth - 0.6)} color="#d6cfb5" />
          {/* Console table along one side */}
          <Furn x={-w2 + 3} z={-d2 + 0.25} size={[2.0, 0.85, 0.35]} color={OFFWHITE} />
          {/* Lamp on the console */}
          <Furn x={-w2 + 2.4} z={-d2 + 0.25} size={[0.15, 0.5, 0.15]} color={DARK} yOffset={0.85} />
          <Furn x={-w2 + 2.4} z={-d2 + 0.25} size={[0.32, 0.06, 0.32]} color="#fde68a" yOffset={1.35} />
          {/* Potted plant at the other end */}
          <Furn x={w2 - 1} z={d2 - 0.3} size={[0.35, 0.35, 0.35]} color="#92400e" />
          <Furn x={w2 - 1} z={d2 - 0.3} size={[0.5, 0.5, 0.5]} color="#166534" yOffset={0.35} />
          {/* Coat rack — small */}
          <Furn x={w2 - 3} z={-d2 + 0.2} size={[0.08, 1.3, 0.08]} color={DARK} />
          <Furn x={w2 - 3} z={-d2 + 0.2} size={[0.5, 0.05, 0.05]} color={DARK} yOffset={1.2} />
        </>
      );
    }

    case "bathroom": {
      // Long bathroom 3 × 6 — three zones per compendium (sink · toilet · shower)
      return (
        <>
          {/* Zone B — Toilet (top of room) */}
          <Toilet x={-w2 + 0.4} z={-d2 + 0.6} />
          {/* Toilet brush stand */}
          <Furn x={-w2 + 0.4} z={-d2 + 1.1} size={[0.1, 0.4, 0.1]} color={DARK} />

          {/* Cupboard III — Towels & Medicine */}
          <Cupboard x={w2 - 0.25} z={-d2 + 1.0} w={0.5} d={1.6} h={1.3} shelves={5} facing="left" />

          {/* Zone A — Sink/Vanity (middle) */}
          <Vanity x={0} z={0} w={Math.min(1.4, width - 0.4)} />

          {/* Bath mat */}
          <Rug x={0} z={0.6} w={1} d={0.5} color="#d6d3d1" />

          {/* Zone C — Shower stall (bottom of room) */}
          <Shower x={0} z={d2 - 0.8} w={Math.min(1.6, width - 0.5)} d={1.4} />

          {/* Squeegee on shower wall — tiny */}
          <Furn x={0.6} z={d2 - 0.2} size={[0.05, 0.4, 0.05]} color={DARK} yOffset={0.5} />
        </>
      );
    }

    case "kitchen": {
      return (
        <>
          {/* Back counter run with stove inset (darker section) */}
          <Furn x={-0.8} z={-d2 + 0.3} size={[width - 2.5, 0.92, 0.55]} color={OFFWHITE} />
          {/* Stove section */}
          <Furn x={width / 2 - 1.4} z={-d2 + 0.3} size={[1.0, 0.92, 0.55]} color={DARK} />
          {/* Stove burners — four black dots on top */}
          {[-0.25, 0.25].map((dx) =>
            [-0.15, 0.15].map((dz) => (
              <mesh key={`b${dx}${dz}`} position={[width / 2 - 1.4 + dx, 0.93, -d2 + 0.3 + dz]}>
                <cylinderGeometry args={[0.08, 0.08, 0.005, 16]} />
                <meshStandardMaterial color="#27272a" />
              </mesh>
            )),
          )}
          {/* Fridge — tall, opposite corner */}
          <Cupboard x={-w2 + 0.45} z={-d2 + 0.45} w={0.85} d={0.85} h={1.35} shelves={2} facing="front" />

          {/* Kitchen island */}
          <Furn x={0} z={0.3} size={[Math.min(2.6, width - 1.5), 0.92, 1.05]} color={OFFWHITE} />
          {/* Bar stools — three facing the island */}
          {[-0.8, 0, 0.8].map((dx) => (
            <Furn key={dx} x={dx} z={d2 - 1.0} size={[0.35, 0.55, 0.35]} color={WHITE} />
          ))}

          {/* iPad on small stand near the entrance */}
          <Furn x={w2 - 0.5} z={d2 - 0.4} size={[0.4, 0.08, 0.3]} color={DARK} yOffset={1.0} />
          <Furn x={w2 - 0.5} z={d2 - 0.4} size={[0.18, 1.0, 0.18]} color={ACCENT} />

          {/* "Library" bench — popcorn/ice-cream/smoothie devices */}
          <Furn x={-w2 + 1.4} z={d2 - 0.4} size={[1.2, 0.8, 0.5]} color={OFFWHITE} />
          <Furn x={-w2 + 0.95} z={d2 - 0.4} size={[0.25, 0.3, 0.25]} color={DARK} yOffset={0.8} />
          <Furn x={-w2 + 1.4} z={d2 - 0.4} size={[0.3, 0.35, 0.3]} color={DARK} yOffset={0.8} />
          <Furn x={-w2 + 1.85} z={d2 - 0.4} size={[0.22, 0.4, 0.22]} color={DARK} yOffset={0.8} />
        </>
      );
    }

    case "tech": {
      // Tech room — 3 tables along back wall, pegboard one side, cabinet the other
      return (
        <>
          {/* Three workstation tables */}
          {[-w2 + 1.0, 0, w2 - 1.0].map((tx, i) => (
            <group key={i}>
              <Furn x={tx} z={-d2 + 0.45} size={[1.2, 0.74, 0.7]} color={OFFWHITE} />
              <Monitor x={tx} z={-d2 + 0.3} />
              {/* Chair behind the desk */}
              <Furn x={tx} z={-d2 + 1.35} size={[0.5, 0.5, 0.5]} color={ACCENT} />
              {/* Chair backrest */}
              <Furn x={tx} z={-d2 + 1.55} size={[0.5, 0.85, 0.08]} color={ACCENT} />
            </group>
          ))}

          {/* Pegboard — left side wall */}
          <Pegboard x={-w2 + 0.1} z={d2 - 1.3} w={1.6} h={0.9} rotateY={Math.PI / 2} />

          {/* Cabinet — right side wall (lenses / inventory) */}
          <Cupboard x={w2 - 0.3} z={d2 - 1.0} w={0.55} d={1.4} h={1.25} shelves={4} facing="left" />

          {/* Repair-depot bin in the corner */}
          <Furn x={0} z={d2 - 0.4} size={[0.5, 0.55, 0.5]} color={DARK} />
          {/* Drone on the centre table */}
          <Furn x={0} z={-d2 + 0.6} size={[0.45, 0.07, 0.45]} color={DARK} yOffset={0.78} />
          <Furn x={0} z={-d2 + 0.6} size={[0.55, 0.02, 0.02]} color={DARK} yOffset={0.78} />
        </>
      );
    }

    case "living": {
      // Media Room — 6×6 — three stations
      return (
        <>
          <Rug x={0} z={0.5} w={width - 1.8} d={depth - 2.2} />

          {/* Content Lounge — sofa back-left */}
          <Furn x={-1.2} z={-d2 + 0.6} size={[2.4, 0.7, 0.95]} color={OFFWHITE} />
          {/* Sofa back cushion */}
          <Furn x={-1.2} z={-d2 + 0.3} size={[2.4, 0.45, 0.25]} color={ACCENT} yOffset={0.4} />

          {/* Coffee table */}
          <Furn x={-1} z={0.6} size={[1.4, 0.38, 0.7]} color={WHITE} />

          {/* TV stand & screen — front wall */}
          <Furn x={-1.2} z={d2 - 0.3} size={[2.2, 0.45, 0.4]} color={OFFWHITE} />
          <Furn x={-1.2} z={d2 - 0.35} size={[1.8, 1.0, 0.05]} color={DARK} yOffset={0.45} />

          {/* Muse Mirror — back-right (table + mirror panel + light) */}
          <Furn x={w2 - 1.2} z={-d2 + 0.6} size={[1.6, 0.75, 0.65]} color={OFFWHITE} />
          <Furn x={w2 - 1.2} z={-d2 + 0.3} size={[1.4, 1.2, 0.05]} color={GLASS} yOffset={0.75} />
          {/* Ring light */}
          <mesh position={[w2 - 1.2, 1.6, -d2 + 0.5]}>
            <torusGeometry args={[0.2, 0.025, 12, 24]} />
            <meshStandardMaterial color={WHITE} emissive="#fafafa" emissiveIntensity={0.3} />
          </mesh>

          {/* Sound Salon — instruments on a low rack (front-right) */}
          <Furn x={w2 - 1.0} z={d2 - 0.5} size={[1.8, 0.3, 0.5]} color={OFFWHITE} />
          {/* Guitar */}
          <Furn x={w2 - 1.7} z={d2 - 0.5} size={[0.15, 1.0, 0.12]} color={"#92400e"} yOffset={0.3} />
          {/* Keyboard */}
          <Furn x={w2 - 0.6} z={d2 - 0.5} size={[1.0, 0.08, 0.35]} color={DARK} yOffset={0.3} />

          {/* Wardrobe — for cameras/lighting/backdrops, against the far wall */}
          <Cupboard x={-w2 + 0.3} z={0.5} w={0.55} d={2.0} h={1.3} shelves={4} facing="right" />

          {/* Floor cushions */}
          <Furn x={-0.2} z={1.0} size={[0.5, 0.18, 0.5]} color={ACCENT} />
          <Furn x={0.4} z={1.2} size={[0.5, 0.18, 0.5]} color={ACCENT} />
        </>
      );
    }

    case "bedroom": {
      // Zen Room — 4×6 — tatami feel, low furniture, futon
      return (
        <>
          {/* Tatami mat — large central rug */}
          <Rug x={0} z={0} w={width - 0.8} d={depth - 0.8} color="#e7d9b0" />

          {/* Chabudai (low table) in the centre */}
          <Furn x={0} z={0} size={[1.4, 0.32, 0.9]} color={"#8b6f3f"} />
          {/* Cushion next to it */}
          <Furn x={0} z={0.9} size={[0.55, 0.18, 0.55]} color={ACCENT} />
          <Furn x={0} z={-0.9} size={[0.55, 0.18, 0.55]} color={ACCENT} />

          {/* Futon rolled in the corner */}
          <Futon x={-w2 + 0.5} z={d2 - 1.5} />

          {/* Wardrobe (jumper cabinet) along one wall */}
          <Cupboard x={w2 - 0.3} z={-d2 + 1.0} w={0.55} d={1.6} h={1.3} shelves={5} facing="left" />

          {/* Cupboard V — Seasonal clothing — opposite wall */}
          <Cupboard x={-w2 + 0.3} z={-d2 + 1.0} w={0.55} d={1.5} h={1.3} shelves={4} facing="right" />

          {/* Lanterns and fountain */}
          <Lantern x={w2 - 0.5} z={d2 - 0.5} />
          <Lantern x={-w2 + 0.5} z={d2 - 0.5} />
          {/* Fountain — small low square */}
          <Furn x={w2 - 0.6} z={1.2} size={[0.5, 0.22, 0.5]} color={GLASS} />
        </>
      );
    }
  }
}
