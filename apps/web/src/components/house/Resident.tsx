"use client";

import { useEffect, useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import type { Profile, Room } from "@/lib/types";
import { colorFromString } from "@/lib/store";

interface Props {
  profile: Profile;
  room: Room;
  pinPositions: Array<[number, number, number]>;
}

const WALK_SPEED = 0.9;     // m/s — strolling, not jogging
const TURN_RATE = 6;        // rad/s — how quickly the figure faces the new direction
const WANDER_PAUSE = 1.6;   // seconds to "clean" before picking a new spot
const HEAD_SKIN = "#f5d3a8";
const PANTS_COLOR = "#2a2620";

export function Resident({ profile, room, pinPositions }: Props) {
  const groupRef = useRef<Group>(null);
  const armLRef = useRef<Group>(null);
  const armRRef = useRef<Group>(null);
  const legLRef = useRef<Group>(null);
  const legRRef = useRef<Group>(null);

  // Build a list of wander targets inside the room — random points within
  // the floor footprint with a small inset so the figure doesn't clip a
  // wall. We cycle through these so the person walks around as if cleaning.
  const wanderTargets = useMemo(() => {
    const halfW = Math.max(0.2, room.width / 2 - 0.35);
    const halfD = Math.max(0.2, room.depth / 2 - 0.35);
    const seed = (profile.id.charCodeAt(0) || 1) * 7919;
    const rand = (n: number) => {
      // Tiny deterministic LCG so the same person picks the same path
      // across renders — avoids re-shuffling when React re-mounts.
      let x = seed + n * 2654435761;
      x = (x ^ (x >>> 13)) >>> 0;
      return (x / 0xffffffff) * 2 - 1; // ∈ [-1, 1]
    };
    return Array.from({ length: 5 }, (_, i) => ({
      x: room.position_x + rand(i * 2) * halfW,
      z: room.position_z + rand(i * 2 + 1) * halfD,
    }));
  }, [room, profile.id]);

  // Spawn position: outside the room on whichever side is closest to the
  // origin (rough corridor direction). The figure then walks IN through
  // that side so the user sees the entry.
  const start = useMemo(() => {
    const halfD = room.depth / 2;
    const fromFront = room.position_z < 0; // south-facing rooms enter from +Z
    const dz = fromFront ? halfD + 1.2 : -halfD - 1.2;
    return { x: room.position_x, z: room.position_z + dz };
  }, [room]);

  // Mutable position/orientation kept in refs — animation drives transform.
  const pos = useRef({ x: start.x, z: start.z });
  const yaw = useRef(0);
  const targetIdx = useRef(0);
  const pauseUntil = useRef(0);
  const walkPhase = useRef(0);

  const color = useMemo(() => colorFromString(profile.id), [profile.id]);

  // Push the resident's meshes to render *after* the room volume's walls
  // and floor (which use renderOrder=2 + depthTest=false). With higher
  // renderOrder + matching depthTest=false + opacity=1, the resident draws
  // on top of the room tint instead of being blended (tinted) by it.
  // Materials are mutated rather than reset on each frame for perf.
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.renderOrder = 10;
      const mat = mesh.material as MeshStandardMaterial | undefined;
      if (!mat || Array.isArray(mat)) return;
      mat.transparent = true;
      mat.opacity = 1;
      mat.depthTest = false;
      mat.depthWrite = false;
      mat.needsUpdate = true;
    });
  }, []);

  useFrame((state, dt) => {
    const g = groupRef.current;
    if (!g) return;

    // If the resident has a current pin centroid, walk to that first; once
    // arrived, pick wander targets in sequence.
    const currentTarget = wanderTargets[targetIdx.current];
    const dx = currentTarget.x - pos.current.x;
    const dz = currentTarget.z - pos.current.z;
    const dist = Math.hypot(dx, dz);

    const t = state.clock.elapsedTime;

    if (dist > 0.05) {
      // Walking
      const step = Math.min(dist, WALK_SPEED * dt);
      pos.current.x += (dx / dist) * step;
      pos.current.z += (dz / dist) * step;
      walkPhase.current += dt * WALK_SPEED * 6;

      // Smoothly turn to face the walk direction (atan2 gives target yaw).
      const desiredYaw = Math.atan2(dx, dz);
      const dy = ((desiredYaw - yaw.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      yaw.current += Math.sign(dy) * Math.min(Math.abs(dy), TURN_RATE * dt);

      // Animate limbs: alternating swing on legs, opposite swing on arms.
      const swing = Math.sin(walkPhase.current) * 0.7;
      if (legLRef.current) legLRef.current.rotation.x = swing;
      if (legRRef.current) legRRef.current.rotation.x = -swing;
      if (armLRef.current) armLRef.current.rotation.x = -swing * 0.7;
      if (armRRef.current) armRRef.current.rotation.x = swing * 0.7;
      g.position.set(pos.current.x, Math.abs(Math.sin(walkPhase.current)) * 0.03, pos.current.z);
    } else {
      // Arrived. Idle "cleaning" until pauseUntil passes, then pick next.
      if (pauseUntil.current === 0) {
        pauseUntil.current = t + WANDER_PAUSE;
      } else if (t >= pauseUntil.current) {
        targetIdx.current = (targetIdx.current + 1) % wanderTargets.length;
        pauseUntil.current = 0;
      }
      // Gentle "reaching" sway with arms while standing still.
      const reach = Math.sin(t * 2.2) * 0.5;
      if (armLRef.current) armLRef.current.rotation.x = reach;
      if (armRRef.current) armRRef.current.rotation.x = -reach * 0.6;
      if (legLRef.current) legLRef.current.rotation.x = 0;
      if (legRRef.current) legRRef.current.rotation.x = 0;
      g.position.set(pos.current.x, 0, pos.current.z);
    }

    g.rotation.y = yaw.current;
  });

  // Body proportions — small Lego-ish figure.
  // Floor is at Y=0; legs sit from Y=0 to Y=0.32; body Y=0.32 to Y=0.70;
  // head Y=0.70 to Y=0.85. Total height ≈ 0.95 m.
  return (
    <group ref={groupRef} position={[start.x, 0, start.z]}>
      {/* Contact shadow */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.22, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} />
      </mesh>

      {/* Left leg — pivots at hip (top) so swinging looks natural */}
      <group ref={legLRef} position={[-0.06, 0.32, 0]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 0.32, 10]} />
          <meshStandardMaterial color={PANTS_COLOR} roughness={0.85} />
        </mesh>
        {/* Shoe */}
        <mesh position={[0, -0.32, 0.02]} castShadow>
          <boxGeometry args={[0.1, 0.05, 0.13]} />
          <meshStandardMaterial color="#181614" roughness={0.7} />
        </mesh>
      </group>

      {/* Right leg */}
      <group ref={legRRef} position={[0.06, 0.32, 0]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 0.32, 10]} />
          <meshStandardMaterial color={PANTS_COLOR} roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.32, 0.02]} castShadow>
          <boxGeometry args={[0.1, 0.05, 0.13]} />
          <meshStandardMaterial color="#181614" roughness={0.7} />
        </mesh>
      </group>

      {/* Torso — capsule in the resident's colour */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <capsuleGeometry args={[0.11, 0.22, 6, 12]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>

      {/* Left arm — pivots at shoulder */}
      <group ref={armLRef} position={[-0.13, 0.6, 0]}>
        <mesh position={[0, -0.13, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.26, 10]} />
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, -0.27, 0]} castShadow>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color={HEAD_SKIN} roughness={0.55} />
        </mesh>
      </group>

      {/* Right arm */}
      <group ref={armRRef} position={[0.13, 0.6, 0]}>
        <mesh position={[0, -0.13, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.26, 10]} />
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.27, 0]} castShadow>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color={HEAD_SKIN} roughness={0.55} />
        </mesh>
      </group>

      {/* Neck */}
      <mesh position={[0, 0.69, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.05, 0.04, 12]} />
        <meshStandardMaterial color={HEAD_SKIN} roughness={0.55} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.78, 0]} castShadow>
        <sphereGeometry args={[0.095, 16, 16]} />
        <meshStandardMaterial color={HEAD_SKIN} roughness={0.5} />
      </mesh>

      {/* Hair cap — slightly darker, half-sphere on top */}
      <mesh position={[0, 0.82, -0.005]} castShadow>
        <sphereGeometry args={[0.097, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color="#2a2018" roughness={0.7} />
      </mesh>

      {/* Floating name label */}
      <Html position={[0, 1.0, 0]} center zIndexRange={[20, 0]}>
        <div
          className="pointer-events-none whitespace-nowrap rounded-full border border-white/60 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide text-white shadow"
          style={{ backgroundColor: color }}
        >
          {profile.full_name}
        </div>
      </Html>
    </group>
  );
}
