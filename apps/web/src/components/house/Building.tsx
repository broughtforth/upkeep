"use client";

import { Fragment, useEffect, useMemo } from "react";
import { Edges, Text3D } from "@react-three/drei";
import {
  CanvasTexture,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

// A 3-storey brick building topped by a limestone frieze (which carries the
// ALBERT DOCK sign) and a platform that the open-top dollhouse sits on.

const STOREY_H = 1.6;
const NUM_STOREYS = 3;
const FRIEZE_H = 0.75;
const PLATFORM_H = 0.25;

const BUILDING_BODY_H = STOREY_H * NUM_STOREYS; // brick portion
const BUILDING_H = BUILDING_BODY_H + FRIEZE_H;  // brick + frieze
// Top of the structure that the dollhouse rests on.
export const BUILDING_TOP_Y = BUILDING_H + PLATFORM_H;

// Footprint matches the dollhouse exactly: rooms span x[-8..8] and z[-5..5.5],
// so the building is 16 × 10.5 centred at (0, 0.25).
const BUILDING_W = 16;
const BUILDING_D = 10.5;
const FOOTPRINT_OFFSET_Z = 0.25;
const WALL_T = 0.4;

const PLINTH_H = 0.5;
const PLINTH_OVERHANG = 0.5;
const PLATFORM_OVERHANG = 0.2;
const BAND_H = 0.18;
const BAND_OVERHANG = 0.14;

const FRIEZE_COLOR = "#e0d3b7";         // limestone band
const BAND_COLOR = "#3a322a";           // mortar-toned cornice
const GLASS_COLOR = "#6d8aa8";          // daytime sky-reflection
const GLASS_EMISSIVE = "#243a55";
const LIT_GLASS_COLOR = "#ffe1a6";      // warm interior light
const LIT_GLASS_EMISSIVE = "#ffaf48";
const FRAME_COLOR = "#2a2620";
const SILL_COLOR = "#c6bba6";
const PLATFORM_COLOR = "#c2b9a8";
const PLINTH_COLOR = "#3e362c";
const SIGN_METAL_COLOR = "#c8cdd3";     // brushed steel
const FALLBACK_BRICK_COLOR = "#8a4838";
const EDGE_COLOR = "#0a0a0a";

// Window geometry — shared so RealisticWindow and the layout code agree.
const WIN_W = 1.3;
const WIN_H = 1.05;
const FRAME_T = 0.09;
const FRAME_D = 0.07;
const GLASS_D = 0.05;
const MULLION_T = 0.04;
const MULLION_D = 0.05;
const SILL_W_EXTRA = 0.3;
const SILL_H = 0.09;
const SILL_D = 0.22;
const LINTEL_W_EXTRA = 0.2;
const LINTEL_H = 0.06;
const LINTEL_D = 0.16;

// Brick texture sizing — the procedural texture below contains TEX_COLS×TEX_ROWS
// bricks; per-wall repeats are tuned so a brick comes out near these world dims.
const TARGET_BRICK_W = 0.42;
const TARGET_BRICK_H = 0.18;
const TEX_COLS = 8;
const TEX_ROWS = 10;

// Sign sizing — these are measured for "ALBERT DOCK" in helvetiker_bold at
// the chosen size with letterSpacing=-0.04, used to centre the text on the
// frieze without needing drei's <Center> (which doesn't expose disableZ in
// its current type definitions).
const SIGN_SIZE = 0.42;
const SIGN_TEXT_WIDTH = 3.76; // measured from helvetiker_bold glyph metrics
const SIGN_TEXT_CAP_H = 0.29;

function makeBrickTexture(): CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Mortar fill — slightly warm grey-brown.
  ctx.fillStyle = "#3c342c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const brickW = canvas.width / TEX_COLS;
  const brickH = canvas.height / TEX_ROWS;
  const mortar = 2.5;

  for (let row = -1; row <= TEX_ROWS + 1; row++) {
    const offsetX = row % 2 === 0 ? 0 : brickW / 2;
    for (let col = -1; col <= TEX_COLS + 1; col++) {
      const x = col * brickW + offsetX + mortar / 2;
      const y = row * brickH + mortar / 2;
      // Pseudo-random per-brick tint — sine-mix for stable deterministic noise.
      const seed = row * 17.13 + col * 7.31;
      const t = (Math.sin(seed) + Math.sin(seed * 2.7)) * 0.25 + 0.5;
      const r = Math.round(140 + (t - 0.5) * 56);
      const g = Math.round(64 + (t - 0.5) * 32);
      const b = Math.round(50 + (t - 0.5) * 24);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, brickW - mortar, brickH - mortar);
      // Subtle top highlight + bottom shadow per brick.
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x, y, brickW - mortar, 1);
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(x, y + brickH - mortar - 1, brickW - mortar, 1);
    }
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function makeBrickMaterial(
  baseTex: CanvasTexture | null,
  wallW: number,
  wallH: number,
): MeshStandardMaterial {
  if (!baseTex) {
    return new MeshStandardMaterial({
      color: FALLBACK_BRICK_COLOR,
      roughness: 0.95,
    });
  }
  const tex = baseTex.clone();
  tex.needsUpdate = true;
  tex.repeat.set(
    wallW / (TARGET_BRICK_W * TEX_COLS),
    wallH / (TARGET_BRICK_H * TEX_ROWS),
  );
  return new MeshStandardMaterial({
    map: tex,
    color: "#ffffff",
    roughness: 0.95,
  });
}

// Deterministic ~30% "lit" — stable across renders, varies by storey/face/index.
function shouldLight(storey: number, faceCode: number, idx: number): boolean {
  let h = (storey * 257 + faceCode * 113 + idx * 17 + 991) >>> 0;
  h = ((h ^ (h >>> 13)) * 2654435761) >>> 0;
  h = h ^ (h >>> 16);
  return h % 100 < 30;
}

export function Building() {
  const brickTex = useMemo(makeBrickTexture, []);

  const longWallMat = useMemo(
    () => makeBrickMaterial(brickTex, BUILDING_W, BUILDING_BODY_H),
    [brickTex],
  );
  const shortWallMat = useMemo(
    () => makeBrickMaterial(brickTex, BUILDING_D, BUILDING_BODY_H),
    [brickTex],
  );

  const friezeMat = useMemo(
    () => new MeshStandardMaterial({ color: FRIEZE_COLOR, roughness: 0.85 }),
    [],
  );
  const bandMat = useMemo(
    () => new MeshStandardMaterial({ color: BAND_COLOR, roughness: 0.9 }),
    [],
  );
  const glassMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: GLASS_COLOR,
        roughness: 0.18,
        metalness: 0.55,
        emissive: GLASS_EMISSIVE,
        emissiveIntensity: 0.35,
      }),
    [],
  );
  const litGlassMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: LIT_GLASS_COLOR,
        roughness: 0.35,
        metalness: 0.15,
        emissive: LIT_GLASS_EMISSIVE,
        emissiveIntensity: 1.6,
      }),
    [],
  );
  const frameMat = useMemo(
    () => new MeshStandardMaterial({ color: FRAME_COLOR, roughness: 0.55 }),
    [],
  );
  const sillMat = useMemo(
    () => new MeshStandardMaterial({ color: SILL_COLOR, roughness: 0.8 }),
    [],
  );
  const platformMat = useMemo(
    () => new MeshStandardMaterial({ color: PLATFORM_COLOR, roughness: 0.85 }),
    [],
  );
  const plinthMat = useMemo(
    () => new MeshStandardMaterial({ color: PLINTH_COLOR, roughness: 0.95 }),
    [],
  );
  const signMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: SIGN_METAL_COLOR,
        roughness: 0.28,
        metalness: 0.92,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      brickTex?.dispose();
      longWallMat.map?.dispose();
      shortWallMat.map?.dispose();
      longWallMat.dispose();
      shortWallMat.dispose();
      friezeMat.dispose();
      bandMat.dispose();
      glassMat.dispose();
      litGlassMat.dispose();
      frameMat.dispose();
      sillMat.dispose();
      platformMat.dispose();
      plinthMat.dispose();
      signMat.dispose();
    };
  }, [
    brickTex,
    longWallMat,
    shortWallMat,
    friezeMat,
    bandMat,
    glassMat,
    litGlassMat,
    frameMat,
    sillMat,
    platformMat,
    plinthMat,
    signMat,
  ]);

  const halfW = BUILDING_W / 2;
  const halfD = BUILDING_D / 2;

  return (
    <group position={[0, 0, FOOTPRINT_OFFSET_Z]}>
      {/* Plinth */}
      <BoxMesh
        position={[0, -PLINTH_H / 2, 0]}
        size={[
          BUILDING_W + PLINTH_OVERHANG,
          PLINTH_H,
          BUILDING_D + PLINTH_OVERHANG,
        ]}
        material={plinthMat}
      />

      {/* Brick body — 3 storeys */}
      <BoxMesh
        position={[0, BUILDING_BODY_H / 2, halfD]}
        size={[BUILDING_W, BUILDING_BODY_H, WALL_T]}
        material={longWallMat}
      />
      <BoxMesh
        position={[0, BUILDING_BODY_H / 2, -halfD]}
        size={[BUILDING_W, BUILDING_BODY_H, WALL_T]}
        material={longWallMat}
      />
      <BoxMesh
        position={[halfW, BUILDING_BODY_H / 2, 0]}
        size={[WALL_T, BUILDING_BODY_H, BUILDING_D]}
        material={shortWallMat}
      />
      <BoxMesh
        position={[-halfW, BUILDING_BODY_H / 2, 0]}
        size={[WALL_T, BUILDING_BODY_H, BUILDING_D]}
        material={shortWallMat}
      />

      {/* Cornice bands between storeys 1-2 and 2-3 */}
      {Array.from({ length: NUM_STOREYS - 1 }).map((_, i) => (
        <BoxMesh
          key={`band-${i}`}
          position={[0, STOREY_H * (i + 1), 0]}
          size={[
            BUILDING_W + BAND_OVERHANG,
            BAND_H,
            BUILDING_D + BAND_OVERHANG,
          ]}
          material={bandMat}
        />
      ))}

      {/* Cornice marking top of brick body / bottom of frieze */}
      <BoxMesh
        position={[0, BUILDING_BODY_H, 0]}
        size={[
          BUILDING_W + BAND_OVERHANG,
          BAND_H,
          BUILDING_D + BAND_OVERHANG,
        ]}
        material={bandMat}
      />

      {/* Limestone frieze — wraps all 4 sides, carries the sign on +z */}
      <BoxMesh
        position={[0, BUILDING_BODY_H + FRIEZE_H / 2, halfD]}
        size={[BUILDING_W, FRIEZE_H, WALL_T]}
        material={friezeMat}
      />
      <BoxMesh
        position={[0, BUILDING_BODY_H + FRIEZE_H / 2, -halfD]}
        size={[BUILDING_W, FRIEZE_H, WALL_T]}
        material={friezeMat}
      />
      <BoxMesh
        position={[halfW, BUILDING_BODY_H + FRIEZE_H / 2, 0]}
        size={[WALL_T, FRIEZE_H, BUILDING_D]}
        material={friezeMat}
      />
      <BoxMesh
        position={[-halfW, BUILDING_BODY_H + FRIEZE_H / 2, 0]}
        size={[WALL_T, FRIEZE_H, BUILDING_D]}
        material={friezeMat}
      />

      {/* Cornice capping the frieze, below the platform */}
      <BoxMesh
        position={[0, BUILDING_H, 0]}
        size={[
          BUILDING_W + BAND_OVERHANG,
          BAND_H,
          BUILDING_D + BAND_OVERHANG,
        ]}
        material={bandMat}
      />

      {/* Windows on each storey, each face */}
      {Array.from({ length: NUM_STOREYS }).map((_, s) => (
        <StoreyWindows
          key={`win-${s}`}
          storey={s}
          cy={s * STOREY_H + STOREY_H / 2}
          halfW={halfW}
          halfD={halfD}
          glassMat={glassMat}
          litGlassMat={litGlassMat}
          frameMat={frameMat}
          sillMat={sillMat}
        />
      ))}

      {/* ALBERT DOCK — brushed metal letters on the frieze's +z face.
          TextGeometry positions text from baseline at (0,0,0) extending +X
          and +Y, so we offset to centre on the wall. SIGN_TEXT_WIDTH is
          measured for "ALBERT DOCK" in helvetiker_bold at size 0.42. */}
      <group
        position={[
          -SIGN_TEXT_WIDTH / 2,
          BUILDING_BODY_H + FRIEZE_H / 2 - SIGN_TEXT_CAP_H / 2,
          halfD + WALL_T / 2 + 0.005,
        ]}
      >
        <Text3D
          font="/fonts/helvetiker_bold.typeface.json"
          size={SIGN_SIZE}
          height={0.08}
          bevelEnabled
          bevelThickness={0.012}
          bevelSize={0.012}
          bevelSegments={3}
          curveSegments={6}
          letterSpacing={-0.04}
          castShadow
        >
          ALBERT DOCK
          <primitive object={signMat} attach="material" />
        </Text3D>
      </group>

      {/* Platform — the dollhouse model rests here */}
      <BoxMesh
        position={[0, BUILDING_H + PLATFORM_H / 2, 0]}
        size={[
          BUILDING_W + PLATFORM_OVERHANG,
          PLATFORM_H,
          BUILDING_D + PLATFORM_OVERHANG,
        ]}
        material={platformMat}
      />
    </group>
  );
}

function StoreyWindows({
  storey,
  cy,
  halfW,
  halfD,
  glassMat,
  litGlassMat,
  frameMat,
  sillMat,
}: {
  storey: number;
  cy: number;
  halfW: number;
  halfD: number;
  glassMat: MeshStandardMaterial;
  litGlassMat: MeshStandardMaterial;
  frameMat: MeshStandardMaterial;
  sillMat: MeshStandardMaterial;
}) {
  const NX = 4;
  const NZ = 3;
  const wallOuterZ = halfD + WALL_T / 2;
  const wallOuterX = halfW + WALL_T / 2;

  const stepX = (halfW * 2) / (NX + 1);
  const stepZ = (halfD * 2) / (NZ + 1);
  const xs = Array.from({ length: NX }, (_, i) => -halfW + stepX * (i + 1));
  const zs = Array.from({ length: NZ }, (_, i) => -halfD + stepZ * (i + 1));

  const pickGlass = (faceCode: number, idx: number) =>
    shouldLight(storey, faceCode, idx) ? litGlassMat : glassMat;

  return (
    <>
      {xs.map((x, i) => (
        <Fragment key={`x-${i}`}>
          <group position={[x, cy, wallOuterZ]}>
            <RealisticWindow
              glassMat={pickGlass(0, i)}
              frameMat={frameMat}
              sillMat={sillMat}
            />
          </group>
          <group position={[x, cy, -wallOuterZ]} rotation={[0, Math.PI, 0]}>
            <RealisticWindow
              glassMat={pickGlass(1, i)}
              frameMat={frameMat}
              sillMat={sillMat}
            />
          </group>
        </Fragment>
      ))}
      {zs.map((z, i) => (
        <Fragment key={`z-${i}`}>
          <group position={[wallOuterX, cy, z]} rotation={[0, Math.PI / 2, 0]}>
            <RealisticWindow
              glassMat={pickGlass(2, i)}
              frameMat={frameMat}
              sillMat={sillMat}
            />
          </group>
          <group position={[-wallOuterX, cy, z]} rotation={[0, -Math.PI / 2, 0]}>
            <RealisticWindow
              glassMat={pickGlass(3, i)}
              frameMat={frameMat}
              sillMat={sillMat}
            />
          </group>
        </Fragment>
      ))}
    </>
  );
}

// One window unit, built facing +z. Composed of:
//   - sill ledge (light stone) below
//   - frame trim (dark) around the glass, protruding from the wall
//   - cross mullions splitting the pane into 4 lights
//   - glass pane recessed behind the frame (lit or unlit material)
//   - small lintel ledge above
function RealisticWindow({
  glassMat,
  frameMat,
  sillMat,
}: {
  glassMat: MeshStandardMaterial;
  frameMat: MeshStandardMaterial;
  sillMat: MeshStandardMaterial;
}) {
  const frameW = WIN_W + FRAME_T * 2;
  const frameH = WIN_H + FRAME_T * 2;
  const glassZ = -GLASS_D / 2 - 0.005;
  const mullionZ = FRAME_D - MULLION_D / 2;

  return (
    <>
      <mesh
        position={[
          0,
          -(WIN_H / 2 + FRAME_T + SILL_H / 2 - 0.005),
          FRAME_D / 2,
        ]}
        material={sillMat}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[frameW + SILL_W_EXTRA, SILL_H, SILL_D]} />
      </mesh>

      <mesh
        position={[
          0,
          WIN_H / 2 + FRAME_T + LINTEL_H / 2 - 0.005,
          FRAME_D / 2,
        ]}
        material={sillMat}
        castShadow
      >
        <boxGeometry args={[frameW + LINTEL_W_EXTRA, LINTEL_H, LINTEL_D]} />
      </mesh>

      <mesh position={[0, 0, FRAME_D / 2]} material={frameMat} castShadow>
        <boxGeometry args={[frameW, frameH, FRAME_D]} />
      </mesh>

      <mesh position={[0, 0, glassZ]} material={glassMat}>
        <boxGeometry args={[WIN_W, WIN_H, GLASS_D]} />
      </mesh>

      <mesh position={[0, 0, mullionZ]} material={frameMat} castShadow>
        <boxGeometry args={[MULLION_T, WIN_H, MULLION_D]} />
      </mesh>

      <mesh position={[0, 0, mullionZ]} material={frameMat} castShadow>
        <boxGeometry args={[WIN_W, MULLION_T, MULLION_D]} />
      </mesh>
    </>
  );
}

function BoxMesh({
  position,
  size,
  material,
}: {
  position: [number, number, number];
  size: [number, number, number];
  material: MeshStandardMaterial;
}) {
  return (
    <mesh position={position} material={material} castShadow receiveShadow>
      <boxGeometry args={size} />
      <Edges color={EDGE_COLOR} lineWidth={1.4} threshold={15} />
    </mesh>
  );
}
