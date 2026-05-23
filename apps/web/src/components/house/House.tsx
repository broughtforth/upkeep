"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";

import type {
  Room as RoomType,
  TaskInstanceWithDetails,
} from "@upkeep/shared";
import { Room } from "./Room";

type Props = {
  rooms: RoomType[];
  instancesByRoom: Map<string | null, TaskInstanceWithDetails[]>;
  highlightedRoomId: string | null;
  assigning: boolean;
};

// Lay rooms out in a grid for v1. Once we have a real GLB, the layout
// is replaced by the model's actual mesh positions.
function gridPosition(index: number): [number, number, number] {
  const cols = 4;
  const spacing = 2.6;
  const x = (index % cols) * spacing - ((cols - 1) * spacing) / 2;
  const z = Math.floor(index / cols) * spacing - spacing;
  return [x, 0.5, z];
}

export function House({
  rooms,
  instancesByRoom,
  highlightedRoomId,
  assigning,
}: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900">
      <Canvas
        camera={{ position: [0, 6, 8], fov: 45 }}
        // Important: dnd-kit listens to pointer events on DOM. The Canvas's
        // own r3f pointer handlers don't bubble, so per-room hit zones are
        // rendered with drei's <Html> overlay (see Room.tsx).
        shadows
      >
        <color attach="background" args={["#0d0c14"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />

        {/* Floor */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#1a1923" />
        </mesh>

        <Suspense fallback={null}>
          {rooms.map((room, i) => (
            <Room
              key={room.id}
              room={room}
              position={gridPosition(i)}
              instances={instancesByRoom.get(room.id) ?? []}
              isHighlighted={highlightedRoomId === room.id}
            />
          ))}
        </Suspense>

        <OrbitControls
          enablePan={false}
          minDistance={4}
          maxDistance={20}
          maxPolarAngle={Math.PI / 2.1}
        />

        {/* Tiny HUD: shows "Assigning…" while the server action is in flight. */}
        {assigning && (
          <Html fullscreen pointerEvents="none">
            <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-blue-600/90 px-3 py-1 text-xs font-semibold text-white">
              Assigning…
            </div>
          </Html>
        )}
      </Canvas>
    </div>
  );
}
