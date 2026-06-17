'use client';

// ─── Engram — Aldenmoor in 3D ─────────────────────────────────────────────────
// A low-poly, night-time render of the village built with @react-three/fiber +
// @react-three/drei. This is *only* the visual layer: it receives the player's
// memories, which NPC is active, and a select callback — all game/memory/dialogue
// logic still lives in client-page.tsx. The 2D dialogue box overlays this Canvas.

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Sky, Html, ContactShadows, Text, PointerLockControls, OrthographicCamera, KeyboardControls, useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { NPC_LIST } from '@/lib/npcs';
import type { NPCName, NPCMemory } from '@/lib/types';
import {
  getHeightAt,
  COLLIDERS,
  COTTAGES,
  TREES,
  CAMPFIRE,
  WORLD_RADIUS,
  GROUND_RADIUS,
  type TreeDef,
  type CottageDef,
} from './map';
import { getTexture, getTextureVariant, hasTexture } from './textures';
import { useWorld, chopTree, isChopped } from '@/lib/world';

// A tree carries its global index (into TREES) so chopping can target it.
type TreeInst = TreeDef & { idx: number };

// Shared player ground position + facing, so the first-person camera and the
// aerial avatar stay in sync when you switch views.
type PlayerPos = { x: number; z: number; heading: number };
type PlayerPosRef = React.MutableRefObject<PlayerPos>;
type ViewMode = 'fp' | 'aerial';

// How many texture-variant groups the forest is split into (cycles through the
// PNGs registered per slot, so the woods don't look uniform).
const TREE_BUCKETS = 4;

// Where each villager stands (XZ). They live in the flat clearing, so ground
// height is ~0; we still anchor their Y to the terrain for safety.
const NPC_POS: Record<NPCName, [number, number, number]> = {
  aldric: [-3.4, 0, 0.4],
  maren: [0, 0, -0.3],
  sable: [3.4, 0, 0.4],
};

export const dynamicNpcState: Record<NPCName, { x: number; z: number; targetX: number; targetZ: number; timer: number; speed: number; hp: number; maxHp: number; knockedOut: boolean; reviveTimer: number; attackTimer: number }> = {
  aldric: { x: NPC_POS.aldric[0], z: NPC_POS.aldric[2], targetX: NPC_POS.aldric[0], targetZ: NPC_POS.aldric[2], timer: 0, speed: 0.8, hp: 100, maxHp: 100, knockedOut: false, reviveTimer: 0, attackTimer: 0 },
  maren: { x: NPC_POS.maren[0], z: NPC_POS.maren[2], targetX: NPC_POS.maren[0], targetZ: NPC_POS.maren[2], timer: 0, speed: 1.2, hp: 150, maxHp: 150, knockedOut: false, reviveTimer: 0, attackTimer: 0 },
  sable: { x: NPC_POS.sable[0], z: NPC_POS.sable[2], targetX: NPC_POS.sable[0], targetZ: NPC_POS.sable[2], timer: 0, speed: 0.7, hp: 100, maxHp: 100, knockedOut: false, reviveTimer: 0, attackTimer: 0 },
};

export const dynamicEnemyState: Record<string, { x: number; z: number; speed: number; dead: boolean; hp: number; maxHp: number; attackTimer: number }> = {};

export const dynamicPlayerState = { x: 0, z: 0, hp: 100, maxHp: 100, dead: false, attackTimer: 0 };

// ─── First-person walking constants ───────────────────────────────────────────
const EYE_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.45;
const WALK_SPEED = 4.6;
const TALK_RANGE = 3.2; // how close you must stand before "Press E" appears
const CHOP_RANGE = 2.8; // how close to a tree before "Press F to chop"
const SPAWN_XZ: [number, number] = [0, 9]; // y is sampled from the terrain

const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
];

// Slide the player out of the boundary and any prop/NPC they overlap.
function resolveCollision(x: number, z: number): [number, number] {
  const d = Math.hypot(x, z);
  if (d > WORLD_RADIUS) {
    x = (x / d) * WORLD_RADIUS;
    z = (z / d) * WORLD_RADIUS;
  }
  const obstacles = [
    ...COLLIDERS,
    ...(Object.values(dynamicNpcState)).map((state) => ({ x: state.x, z: state.z, r: 0.6 })),
    ...(Object.values(dynamicEnemyState)).filter((s) => !s.dead).map((s) => ({ x: s.x, z: s.z, r: 0.5 })),
  ];
  for (const c of obstacles) {
    const dx = x - c.x;
    const dz = z - c.z;
    const dist = Math.hypot(dx, dz);
    const min = c.r + PLAYER_RADIUS;
    if (dist < min && dist > 1e-4) {
      const push = min - dist;
      x += (dx / dist) * push;
      z += (dz / dist) * push;
    }
  }
  return [x, z];
}

function trustColor(t: number) {
  if (t >= 70) return '#5fb86a';
  if (t >= 40) return '#d6b84a';
  return '#cc5a4a';
}

// ─── Camera rig ───────────────────────────────────────────────────────────────
// Smoothly eases the camera toward whichever NPC is active; returns to an
// overview shot when none is selected.

function CameraRig({ active }: { active: NPCName | null }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 1.2, 0));
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpLook = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    if (active) {
      // Dolly in: sit almost in front of this NPC and frame their face — a real
      // zoom toward them, not just a lateral pan.
      const { x, z } = dynamicNpcState[active];
      tmpPos.set(x * 0.9, 1.7, z + 2.6);
      tmpLook.set(x, 1.4, z);
    } else {
      tmpPos.set(0, 3.1, 9);
      tmpLook.set(0, 1.1, 0);
    }
    // Frame-rate independent smoothing.
    const k = 1 - Math.pow(0.0015, dt);
    camera.position.lerp(tmpPos, k);
    look.current.lerp(tmpLook, k);
    camera.lookAt(look.current);
  });

  return null;
}

// ─── First-person player ──────────────────────────────────────────────────────
// Walks the camera around Aldenmoor (WASD / arrows) using the yaw that
// PointerLockControls feeds in via the mouse. Resolves collisions, adds a subtle
// head-bob, and reports which villager (if any) is within talking range.

function Player({
  enabled,
  posRef,
  onNearbyChange,
  onNearbyTreeChange,
  onNearbyEnemyChange,
}: {
  enabled: boolean;
  posRef: PlayerPosRef;
  onNearbyChange: (npc: NPCName | null) => void;
  onNearbyTreeChange?: (treeIdx: number | null) => void;
  onNearbyEnemyChange?: (enemyId: string | null) => void;
}) {
  const { camera } = useThree();
  const [, getKeys] = useKeyboardControls();
  const bob = useRef({ t: 0, off: 0 });
  const nearbyRef = useRef<NPCName | null>(null);
  const treeRef = useRef<number | null>(null);
  const nearbyEnemyRef = useRef<string | null>(null);
  const didLook = useRef(false);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const move = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  // Sync the camera to the shared player position whenever first-person control
  // (re)engages — so leaving a dialogue, or returning from the aerial view,
  // resumes where the player actually is rather than teleporting to spawn.
  useEffect(() => {
    if (!enabled) return;
    const { x, z } = posRef.current;
    camera.position.set(x, getHeightAt(x, z) + EYE_HEIGHT, z);
    if (!didLook.current) {
      camera.lookAt(0, 1.2, 0);
      didLook.current = true;
    }
  }, [enabled, camera, posRef]);

  useFrame((_, dtRaw) => {
    if (!enabled) return;
    const dt = Math.min(dtRaw, 0.05);
    const k = getKeys();

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, up).normalize();

    move.set(0, 0, 0);
    if (k.forward) move.add(forward);
    if (k.backward) move.sub(forward);
    if (k.left) move.sub(right);
    if (k.right) move.add(right);
    const moving = move.lengthSq() > 0;

    if (moving) {
      move.normalize().multiplyScalar(WALK_SPEED * dt);
      const [nx, nz] = resolveCollision(camera.position.x + move.x, camera.position.z + move.z);
      camera.position.x = nx;
      camera.position.z = nz;
      bob.current.t += dt * 10.5;
      bob.current.off = Math.sin(bob.current.t) * 0.045;
    } else {
      bob.current.off += (0 - bob.current.off) * Math.min(1, dt * 10);
    }
    // Follow the terrain: ground height under the feet + eye height + head-bob.
    camera.position.y = getHeightAt(camera.position.x, camera.position.z) + EYE_HEIGHT + bob.current.off;

    // Publish position + facing so the aerial avatar can pick up where we are.
    posRef.current.x = camera.position.x;
    posRef.current.z = camera.position.z;
    posRef.current.heading = Math.atan2(forward.x, forward.z);
    
    // Publish to dynamic state for Enemy targeting
    dynamicPlayerState.x = camera.position.x;
    dynamicPlayerState.z = camera.position.z;

    // Nearest villager within talking range.
    let best: NPCName | null = null;
    let bestD = Infinity;
    for (const npc of NPC_LIST) {
      const dyn = dynamicNpcState[npc.id];
      if (dyn.knockedOut) continue;
      const dd = Math.hypot(camera.position.x - dyn.x, camera.position.z - dyn.z);
      if (dd < TALK_RANGE && dd < bestD) {
        bestD = dd;
        best = npc.id;
      }
    }
    if (best !== nearbyRef.current) {
      nearbyRef.current = best;
      onNearbyChange(best);
    }

    // Nearest choppable (non-chopped) tree within reach.
    let bestTree = -1;
    let bestTd = Infinity;
    for (let i = 0; i < TREES.length; i++) {
      if (isChopped(i)) continue;
      const t = TREES[i];
      const dd = Math.hypot(camera.position.x - t.x, camera.position.z - t.z);
      if (dd < CHOP_RANGE && dd < bestTd) {
        bestTd = dd;
        bestTree = i;
      }
    }
    const treeIdx = bestTree >= 0 ? bestTree : null;
    if (treeIdx !== treeRef.current) {
      treeRef.current = treeIdx;
      onNearbyTreeChange?.(treeIdx);
    }
    
    // Nearest enemy within attack range.
    let bestEnemy: string | null = null;
    let bestEd = Infinity;
    for (const [id, enemy] of Object.entries(dynamicEnemyState)) {
      if (enemy.dead) continue;
      const dd = Math.hypot(camera.position.x - enemy.x, camera.position.z - enemy.z);
      if (dd < 4.0 && dd < bestEd) {
        bestEd = dd;
        bestEnemy = id;
      }
    }
    if (onNearbyEnemyChange && bestEnemy !== nearbyEnemyRef.current) {
      nearbyEnemyRef.current = bestEnemy;
      onNearbyEnemyChange(bestEnemy);
    }
  });

  return null;
}

// While a dialogue is open in first-person, keep the player rooted but gently
// turn the camera to face whoever they're talking to.
function TalkFraming({ active }: { active: NPCName | null }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 1.2, 0));
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    if (!active) return;
    const { x, z } = dynamicNpcState[active];
    target.set(x, 1.5, z);
    const k = 1 - Math.pow(0.0025, Math.min(dt, 0.05));
    look.current.lerp(target, k);
    camera.lookAt(look.current);
  });

  return null;
}

// ─── Aerial (top-down RTS) view ───────────────────────────────────────────────
// A third-person avatar driven by WASD in WORLD directions, with an orthographic
// camera following from above. Shares the player position with the FP camera.

function Avatar({ posRef }: { posRef: PlayerPosRef }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!g.current) return;
    const { x, z, heading } = posRef.current;
    g.current.position.set(x, getHeightAt(x, z), z);
    g.current.rotation.y = heading;
  });
  return (
    <group ref={g}>
      <mesh castShadow position={[0, 0.85, 0]}>
        <capsuleGeometry args={[0.32, 0.7, 4, 10]} />
        <meshStandardMaterial color="#c98b3a" flatShading />
      </mesh>
      <mesh castShadow position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.26, 12, 12]} />
        <meshStandardMaterial color="#e8c4a0" flatShading />
      </mesh>
      {/* nose marker so facing is readable from above */}
      <mesh position={[0, 1.5, 0.24]}>
        <boxGeometry args={[0.08, 0.08, 0.12]} />
        <meshStandardMaterial color="#7a5a2a" flatShading />
      </mesh>
    </group>
  );
}

function AerialRig({ enabled, posRef }: { enabled: boolean; posRef: PlayerPosRef }) {
  const camRef = useRef<THREE.OrthographicCamera>(null);
  const [, getKeys] = useKeyboardControls();
  const zoom = useRef(22);

  // Mouse-wheel zoom while in aerial view (min raised so you can't zoom out past
  // the world into the sky).
  useEffect(() => {
    if (!enabled) return;
    const onWheel = (e: WheelEvent) => {
      zoom.current = THREE.MathUtils.clamp(zoom.current - e.deltaY * 0.02, 14, 50);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [enabled]);

  useFrame((_, dtRaw) => {
    const cam = camRef.current;
    if (!enabled || !cam) return;
    const dt = Math.min(dtRaw, 0.05);
    const k = getKeys();

    // MAP-aligned movement: the camera sits due south looking north, so world
    // axes line up with the screen — W=up(north −Z), S=down(+Z), A=left(−X), D=right(+X).
    let dx = 0;
    let dz = 0;
    if (k.forward) dz -= 1;
    if (k.backward) dz += 1;
    if (k.left) dx -= 1;
    if (k.right) dx += 1;
    if (dx || dz) {
      const len = Math.hypot(dx, dz);
      dx /= len;
      dz /= len;
      const [rx, rz] = resolveCollision(posRef.current.x + dx * WALK_SPEED * dt, posRef.current.z + dz * WALK_SPEED * dt);
      posRef.current.x = rx;
      posRef.current.z = rz;
      posRef.current.heading = Math.atan2(dx, dz); // face the move direction
    }

    // Overhead follow from due south (no X offset → screen axes match world axes).
    // Tilted ~43° from horizontal (not straight down) for a 3/4 "diagonal" view.
    const { x, z } = posRef.current;
    cam.zoom = zoom.current;
    cam.position.set(x, 28, z + 30);
    cam.up.set(0, 1, 0);
    cam.lookAt(x, getHeightAt(x, z), z);
    cam.updateProjectionMatrix();
  });

  return <OrthographicCamera ref={camRef} makeDefault near={0.1} far={400} position={[0, 28, 30]} />;
}

// ─── Scenery ──────────────────────────────────────────────────────────────────

// A soft round radial texture (sprites, glows, smoke). `core` is the centre
// colour; it fades to transparent at the rim.
function makeRadialTexture(core: string, mid = 'rgba(255,255,255,0)') {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, core);
  g.addColorStop(0.5, mid);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// ── Terrain ──
// A single displaced plane whose vertices read their height from getHeightAt,
// so the visible ground and the walked-on ground are literally the same surface.
function Terrain() {
  const geom = useMemo(() => {
    const size = GROUND_RADIUS * 2;
    const seg = 200; // keep hill detail across the much larger terrain
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, getHeightAt(pos.getX(i), pos.getZ(i)));
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geom} receiveShadow>
      <meshStandardMaterial color="#3e4a32" map={getTexture('terrain_grass', { repeat: Math.round(GROUND_RADIUS / 3) })} roughness={1} />
    </mesh>
  );
}

// ── Moon ── emissive disc + an additive halo sprite.
function Moon() {
  const halo = useMemo(() => makeRadialTexture('rgba(255,247,224,0.9)', 'rgba(255,240,200,0.25)'), []);
  return (
    <group position={[20, 24, -46]}>
      <mesh>
        <sphereGeometry args={[3, 24, 24]} />
        <meshBasicMaterial color="#fff7e0" />
      </mesh>
      <sprite scale={[22, 22, 1]}>
        <spriteMaterial map={halo} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.7} />
      </sprite>
    </group>
  );
}

// ── Chimney smoke ── a few slow grey puffs rising from a cottage chimney.
function ChimneySmoke({ origin }: { origin: [number, number, number] }) {
  const ref = useRef<THREE.Points>(null);
  const count = 10;
  const tex = useMemo(() => makeRadialTexture('rgba(190,185,176,0.7)', 'rgba(170,165,156,0.25)'), []);
  const parts = useMemo(
    () => Array.from({ length: count }, () => ({ y: Math.random() * 1.4, speed: 0.12 + Math.random() * 0.1, seed: Math.random() * 10 })),
    []
  );
  const positions = useMemo(() => new Float32Array(count * 3), []);
  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05);
    for (let i = 0; i < count; i++) {
      const p = parts[i];
      p.y += p.speed * dtc;
      if (p.y > 1.4) p.y = 0;
      positions[i * 3] = Math.sin(p.y * 3 + p.seed) * 0.12;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = Math.cos(p.y * 2 + p.seed) * 0.1;
    }
    if (ref.current) ref.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref} position={origin}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial map={tex} size={0.55} sizeAttenuation transparent opacity={0.32} depthWrite={false} />
    </points>
  );
}

// ── Cottage ── bigger, gabled, with corner beams, a framed door, glowing
// windows and a smoking chimney. Anchored to the terrain height at its spot.
function Cottage({ def, seed }: { def: CottageDef; seed: number }) {
  const y = getHeightAt(def.x, def.z);
  return (
    <group position={[def.x, y, def.z]} rotation={[0, def.rot, 0]} scale={def.scale}>
      {/* stone plinth */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.7, 0.2, 2.3]} />
        <meshStandardMaterial color="#5b5048" map={getTextureVariant('stone', seed)} flatShading />
      </mesh>
      {/* body */}
      <mesh position={[0, 1.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 1.8, 2.0]} />
        <meshStandardMaterial color={def.body} map={getTextureVariant('cottage_wood', seed)} flatShading />
      </mesh>
      {/* corner beams */}
      {([[-1.2, -1.0], [1.2, -1.0], [-1.2, 1.0], [1.2, 1.0]] as [number, number][]).map(([x, z], i) => (
        <mesh key={i} position={[x, 1.05, z]} castShadow>
          <boxGeometry args={[0.16, 1.85, 0.16]} />
          <meshStandardMaterial color="#4a3424" flatShading />
        </mesh>
      ))}
      {/* gable roof — two slopes meeting at a ridge running along X */}
      <mesh position={[0, 2.2, -0.66]} rotation={[0.62, 0, 0]} castShadow>
        <boxGeometry args={[2.8, 0.14, 1.6]} />
        <meshStandardMaterial color={def.roof} map={getTextureVariant('cottage_roof', seed)} flatShading />
      </mesh>
      <mesh position={[0, 2.2, 0.66]} rotation={[-0.62, 0, 0]} castShadow>
        <boxGeometry args={[2.8, 0.14, 1.6]} />
        <meshStandardMaterial color={def.roof} map={getTextureVariant('cottage_roof', seed)} flatShading />
      </mesh>
      <mesh position={[0, 2.62, 0]}>
        <boxGeometry args={[2.9, 0.12, 0.12]} />
        <meshStandardMaterial color="#3a2a1a" flatShading />
      </mesh>
      {/* door + frame */}
      <mesh position={[0, 0.7, 1.04]}>
        <boxGeometry args={[0.74, 1.44, 0.04]} />
        <meshStandardMaterial color="#2a1a10" flatShading />
      </mesh>
      <mesh position={[0, 0.7, 1.06]}>
        <boxGeometry args={[0.6, 1.3, 0.04]} />
        <meshStandardMaterial color="#5a3a1f" flatShading />
      </mesh>
      {/* windows: dark frame + warm glow */}
      {[-0.78, 0.78].map((x, i) => (
        <group key={i} position={[x, 1.2, 1.01]}>
          <mesh>
            <boxGeometry args={[0.5, 0.5, 0.05]} />
            <meshStandardMaterial color="#2a1a10" flatShading />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <planeGeometry args={[0.36, 0.36]} />
            <meshBasicMaterial color="#ffcf7a" />
          </mesh>
        </group>
      ))}
      {/* chimney + smoke */}
      <mesh position={[0.8, 2.55, -0.25]} castShadow>
        <boxGeometry args={[0.34, 1.1, 0.34]} />
        <meshStandardMaterial color="#5a4a40" map={getTextureVariant('stone', seed)} flatShading />
      </mesh>
      <ChimneySmoke origin={[0.8, 3.15, -0.25]} />
    </group>
  );
}

// ── Forest ── 2–3 species, each drawn as a handful of InstancedMeshes (one per
// part) so a hundred-plus trees cost only a few draw calls. Every instance is
// anchored to the terrain and pushed into the shared collider set via map.ts.
function TreePart({
  items,
  geometry,
  material,
  localY,
  chopped,
}: {
  items: TreeInst[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  localY: number;
  chopped: ReadonlySet<number>;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    items.forEach((t, i) => {
      // A chopped tree collapses to zero scale (invisible) but keeps its slot.
      if (chopped.has(t.idx)) {
        dummy.position.set(t.x, -1000, t.z);
        dummy.scale.setScalar(0);
      } else {
        dummy.position.set(t.x, getHeightAt(t.x, t.z) + localY * t.scale, t.z);
        dummy.scale.setScalar(t.scale);
      }
      dummy.rotation.set(0, t.rot, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, localY, chopped]);
  if (items.length === 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow />;
}

function InstancedTrees() {
  // Carry each tree's global index so chopping can target individual trees.
  const withIdx = useMemo<TreeInst[]>(() => TREES.map((t, idx) => ({ ...t, idx })), []);

  // Re-render instance matrices when the chopped set changes.
  const world = useWorld();
  const chopped = useMemo(() => new Set(world.choppedTrees), [world.choppedTrees]);

  const geo = useMemo(
    () => ({
      trunk: new THREE.CylinderGeometry(0.16, 0.24, 1.4, 6),
      pineA: new THREE.ConeGeometry(0.95, 1.7, 7),
      pineB: new THREE.ConeGeometry(0.72, 1.4, 7),
      pineC: new THREE.ConeGeometry(0.46, 1.1, 7),
      broadTrunk: new THREE.CylinderGeometry(0.2, 0.28, 1.6, 6),
      leaf: new THREE.IcosahedronGeometry(1.0, 0),
      leafS: new THREE.IcosahedronGeometry(0.72, 0),
      bush: new THREE.IcosahedronGeometry(0.72, 0),
    }),
    []
  );

  // Spread trees across TREE_BUCKETS texture variants so the forest isn't
  // uniform. Each bucket gets bark + foliage from a different registered PNG
  // (getTextureVariant cycles through whatever the artist added; null = flat).
  const buckets = useMemo(
    () =>
      Array.from({ length: TREE_BUCKETS }, (_, b) => ({
        bark: new THREE.MeshStandardMaterial({ color: '#5a3f28', map: getTextureVariant('bark', b, { repeat: 1 }), flatShading: !hasTexture('bark'), roughness: 1 }),
        pine: new THREE.MeshStandardMaterial({ color: '#2f4a2c', map: getTextureVariant('foliage_pine', b), flatShading: !hasTexture('foliage_pine'), roughness: 1 }),
        broad: new THREE.MeshStandardMaterial({ color: '#3b5a30', map: getTextureVariant('foliage_broadleaf', b), flatShading: !hasTexture('foliage_broadleaf'), roughness: 1 }),
        bushLeaf: new THREE.MeshStandardMaterial({ color: '#45683a', map: getTextureVariant('foliage_bush', b), flatShading: !hasTexture('foliage_bush'), roughness: 1 }),
      })),
    []
  );

  // Partition each species' trees into buckets by their global index.
  const groups = useMemo(() => {
    const empty = () => Array.from({ length: TREE_BUCKETS }, () => [] as TreeInst[]);
    const pine = empty();
    const broad = empty();
    const bush = empty();
    for (const t of withIdx) {
      const b = t.idx % TREE_BUCKETS;
      (t.species === 0 ? pine : t.species === 1 ? broad : bush)[b].push(t);
    }
    return { pine, broad, bush };
  }, [withIdx]);

  return (
    <group>
      {Array.from({ length: TREE_BUCKETS }, (_, b) => (
        <group key={b}>
          {/* pines: trunk + three stacked cones */}
          <TreePart items={groups.pine[b]} geometry={geo.trunk} material={buckets[b].bark} localY={0.7} chopped={chopped} />
          <TreePart items={groups.pine[b]} geometry={geo.pineA} material={buckets[b].pine} localY={1.9} chopped={chopped} />
          <TreePart items={groups.pine[b]} geometry={geo.pineB} material={buckets[b].pine} localY={2.8} chopped={chopped} />
          <TreePart items={groups.pine[b]} geometry={geo.pineC} material={buckets[b].pine} localY={3.6} chopped={chopped} />
          {/* broadleaf: taller trunk + two foliage clumps */}
          <TreePart items={groups.broad[b]} geometry={geo.broadTrunk} material={buckets[b].bark} localY={0.8} chopped={chopped} />
          <TreePart items={groups.broad[b]} geometry={geo.leaf} material={buckets[b].broad} localY={2.3} chopped={chopped} />
          <TreePart items={groups.broad[b]} geometry={geo.leafS} material={buckets[b].broad} localY={3.0} chopped={chopped} />
          {/* bushes: a single low clump */}
          <TreePart items={groups.bush[b]} geometry={geo.bush} material={buckets[b].bushLeaf} localY={0.55} chopped={chopped} />
        </group>
      ))}
    </group>
  );
}

// A soft round sprite so the embers read as flames rather than squares.
function makeSpriteTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,210,120,0.95)');
  g.addColorStop(0.7, 'rgba(255,120,40,0.5)');
  g.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function FireParticles({ count = 60 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);
  const texture = useMemo(makeSpriteTexture, []);

  // Per-particle motion state.
  const particles = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 0.28,
        z: (Math.random() - 0.5) * 0.28,
        y: Math.random() * 1.1,
        speed: 0.6 + Math.random() * 0.9,
        drift: (Math.random() - 0.5) * 0.4,
      })),
    [count]
  );

  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  const colors = useMemo(() => new Float32Array(count * 3), [count]);

  useFrame((_, dt) => {
    const dtc = Math.min(dt, 0.05);
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      p.y += p.speed * dtc;
      if (p.y > 1.1) {
        p.y = 0;
        p.x = (Math.random() - 0.5) * 0.28;
        p.z = (Math.random() - 0.5) * 0.28;
        p.speed = 0.6 + Math.random() * 0.9;
      }
      const life = p.y / 1.1; // 0 at base, 1 at top
      const taper = 1 - life * 0.7; // flames narrow as they rise
      positions[i * 3] = p.x * taper + p.drift * life * 0.3;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z * taper;
      // Yellow-white at the base → deep red/transparent as it rises.
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 0.85 - life * 0.65;
      colors[i * 3 + 2] = 0.4 - life * 0.4;
    }
    if (points.current) {
      points.current.geometry.attributes.position.needsUpdate = true;
      points.current.geometry.attributes.color.needsUpdate = true;
    }
  });

  return (
    <points ref={points} position={[0, 0.18, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={0.4}
        sizeAttenuation
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Campfire() {
  const light = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    if (light.current) {
      // Flicker.
      light.current.intensity = 2.2 + Math.sin(state.clock.elapsedTime * 12) * 0.4 + Math.random() * 0.15;
    }
  });
  return (
    <group position={[CAMPFIRE.x, getHeightAt(CAMPFIRE.x, CAMPFIRE.z), CAMPFIRE.z]}>
      <pointLight ref={light} color="#ff9a3c" intensity={2.2} distance={9} position={[0, 0.6, 0]} />
      <FireParticles />
      <mesh position={[0, 0.18, 0]}>
        <coneGeometry args={[0.22, 0.5, 8]} />
        <meshBasicMaterial color="#ffb347" />
      </mesh>
      {/* Log ring. */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos((i / 4) * Math.PI * 2) * 0.35, 0.05, Math.sin((i / 4) * Math.PI * 2) * 0.35]} rotation={[0, (i / 4) * Math.PI * 2, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.5, 6]} />
          <meshStandardMaterial color="#3a2a1a" flatShading />
        </mesh>
      ))}
    </group>
  );
}

// ─── Enemy characters ─────────────────────────────────────────────────────────

function EnemyBody() {
  return (
    <group>
      {/* Abstract dark spiky figure */}
      <mesh castShadow position={[0, 0.7, 0]}>
        <coneGeometry args={[0.5, 1.4, 6]} />
        <meshStandardMaterial color="#1a0f1c" flatShading roughness={0.8} />
      </mesh>
      {/* Shoulders / Spikes */}
      <mesh castShadow position={[-0.3, 1.0, 0]} rotation={[0, 0, 0.5]}>
        <coneGeometry args={[0.15, 0.6, 4]} />
        <meshStandardMaterial color="#2d1a30" flatShading />
      </mesh>
      <mesh castShadow position={[0.3, 1.0, 0]} rotation={[0, 0, -0.5]}>
        <coneGeometry args={[0.15, 0.6, 4]} />
        <meshStandardMaterial color="#2d1a30" flatShading />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshStandardMaterial color="#1a0f1c" flatShading />
      </mesh>
      {/* Glowing red eyes */}
      <mesh position={[-0.08, 1.65, 0.22]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#ff2a2a" />
      </mesh>
      <mesh position={[0.08, 1.65, 0.22]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#ff2a2a" />
      </mesh>
    </group>
  );
}

function Enemy({ id }: { id: string }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state, dtRaw) => {
    if (!group.current) return;
    const dt = Math.min(dtRaw, 0.05);
    const t = state.clock.elapsedTime;
    const dyn = dynamicEnemyState[id];
    
    if (!dyn || dyn.dead) return;

    // Find closest alive NPC
    let closestNpcId: NPCName | null = null;
    let closestDist = Infinity;
    for (const [id, npcState] of Object.entries(dynamicNpcState)) {
      if (npcState.knockedOut) continue;
      const d = Math.hypot(npcState.x - dyn.x, npcState.z - dyn.z);
      if (d < closestDist) {
        closestDist = d;
        closestNpcId = id as NPCName;
      }
    }
    
    // Check distance to player
    if (!dynamicPlayerState.dead) {
      const pDist = Math.hypot(dynamicPlayerState.x - dyn.x, dynamicPlayerState.z - dyn.z);
      if (pDist < closestDist) {
        closestDist = pDist;
        closestNpcId = 'player' as any;
      }
    }

    let targetX = 0;
    let targetZ = 0;
    let isMoving = false;

    if (closestNpcId && closestDist < 12) {
      // Chase target
      if (closestNpcId === ('player' as any)) {
        targetX = dynamicPlayerState.x;
        targetZ = dynamicPlayerState.z;
        if (closestDist < 1.4) {
          dyn.attackTimer -= dt;
          if (dyn.attackTimer <= 0) {
            dynamicPlayerState.hp -= 15; // Enemy DPS
            dyn.attackTimer = 1.0;
            if (dynamicPlayerState.hp <= 0) {
              dynamicPlayerState.dead = true;
            }
          }
        } else {
          isMoving = true;
        }
      } else {
        const npcState = dynamicNpcState[closestNpcId];
        targetX = npcState.x;
        targetZ = npcState.z;
        if (closestDist < 1.4) {
          dyn.attackTimer -= dt;
          if (dyn.attackTimer <= 0) {
            npcState.hp -= 15; // Enemy DPS
            dyn.attackTimer = 1.0;
            if (npcState.hp <= 0) {
              npcState.knockedOut = true;
              npcState.reviveTimer = 20; // 20s to revive
            }
          }
        } else {
          isMoving = true;
        }
      }
    } else {
      // No NPC nearby or all dead, move towards campfire (0,0)
      const distToCenter = Math.hypot(0 - dyn.x, 0 - dyn.z);
      if (distToCenter > 1.8) {
        targetX = 0;
        targetZ = 0;
        isMoving = true;
      }
    }

    const dx = targetX - dyn.x;
    const dz = targetZ - dyn.z;
    
    if (isMoving) {
      const step = dyn.speed * dt;
      const moveRatio = step / Math.hypot(dx, dz);
      dyn.x += dx * moveRatio;
      dyn.z += dz * moveRatio;
    }

    const phase = dyn.x * 2.1;
    const speed = isMoving ? 5 : 2;
    const amp = isMoving ? 0.15 : 0.08;

    group.current.position.set(
      dyn.x,
      getHeightAt(dyn.x, dyn.z) + Math.abs(Math.sin(t * speed + phase)) * amp,
      dyn.z
    );

    if (isMoving) {
      group.current.rotation.y = Math.atan2(dx, dz) + Math.sin(t * 2.5 + phase) * 0.1;
    } else {
      group.current.rotation.y = Math.atan2(dx, dz) + Math.sin(t * 1.2 + phase) * 0.05;
    }
    group.current.rotation.z = Math.sin(t * 1.8 + phase) * 0.06;
  });

  const dyn = dynamicEnemyState[id];
  if (!dyn || dyn.dead) return null;

  return (
    <group ref={group} position={[dyn.x, 0, dyn.z]}>
      <EnemyBody />
    </group>
  );
}

function EnemySpawner() {
  const [enemyIds, setEnemyIds] = useState<string[]>([]);

  useEffect(() => {
    // Spawn 1 enemy every 5 seconds, up to 15 max
    const interval = setInterval(() => {
      setEnemyIds((prev) => {
        const alive = prev.filter(id => !dynamicEnemyState[id]?.dead);
        if (alive.length >= 15) return prev;

        const id = Math.random().toString(36).substring(7);
        const angle = Math.random() * Math.PI * 2;
        const radius = WORLD_RADIUS + 2; // Spawn just outside

        dynamicEnemyState[id] = {
          x: Math.cos(angle) * radius,
          z: Math.sin(angle) * radius,
          speed: 1.5 + Math.random() * 1.0,
          dead: false,
          hp: 50,
          maxHp: 50,
          attackTimer: 0,
        };

        return [...alive, id];
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <group>
      {enemyIds.map((id) => (
        <Enemy key={id} id={id} />
      ))}
    </group>
  );
}

function Village() {
  return (
    <group>
      <Terrain />
      <Moon />
      {COTTAGES.map((c, i) => (
        <Cottage key={i} def={c} seed={i} />
      ))}
      <InstancedTrees />
      <Campfire />
    </group>
  );
}

// ─── Floating 3D title (shown before a wallet connects) ───────────────────────

function FloatingTitle() {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.position.y = 3.6 + Math.sin(t * 0.8) * 0.18;
    group.current.rotation.y = Math.sin(t * 0.4) * 0.12;
  });
  return (
    <group ref={group} position={[0, 3.6, -1]}>
      <Text
        fontSize={1.5}
        letterSpacing={0.18}
        color="#e7c14e"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#5a4310"
      >
        ENGRAM
        <meshStandardMaterial attach="material" color="#e7c14e" emissive="#d6a72a" emissiveIntensity={0.55} metalness={0.3} roughness={0.4} />
      </Text>
      <Text position={[0, -1, 0]} fontSize={0.32} color="#f4e8d0" anchorX="center" anchorY="middle" fillOpacity={0.85}>
        The village of Aldenmoor remembers you.
      </Text>
    </group>
  );
}

// ─── NPC characters ───────────────────────────────────────────────────────────

function CharacterBody({ npc, accent }: { npc: NPCName; accent: string }) {
  const skin = '#e8c4a0';

  if (npc === 'maren') {
    // Guard captain: plated torso, pauldrons, gauntleted arms, plumed helm, spear.
    return (
      <group>
        <mesh castShadow position={[0, 0.7, 0]}>
          <capsuleGeometry args={[0.42, 0.8, 4, 12]} />
          <meshStandardMaterial color="#4a5a6a" flatShading metalness={0.45} roughness={0.55} />
        </mesh>
        {/* chest plate */}
        <mesh position={[0, 0.95, 0.32]}>
          <boxGeometry args={[0.56, 0.5, 0.16]} />
          <meshStandardMaterial color="#5a6b7c" flatShading metalness={0.5} roughness={0.45} />
        </mesh>
        {/* pauldrons + arms */}
        {([-1, 1] as const).map((s) => (
          <group key={s}>
            <mesh castShadow position={[s * 0.5, 1.12, 0]}>
              <sphereGeometry args={[0.2, 12, 12]} />
              <meshStandardMaterial color={accent} flatShading metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh castShadow position={[s * 0.5, 0.7, 0.05]} rotation={[0, 0, s * 0.18]}>
              <capsuleGeometry args={[0.13, 0.6, 4, 8]} />
              <meshStandardMaterial color="#41505f" flatShading metalness={0.4} roughness={0.6} />
            </mesh>
          </group>
        ))}
        {/* head + helmet + plume */}
        <mesh castShadow position={[0, 1.55, 0]}>
          <sphereGeometry args={[0.3, 12, 12]} />
          <meshStandardMaterial color={skin} flatShading />
        </mesh>
        <mesh castShadow position={[0, 1.66, 0]}>
          <sphereGeometry args={[0.34, 12, 12, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
          <meshStandardMaterial color={accent} flatShading metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.94, -0.04]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.08, 0.34, 0.12]} />
          <meshStandardMaterial color="#b6433a" flatShading />
        </mesh>
        {/* spear, gripped to the right */}
        <mesh position={[0.5, 1.0, 0.12]}>
          <cylinderGeometry args={[0.04, 0.04, 2.4, 6]} />
          <meshStandardMaterial color="#6a4a2a" flatShading />
        </mesh>
        <mesh position={[0.5, 2.25, 0.12]}>
          <coneGeometry args={[0.09, 0.3, 6]} />
          <meshStandardMaterial color="#cdd3da" flatShading metalness={0.6} />
        </mesh>
      </group>
    );
  }

  if (npc === 'sable') {
    // Broker: slender hooded robe, sleeve-crossed arms, a satchel, glinting eyes.
    return (
      <group>
        <mesh castShadow position={[0, 0.7, 0]}>
          <coneGeometry args={[0.55, 1.5, 10]} />
          <meshStandardMaterial color="#2a1d40" flatShading />
        </mesh>
        {/* crossed sleeves */}
        {([-1, 1] as const).map((s) => (
          <mesh key={s} castShadow position={[s * 0.16, 0.78, 0.34]} rotation={[1.1, 0, -s * 0.5]}>
            <capsuleGeometry args={[0.11, 0.42, 4, 8]} />
            <meshStandardMaterial color="#231836" flatShading />
          </mesh>
        ))}
        {/* satchel */}
        <mesh castShadow position={[0.34, 0.6, 0.18]} rotation={[0, 0, 0.2]}>
          <boxGeometry args={[0.26, 0.24, 0.14]} />
          <meshStandardMaterial color={accent} flatShading roughness={0.7} />
        </mesh>
        {/* head + hood */}
        <mesh castShadow position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.27, 12, 12]} />
          <meshStandardMaterial color={skin} flatShading />
        </mesh>
        <mesh castShadow position={[0, 1.62, -0.02]}>
          <coneGeometry args={[0.4, 0.7, 10]} />
          <meshStandardMaterial color={accent} flatShading />
        </mesh>
        <mesh position={[-0.1, 1.5, 0.24]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#b98bff" />
        </mesh>
        <mesh position={[0.1, 1.5, 0.24]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#b98bff" />
        </mesh>
      </group>
    );
  }

  // Aldric — merchant: round, robed, gold trim, short arms, a floating coin.
  return (
    <group>
      <mesh castShadow position={[0, 0.65, 0]}>
        <capsuleGeometry args={[0.48, 0.6, 4, 12]} />
        <meshStandardMaterial color="#7a5a2a" flatShading />
      </mesh>
      {/* belt / trim */}
      <mesh position={[0, 0.6, 0]}>
        <torusGeometry args={[0.49, 0.06, 8, 20]} />
        <meshStandardMaterial color={accent} flatShading metalness={0.5} roughness={0.4} />
      </mesh>
      {/* coin pouch */}
      <mesh castShadow position={[0.3, 0.5, 0.34]}>
        <sphereGeometry args={[0.13, 10, 10]} />
        <meshStandardMaterial color="#5a3f1f" flatShading />
      </mesh>
      {/* short arms */}
      {([-1, 1] as const).map((s) => (
        <mesh key={s} castShadow position={[s * 0.52, 0.62, 0.1]} rotation={[0, 0, s * 0.32]}>
          <capsuleGeometry args={[0.13, 0.34, 4, 8]} />
          <meshStandardMaterial color="#6a4d24" flatShading />
        </mesh>
      ))}
      {/* head + cap */}
      <mesh castShadow position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial color={skin} flatShading />
      </mesh>
      <mesh castShadow position={[0, 1.72, 0]}>
        <cylinderGeometry args={[0.26, 0.3, 0.18, 10]} />
        <meshStandardMaterial color="#8a3a2a" flatShading />
      </mesh>
      {/* floating gold coin over the open hand */}
      <mesh position={[0.62, 1.05, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.03, 16]} />
        <meshStandardMaterial color={accent} flatShading metalness={0.7} roughness={0.3} emissive={accent} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

function Character({
  npc,
  name,
  role,
  accent,
  memory,
  active,
  dim,
  talking,
  interactive,
  onSelect,
}: {
  npc: NPCName;
  name: string;
  role: string;
  accent: string;
  memory: NPCMemory | null;
  active: boolean;
  dim: boolean;
  talking: boolean;
  interactive: boolean;
  onSelect: (npc: NPCName) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const htmlRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const tmpScale = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, dtRaw) => {
    if (!group.current) return;
    const dt = Math.min(dtRaw, 0.05); // cap delta
    const t = state.clock.elapsedTime;
    const dyn = dynamicNpcState[npc];
    
    if (htmlRef.current) {
      htmlRef.current.style.visibility = dyn.knockedOut ? 'hidden' : 'visible';
    }

    // Knockout logic
    if (dyn.knockedOut) {
      dyn.reviveTimer -= dt;
      if (dyn.reviveTimer <= 0) {
        dyn.knockedOut = false;
        dyn.hp = dyn.maxHp;
        group.current.rotation.x = 0; // stand up
      } else {
        // Lying down
        group.current.rotation.x = Math.PI / 2;
        group.current.position.set(dyn.x, getHeightAt(dyn.x, dyn.z) + 0.3, dyn.z);
        // Dim knocked out characters
        const targetScale = 1;
        tmpScale.set(targetScale, targetScale, targetScale);
        group.current.scale.lerp(tmpScale, 0.12);
        return; // skip movement and swaying
      }
    }

    let isMoving = false;
    let targetRotY = group.current.rotation.y;
    let combatEngaged = false;
    
    // Maren Guard AI
    if (npc === 'maren' && !active) {
      let closestEnemyId: string | null = null;
      let closestDist = Infinity;
      for (const [id, enemy] of Object.entries(dynamicEnemyState)) {
        if (enemy.dead) continue;
        const d = Math.hypot(enemy.x - dyn.x, enemy.z - dyn.z);
        if (d < closestDist) {
          closestDist = d;
          closestEnemyId = id;
        }
      }

      if (closestEnemyId && closestDist < 15) {
        combatEngaged = true;
        const enemy = dynamicEnemyState[closestEnemyId];
        dyn.targetX = enemy.x;
        dyn.targetZ = enemy.z;
        
        const dx = dyn.targetX - dyn.x;
        const dz = dyn.targetZ - dyn.z;

        if (closestDist < 1.4) {
          // Attack
          isMoving = false;
          targetRotY = Math.atan2(dx, dz);
          dyn.attackTimer -= dt;
          if (dyn.attackTimer <= 0) {
            enemy.hp -= 25; // Guard DPS
            dyn.attackTimer = 1.0;
            if (enemy.hp <= 0) enemy.dead = true;
          }
        } else {
          isMoving = true;
          const step = dyn.speed * 1.5 * dt; // run faster when in combat
          const moveRatio = step / closestDist;
          dyn.x += dx * moveRatio;
          dyn.z += dz * moveRatio;
          targetRotY = Math.atan2(dx, dz);
        }
      }
    }
    
    // Only wander if not active (talking to someone) and not in combat
    if (!active && !combatEngaged) {
      // For non-Maren NPCs, flee if an enemy is nearby
      if (npc !== 'maren') {
        let closestEnemyDist = Infinity;
        let closestEnemy: any = null;
        for (const [id, enemy] of Object.entries(dynamicEnemyState)) {
          if (enemy.dead) continue;
          const d = Math.hypot(enemy.x - dyn.x, enemy.z - dyn.z);
          if (d < closestEnemyDist) {
            closestEnemyDist = d;
            closestEnemy = enemy;
          }
        }
        
        if (closestEnemy && closestEnemyDist < 10) {
          const dx = dyn.x - closestEnemy.x;
          const dz = dyn.z - closestEnemy.z;
          const angle = Math.atan2(dx, dz);
          dyn.targetX = dyn.x + Math.sin(angle) * 5;
          dyn.targetZ = dyn.z + Math.cos(angle) * 5;
          
          const distToCenter = Math.hypot(dyn.targetX, dyn.targetZ);
          if (distToCenter > WORLD_RADIUS) {
            dyn.targetX = (dyn.targetX / distToCenter) * WORLD_RADIUS;
            dyn.targetZ = (dyn.targetZ / distToCenter) * WORLD_RADIUS;
          }
          dyn.speed = 2.5; // sprint away
          dyn.timer = 0; // force move
        } else {
          dyn.speed = 0.8; // back to normal
        }
      }

      const dx = dyn.targetX - dyn.x;
      const dz = dyn.targetZ - dyn.z;
      const dist = Math.hypot(dx, dz);
      
      if (dist > 0.05) {
        isMoving = true;
        const step = dyn.speed * dt;
        const moveRatio = Math.min(1, step / dist);
        dyn.x += dx * moveRatio;
        dyn.z += dz * moveRatio;
        targetRotY = Math.atan2(dx, dz);
        dyn.timer = 0;
      } else {
        dyn.timer -= dt;
        if (dyn.timer <= 0) {
          const spawn = NPC_POS[npc];
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 3.5;
          
          let nx = spawn[0] + Math.cos(angle) * radius;
          let nz = spawn[2] + Math.sin(angle) * radius;
          
          const d = Math.hypot(nx, nz);
          if (d > WORLD_RADIUS) {
            nx = (nx / d) * WORLD_RADIUS;
            nz = (nz / d) * WORLD_RADIUS;
          }
          dyn.targetX = nx;
          dyn.targetZ = nz;
          
          dyn.timer = 2 + Math.random() * 4;
        }
      }
    }

    const phase = dyn.x * 1.7; // stagger each villager
    const speed = talking ? 6 : (isMoving ? 4.5 : 2.4);
    const amp = talking ? 0.16 : (isMoving ? 0.14 : 0.11);
    
    // Update dynamic position and grounded Y
    group.current.position.set(
      dyn.x,
      getHeightAt(dyn.x, dyn.z) + Math.abs(Math.sin(t * speed + phase)) * amp,
      dyn.z
    );
    
    if (isMoving) {
      // Snap rotation to target direction and add extra walking sway
      group.current.rotation.y = targetRotY + Math.sin(t * 2 + phase) * 0.08;
    } else {
      // Gentle side-to-side sway when idle
      group.current.rotation.y = Math.sin(t * 0.9 + phase) * 0.16;
    }
    group.current.rotation.z = Math.sin(t * 1.5 + phase) * 0.05;
    
    const targetScale = active ? 1.14 : hovered ? 1.07 : 1;
    tmpScale.set(targetScale, targetScale, targetScale);
    group.current.scale.lerp(tmpScale, 0.12);
  });

  const canClick = interactive && !dim && !active;
  // Initialize with current dynamic state so they don't pop from NPC_POS on first frame
  const initialPos = [dynamicNpcState[npc].x, 0, dynamicNpcState[npc].z] as [number, number, number];

  return (
    <group ref={group} position={initialPos}>
      {/* Invisible hit target — generous, so the whole figure is clickable. */}
      <mesh
        position={[0, 1, 0]}
        visible={false}
        onPointerOver={(e) => {
          if (!canClick || dynamicNpcState[npc].knockedOut) return;
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
        onClick={(e) => {
          if (!canClick || dynamicNpcState[npc].knockedOut) return;
          e.stopPropagation();
          onSelect(npc);
        }}
      >
        <cylinderGeometry args={[0.7, 0.7, 2.2, 8]} />
      </mesh>

      {/* Dim the whole figure when another NPC is in focus. */}
      <DimGroup dim={dim}>
        <CharacterBody npc={npc} accent={accent} />
      </DimGroup>

      {/* Floating label + trust bar. */}
      <Html position={[0, 2.15, 0]} center distanceFactor={9} pointerEvents="none" style={{ opacity: dim ? 0.3 : 1, transition: 'opacity 0.3s' }}>
        <div ref={htmlRef} style={{ textAlign: 'center', fontFamily: 'var(--engram-serif, serif)', color: '#f4e8d0', textShadow: '0 2px 6px #000', userSelect: 'none', width: 120 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: accent }}>{name}</div>
          <div style={{ fontSize: 11, fontStyle: 'italic', opacity: 0.8, marginTop: -2 }}>{role}</div>
          {memory && (
            <div style={{ width: 70, height: 5, margin: '4px auto 0', background: 'rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }} title={`trust ${memory.trust_level}`}>
              <div style={{ width: `${memory.trust_level}%`, height: '100%', background: trustColor(memory.trust_level) }} />
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

// Applies a fade/desaturate to its children by overriding material props.
function DimGroup({ dim, children }: { dim: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const mat = mesh.material as THREE.Material & { opacity?: number; transparent?: boolean };
      if (mat && 'opacity' in mat) {
        mat.transparent = true;
        const targetOp = dim ? 0.25 : 1;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity ?? 1, targetOp, 0.15);
      }
    });
  });
  return <group ref={ref}>{children}</group>;
}

// ─── Public component ─────────────────────────────────────────────────────────

interface Scene3DProps {
  memories?: Record<NPCName, NPCMemory> | null;
  active?: NPCName | null;
  talking?: boolean;
  onSelect?: (npc: NPCName) => void;
  /** When false (e.g. the title screen) the villagers are decorative only. */
  interactive?: boolean;
  /** Show the floating 3D "ENGRAM" title (pre-connect title screen). */
  showTitle?: boolean;
  /**
   * True while any 2D GUI overlay is open (e.g. the Memory panel). Releases the
   * pointer lock and freezes movement so the cursor is usable for the GUI.
   */
  uiOpen?: boolean;
}

export default function Scene3D({ memories = null, active = null, talking = false, onSelect = () => {}, interactive = true, showTitle = false, uiOpen = false }: Scene3DProps) {
  // Walk-around mode kicks in once the village is interactive (wallet connected
  // and memories loaded). The title screen stays cinematic.
  const explorable = interactive && !showTitle;
  // Movement + pointer lock only when not mid-dialogue and no GUI is open.
  const exploring = explorable && !active && !uiOpen;

  const [nearby, setNearby] = useState<NPCName | null>(null);
  const [nearbyTree, setNearbyTree] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [view, setView] = useState<ViewMode>('fp');
  const [flash, setFlash] = useState(false);
  const [playerHp, setPlayerHp] = useState(100);
  const [nearbyEnemy, setNearbyEnemy] = useState<string | null>(null);
  
  const nearbyRef = useRef<NPCName | null>(null);
  nearbyRef.current = nearby;
  const nearbyTreeRef = useRef<number | null>(null);
  nearbyTreeRef.current = nearbyTree;
  const nearbyEnemyRef = useRef<string | null>(null);
  nearbyEnemyRef.current = nearbyEnemy;
  
  const world = useWorld();

  // Shared player position (first-person camera ↔ aerial avatar).
  const posRef = useRef<PlayerPos>({ x: SPAWN_XZ[0], z: SPAWN_XZ[1], heading: 0 });

  const fpExploring = exploring && view === 'fp';
  const aerialExploring = exploring && view === 'aerial';

  // V toggles first-person ↔ aerial; E talks / F chops (first-person only).
  useEffect(() => {
    if (!exploring) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'KeyV') {
        setView((v) => (v === 'fp' ? 'aerial' : 'fp'));
        return;
      }
      if (view !== 'fp') return; // interactions are first-person only
      if (e.code === 'KeyE' && nearbyRef.current) onSelect(nearbyRef.current);
      if (e.code === 'KeyF' && nearbyTreeRef.current !== null && !isChopped(nearbyTreeRef.current)) {
        chopTree(nearbyTreeRef.current);
        setNearbyTree(null); // it's gone now; Player will repick next frame
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exploring, onSelect, view]);

  // Player combat listener
  useEffect(() => {
    if (!exploring) return;
    const onMouseDown = (e: MouseEvent) => {
      // Only trigger if locked (first person) and left click
      if (document.pointerLockElement && e.button === 0 && nearbyEnemyRef.current) {
        const enemy = dynamicEnemyState[nearbyEnemyRef.current];
        if (enemy && !enemy.dead) {
          enemy.hp -= 25;
          if (enemy.hp <= 0) enemy.dead = true;
          setFlash(true);
          setTimeout(() => setFlash(false), 80);
        }
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [exploring]);
  
  // Sync player HP to UI and handle death
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerHp !== dynamicPlayerState.hp) {
        setPlayerHp(dynamicPlayerState.hp);
      }
      if (dynamicPlayerState.dead) {
        dynamicPlayerState.hp = dynamicPlayerState.maxHp;
        dynamicPlayerState.dead = false;
        posRef.current = { x: SPAWN_XZ[0], z: SPAWN_XZ[1], heading: 0 };
        setPlayerHp(dynamicPlayerState.maxHp);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [playerHp]);

  // Clear the proximity prompt and lock state whenever we leave explore mode
  // (dialogue or a GUI opened), so the HUD is correct when control returns.
  // Also force-release any pointer lock: drei re-locks on *any* document click,
  // so the same click that opens a GUI can issue a lock request right before
  // PointerLockControls unmounts — exitPointerLock guarantees the cursor is freed.
  useEffect(() => {
    if (exploring) return;
    setNearby(null);
    setNearbyTree(null);
    setLocked(false);
    if (typeof document === 'undefined') return;
    // Exit any lock already held, and any lock whose async grant lands after the
    // GUI-opening click (drei's request can resolve after PointerLockControls
    // has unmounted).
    const release = () => {
      if (document.pointerLockElement) document.exitPointerLock();
    };
    release();
    document.addEventListener('pointerlockchange', release);
    return () => document.removeEventListener('pointerlockchange', release);
  }, [exploring]);

  const nearbyNpc = nearby ? NPC_LIST.find((n) => n.id === nearby) : null;

  return (
    <div className="absolute inset-0">
      <KeyboardControls map={keyboardMap}>
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [0, 3.1, 9], fov: 60 }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={['#0e1220']} />
          <fog attach="fog" args={['#10131f', 24, 80]} />

          {/* Dusk skydome behind the stars for a deep, graded horizon. */}
          <Sky distance={450000} sunPosition={[-40, 5, -70]} turbidity={12} rayleigh={0.7} mieCoefficient={0.02} mieDirectionalG={0.86} />

          {/* Moonlight + soft ambient + cool fill. */}
          <ambientLight intensity={0.32} color="#9fb3d6" />
          <directionalLight
            position={[20, 24, -46]}
            intensity={1.05}
            color="#cdd9ff"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-near={1}
            shadow-camera-far={80}
            shadow-camera-left={-26}
            shadow-camera-right={26}
            shadow-camera-top={26}
            shadow-camera-bottom={-26}
          />

          <Stars radius={80} depth={45} count={1800} factor={3.2} saturation={0} fade speed={0.5} />

          {/* Cinematic rig on the title/loading screen; first-person controls
              once Aldenmoor is explorable. */}
          {!explorable && <CameraRig active={active} />}
          {/* Player stays mounted across dialogues/views (movement gated by
              `enabled`) so switching back resumes where you stood, not at spawn. */}
          {fpExploring && (
            <Player
              posRef={posRef}
              enabled={true}
              onNearbyChange={setNearby}
              onNearbyTreeChange={setNearbyTree}
              onNearbyEnemyChange={setNearbyEnemy}
            />
          )}
          {fpExploring && <PointerLockControls onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />}
          {explorable && view === 'aerial' && (
            <>
              <AerialRig enabled={aerialExploring} posRef={posRef} />
              <Avatar posRef={posRef} />
            </>
          )}
          {explorable && active && view === 'fp' && <TalkFraming active={active} />}

          <Village />
          {explorable && <EnemySpawner />}
          {/* The title text is HTML in client-page now: a 3D drei <Text> here
              orphaned in the persistent canvas across the title→game transition,
              showing up as stray letters in the aerial view. */}

          <ContactShadows position={[0, 0.01, 0]} opacity={0.45} scale={20} blur={2.4} far={6} />

          {NPC_LIST.map((npc) => (
            <Character
              key={npc.id}
              npc={npc.id}
              name={npc.name}
              role={npc.role}
              accent={npc.accent}
              memory={memories ? memories[npc.id] : null}
              active={active === npc.id}
              dim={!!active && active !== npc.id}
              talking={talking && active === npc.id}
              interactive={interactive && !explorable}
              onSelect={onSelect}
            />
          ))}
        </Canvas>
      </KeyboardControls>

      {/* Shared HUD while exploring (either view): inventory + view toggle. */}
      {exploring && (
        <>
          <div className="pointer-events-none absolute top-20 left-4 z-10 flex gap-3 text-sm text-[#f4e8d0]">
            <span className="rounded-md bg-black/45 px-2.5 py-1" title="Wood">🪵 {world.inventory.wood}</span>
            <span className="rounded-md bg-black/45 px-2.5 py-1" title="Coin">🪙 {world.inventory.coin}</span>
          </div>
          <button
            onClick={() => setView((v) => (v === 'fp' ? 'aerial' : 'fp'))}
            className="absolute top-20 right-4 z-10 rounded-md border border-[#5a4a28] bg-black/50 px-3 py-1.5 text-sm text-[#f4e8d0] hover:border-[#d6b84a]"
          >
            {view === 'fp' ? '🦅 Aerial (V)' : '🚶 First person (V)'}
          </button>
        </>
      )}

      {/* First-person HUD (crosshair, proximity prompts, controls). */}
      {fpExploring && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <div className="h-1.5 w-1.5 rounded-full bg-white/70 shadow-[0_0_4px_rgba(0,0,0,0.8)]" />
          </div>

          {flash && <div className="absolute inset-0 pointer-events-none bg-white/20 mix-blend-overlay z-20" />}
          
          <div className="absolute bottom-[4.5rem] left-4 pointer-events-none select-none drop-shadow-md z-10">
            <div className="text-white/80 text-sm mb-1 font-bold tracking-wide">HP: {Math.max(0, playerHp)}</div>
            <div className="w-40 h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
              <div className="h-full bg-red-500/90 transition-all duration-200" style={{ width: `${Math.max(0, playerHp)}%` }} />
            </div>
          </div>

          {!locked && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="rounded-full bg-black/55 px-5 py-2 text-sm text-[#f4e8d0]/90">
                Click to look around · WASD to walk · V for aerial view
              </div>
            </div>
          )}

          {locked && nearbyNpc && (
            <div className="pointer-events-none absolute bottom-28 left-1/2 z-10 -translate-x-1/2">
              <div
                className="rounded-full border px-5 py-2 text-sm font-semibold text-[#f4e8d0] shadow-lg"
                style={{ background: 'rgba(20,16,10,0.88)', borderColor: nearbyNpc.accent }}
              >
                Press <span style={{ color: nearbyNpc.accent }}>E</span> to speak with {nearbyNpc.name}
              </div>
            </div>
          )}

          {locked && nearbyTree !== null && !nearbyNpc && (
            <div className="pointer-events-none absolute bottom-28 left-1/2 z-10 -translate-x-1/2">
              <div className="rounded-full border border-[#6a8a4a] px-5 py-2 text-sm font-semibold text-[#f4e8d0] shadow-lg" style={{ background: 'rgba(16,20,10,0.88)' }}>
                Press <span className="text-[#8fd06a]">F</span> to chop this tree
              </div>
            </div>
          )}

          {locked && nearbyEnemy && !nearbyNpc && !nearbyTree && (
            <div className="pointer-events-none absolute bottom-28 left-1/2 z-10 -translate-x-1/2">
              <div className="rounded-full border border-red-500/60 px-5 py-2 text-sm font-semibold text-red-100 shadow-lg" style={{ background: 'rgba(30,10,10,0.88)' }}>
                <span className="text-red-400">Left Click</span> to attack Enemy
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute bottom-4 left-4 z-10 text-xs text-[#f4e8d0]/55">
            WASD move · Mouse look · E talk · F chop · Click attack · V aerial · Esc release cursor
          </div>
        </>
      )}

      {/* Aerial HUD. */}
      {aerialExploring && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 text-xs text-[#f4e8d0]/60">
          WASD move (W=north) · Scroll to zoom · V back to first person
        </div>
      )}
    </div>
  );
}
