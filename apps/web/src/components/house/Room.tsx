"use client";

import { useState } from "react";
import { Html } from "@react-three/drei";
import { useDroppable } from "@dnd-kit/core";

import type {
  Room as RoomType,
  TaskInstanceWithDetails,
} from "@upkeep/shared";

type Props = {
  room: RoomType;
  position: [number, number, number];
  instances: TaskInstanceWithDetails[];
  isHighlighted: boolean;
};

// Pick the most "interesting" status to colour the room by:
//   any pending -> red, any in_progress -> orange, all complete -> green.
// No instances -> neutral.
function statusColor(instances: TaskInstanceWithDetails[]): string {
  if (instances.length === 0) return "#3a3a44";
  if (instances.some((i) => i.status === "pending")) return "#d9534f";
  if (instances.some((i) => i.status === "in_progress")) return "#e68a2e";
  return "#34a853";
}

export function Room({ room, position, instances, isHighlighted }: Props) {
  const [hovered, setHovered] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: room.id });

  const baseColor = statusColor(instances);
  const lifted = hovered || isOver || isHighlighted ? 0.3 : 0;

  return (
    <group position={[position[0], position[1] + lifted, position[2]]}>
      {/* The visible cube. */}
      <mesh
        castShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[2, 1, 2]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={isOver ? "#ffffff" : "#000000"}
          emissiveIntensity={isOver ? 0.25 : 0}
        />
      </mesh>

      {/* DOM hit zone for dnd-kit. Sized to roughly cover the cube's 2D
          projection at typical camera angle. Pointer events are picked up
          by dnd-kit; everything else passes through to r3f. */}
      <Html
        center
        position={[0, 0, 0]}
        // Keep the hit zone in the DOM layer so dnd-kit's listeners fire.
        // wrapperClass keeps it from intercepting orbit-controls panning.
        wrapperClass="pointer-events-auto"
      >
        <div
          ref={setNodeRef}
          className={`flex h-16 w-32 cursor-grab items-center justify-center rounded-md px-2 text-center text-[11px] font-semibold leading-tight text-white transition ${
            isOver ? "bg-white/15 ring-2 ring-white" : "bg-transparent"
          }`}
          style={{ transform: "translate(-50%, -50%)" }}
        >
          <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            {room.name}
            <br />
            <span className="text-[10px] font-normal text-white/80">
              {instances.length === 0
                ? "no tasks"
                : `${instances.length} task${instances.length === 1 ? "" : "s"}`}
            </span>
          </span>
        </div>
      </Html>
    </group>
  );
}
