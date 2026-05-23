"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Html, Edges } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  DoubleSide,
  MeshStandardMaterial,
  type Mesh,
  type MeshBasicMaterial,
} from "three";
import type { Room } from "@/lib/types";
import { useAppStore, statusColorFor } from "@/lib/store";
import { RoomFurniture } from "./Furniture";
import { TaskPins } from "./TaskPins";

const EDGE_COLOR = "#0a0a0a";
const FLOOR_COLOR = "#fafafa";
const WALL_COLOR = "#ffffff";
const WALL_THICKNESS = 0.18;

interface Props {
  room: Room;
}

export function RoomMesh({ room }: Props) {
  const [hovered, setHovered] = useState(false);
  const instances = useAppStore((s) => s.instances);
  const setHoveredRoom = useAppStore((s) => s.setHoveredRoom);
  const draggingProfileId = useAppStore((s) => s.draggingProfileId);
  const isHoveredViaDrag = useAppStore((s) => s.hoveredRoomId === room.id);
  const pinHovered = useAppStore((s) => s.hoveredInstanceId !== null);

  const statusColor = statusColorFor(room.id, instances);
  const roomInstances = instances.filter((i) => i.room_id === room.id);
  const pendingCount = roomInstances.filter((i) => i.status === "pending").length;
  const assignedCount = roomInstances.filter((i) => i.status === "assigned").length;
  const queuedCount = roomInstances.filter((i) => i.status === "queued").length;
  const isPending = pendingCount > 0;
  const isDraggable = draggingProfileId !== null;

  // Pulse the floor tint when there are pending tasks.
  const overlayRef = useRef<Mesh>(null);
  useFrame((state) => {
    if (!overlayRef.current) return;
    const mat = overlayRef.current.material as MeshBasicMaterial;
    if (isPending) {
      const t = (Math.sin(state.clock.elapsedTime * 2.4) + 1) / 2;
      mat.opacity = 0.18 + t * 0.26;
    } else {
      mat.opacity = 0.22;
    }
  });

  // While dragging, the hovered drop-target room gets a bigger highlight —
  // unless the cursor is parked on a pin, in which case the pin owns the
  // drop and the room shouldn't compete for attention.
  const dragHighlightRef = useRef<Mesh>(null);
  useFrame((state) => {
    if (!dragHighlightRef.current) return;
    const mat = dragHighlightRef.current.material as MeshBasicMaterial;
    if (isDraggable && isPending && !pinHovered) {
      const t = (Math.sin(state.clock.elapsedTime * 4) + 1) / 2;
      mat.opacity = isHoveredViaDrag ? 0.5 : 0.1 + t * 0.2;
    } else {
      mat.opacity = 0;
    }
  });

  return (
    <group
      position={[room.position_x, 0, room.position_z]}
      // userData lets the DragHover raycaster identify which room was hit
      // (it traverses up from the intersected mesh to find this group).
      userData={{ roomId: room.id }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        // While dragging, DragHover (document-level raycaster) owns the
        // hoveredRoomId. Don't fight it from here.
        if (!useAppStore.getState().draggingProfileId) {
          setHoveredRoom(room.id);
        }
      }}
      onPointerOut={() => {
        setHovered(false);
        if (
          !useAppStore.getState().draggingProfileId &&
          useAppStore.getState().hoveredRoomId === room.id
        ) {
          setHoveredRoom(null);
        }
      }}
    >
      {/* Floor */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[room.width, room.depth]} />
        <meshStandardMaterial color={hovered ? "#ffffff" : FLOOR_COLOR} />
        <Edges color={EDGE_COLOR} lineWidth={1.8} threshold={15} />
      </mesh>

      {/* Status tint overlay — pulses red when pending */}
      {statusColor && (
        <mesh ref={overlayRef} position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[room.width - 0.05, room.depth - 0.05]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.25} />
        </mesh>
      )}

      {/* Drop-target highlight (only visible while dragging a person) */}
      <mesh ref={dragHighlightRef} position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.width - 0.15, room.depth - 0.15]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0} />
      </mesh>

      {/* The corridor is an open passage — only its short end-caps get walls
          (the adjacent rooms' walls visually define the corridor's long sides). */}
      {room.type === "corridor" ? (
        <CorridorEndCaps width={room.width} depth={room.depth} height={room.height} />
      ) : (
        <Walls
          width={room.width}
          depth={room.depth}
          height={room.height}
          tint={statusColor}
          pulsing={isPending}
        />
      )}

      <RoomFurniture type={room.type} width={room.width} depth={room.depth} />

      <TaskPins roomId={room.id} />

      {/* Room label above the walls */}
      <Html
        position={[0, room.height + 0.05, 0]}
        center
        distanceFactor={14}
        zIndexRange={[5, 0]}
      >
        <div className="pointer-events-none select-none whitespace-nowrap rounded-md border border-neutral-200 bg-white/95 px-2 py-1 text-center shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-900">
            {room.name}
          </div>
          {(pendingCount > 0 || assignedCount > 0 || queuedCount > 0) && (
            <div className="mt-0.5 flex items-center justify-center gap-1 text-[9px]">
              {pendingCount > 0 && (
                <span className="rounded bg-red-100 px-1 text-red-700">
                  {pendingCount} pending
                </span>
              )}
              {assignedCount > 0 && (
                <span className="rounded bg-orange-100 px-1 text-orange-700">
                  {assignedCount} active
                </span>
              )}
              {queuedCount > 0 && (
                <span className="rounded bg-amber-100 px-1 text-amber-700">
                  {queuedCount} queued
                </span>
              )}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

function Walls({
  width,
  depth,
  height,
  tint,
  pulsing,
}: {
  width: number;
  depth: number;
  height: number;
  tint: string | null;
  pulsing: boolean;
}) {
  const t = WALL_THICKNESS;
  const material = useMemo(() => new MeshStandardMaterial({ color: WALL_COLOR }), []);
  useEffect(() => () => material.dispose(), [material]);

  // One translucent red plane stuck to each inner wall face. Mirrors the
  // floor overlay exactly — pulses when pending, holds steady at 0.22
  // otherwise — so floor and walls flash in lockstep.
  const overlayRefs = useRef<Array<Mesh | null>>([null, null, null, null]);
  useFrame((state) => {
    if (!tint) return;
    let opacity: number;
    if (pulsing) {
      const k = (Math.sin(state.clock.elapsedTime * 2.4) + 1) / 2;
      opacity = 0.18 + k * 0.26;
    } else {
      opacity = 0.22;
    }
    for (const m of overlayRefs.current) {
      if (m) (m.material as MeshBasicMaterial).opacity = opacity;
    }
  });

  // 0.005 inset stops z-fighting with the wall surface itself.
  const inset = t / 2 + 0.005;
  const padW = Math.max(0.1, width - 0.1);
  const padD = Math.max(0.1, depth - 0.1);
  const padH = Math.max(0.1, height - 0.05);

  return (
    <>
      {/* Walls — plain white */}
      <WallBox position={[0, height / 2,  depth / 2]} size={[width, height, t]} material={material} />
      <WallBox position={[0, height / 2, -depth / 2]} size={[width, height, t]} material={material} />
      <WallBox position={[ width / 2, height / 2, 0]} size={[t, height, depth]} material={material} />
      <WallBox position={[-width / 2, height / 2, 0]} size={[t, height, depth]} material={material} />

      {/* Inner-face red overlays — only mount when there's anything to flash */}
      {tint && (
        <>
          {/* North wall (z = +depth/2) — inner face */}
          <mesh
            ref={(el) => { overlayRefs.current[0] = el; }}
            position={[0, height / 2, depth / 2 - inset]}
          >
            <planeGeometry args={[padW, padH]} />
            <meshBasicMaterial color={tint} transparent opacity={0} side={DoubleSide} depthWrite={false} />
          </mesh>
          {/* South wall (z = -depth/2) */}
          <mesh
            ref={(el) => { overlayRefs.current[1] = el; }}
            position={[0, height / 2, -depth / 2 + inset]}
          >
            <planeGeometry args={[padW, padH]} />
            <meshBasicMaterial color={tint} transparent opacity={0} side={DoubleSide} depthWrite={false} />
          </mesh>
          {/* East wall (x = +width/2) */}
          <mesh
            ref={(el) => { overlayRefs.current[2] = el; }}
            position={[width / 2 - inset, height / 2, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <planeGeometry args={[padD, padH]} />
            <meshBasicMaterial color={tint} transparent opacity={0} side={DoubleSide} depthWrite={false} />
          </mesh>
          {/* West wall (x = -width/2) */}
          <mesh
            ref={(el) => { overlayRefs.current[3] = el; }}
            position={[-width / 2 + inset, height / 2, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <planeGeometry args={[padD, padH]} />
            <meshBasicMaterial color={tint} transparent opacity={0} side={DoubleSide} depthWrite={false} />
          </mesh>
        </>
      )}
    </>
  );
}

function CorridorEndCaps({
  width,
  depth,
  height,
}: {
  width: number;
  depth: number;
  height: number;
}) {
  const t = WALL_THICKNESS;
  const material = useMemo(() => new MeshStandardMaterial({ color: WALL_COLOR }), []);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <>
      <WallBox position={[ width / 2, height / 2, 0]} size={[t, height, depth]} material={material} />
      <WallBox position={[-width / 2, height / 2, 0]} size={[t, height, depth]} material={material} />
    </>
  );
}

function WallBox({
  position,
  size,
  material,
}: {
  position: [number, number, number];
  size: [number, number, number];
  material: MeshStandardMaterial;
}) {
  return (
    <mesh position={position} castShadow receiveShadow material={material}>
      <boxGeometry args={size} />
      <Edges color={EDGE_COLOR} lineWidth={1.8} threshold={15} />
    </mesh>
  );
}
