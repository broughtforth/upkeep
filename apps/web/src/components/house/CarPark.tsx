"use client";

import { useEffect, useMemo } from "react";
import { Edges } from "@react-three/drei";
import { MeshStandardMaterial } from "three";

// Car park slab sits on the ground in front of the building (+z side),
// outside the plinth. Three cars are parked nose-in, each in its own
// addressable group node (userData.carId).

const PARK_W = 12;
const PARK_D = 4.6;
const PARK_OFFSET_Z = 8.4; // world-z centre of the lot
const SLAB_H = 0.06;

const TARMAC_COLOR = "#34343a";
const LINE_COLOR = "#ece6cf";
const KERB_COLOR = "#7d7a72";

const EDGE_COLOR = "#0a0a0a";

interface CarSpec {
  id: string;
  body: string;
  trim: string;
}

const CARS: CarSpec[] = [
  { id: "car-1", body: "#b03326", trim: "#7a1f15" }, // red
  { id: "car-2", body: "#235e8c", trim: "#143a59" }, // blue
  { id: "car-3", body: "#c6cad0", trim: "#7a7e82" }, // silver
];

export function CarPark() {
  const tarmacMat = useMemo(
    () => new MeshStandardMaterial({ color: TARMAC_COLOR, roughness: 0.95 }),
    [],
  );
  const lineMat = useMemo(
    () => new MeshStandardMaterial({ color: LINE_COLOR, roughness: 0.85 }),
    [],
  );
  const kerbMat = useMemo(
    () => new MeshStandardMaterial({ color: KERB_COLOR, roughness: 0.9 }),
    [],
  );

  useEffect(() => {
    return () => {
      tarmacMat.dispose();
      lineMat.dispose();
      kerbMat.dispose();
    };
  }, [tarmacMat, lineMat, kerbMat]);

  // Four parking-line dividers at x = -PARK_W/2 + n*spaceWidth, for n=0..3.
  // We draw stripes at the front 80% of the bay so the back kerb is clear.
  const numSpaces = 3;
  const spaceW = (PARK_W - 0.4) / numSpaces; // leave 0.2 margin each side
  const stripeXs = Array.from({ length: numSpaces + 1 }, (_, i) =>
    -PARK_W / 2 + 0.2 + i * spaceW,
  );
  const stripeLength = PARK_D * 0.8;
  const stripeWidth = 0.08;

  // Car positions: centred in each parking space.
  const carXs = Array.from({ length: numSpaces }, (_, i) =>
    -PARK_W / 2 + 0.2 + spaceW * (i + 0.5),
  );

  return (
    <group position={[0, 0, PARK_OFFSET_Z]}>
      {/* Tarmac slab */}
      <mesh position={[0, SLAB_H / 2, 0]} material={tarmacMat} receiveShadow>
        <boxGeometry args={[PARK_W, SLAB_H, PARK_D]} />
        <Edges color={EDGE_COLOR} lineWidth={1.4} threshold={15} />
      </mesh>

      {/* White parking-bay stripes (just above the slab to avoid z-fighting) */}
      {stripeXs.map((x, i) => (
        <mesh
          key={`stripe-${i}`}
          position={[x, SLAB_H + 0.005, -PARK_D / 2 + stripeLength / 2 + 0.2]}
          material={lineMat}
        >
          <boxGeometry args={[stripeWidth, 0.01, stripeLength]} />
        </mesh>
      ))}

      {/* Back kerb — runs along the rear of the lot (toward the building) */}
      <mesh
        position={[0, 0.08, -PARK_D / 2 + 0.1]}
        material={kerbMat}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[PARK_W, 0.16, 0.18]} />
        <Edges color={EDGE_COLOR} lineWidth={1.2} threshold={15} />
      </mesh>

      {/* Three cars — each a self-contained node */}
      {CARS.map((spec, i) => (
        <Car
          key={spec.id}
          id={spec.id}
          // Sit on top of the tarmac slab.
          position={[carXs[i], SLAB_H, 0.2]}
          bodyColor={spec.body}
          trimColor={spec.trim}
        />
      ))}
    </group>
  );
}

// One car. Nose points toward -z (toward the building) so they're parked
// nose-in. Wrapped in a group with userData.carId so it's identifiable
// when the scene graph is traversed (mirrors how rooms expose roomId).
function Car({
  id,
  position,
  bodyColor,
  trimColor,
}: {
  id: string;
  position: [number, number, number];
  bodyColor: string;
  trimColor: string;
}) {
  const bodyMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.42,
        metalness: 0.35,
      }),
    [bodyColor],
  );
  const trimMat = useMemo(
    () => new MeshStandardMaterial({ color: trimColor, roughness: 0.6 }),
    [trimColor],
  );
  const glassMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#1c2433",
        roughness: 0.2,
        metalness: 0.6,
        emissive: "#0b1428",
        emissiveIntensity: 0.4,
      }),
    [],
  );
  const tyreMat = useMemo(
    () => new MeshStandardMaterial({ color: "#161616", roughness: 0.9 }),
    [],
  );
  const hubMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#9aa0a6",
        roughness: 0.3,
        metalness: 0.85,
      }),
    [],
  );
  const headlightMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#fff6cc",
        emissive: "#ffe28a",
        emissiveIntensity: 1.4,
        roughness: 0.3,
      }),
    [],
  );
  const taillightMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#5a0808",
        emissive: "#c81f1f",
        emissiveIntensity: 0.6,
        roughness: 0.4,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      bodyMat.dispose();
      trimMat.dispose();
      glassMat.dispose();
      tyreMat.dispose();
      hubMat.dispose();
      headlightMat.dispose();
      taillightMat.dispose();
    };
  }, [bodyMat, trimMat, glassMat, tyreMat, hubMat, headlightMat, taillightMat]);

  // Dimensions
  const W = 0.95;   // width (along x)
  const L = 2.0;    // length (along z) — nose at -z
  const lowerH = 0.42;
  const cabinH = 0.42;
  const wheelR = 0.22;
  const wheelW = 0.16;

  return (
    <group position={position} userData={{ carId: id }}>
      {/* Lower body — sits above the wheels */}
      <mesh position={[0, wheelR + lowerH / 2 - 0.04, 0]} material={bodyMat} castShadow receiveShadow>
        <boxGeometry args={[W, lowerH, L]} />
        <Edges color={EDGE_COLOR} lineWidth={1.2} threshold={20} />
      </mesh>

      {/* Cabin — slightly narrower, positioned slightly rearward */}
      <mesh
        position={[0, wheelR + lowerH + cabinH / 2 - 0.04, 0.15]}
        material={bodyMat}
        castShadow
      >
        <boxGeometry args={[W - 0.06, cabinH, L * 0.55]} />
        <Edges color={EDGE_COLOR} lineWidth={1.2} threshold={20} />
      </mesh>

      {/* Windshield — slopes are skipped for the toy-car style; just dark panels */}
      <mesh
        position={[0, wheelR + lowerH + cabinH / 2 - 0.04, -0.15]}
        material={glassMat}
      >
        <boxGeometry args={[W - 0.1, cabinH - 0.08, 0.04]} />
      </mesh>

      {/* Rear window */}
      <mesh
        position={[0, wheelR + lowerH + cabinH / 2 - 0.04, 0.15 + (L * 0.55) / 2 + 0.005]}
        material={glassMat}
      >
        <boxGeometry args={[W - 0.1, cabinH - 0.08, 0.04]} />
      </mesh>

      {/* Side windows — left and right of cabin */}
      <mesh
        position={[
          W / 2 - 0.025,
          wheelR + lowerH + cabinH / 2 - 0.04,
          0.15,
        ]}
        material={glassMat}
      >
        <boxGeometry args={[0.04, cabinH - 0.12, L * 0.5]} />
      </mesh>
      <mesh
        position={[
          -W / 2 + 0.025,
          wheelR + lowerH + cabinH / 2 - 0.04,
          0.15,
        ]}
        material={glassMat}
      >
        <boxGeometry args={[0.04, cabinH - 0.12, L * 0.5]} />
      </mesh>

      {/* Headlights — pair on the front face */}
      <mesh position={[-W / 2 + 0.22, wheelR + lowerH / 2 - 0.04, -L / 2 - 0.005]} material={headlightMat}>
        <boxGeometry args={[0.18, 0.1, 0.04]} />
      </mesh>
      <mesh position={[W / 2 - 0.22, wheelR + lowerH / 2 - 0.04, -L / 2 - 0.005]} material={headlightMat}>
        <boxGeometry args={[0.18, 0.1, 0.04]} />
      </mesh>

      {/* Tail lights */}
      <mesh position={[-W / 2 + 0.22, wheelR + lowerH / 2 - 0.04, L / 2 + 0.005]} material={taillightMat}>
        <boxGeometry args={[0.2, 0.1, 0.04]} />
      </mesh>
      <mesh position={[W / 2 - 0.22, wheelR + lowerH / 2 - 0.04, L / 2 + 0.005]} material={taillightMat}>
        <boxGeometry args={[0.2, 0.1, 0.04]} />
      </mesh>

      {/* Bumper trim — front and rear */}
      <mesh
        position={[0, wheelR + lowerH * 0.3, -L / 2 - 0.02]}
        material={trimMat}
        castShadow
      >
        <boxGeometry args={[W - 0.06, 0.1, 0.06]} />
      </mesh>
      <mesh
        position={[0, wheelR + lowerH * 0.3, L / 2 + 0.02]}
        material={trimMat}
        castShadow
      >
        <boxGeometry args={[W - 0.06, 0.1, 0.06]} />
      </mesh>

      {/* Four wheels */}
      {[
        [W / 2, wheelR, -L / 2 + 0.5],
        [-W / 2, wheelR, -L / 2 + 0.5],
        [W / 2, wheelR, L / 2 - 0.5],
        [-W / 2, wheelR, L / 2 - 0.5],
      ].map(([x, y, z], i) => (
        <Wheel
          key={i}
          position={[x, y, z]}
          radius={wheelR}
          width={wheelW}
          tyreMat={tyreMat}
          hubMat={hubMat}
        />
      ))}
    </group>
  );
}

function Wheel({
  position,
  radius,
  width,
  tyreMat,
  hubMat,
}: {
  position: [number, number, number];
  radius: number;
  width: number;
  tyreMat: MeshStandardMaterial;
  hubMat: MeshStandardMaterial;
}) {
  // Wheel lies on its side (axis along x), so we rotate the cylinder 90°
  // around z so its long axis aligns with x.
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]} material={tyreMat} castShadow>
        <cylinderGeometry args={[radius, radius, width, 18]} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} material={hubMat}>
        <cylinderGeometry args={[radius * 0.45, radius * 0.45, width + 0.005, 12]} />
      </mesh>
    </group>
  );
}
