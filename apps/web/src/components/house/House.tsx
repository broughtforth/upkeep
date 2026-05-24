"use client";

import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, PerspectiveCamera, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Color, DoubleSide, MeshStandardMaterial, Shape, Vector3 } from "three";
import type { Mesh as ThreeMesh, MeshStandardMaterial as ThreeStandardMat } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { statusColorFor, useAppStore, type RoomLabel } from "@/lib/store";
import { RoomFurniture } from "./Furniture";
import { Residents } from "./Residents";
import { DragHover } from "./DragHover";
import { RoomNodes } from "./RoomNodes";

function TelosHouse() {
  const { scene } = useGLTF("/models/telos-house.glb");
  const setCursorPos = useAppStore((s) => s.setCursorPos);

  // Lighten every material on the GLB so the base shell reads paler than
  // the raw export. Each colour is lerped toward white by ~35%.
  useEffect(() => {
    const target = new Color("#ffffff");
    scene.traverse((child) => {
      const mesh = child as ThreeMesh;
      if (!mesh.isMesh) return;
      const mats: ThreeStandardMat[] = Array.isArray(mesh.material)
        ? (mesh.material as ThreeStandardMat[])
        : [mesh.material as ThreeStandardMat];
      for (const m of mats) {
        if (m && (m as { color?: Color }).color) {
          (m as { color: Color }).color.lerp(target, 0.35);
        }
      }
    });
  }, [scene]);

  return (
    <primitive
      object={scene}
      scale={4}
      // Stream cursor world-position so the HUD can show coords the user
      // can call out to me when shaping room volumes.
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        setCursorPos([e.point.x, e.point.y, e.point.z]);
      }}
      onPointerLeave={() => setCursorPos(null)}
    />
  );
}

// Default camera framing — used when no room is selected.
const DEFAULT_CAM_POS = new Vector3(22, 18, 22);
const DEFAULT_TARGET = new Vector3(0, 1, 0);

// How long the camera takes to fly to a room, in ms.
const FLY_DURATION = 900;

// Camera flight controller — adapted from the friend's TelosHouseViewer.
// On every change to `zoomedRoomId` (set by clicking a room volume or
// label), kicks off an ease-out cubic interpolation of both
// `camera.position` and `OrbitControls.target` over FLY_DURATION ms.
// Doesn't disable OrbitControls during the flight — `orbit.update()` after
// each lerp keeps the controls' internal spherical state in sync with the
// position we're setting, so when the flight finishes the user can orbit
// from the new viewpoint with no visible snap.
function CameraController() {
  const { camera, controls } = useThree();
  const zoomedRoomId = useAppStore((s) => s.zoomedRoomId);
  const roomLabels = useAppStore((s) => s.roomLabels);

  const animStartRef = useRef<number | null>(null);
  const startPosRef = useRef(new Vector3());
  const startTargetRef = useRef(new Vector3());
  const endPosRef = useRef(new Vector3());
  const endTargetRef = useRef(new Vector3());

  useEffect(() => {
    if (!controls) return;
    const orbit = controls as unknown as OrbitControlsImpl;

    startPosRef.current.copy(camera.position);
    startTargetRef.current.copy(orbit.target);

    if (zoomedRoomId) {
      const room = roomLabels.find((r) => r.id === zoomedRoomId);
      if (room) {
        const off = room.cameraOffset ?? [6, 5, 6];
        endTargetRef.current.set(room.position[0], room.position[1], room.position[2]);
        endPosRef.current.set(
          room.position[0] + off[0],
          room.position[1] + off[1],
          room.position[2] + off[2],
        );
      } else {
        endTargetRef.current.copy(DEFAULT_TARGET);
        endPosRef.current.copy(DEFAULT_CAM_POS);
      }
    } else {
      endTargetRef.current.copy(DEFAULT_TARGET);
      endPosRef.current.copy(DEFAULT_CAM_POS);
    }

    animStartRef.current = performance.now();
  }, [zoomedRoomId, controls, camera, roomLabels]);

  useFrame(() => {
    if (animStartRef.current === null || !controls) return;
    const orbit = controls as unknown as OrbitControlsImpl;
    const elapsed = performance.now() - animStartRef.current;
    const t = Math.min(elapsed / FLY_DURATION, 1);
    const eased = 1 - Math.pow(1 - t, 3);

    camera.position.lerpVectors(startPosRef.current, endPosRef.current, eased);
    orbit.target.lerpVectors(startTargetRef.current, endTargetRef.current, eased);
    orbit.update();

    if (t >= 1) {
      animStartRef.current = null;
    }
  });

  return null;
}

// Resolve a room to a flat-polygon footprint (X-Z points). If the room has
// a custom `shape` we use it; otherwise we synthesise a 4-corner rectangle
// from `position` + `size`. Extras (multi-box rooms) aren't currently used
// by any seeded room since the hallway switched to a shape polygon.
function getRoomShape(label: RoomLabel): [number, number][] {
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
}

const ROOM_FLOOR_Y = 0.16;
const ROOM_WALL_H = 1.7;

function RoomVolume({ label }: { label: RoomLabel }) {
  const instances = useAppStore((s) => s.instances);
  const setHoveredRoom = useAppStore((s) => s.setHoveredRoom);
  const hoveredRoomId = useAppStore((s) => s.hoveredRoomId);
  const draggingProfileId = useAppStore((s) => s.draggingProfileId);
  const zoomToRoom = useAppStore((s) => s.zoomToRoom);
  const zoomedRoomId = useAppStore((s) => s.zoomedRoomId);

  const status = statusColorFor(label.id, instances);
  const isHovered = hoveredRoomId === label.id;
  const isPending = status === "#ef4444";

  // Footprint polygon — used for both the floor shape and the wall edges.
  const points = useMemo(() => getRoomShape(label), [label]);

  // Floor: a 2D polygon in the room's footprint, laid horizontally at
  // ROOM_FLOOR_Y. The mesh rotation rotates the shape into the X-Z plane.
  const floorShape = useMemo(() => {
    const s = new Shape();
    s.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      s.lineTo(points[i][0], points[i][1]);
    }
    s.closePath();
    return s;
  }, [points]);

  // Walls: one vertical plane per polygon edge. We precompute midpoint,
  // length, and Y-rotation so React just instantiates a PlaneGeometry per
  // edge during render.
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

  // One shared MeshStandardMaterial for both floor and walls — colour is
  // mutated in an effect when status changes, opacity is driven by the
  // useFrame pulse below.
  const material = useMemo(() => {
    return new MeshStandardMaterial({
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
      depthTest: false,
    });
  }, []);

  // Dispose the material when this RoomVolume unmounts (zustand re-mounts
  // are rare but defensive).
  useEffect(() => () => material.dispose(), [material]);

  // Re-tint the shared material whenever status changes.
  useEffect(() => {
    const c = status ?? "#3b82f6";
    material.color.set(c);
    material.emissive.set(c);
    material.emissiveIntensity = status ? 0.25 : 0;
  }, [status, material]);

  // Pulse opacity. With no status, the volume only shows up during a drag
  // (faint blue drop-target tint); with a status, semi-translucent coloured
  // walls + floor — visible enough to read the room but light enough that
  // the GLB still shows through and residents (renderOrder=10) aren't tinted.
  useFrame((state) => {
    if (!status) {
      material.opacity = isHovered ? 0.2 : 0.1;
      return;
    }
    const base = isHovered ? 0.55 : 0.4;
    if (isPending) {
      material.opacity = base + 0.05 * Math.sin(state.clock.elapsedTime * 2.5);
    } else {
      material.opacity = base;
    }
  });

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredRoom(label.id);
  };
  const onPointerOut = () => setHoveredRoom(null);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    zoomToRoom(zoomedRoomId === label.id ? null : label.id);
  };

  // Don't render anything for rooms with no tasks unless a drag is in flight
  // (so they're still drop-targetable).
  if (!status && !draggingProfileId) return null;

  return (
    <group userData={{ roomId: label.id }}>
      {/* Floor — flat polygon laid horizontally at ROOM_FLOOR_Y */}
      <mesh
        material={material}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, ROOM_FLOOR_Y, 0]}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onClick={onClick}
        renderOrder={2}
      >
        <shapeGeometry args={[floorShape]} />
      </mesh>

      {/* Walls — one vertical plane per polygon edge, perpendicular to
          the floor, both sides visible so they read from inside or out. */}
      {walls.map((w, i) => (
        <mesh
          key={i}
          material={material}
          position={[w.midX, ROOM_FLOOR_Y + ROOM_WALL_H / 2, w.midZ]}
          rotation={[0, w.angle, 0]}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onClick={onClick}
          renderOrder={2}
        >
          <planeGeometry args={[w.length, ROOM_WALL_H]} />
        </mesh>
      ))}
    </group>
  );
}

function RoomVolumes() {
  const roomLabels = useAppStore((s) => s.roomLabels);
  return (
    <>
      {roomLabels.map((label) => (
        <RoomVolume key={label.id} label={label} />
      ))}
    </>
  );
}

// Per-room procedural furniture from the previous (now-removed) dollhouse,
// dropped at each label's centroid. Furniture is anchored to the room's
// floor (Y=0.15) and sized by the room's bounding-box width/depth.
//
// The bounding boxes come from the friend's manualRoomPositions, which are
// approximate click-targets — they can extend slightly past the GLB's real
// walls. We shrink the footprint we feed the furniture by FURNITURE_INSET
// on each side so edge-anchored pieces stay inside the GLB.
const FURNITURE_INSET = 0.3;

function RoomFurnitures() {
  const roomLabels = useAppStore((s) => s.roomLabels);
  return (
    <>
      {roomLabels.map((label) => {
        const w = Math.max(0.4, label.size[0] - 2 * FURNITURE_INSET);
        const d = Math.max(0.4, label.size[2] - 2 * FURNITURE_INSET);
        return (
          <group
            key={label.id}
            position={[label.position[0], 0.15, label.position[2]]}
          >
            <RoomFurniture type={label.type} width={w} depth={d} />
          </group>
        );
      })}
    </>
  );
}

function RoomLabelMarker({ label }: { label: RoomLabel }) {
  const editMode = useAppStore((s) => s.editMode);
  const renameRoomLabel = useAppStore((s) => s.renameRoomLabel);
  const zoomToRoom = useAppStore((s) => s.zoomToRoom);
  const zoomedRoomId = useAppStore((s) => s.zoomedRoomId);

  // When this room is the one zoomed into, the RoomNode card already shows
  // the room's name big. Hide the small label so the two don't stack on
  // top of each other.
  if (zoomedRoomId === label.id && !editMode) return null;

  return (
    <Html position={label.position} center zIndexRange={[40, 0]}>
      {editMode ? (
        <input
          autoFocus={false}
          value={label.name}
          onChange={(e) => renameRoomLabel(label.id, e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") {
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-24 rounded-md border-2 border-[var(--foreground)] bg-[var(--surface)] px-1.5 py-1 text-center text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--foreground)] shadow-sm outline-none focus:border-[var(--primary)] placeholder:text-[var(--muted)]"
          placeholder="Room name"
        />
      ) : (
        // Label itself becomes the click target — Html's wrapper otherwise
        // absorbs the pointer event before the volume mesh underneath sees
        // it, so the volume's onClick can silently fail.
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            zoomToRoom(zoomedRoomId === label.id ? null : label.id);
          }}
          className="cursor-pointer select-none whitespace-nowrap rounded-md border-2 border-[var(--foreground)] bg-[var(--surface)] px-2 py-1 text-center text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--foreground)] shadow-sm transition hover:border-[var(--primary)] hover:bg-[var(--primary-container)] hover:text-[var(--primary)]"
        >
          {label.name}
        </button>
      )}
    </Html>
  );
}

function RoomLabels() {
  const roomLabels = useAppStore((s) => s.roomLabels);
  return (
    <>
      {roomLabels.map((label) => (
        <RoomLabelMarker key={label.id} label={label} />
      ))}
    </>
  );
}

export function House() {
  const zoomToRoom = useAppStore((s) => s.zoomToRoom);
  return (
    <Canvas
      shadows
      className="!h-full !w-full"
      gl={{ antialias: true }}
      style={{ background: "#FAF9F8" }}
      // Click on empty space outside any room fires this — flies the camera
      // back to the default framing.
      onPointerMissed={() => zoomToRoom(null)}
    >
      <PerspectiveCamera makeDefault position={[22, 18, 22]} fov={40} near={0.1} far={300} />

      <Suspense fallback={null}>
        <ambientLight intensity={0.9} />
        <directionalLight
          position={[10, 18, 10]}
          intensity={0.8}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <directionalLight position={[-10, 12, -8]} intensity={0.3} />
        <hemisphereLight intensity={0.4} groundColor="#cbd5e1" color="#ffffff" />

        <TelosHouse />
        {/* Furniture intentionally not rendered — rooms start empty and we'll
            add pieces one-by-one as the user dictates each room's layout. */}
        <RoomVolumes />
        <Residents />
        <DragHover />
        <RoomLabels />
        <RoomNodes />

        <OrbitControls
          makeDefault
          enablePan
          minDistance={8}
          maxDistance={80}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 1, 0]}
        />

        <CameraController />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload("/models/telos-house.glb");
