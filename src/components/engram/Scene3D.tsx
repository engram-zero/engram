'use client';

// ─── Engram — Aldenmoor in 3D ─────────────────────────────────────────────────
// A low-poly, night-time render of the village built with @react-three/fiber +
// @react-three/drei. This is *only* the visual layer: it receives the player's
// memories, which NPC is active, and a select callback — all game/memory/dialogue
// logic still lives in client-page.tsx. The 2D dialogue box overlays this Canvas.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Sky, Html, ContactShadows, PointerLockControls, OrthographicCamera, KeyboardControls, useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { useNetwork } from '@/app/providers';
import { NPC_LIST } from '@/lib/npcs';
import { BLOCK_SCALE_MAX, BLOCK_SCALE_MIN, BLOCK_UNIT, type NPCName, type NPCMemory } from '@/lib/types';
import { writeWorldState } from '@/lib/memory';
import {
  getHeightAt,
  COTTAGES,
  TREES,
  CAMPFIRE,
  WORLD_RADIUS,
  GROUND_RADIUS,
  type TreeDef,
  type CottageDef,
} from './map';
import { getTexture, getTextureVariant, hasTexture } from './textures';
import {
  useWorld,
  getWorld,
  getWorldWallet,
  cloneWorldState,
  replaceWorldState,
  harvestTree,
  isChopped,
  woodIsFull,
  MAX_WOOD,
  placeBuilding,
  removeBuilding,
  BUILD_COST,
  BUILD_RADIUS,
  isLocalhostFreeBuildWallet,
  type BuildingType,
  type Building,
} from '@/lib/world';
import { useEngramAudio } from '@/context/AudioContext';
import { usePublicWorld } from '@/lib/public-world';

// A tree carries its global index (into TREES) so chopping can target it.
type TreeInst = TreeDef & { idx: number };

// Shared player ground position + facing, so the first-person camera and the
// aerial avatar stay in sync when you switch views.
type PlayerPos = { x: number; z: number; heading: number };
type PlayerPosRef = React.MutableRefObject<PlayerPos>;
type ViewMode = 'fp' | 'aerial';
type MovementInput = { forward: boolean; backward: boolean; left: boolean; right: boolean };

// How many texture-variant groups the forest is split into (cycles through the
// PNGs registered per slot, so the woods don't look uniform).
const TREE_BUCKETS = 4;
const IDLE_MOVEMENT: MovementInput = { forward: false, backward: false, left: false, right: false };

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
  { name: 'jump', keys: ['Space'] },
];

const JUMP_SPEED = 5.2; // initial upward velocity (m/s)
const GRAVITY = 16; // m/s²
const HOUSE_WIDTH = 2.4;
const HOUSE_DEPTH = 2.0;
const HOUSE_WALL_HEIGHT = 1.8;
const HOUSE_WALL_THICKNESS = 0.16;
const HOUSE_DOOR_WIDTH = 0.82;
const HOUSE_DOOR_OFFSET_Z = HOUSE_DEPTH / 2 - HOUSE_WALL_THICKNESS / 2;
const HOUSE_ROOF_Y = 2.2;
const HOUSE_INTERIOR_CAMERA_BOOST = 0.18;

type OrientedWallBox = { cx: number; cz: number; hx: number; hz: number };

function toLocalXZ(x: number, z: number, originX: number, originZ: number, rot: number) {
  const dx = x - originX;
  const dz = z - originZ;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

function toWorldXZ(localX: number, localZ: number, originX: number, originZ: number, rot: number) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return {
    x: originX + localX * c + localZ * s,
    z: originZ - localX * s + localZ * c,
  };
}

const HOUSE_WALL_BOXES: OrientedWallBox[] = [
  { cx: -HOUSE_WIDTH / 2 + HOUSE_WALL_THICKNESS / 2, cz: 0, hx: HOUSE_WALL_THICKNESS / 2, hz: HOUSE_DEPTH / 2 },
  { cx: HOUSE_WIDTH / 2 - HOUSE_WALL_THICKNESS / 2, cz: 0, hx: HOUSE_WALL_THICKNESS / 2, hz: HOUSE_DEPTH / 2 },
  { cx: 0, cz: -HOUSE_DEPTH / 2 + HOUSE_WALL_THICKNESS / 2, hx: HOUSE_WIDTH / 2, hz: HOUSE_WALL_THICKNESS / 2 },
  { cx: -(HOUSE_WIDTH - HOUSE_DOOR_WIDTH) / 4 - HOUSE_DOOR_WIDTH / 2, cz: HOUSE_DOOR_OFFSET_Z, hx: (HOUSE_WIDTH - HOUSE_DOOR_WIDTH) / 4, hz: HOUSE_WALL_THICKNESS / 2 },
  { cx: (HOUSE_WIDTH - HOUSE_DOOR_WIDTH) / 4 + HOUSE_DOOR_WIDTH / 2, cz: HOUSE_DOOR_OFFSET_Z, hx: (HOUSE_WIDTH - HOUSE_DOOR_WIDTH) / 4, hz: HOUSE_WALL_THICKNESS / 2 },
];

function pushOutOfRotatedBox(
  x: number,
  z: number,
  originX: number,
  originZ: number,
  rot: number,
  box: OrientedWallBox,
  radius: number
): [number, number] {
  const local = toLocalXZ(x, z, originX, originZ, rot);
  const hx = box.hx + radius;
  const hz = box.hz + radius;
  const dx = local.x - box.cx;
  const dz = local.z - box.cz;
  if (Math.abs(dx) >= hx || Math.abs(dz) >= hz) return [x, z];

  let nextLocalX = local.x;
  let nextLocalZ = local.z;
  if (hx - Math.abs(dx) < hz - Math.abs(dz)) {
    nextLocalX = box.cx + (dx >= 0 ? hx : -hx);
  } else {
    nextLocalZ = box.cz + (dz >= 0 ? hz : -hz);
  }
  const world = toWorldXZ(nextLocalX, nextLocalZ, originX, originZ, rot);
  return [world.x, world.z];
}

function resolveHouseCollision(x: number, z: number, house: Building, radius: number): [number, number] {
  let nextX = x;
  let nextZ = z;
  for (const box of HOUSE_WALL_BOXES) {
    [nextX, nextZ] = pushOutOfRotatedBox(nextX, nextZ, house.x, house.z, house.rot, box, radius);
  }
  return [nextX, nextZ];
}

function isInsideHouseInterior(house: Building, x: number, z: number) {
  const local = toLocalXZ(x, z, house.x, house.z, house.rot);
  return (
    Math.abs(local.x) < HOUSE_WIDTH / 2 - HOUSE_WALL_THICKNESS * 1.4 &&
    local.z > -HOUSE_DEPTH / 2 + HOUSE_WALL_THICKNESS * 1.4 &&
    local.z < HOUSE_DEPTH / 2 - HOUSE_WALL_THICKNESS * 1.4
  );
}

function resolveStaticCottageCollision(x: number, z: number): [number, number] {
  let nextX = x;
  let nextZ = z;
  for (const cottage of COTTAGES) {
    const scaledBoxes = HOUSE_WALL_BOXES.map((box) => ({
      cx: box.cx * cottage.scale,
      cz: box.cz * cottage.scale,
      hx: box.hx * cottage.scale,
      hz: box.hz * cottage.scale,
    }));
    for (const box of scaledBoxes) {
      [nextX, nextZ] = pushOutOfRotatedBox(nextX, nextZ, cottage.x, cottage.z, cottage.rot, box, PLAYER_RADIUS);
    }
  }
  return [nextX, nextZ];
}

function isInsideStaticCottage(cottage: CottageDef, x: number, z: number) {
  const local = toLocalXZ(x, z, cottage.x, cottage.z, cottage.rot);
  return (
    Math.abs(local.x) < (HOUSE_WIDTH / 2 - HOUSE_WALL_THICKNESS * 1.4) * cottage.scale &&
    local.z > (-HOUSE_DEPTH / 2 + HOUSE_WALL_THICKNESS * 1.4) * cottage.scale &&
    local.z < (HOUSE_DEPTH / 2 - HOUSE_WALL_THICKNESS * 1.4) * cottage.scale
  );
}

function normalizeBlockBuilding(candidate: Partial<Building> & Pick<Building, 'x' | 'z'>): Building {
  const scaleRaw = typeof candidate.scale === 'number' ? candidate.scale : BLOCK_UNIT;
  const scale = Math.max(BLOCK_SCALE_MIN, Math.min(BLOCK_SCALE_MAX, Math.round(scaleRaw / BLOCK_UNIT) * BLOCK_UNIT));
  const yRaw = typeof candidate.y === 'number' ? candidate.y : 0;
  return {
    type: 'block',
    x: Math.round(candidate.x / BLOCK_UNIT) * BLOCK_UNIT,
    z: Math.round(candidate.z / BLOCK_UNIT) * BLOCK_UNIT,
    rot: typeof candidate.rot === 'number' ? candidate.rot : 0,
    y: Math.max(0, Math.round(yRaw / BLOCK_UNIT) * BLOCK_UNIT),
    scale,
    color: candidate.color ?? '#8a6a4a',
  };
}

function blocksOverlap(a: Building, b: Building) {
  const sa = a.scale ?? BLOCK_UNIT;
  const sb = b.scale ?? BLOCK_UNIT;
  const ay0 = a.y ?? 0;
  const ay1 = ay0 + sa;
  const by0 = b.y ?? 0;
  const by1 = by0 + sb;
  return (
    a.x - sa / 2 < b.x + sb / 2 &&
    a.x + sa / 2 > b.x - sb / 2 &&
    a.z - sa / 2 < b.z + sb / 2 &&
    a.z + sa / 2 > b.z - sb / 2 &&
    ay0 < by1 &&
    ay1 > by0
  );
}

// Slide the player out of the boundary and any prop/NPC they overlap.
function resolveCollision(x: number, z: number): [number, number] {
  const d = Math.hypot(x, z);
  if (d > WORLD_RADIUS) {
    x = (x / d) * WORLD_RADIUS;
    z = (z / d) * WORLD_RADIUS;
  }
  const obstacles = [
    ...COTTAGES.map((c) => ({ x: c.x, z: c.z, r: c.scale * 1.5 })),
    { x: CAMPFIRE.x, z: CAMPFIRE.z, r: 1.0 },
    ...TREES.map((t, i) => ({ t, i })).filter(({ i }) => !isChopped(i)).map(({ t }) => ({ x: t.x, z: t.z, r: 0.45 * t.scale })),
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
  [x, z] = resolveStaticCottageCollision(x, z);
  for (const b of getWorld().buildings) {
    if (b.type === 'block') continue;
    if (b.type === 'house') {
      [x, z] = resolveHouseCollision(x, z, b, PLAYER_RADIUS);
      continue;
    }
    const dx = x - b.x;
    const dz = z - b.z;
    const dist = Math.hypot(dx, dz);
    const min = BUILD_RADIUS[b.type] + PLAYER_RADIUS;
    if (dist < min && dist > 1e-4) {
      const push = min - dist;
      x += (dx / dist) * push;
      z += (dz / dist) * push;
    }
  }
  return [x, z];
}

// Push an entity (NPCs, enemies) out of any building it overlaps. Used for actors
// that move directly (not via resolveCollision) so they can't walk through walls.
function resolveBuildings(x: number, z: number, radius = 0.5): [number, number] {
  for (const b of getWorld().buildings) {
    if (b.type === 'block') continue; // decorative voxels don't block movement
    if (b.type === 'house') {
      [x, z] = resolveHouseCollision(x, z, b, radius);
      continue;
    }
    const dx = x - b.x;
    const dz = z - b.z;
    const dist = Math.hypot(dx, dz);
    const min = BUILD_RADIUS[b.type] + radius;
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

function mergeMovement(keyboard: MovementInput, touch: MovementInput) {
  return {
    forward: keyboard.forward || touch.forward,
    backward: keyboard.backward || touch.backward,
    left: keyboard.left || touch.left,
    right: keyboard.right || touch.right,
  };
}

function WoodIcon() {
  return (
    <span className="engram-resource-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="4" y="8" width="16" height="8" rx="4" fill="#8b5a2b" stroke="#d7b17a" strokeWidth="1.4" />
        <circle cx="8" cy="12" r="2.2" fill="none" stroke="#f0d3a0" strokeWidth="1.2" />
        <path d="M15 9.5c1.8 1 1.8 4 0 5" stroke="#f0d3a0" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function CoinIcon() {
  return (
    <span className="engram-resource-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="7" fill="#d6b84a" stroke="#f6e08a" strokeWidth="1.4" />
        <circle cx="12" cy="12" r="4.2" fill="none" stroke="#8f6f1d" strokeWidth="1.2" />
      </svg>
    </span>
  );
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
  touchMove = IDLE_MOVEMENT,
  touchLook,
  onNearbyChange,
  onNearbyTreeChange,
  onNearbyEnemyChange,
  onFootstep,
  onJump,
  onLand,
}: {
  enabled: boolean;
  posRef: PlayerPosRef;
  touchMove?: MovementInput;
  touchLook?: React.MutableRefObject<{ dx: number; dy: number }>;
  onNearbyChange: (npc: NPCName | null) => void;
  onNearbyTreeChange?: (treeIdx: number | null) => void;
  onNearbyEnemyChange?: (enemyId: string | null) => void;
  onFootstep?: () => void;
  onJump?: () => void;
  onLand?: () => void;
}) {
  const { camera } = useThree();
  const [, getKeys] = useKeyboardControls();
  const bob = useRef({ t: 0, off: 0 });
  const jump = useRef({ y: 0, vy: 0, held: false }); // first-person jump (Space)
  const footstep = useRef(0);
  const nearbyRef = useRef<NPCName | null>(null);
  const treeRef = useRef<number | null>(null);
  const nearbyEnemyRef = useRef<string | null>(null);
  const didLook = useRef(false);
  const lookEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ')); // touch look (yaw/pitch)
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
    // Seed the touch-look angles from wherever the camera is now.
    lookEuler.current.setFromQuaternion(camera.quaternion, 'YXZ');
  }, [enabled, camera, posRef]);

  useFrame((_, dtRaw) => {
    if (!enabled || dynamicPlayerState.dead) return;
    const dt = Math.min(dtRaw, 0.05);
    // Touch look: drag rotates the camera (yaw + clamped pitch) — no pointer
    // lock on mobile. Pitch is clamped so you can glance at the sky/ground but
    // not flip over.
    if (touchLook && (touchLook.current.dx !== 0 || touchLook.current.dy !== 0)) {
      lookEuler.current.y -= touchLook.current.dx * 0.005;
      lookEuler.current.x -= touchLook.current.dy * 0.005;
      lookEuler.current.x = Math.max(-1.2, Math.min(1.2, lookEuler.current.x));
      camera.quaternion.setFromEuler(lookEuler.current);
      touchLook.current.dx = 0;
      touchLook.current.dy = 0;
    }
    const keys = getKeys() as MovementInput & { jump: boolean };
    const k = mergeMovement(keys, touchMove);

    // Jump: launch on a fresh Space press while grounded, then fall under gravity.
    const grounded = jump.current.y <= 0.001;
    if (keys.jump && !jump.current.held && grounded) {
      jump.current.vy = JUMP_SPEED;
      onJump?.();
    }
    jump.current.held = !!keys.jump;
    if (!grounded || jump.current.vy > 0) {
      jump.current.vy -= GRAVITY * dt;
      jump.current.y = Math.max(0, jump.current.y + jump.current.vy * dt);
      if (jump.current.y === 0) {
        if (jump.current.vy < -0.5) onLand?.();
        jump.current.vy = 0;
      }
    }

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
    if (moving && grounded) {
      footstep.current += dt;
      if (footstep.current >= 0.42) {
        footstep.current = 0;
        onFootstep?.();
      }
    } else {
      footstep.current = 0;
    }
    // Follow the terrain: ground height under the feet + eye height + head-bob + jump.
    camera.position.y = getHeightAt(camera.position.x, camera.position.z) + EYE_HEIGHT + bob.current.off + jump.current.y;
    for (const cottage of COTTAGES) {
      if (isInsideStaticCottage(cottage, camera.position.x, camera.position.z)) {
        camera.position.y += HOUSE_INTERIOR_CAMERA_BOOST * cottage.scale * 0.7;
        break;
      }
    }
    for (const house of getWorld().buildings) {
      if (house.type === 'house' && isInsideHouseInterior(house, camera.position.x, camera.position.z)) {
        camera.position.y += HOUSE_INTERIOR_CAMERA_BOOST;
        break;
      }
    }

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

function AerialRig({
  enabled,
  posRef,
  touchMove = IDLE_MOVEMENT,
  onNearbyChange,
  onNearbyTreeChange,
  onNearbyEnemyChange,
}: {
  enabled: boolean;
  posRef: PlayerPosRef;
  touchMove?: MovementInput;
  onNearbyChange?: (npc: NPCName | null) => void;
  onNearbyTreeChange?: (treeIdx: number | null) => void;
  onNearbyEnemyChange?: (enemyId: string | null) => void;
}) {
  const camRef = useRef<THREE.OrthographicCamera>(null);
  const [, getKeys] = useKeyboardControls();
  const zoom = useRef(22);
  const nearbyRef = useRef<NPCName | null>(null);
  const treeRef = useRef<number | null>(null);
  const enemyRef = useRef<string | null>(null);

  // Mouse-wheel zoom while in aerial view (min raised so you can't zoom out past
  // the world into the sky).
  useEffect(() => {
    if (!enabled) return;
    const onWheel = (e: WheelEvent) => {
      // Min kept above the point where the bright sky horizon peeks in at the
      // bottom of the tilted view.
      zoom.current = THREE.MathUtils.clamp(zoom.current - e.deltaY * 0.02, 12, 55);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [enabled]);

  useFrame((_, dtRaw) => {
    const cam = camRef.current;
    if (!enabled || !cam) return;
    const dt = Math.min(dtRaw, 0.05);
    const k = mergeMovement(getKeys() as MovementInput, touchMove);

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

    dynamicPlayerState.x = posRef.current.x;
    dynamicPlayerState.z = posRef.current.z;

    let bestNpc: NPCName | null = null;
    let bestNpcDistance = Infinity;
    for (const npc of NPC_LIST) {
      const dyn = dynamicNpcState[npc.id];
      if (dyn.knockedOut) continue;
      const dd = Math.hypot(posRef.current.x - dyn.x, posRef.current.z - dyn.z);
      if (dd < TALK_RANGE && dd < bestNpcDistance) {
        bestNpcDistance = dd;
        bestNpc = npc.id;
      }
    }
    if (bestNpc !== nearbyRef.current) {
      nearbyRef.current = bestNpc;
      onNearbyChange?.(bestNpc);
    }

    let bestTree = -1;
    let bestTreeDistance = Infinity;
    for (let i = 0; i < TREES.length; i++) {
      if (isChopped(i)) continue;
      const tree = TREES[i];
      const dd = Math.hypot(posRef.current.x - tree.x, posRef.current.z - tree.z);
      if (dd < CHOP_RANGE && dd < bestTreeDistance) {
        bestTreeDistance = dd;
        bestTree = i;
      }
    }
    const treeIdx = bestTree >= 0 ? bestTree : null;
    if (treeIdx !== treeRef.current) {
      treeRef.current = treeIdx;
      onNearbyTreeChange?.(treeIdx);
    }

    let bestEnemy: string | null = null;
    let bestEnemyDistance = Infinity;
    for (const [id, enemy] of Object.entries(dynamicEnemyState)) {
      if (enemy.dead) continue;
      const dd = Math.hypot(posRef.current.x - enemy.x, posRef.current.z - enemy.z);
      if (dd < 4.0 && dd < bestEnemyDistance) {
        bestEnemyDistance = dd;
        bestEnemy = id;
      }
    }
    if (bestEnemy !== enemyRef.current) {
      enemyRef.current = bestEnemy;
      onNearbyEnemyChange?.(bestEnemy);
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
      <meshStandardMaterial color="#7c8a5c" map={getTexture('terrain_grass', { repeat: Math.round(GROUND_RADIUS / 3) })} roughness={1} />
    </mesh>
  );
}

// ── Moon ── emissive disc + an additive halo sprite.
// Sun (warm, big glow) or moon (cool, small glow). Position is supplied by the
// day/night cycle so it rises and sets with the player's local clock.
function Celestial({ position, sun = false }: { position: [number, number, number]; sun?: boolean }) {
  const halo = useMemo(
    () =>
      sun
        ? makeRadialTexture('rgba(255,238,190,0.95)', 'rgba(255,200,120,0.28)')
        : makeRadialTexture('rgba(255,247,224,0.9)', 'rgba(214,226,255,0.22)'),
    [sun]
  );
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[sun ? 4 : 3, 24, 24]} />
        <meshBasicMaterial color={sun ? '#fff2c4' : '#eef2ff'} />
      </mesh>
      <sprite scale={sun ? [44, 44, 1] : [22, 22, 1]}>
        <spriteMaterial map={halo} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={sun ? 0.9 : 0.7} />
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
        <boxGeometry args={[3.4, 0.24, 2.8]} />
        <meshStandardMaterial color="#5b5048" map={getTextureVariant('stone', seed)} flatShading />
      </mesh>
      <mesh position={[0, 0.03, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HOUSE_WIDTH - 0.14, HOUSE_DEPTH - 0.14]} />
        <meshStandardMaterial color="#2f2a1f" map={getTextureVariant('terrain_grass', seed)} flatShading />
      </mesh>
      {HOUSE_WALL_BOXES.map((wall, i) => (
        <mesh key={i} position={[wall.cx, HOUSE_WALL_HEIGHT / 2, wall.cz]} castShadow receiveShadow>
          <boxGeometry args={[wall.hx * 2, HOUSE_WALL_HEIGHT, wall.hz * 2]} />
          <meshStandardMaterial color={def.body} map={getTextureVariant('cottage_wood', seed)} flatShading />
        </mesh>
      ))}
      {/* corner beams */}
      {([[-HOUSE_WIDTH / 2, -HOUSE_DEPTH / 2], [HOUSE_WIDTH / 2, -HOUSE_DEPTH / 2], [-HOUSE_WIDTH / 2, HOUSE_DEPTH / 2], [HOUSE_WIDTH / 2, HOUSE_DEPTH / 2]] as [number, number][]).map(([x, z], i) => (
        <mesh key={i} position={[x, HOUSE_WALL_HEIGHT / 2, z]} castShadow>
          <boxGeometry args={[0.16, HOUSE_WALL_HEIGHT + 0.05, 0.16]} />
          <meshStandardMaterial color="#4a3424" flatShading />
        </mesh>
      ))}
      {/* gable roof — two slopes meeting at a ridge running along X */}
      <mesh position={[0, 2.34, -0.78]} rotation={[-0.62, 0, 0]} castShadow>
        <boxGeometry args={[3.6, 0.16, 1.95]} />
        <meshStandardMaterial color={def.roof} map={getTextureVariant('cottage_roof', seed)} flatShading />
      </mesh>
      <mesh position={[0, 2.34, 0.78]} rotation={[0.62, 0, 0]} castShadow>
        <boxGeometry args={[3.6, 0.16, 1.95]} />
        <meshStandardMaterial color={def.roof} map={getTextureVariant('cottage_roof', seed)} flatShading />
      </mesh>
      <mesh position={[0, 2.86, 0]}>
        <boxGeometry args={[3.64, 0.13, 0.13]} />
        <meshStandardMaterial color="#3a2a1a" flatShading />
      </mesh>
      {/* door lintel + open doorway */}
      <mesh position={[0, 1.66, HOUSE_DOOR_OFFSET_Z]}>
        <boxGeometry args={[HOUSE_DOOR_WIDTH, 0.18, 0.08]} />
        <meshStandardMaterial color="#2a1a10" flatShading />
      </mesh>
      <mesh position={[-0.47, 0.78, 1.06]}>
        <boxGeometry args={[0.14, 1.42, 0.06]} />
        <meshStandardMaterial color="#5a3a1f" flatShading />
      </mesh>
      <mesh position={[0.47, 0.78, 1.06]}>
        <boxGeometry args={[0.14, 1.42, 0.06]} />
        <meshStandardMaterial color="#5a3a1f" flatShading />
      </mesh>
      {/* windows: dark frame + warm glow */}
      {[-0.92, 0.92].map((x, i) => (
        <group key={i} position={[x, 1.24, 1.01]}>
          <mesh>
            <boxGeometry args={[0.56, 0.56, 0.05]} />
            <meshStandardMaterial color="#2a1a10" flatShading />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <planeGeometry args={[0.4, 0.4]} />
            <meshBasicMaterial color="#ffcf7a" />
          </mesh>
        </group>
      ))}
      {/* chimney + smoke */}
      <mesh position={[1.0, 2.72, -0.34]} castShadow>
        <boxGeometry args={[0.38, 1.26, 0.38]} />
        <meshStandardMaterial color="#5a4a40" map={getTextureVariant('stone', seed)} flatShading />
      </mesh>
      <ChimneySmoke origin={[1.0, 3.45, -0.34]} />
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

function Fireflies({ active = true }: { active?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const flies = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const angle = (i / 18) * Math.PI * 2;
        const radius = 4 + (i % 6) * 1.7;
        return {
          angle,
          radius,
          speed: 0.18 + (i % 5) * 0.04,
          height: 0.7 + (i % 4) * 0.28,
          phase: i * 0.93,
        };
      }),
    []
  );

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    flies.forEach((fly, index) => {
      const child = group.current!.children[index];
      if (!child) return;
      const angle = fly.angle + t * fly.speed;
      const x = Math.cos(angle) * fly.radius;
      const z = Math.sin(angle) * fly.radius;
      const y = getHeightAt(x, z) + fly.height + Math.sin(t * 2.1 + fly.phase) * 0.18;
      child.position.set(x, y, z);
      child.visible = active;
      child.scale.setScalar(active ? 0.85 + Math.sin(t * 5.2 + fly.phase) * 0.14 : 0.001);
    });
  });

  return (
    <group ref={group}>
      {flies.map((_, index) => (
        <group key={index}>
          <mesh>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshBasicMaterial color="#f6f08a" />
          </mesh>
          <pointLight color="#d6ff7a" intensity={active ? 0.3 : 0} distance={2.8} decay={2.4} />
        </group>
      ))}
    </group>
  );
}

function NightFillLight({ active = true }: { active?: boolean }) {
  if (!active) return null;
  return (
    <>
      <pointLight color="#8db8ff" intensity={0.7} distance={40} decay={1.5} position={[0, 9, 8]} />
      <pointLight color="#6fa0ff" intensity={0.45} distance={34} decay={1.7} position={[-10, 8, -6]} />
    </>
  );
}

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
      [dyn.x, dyn.z] = resolveBuildings(dyn.x, dyn.z, 0.5); // can't walk through walls
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
    // Hold off so the player can explore in peace, then spawn 1 enemy every ~9s
    // up to a small cap (kept low so it doesn't feel like a horde).
    const MAX_ENEMIES = 13;
    let interval: ReturnType<typeof setInterval> | undefined;
    const startDelay = setTimeout(() => {
      interval = setInterval(() => {
        setEnemyIds((prev) => {
          const alive = prev.filter(id => !dynamicEnemyState[id]?.dead);
          if (alive.length >= MAX_ENEMIES) return prev;

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
      }, 120000); // a new enemy every ~2 minutes
    }, 20000); // ~20s of calm before the first enemy

    return () => {
      clearTimeout(startDelay);
      if (interval) clearInterval(interval);
    };
  }, []);

  return (
    <group>
      {enemyIds.map((id) => (
        <Enemy key={id} id={id} />
      ))}
    </group>
  );
}

// ── Torch ── a planted post with a flickering warm point light, for atmosphere
// and local lighting around the village.
function Torch({ position, lit = true }: { position: [number, number, number]; lit?: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  const glow = useRef<THREE.Mesh>(null);
  const seed = position[0] * 1.3 + position[2];
  useFrame((s) => {
    if (light.current) {
      light.current.intensity = lit ? 3.3 + Math.sin(s.clock.elapsedTime * 9 + seed) * 0.55 + Math.random() * 0.18 : 0;
      light.current.distance = lit ? 13.5 : 0;
    }
    if (glow.current) {
      const pulse = lit ? 1 + Math.sin(s.clock.elapsedTime * 7 + seed) * 0.08 : 0.001;
      glow.current.scale.setScalar(pulse);
    }
  });
  const y = getHeightAt(position[0], position[2]);
  return (
    <group position={[position[0], y, position[2]]}>
      <mesh position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 1.3, 6]} />
        <meshStandardMaterial color="#4a3424" flatShading />
      </mesh>
      <mesh position={[0, 1.42, 0]} visible={lit}>
        <coneGeometry args={[0.13, 0.4, 8]} />
        <meshBasicMaterial color="#ffb347" />
      </mesh>
      <mesh ref={glow} position={[0, 1.42, 0]} visible={lit}>
        <sphereGeometry args={[0.22, 10, 10]} />
        <meshBasicMaterial color="#ffcc73" transparent opacity={0.35} />
      </mesh>
      <pointLight ref={light} color="#ffb060" intensity={lit ? 3.3 : 0} distance={13.5} decay={1.8} position={[0, 1.45, 0]} />
    </group>
  );
}

function Village({ torchesLit = true }: { torchesLit?: boolean }) {
  return (
    <group>
      <Terrain />
      {COTTAGES.map((c, i) => (
        <Cottage key={i} def={c} seed={i} />
      ))}
      {/* A torch by each cottage door (door faces the cottage's +z, rotated). */}
      {COTTAGES.map((c, i) => (
        <Torch key={`torch${i}`} lit={torchesLit} position={[c.x + 1.7 * c.scale * Math.sin(c.rot), 0, c.z + 1.7 * c.scale * Math.cos(c.rot)]} />
      ))}
      <InstancedTrees />
      <Campfire />
    </group>
  );
}

// ─── Player-built structures ──────────────────────────────────────────────────

function BuildingMesh({ b }: { b: Building }) {
  const y = getHeightAt(b.x, b.z);
  if (b.type === 'block') {
    const s = b.scale ?? BLOCK_UNIT;
    return (
      <mesh position={[b.x, y + (b.y ?? 0) + s / 2, b.z]} rotation={[0, b.rot, 0]} castShadow receiveShadow>
        <boxGeometry args={[s, s, s]} />
        <meshStandardMaterial color={b.color ?? '#8a6a4a'} flatShading />
      </mesh>
    );
  }
  if (b.type === 'wall') {
    return (
      <mesh position={[b.x, y + 0.75, b.z]} rotation={[0, b.rot, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 1.5, 0.3]} />
        <meshStandardMaterial color="#7a5a3a" map={getTextureVariant('cottage_wood', Math.round(b.x + b.z))} flatShading />
      </mesh>
    );
  }
  return (
    <group position={[b.x, y, b.z]} rotation={[0, b.rot, 0]}>
      <mesh position={[0, 0.03, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HOUSE_WIDTH - 0.14, HOUSE_DEPTH - 0.14]} />
        <meshStandardMaterial color="#2f2a1f" map={getTextureVariant('terrain_grass', Math.round(b.x + b.z))} flatShading />
      </mesh>
      {HOUSE_WALL_BOXES.map((wall, i) => (
        <mesh key={i} position={[wall.cx, HOUSE_WALL_HEIGHT / 2, wall.cz]} castShadow receiveShadow>
          <boxGeometry args={[wall.hx * 2, HOUSE_WALL_HEIGHT, wall.hz * 2]} />
          <meshStandardMaterial color="#7a5a3a" map={getTextureVariant('cottage_wood', Math.round(b.x))} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 1.66, HOUSE_DOOR_OFFSET_Z]} castShadow receiveShadow>
        <boxGeometry args={[HOUSE_DOOR_WIDTH, 0.18, 0.08]} />
        <meshStandardMaterial color="#55341f" flatShading transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, HOUSE_ROOF_Y, -0.66]} rotation={[-0.62, 0, 0]} castShadow>
        <boxGeometry args={[2.8, 0.14, 1.6]} />
        <meshStandardMaterial color="#8a3a2a" map={getTextureVariant('cottage_roof', Math.round(b.z))} flatShading />
      </mesh>
      <mesh position={[0, HOUSE_ROOF_Y, 0.66]} rotation={[0.62, 0, 0]} castShadow>
        <boxGeometry args={[2.8, 0.14, 1.6]} />
        <meshStandardMaterial color="#8a3a2a" map={getTextureVariant('cottage_roof', Math.round(b.z))} flatShading />
      </mesh>
    </group>
  );
}

function Buildings() {
  const world = useWorld();
  const publicWorld = usePublicWorld();
  return (
    <group>
      {publicWorld.buildings.map((b, i) => (
        <BuildingMesh key={`public-${b.owner}-${i}`} b={b} />
      ))}
      {world.buildings.map((b, i) => (
        <BuildingMesh key={i} b={b} />
      ))}
    </group>
  );
}

// Build/demolish controller — only mounted in the aerial view while a build tool
// is selected. A big invisible ground plane reads the cursor; a ghost previews
// the structure (green = valid, red = blocked / not enough wood); click places.
// The village core is protected (no building), and the closer you build to the
// centre the pricier it is — so nobody clutters the square, and players spread
// out into sub-villages further out.
const NO_BUILD_RADIUS = 12;

/** Wood cost to build `type` at (x,z): base cost × a distance multiplier that
 * ramps from 6× at the no-build edge down to 1× out at radius 45. */
function buildCostAt(type: BuildingType, x: number, z: number): number {
  const d = Math.hypot(x, z);
  const mult = Math.max(1, Math.min(6, 6 - (d - NO_BUILD_RADIUS) * (5 / 33)));
  return Math.round(BUILD_COST[type] * mult);
}

// Whether a building of `type` may be placed at world (x,z): outside the
// protected core, inside the world, affordable at this spot, and not overlapping
// a cottage, the campfire, a STANDING tree, an existing building or an NPC.
// Terrain slope is intentionally NOT a blocker.
function canPlaceBuilding(type: BuildingType, x: number, z: number, candidate?: Partial<Building>, extraBuildings: Building[] = []): boolean {
  const w = getWorld();
  const d = Math.hypot(x, z);
  if (d < NO_BUILD_RADIUS) return false; // protected village core
  if (d > WORLD_RADIUS) return false;
  if (!isLocalhostFreeBuildWallet() && w.inventory.wood < buildCostAt(type, x, z)) return false;
  if (type === 'block') {
    const block = normalizeBlockBuilding({ ...candidate, x, z });
    const footprint = (block.scale ?? BLOCK_UNIT) / 2;
    const staticObstacles = [
      ...COTTAGES.map((c) => ({ x: c.x, z: c.z, r: c.scale * 1.5 })),
      { x: CAMPFIRE.x, z: CAMPFIRE.z, r: 1.0 },
      ...TREES.map((t, i) => ({ t, i })).filter(({ i }) => !isChopped(i)).map(({ t }) => ({ x: t.x, z: t.z, r: 0.45 * t.scale })),
      ...(Object.values(NPC_POS) as [number, number, number][]).map((p) => ({ x: p[0], z: p[2], r: 0.9 })),
    ];
    for (const c of staticObstacles) {
      if (Math.hypot(block.x - c.x, block.z - c.z) < c.r + footprint) return false;
    }
    for (const existing of [...w.buildings, ...extraBuildings]) {
      if (existing.type !== 'block') continue;
      if (blocksOverlap(block, normalizeBlockBuilding(existing))) return false;
    }
    return true;
  }
  const r = BUILD_RADIUS[type];
  const obstacles = [
    ...COTTAGES.map((c) => ({ x: c.x, z: c.z, r: c.scale * 1.5 })),
    { x: CAMPFIRE.x, z: CAMPFIRE.z, r: 1.0 },
    ...TREES.map((t, i) => ({ t, i })).filter(({ i }) => !isChopped(i)).map(({ t }) => ({ x: t.x, z: t.z, r: 0.45 * t.scale })),
    ...w.buildings.filter((b) => b.type !== 'block').map((b) => ({ x: b.x, z: b.z, r: BUILD_RADIUS[b.type] })),
    ...extraBuildings.filter((b) => b.type !== 'block').map((b) => ({ x: b.x, z: b.z, r: BUILD_RADIUS[b.type] })),
    ...(Object.values(NPC_POS) as [number, number, number][]).map((p) => ({ x: p[0], z: p[2], r: 0.9 })),
  ];
  for (const c of obstacles) {
    if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false;
  }
  return true;
}

// Remove the player-built structure nearest to (x,z) within `reach`, if any.
function demolishNearest(x: number, z: number, reach = 2): boolean {
  let bi = -1;
  let bd = Infinity;
  getWorld().buildings.forEach((b, i) => {
    const d = Math.hypot(x - b.x, z - b.z);
    if (d < reach && d < bd) {
      bd = d;
      bi = i;
    }
  });
  if (bi >= 0) {
    removeBuilding(bi);
    return true;
  }
  return false;
}

function BuildController({ mode, onDraftChange }: { mode: BuildingType | 'demolish'; onDraftChange: () => void }) {
  const [ghost, setGhost] = useState<[number, number] | null>(null);
  const [rot, setRot] = useState(0);
  const world = useWorld();

  // R rotates the building to place (45° steps).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'KeyR') setRot((r) => (r + Math.PI / 4) % (Math.PI * 2));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isBuild = mode !== 'demolish';
  // `world` keeps the ghost validity reactive to inventory/buildings changes.
  void world;
  const valid = isBuild && !!ghost && canPlaceBuilding(mode, ghost[0], ghost[1]);

  const place = (px: number, pz: number) => {
    const x = Math.round(px);
    const z = Math.round(pz);
    if (mode === 'demolish') {
      let bi = -1;
      let bd = Infinity;
      getWorld().buildings.forEach((b, i) => {
        const d = Math.hypot(px - b.x, pz - b.z);
        if (d < 2 && d < bd) {
          bd = d;
          bi = i;
        }
      });
      if (bi >= 0) {
        removeBuilding(bi);
        onDraftChange();
      }
    } else if (valid) {
      if (placeBuilding({ type: mode, x, z, rot }, buildCostAt(mode, x, z))) onDraftChange();
    }
  };

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        onPointerMove={(e) => setGhost([Math.round(e.point.x), Math.round(e.point.z)])}
        onPointerOut={() => setGhost(null)}
        onClick={(e) => {
          e.stopPropagation();
          place(e.point.x, e.point.z);
        }}
      >
        <planeGeometry args={[GROUND_RADIUS * 2, GROUND_RADIUS * 2]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {isBuild && ghost && (
        <mesh
          position={[ghost[0], getHeightAt(ghost[0], ghost[1]) + (mode === 'house' ? HOUSE_WALL_HEIGHT / 2 : 0.75), ghost[1]]}
          rotation={[0, rot, 0]}
        >
          {mode === 'house' ? <boxGeometry args={[2.4, 1.8, 2.0]} /> : <boxGeometry args={[1.8, 1.5, 0.3]} />}
          <meshStandardMaterial color={valid ? '#5fd06a' : '#d05a4a'} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}

// Mobile build preview: no cursor on touch, so the ghost sits just in front of
// the avatar (drive there, then tap Place). Position is computed each frame from
// the shared player position so it tracks as you move.
function mobileGhostXZ(p: { x: number; z: number; heading: number }): [number, number] {
  return [Math.round(p.x + Math.sin(p.heading) * 2.6), Math.round(p.z + Math.cos(p.heading) * 2.6)];
}

function MobileBuildGhost({ mode, posRef, rot }: { mode: BuildingType; posRef: PlayerPosRef; rot: number }) {
  const ref = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const [x, z] = mobileGhostXZ(posRef.current);
    g.position.set(x, getHeightAt(x, z) + (mode === 'house' ? HOUSE_WALL_HEIGHT / 2 : 0.75), z);
    g.rotation.y = rot;
    if (matRef.current) matRef.current.color.set(canPlaceBuilding(mode, x, z) ? '#5fd06a' : '#d05a4a');
  });
  return (
    <group ref={ref}>
      <mesh>
        {mode === 'house' ? <boxGeometry args={[2.4, 1.8, 2.0]} /> : <boxGeometry args={[1.8, 1.5, 0.3]} />}
        <meshStandardMaterial ref={matRef} color="#5fd06a" transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  );
}

// A piece returned by /api/build (offset from the avatar). Blocks carry voxel
// attributes (height, colour, size) so the AI can sculpt arbitrary shapes.
type AIPiece = { type: BuildingType; dx: number; dz: number; rot: number; dy?: number; color?: string; scale?: number };

// AI piece → a placeable Building at absolute (x,z).
function aiPieceToBuilding(b: AIPiece, x: number, z: number): Building {
  const out: Building = { type: b.type, x, z, rot: b.rot };
  if (b.type === 'block') {
    out.y = b.dy ?? 0;
    out.color = b.color ?? '#8a6a4a';
    out.scale = b.scale ?? BLOCK_UNIT;
    return normalizeBlockBuilding(out);
  }
  return out;
}

// Preview of an AI-designed structure at the spot it was generated — purple where
// it'll place, red where it's blocked. Shown until the player confirms or discards.
function AIPreviewGhosts({ pieces, origin }: { pieces: AIPiece[]; origin: { x: number; z: number } }) {
  return (
    <group>
      {pieces.map((b, i) => {
        const x = b.type === 'block' ? origin.x + b.dx : Math.round(origin.x + b.dx);
        const z = b.type === 'block' ? origin.z + b.dz : Math.round(origin.z + b.dz);
        const candidate = aiPieceToBuilding(b, x, z);
        const extra = pieces.slice(0, i).map((prev) =>
          aiPieceToBuilding(
            prev,
            prev.type === 'block' ? origin.x + prev.dx : Math.round(origin.x + prev.dx),
            prev.type === 'block' ? origin.z + prev.dz : Math.round(origin.z + prev.dz)
          )
        );
        const ok = canPlaceBuilding(b.type, x, z, candidate, extra);
        const gy = getHeightAt(x, z);
        if (b.type === 'block') {
          const s = candidate.scale ?? BLOCK_UNIT;
          return (
            <mesh key={i} position={[candidate.x, gy + (candidate.y ?? 0) + s / 2, candidate.z]} rotation={[0, candidate.rot, 0]}>
              <boxGeometry args={[s, s, s]} />
              <meshStandardMaterial color={ok ? candidate.color ?? '#8a6a4a' : '#d05a4a'} transparent opacity={0.55} depthWrite={false} />
            </mesh>
          );
        }
        return (
          <mesh key={i} position={[x, gy + (b.type === 'house' ? HOUSE_WALL_HEIGHT / 2 : 0.75), z]} rotation={[0, b.rot, 0]}>
            {b.type === 'house' ? <boxGeometry args={[2.4, 1.8, 2.0]} /> : <boxGeometry args={[1.8, 1.5, 0.3]} />}
            <meshStandardMaterial color={ok ? '#7a6ad6' : '#d05a4a'} transparent opacity={0.45} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

// The 3D floating title was removed — it's rendered as HTML in client-page now.
// A drei/troika <Text> here orphaned in the persistent canvas across the
// title→game transition and showed up as stray letters in the aerial view.

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
  aerial,
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
  aerial: boolean;
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
          [dyn.x, dyn.z] = resolveBuildings(dyn.x, dyn.z, 0.5);
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
        [dyn.x, dyn.z] = resolveBuildings(dyn.x, dyn.z, 0.5);
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

      {/* Floating label + trust bar. Hidden in the aerial view: drei <Html>
          distanceFactor scales by the camera zoom, and under the high-zoom
          orthographic aerial camera it blows the labels up to giant overlapping
          text across the screen (the "stray letters"). */}
      {!aerial && (
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
      )}
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

// ─── Day/night cycle (driven by the player's local clock) ─────────────────────

export interface DayNight {
  sunPos: [number, number, number];
  bg: string;
  fog: string;
  ambIntensity: number;
  ambColor: string;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  dirPos: [number, number, number];
  dirIntensity: number;
  dirColor: string;
  turbidity: number;
  rayleigh: number;
  skyVisible: boolean;
  starsVisible: boolean;
  torchesLit: boolean;
  /** Visible celestial discs (sun by day, moon by night) — both ride an arc and
   *  drop below the horizon at the right hour. */
  sunVisible: boolean;
  moonVisible: boolean;
  sunDiscPos: [number, number, number];
  moonDiscPos: [number, number, number];
}

// Configurable day window (player's LOCAL hours).
const SUNRISE = 6;
const SUNSET = 19; // 7pm

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function mixColor(a: string, b: string, t: number): string {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

/**
 * Map a local hour (0..24, fractional) to a full lighting setup + the moving
 * sun/moon positions. The sun is up between SUNRISE and SUNSET, arcing east→west
 * and dropping below the horizon outside that window (so the drei <Sky> shader
 * darkens and the moon takes over). `day` ramps 0 (night) → 1 (solar noon).
 */
export function computeDayNight(hour: number): DayNight {
  const dayLen = SUNSET - SUNRISE; // hours of daylight
  const p = (hour - SUNRISE) / dayLen; // 0 at sunrise → 1 at sunset (out of range at night)
  const ang = p * Math.PI;
  const sunY = Math.sin(ang); // >0 daytime, <0 night
  const sunX = -Math.cos(ang); // east (−1) → west (+1)
  const daylight = Math.max(0, sunY);
  // Keep a visibility floor so night still reads as night, but terrain, trees and
  // silhouettes don't collapse into pure black.
  const visible = 0.32 + daylight * 0.68;

  // Moon rides its own arc across the night (sunset → sunrise).
  const nightLen = 24 - dayLen;
  const np = ((hour - SUNSET + 24) % 24) / nightLen; // 0 at sunset → 1 at sunrise
  const mAng = np * Math.PI;
  const moonY = Math.sin(mAng);
  const moonX = -Math.cos(mAng);

  return {
    sunPos: [sunX * 90, sunY * 80, -55], // drives the <Sky> shader (dark when sunY<0)
    bg: mixColor('#020304', '#a8caee', visible),
    fog: mixColor('#31435d', '#b8d0e8', visible),
    ambIntensity: mix(1.18, 1.72, visible),
    ambColor: mixColor('#b4c3e5', '#fff3e0', visible),
    hemiSky: mixColor('#6f84ac', '#d7e6ff', visible),
    hemiGround: mixColor('#4f5c45', '#93a073', visible),
    hemiIntensity: mix(1.22, 1.56, visible),
    dirPos: [sunX * 60, Math.max(18, sunY * 60), -40], // key light follows the sun; min height keeps moonlight
    dirIntensity: mix(0.45, 2.05, visible),
    dirColor: mixColor('#d3def7', '#fff1d6', visible),
    turbidity: mix(7.2, 10.8, visible),
    rayleigh: mix(0.8, 1.55, visible),
    skyVisible: sunY > -0.06,
    starsVisible: sunY < 0.05,
    torchesLit: sunY < 0.12,
    sunVisible: sunY > 0.02,
    moonVisible: sunY < -0.02 && moonY > 0,
    sunDiscPos: [sunX * 130, sunY * 95 + 6, -60],
    moonDiscPos: [moonX * 110, moonY * 70 + 8, -55],
  };
}

// ── Mobile touch controls ── drag the left zone to move (a floating joystick);
// in first person, drag the right zone to look around.
function TouchJoystick({ onChange }: { onChange: (m: MovementInput) => void }) {
  const idRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState<{ ox: number; oy: number; dx: number; dy: number } | null>(null);

  const end = () => {
    idRef.current = null;
    originRef.current = null;
    setKnob(null);
    onChange(IDLE_MOVEMENT);
  };

  return (
    <div
      className="absolute left-0 bottom-0 z-10 h-[62%] w-[58%] touch-none select-none"
      onPointerDown={(e) => {
        idRef.current = e.pointerId;
        originRef.current = { x: e.clientX, y: e.clientY };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setKnob({ ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 });
      }}
      onPointerMove={(e) => {
        const o = originRef.current;
        if (idRef.current !== e.pointerId || !o) return;
        const dx = e.clientX - o.x;
        const dy = e.clientY - o.y;
        const dead = 16;
        const m: MovementInput = { ...IDLE_MOVEMENT };
        if (dy < -dead) m.forward = true;
        if (dy > dead) m.backward = true;
        if (dx < -dead) m.left = true;
        if (dx > dead) m.right = true;
        onChange(m);
        const c = 60;
        setKnob({ ox: o.x, oy: o.y, dx: Math.max(-c, Math.min(c, dx)), dy: Math.max(-c, Math.min(c, dy)) });
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      {knob && (
        <>
          <div className="pointer-events-none fixed rounded-full border-2 border-white/25" style={{ left: knob.ox - 52, top: knob.oy - 52, width: 104, height: 104 }} />
          <div className="pointer-events-none fixed rounded-full border border-white/40 bg-white/35" style={{ left: knob.ox + knob.dx - 24, top: knob.oy + knob.dy - 24, width: 48, height: 48 }} />
        </>
      )}
    </div>
  );
}

function TouchLook({ lookRef }: { lookRef: React.MutableRefObject<{ dx: number; dy: number }> }) {
  const idRef = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });
  return (
    <div
      className="absolute right-0 top-0 z-10 h-[62%] w-[42%] touch-none select-none"
      onPointerDown={(e) => {
        idRef.current = e.pointerId;
        last.current = { x: e.clientX, y: e.clientY };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (idRef.current !== e.pointerId) return;
        lookRef.current.dx += e.clientX - last.current.x;
        lookRef.current.dy += e.clientY - last.current.y;
        last.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => {
        idRef.current = null;
      }}
      onPointerCancel={() => {
        idRef.current = null;
      }}
    />
  );
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
  const { networkType } = useNetwork();
  const { play, setLoopEnabled } = useEngramAudio();
  // Walk-around mode kicks in once the village is interactive (wallet connected
  // and memories loaded). The title screen stays cinematic.
  const explorable = interactive && !showTitle;
  // Movement + pointer lock only when not mid-dialogue and no GUI is open.
  const exploring = explorable && !active && !uiOpen;

  // Day/night driven by the player's local clock. The sun steps to a new spot
  // every 5 local minutes (:00, :05, :10 …), so over a session you see it arc.
  const quantHour = (d: Date) => d.getHours() + (Math.floor(d.getMinutes() / 5) * 5) / 60;
  const [localHour, setLocalHour] = useState(() => quantHour(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setLocalHour(quantHour(new Date())), 30000);
    return () => window.clearInterval(id);
  }, []);
  const dn = useMemo(() => computeDayNight(localHour), [localHour]);
  useEffect(() => {
    void setLoopEnabled('night_crickets', explorable && dn.torchesLit, { volume: 0.24 });
    void setLoopEnabled('campfire_crackle', explorable, { volume: dn.torchesLit ? 0.22 : 0.14 });
  }, [dn.torchesLit, explorable, setLoopEnabled]);

  const [nearby, setNearby] = useState<NPCName | null>(null);
  const [nearbyTree, setNearbyTree] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [view, setView] = useState<ViewMode>('fp');
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [touchMove, setTouchMove] = useState<MovementInput>(IDLE_MOVEMENT);
  const [buildMode, setBuildMode] = useState<BuildingType | 'demolish' | null>(null);
  // Building is aerial-only (needs the free cursor); leave it when not in aerial.
  useEffect(() => {
    if (!(exploring && view === 'aerial')) setBuildMode(null);
  }, [exploring, view]);
  const [flash, setFlash] = useState(false);
  const [playerHp, setPlayerHp] = useState(100);
  const [playerDead, setPlayerDead] = useState(false);
  const [respawnCountdown, setRespawnCountdown] = useState(5);
  const [nearbyEnemy, setNearbyEnemy] = useState<string | null>(null);
  
  const nearbyRef = useRef<NPCName | null>(null);
  nearbyRef.current = nearby;
  const nearbyTreeRef = useRef<number | null>(null);
  nearbyTreeRef.current = nearbyTree;
  const nearbyEnemyRef = useRef<string | null>(null);
  nearbyEnemyRef.current = nearbyEnemy;
  
  const world = useWorld();
  const [publishStatus, setPublishStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [buildDraftDirty, setBuildDraftDirty] = useState(false);
  const aerialDraftBaseRef = useRef(cloneWorldState());
  const fHeldRef = useRef(false); // is the chop key (F) held down
  const chopRef = useRef(0); // chop progress 0..100
  const [chopPct, setChopPct] = useState(0);

  // Shared player position (first-person camera ↔ aerial avatar).
  const posRef = useRef<PlayerPos>({ x: SPAWN_XZ[0], z: SPAWN_XZ[1], heading: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(pointer: coarse)');
    const sync = () => setIsTouchDevice(mq.matches || 'ontouchstart' in window);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  // On touch, START in aerial (easier on a phone), but only once — so the
  // player can still toggle to first person and stay there.
  const didDefaultView = useRef(false);
  useEffect(() => {
    if (explorable && isTouchDevice && !didDefaultView.current) {
      didDefaultView.current = true;
      aerialDraftBaseRef.current = cloneWorldState(getWorld());
      setBuildDraftDirty(false);
      setView('aerial');
    }
  }, [explorable, isTouchDevice]);

  useEffect(() => {
    if (exploring) return;
    setTouchMove(IDLE_MOVEMENT);
    fHeldRef.current = false;
  }, [exploring]);

  const fpExploring = exploring && view === 'fp';
  const aerialExploring = exploring && view === 'aerial';
  const controlsArmed = isTouchDevice ? exploring : locked;
  const touchLookRef = useRef({ dx: 0, dy: 0 }); // first-person look (drag) on touch
  const [buildRot, setBuildRot] = useState(0); // rotation for touch placement

  const markBuildDraftDirty = () => {
    setBuildDraftDirty(true);
    if (publishStatus !== 'saving') {
      setPublishStatus('idle');
      setPublishMsg('Unsaved changes. Save before leaving aerial view.');
    }
  };

  const switchView = useCallback(() => {
    if (view === 'fp') {
      aerialDraftBaseRef.current = cloneWorldState(getWorld());
      setBuildDraftDirty(false);
      setPublishStatus('idle');
      setPublishMsg(null);
      setView('aerial');
      return;
    }

    if (buildDraftDirty) {
      const discard = window.confirm('You have unsaved building changes. If you leave aerial view now, those changes will be discarded. Leave without saving?');
      if (!discard) return;
      void replaceWorldState(aerialDraftBaseRef.current);
      setBuildDraftDirty(false);
      setPublishStatus('idle');
      setPublishMsg('Unsaved changes discarded.');
    }
    setBuildMode(null);
    setView('fp');
  }, [buildDraftDirty, view]);

  // Touch placement: drop the building where the mobile ghost sits (in front of
  // the avatar), or demolish the nearest one.
  const placeMobileBuilding = () => {
    if (!buildMode) return;
    const p = posRef.current;
    if (buildMode === 'demolish') {
      if (demolishNearest(p.x, p.z, 3)) markBuildDraftDirty();
      return;
    }
    const [x, z] = mobileGhostXZ(p);
    if (canPlaceBuilding(buildMode, x, z) && placeBuilding({ type: buildMode, x, z, rot: buildRot }, buildCostAt(buildMode, x, z))) {
      markBuildDraftDirty();
    }
  };

  const publishWorld = async () => {
    const wallet = getWorldWallet();
    if (!wallet || publishStatus === 'saving') return;

    setPublishStatus('saving');
    setPublishMsg('Saving world...');
    try {
      const result = await writeWorldState(wallet, getWorld(), networkType);
      setPublishStatus('saved');
      setBuildDraftDirty(false);
      aerialDraftBaseRef.current = cloneWorldState(getWorld());
      setPublishMsg(result.skipped ? 'World already saved.' : `World saved (${result.rootHash.slice(0, 10)}...${result.rootHash.slice(-6)})`);
      window.setTimeout(() => {
        setPublishStatus('idle');
        setPublishMsg(null);
      }, 5000);
    } catch (error) {
      console.warn('[engram] publish world failed:', error);
      setPublishStatus('error');
      setPublishMsg((error as Error).message || 'Save failed.');
    }
  };

  // AI construction: describe → /api/build returns pieces relative to the avatar
  // → PREVIEW (ghosts) at your spot → confirm to place (pays in wood). The API
  // call costs $ (Claude), estimated and budget-capped per the player's wallet.
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiKey, setAiKey] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [aiPreview, setAiPreview] = useState<AIPiece[] | null>(null);
  const [aiOrigin, setAiOrigin] = useState<{ x: number; z: number } | null>(null);
  const [aiCost, setAiCost] = useState(0); // USD of the last generation
  const [aiBudget, setAiBudget] = useState(''); // session $ cap (persisted)
  const [aiSpent, setAiSpent] = useState(0); // cumulative $ (persisted)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setAiBudget(window.localStorage.getItem('engram:aiBudget') || '');
    setAiSpent(Number(window.localStorage.getItem('engram:aiSpent') || 0));
  }, []);
  const updateBudget = (v: string) => {
    setAiBudget(v);
    if (typeof window !== 'undefined') window.localStorage.setItem('engram:aiBudget', v);
  };
  const addSpend = (usd: number) =>
    setAiSpent((s) => {
      const n = s + usd;
      if (typeof window !== 'undefined') window.localStorage.setItem('engram:aiSpent', String(n));
      return n;
    });

  const requestAIBuild = async () => {
    if (aiBusy || !aiPrompt.trim()) return;
    const budget = parseFloat(aiBudget);
    if (Number.isFinite(budget) && budget > 0 && aiSpent >= budget) {
      setAiMsg(`Budget reached ($${aiSpent.toFixed(4)} / $${budget.toFixed(2)}). Raise it to keep building.`);
      return;
    }
    setAiBusy(true);
    setAiMsg('Designing…');
    setAiPreview(null);
    try {
      const res = await fetch('/api/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim(), apiKey: aiKey.trim() || undefined }),
      });
      const data = (await res.json()) as { buildings?: AIPiece[]; error?: string; costUsd?: number };
      if (data.error && !data.buildings) {
        setAiMsg(data.error);
        setAiBusy(false);
        return;
      }
      const cost = data.costUsd ?? 0;
      setAiCost(cost);
      addSpend(cost); // the design was generated → that API call's $ is incurred now
      const pieces = data.buildings ?? [];
      setAiOrigin({ x: posRef.current.x, z: posRef.current.z });
      setAiPreview(pieces);
      setAiMsg(`Preview ready — ${pieces.length} piece${pieces.length === 1 ? '' : 's'}.`);
    } catch {
      setAiMsg('Build request failed.');
    }
    setAiBusy(false);
  };

  // Place the previewed structure at the spot it was generated.
  const placeAIPreview = () => {
    if (!aiPreview || !aiOrigin) return;
    let placed = 0;
    let wood = 0;
    const placedNow: Building[] = [];
    for (const b of aiPreview) {
      const x = b.type === 'block' ? aiOrigin.x + b.dx : Math.round(aiOrigin.x + b.dx);
      const z = b.type === 'block' ? aiOrigin.z + b.dz : Math.round(aiOrigin.z + b.dz);
      const candidate = aiPieceToBuilding(b, x, z);
      if (canPlaceBuilding(b.type, x, z, candidate, placedNow)) {
        const cost = buildCostAt(b.type, x, z);
        if (placeBuilding(candidate, cost)) {
          placed += 1;
          wood += cost;
          placedNow.push(candidate);
        }
      }
    }
    setAiPreview(null);
    setAiOrigin(null);
    if (placed > 0) markBuildDraftDirty();
    setAiMsg(placed > 0 ? `Built ${placed} piece${placed === 1 ? '' : 's'} (−${wood}🪵).` : 'Nothing fit / not enough wood. Drive to open ground and re-generate.');
  };

  const activateNearbyNpc = () => {
    if (!nearbyRef.current) return;
    onSelect(nearbyRef.current);
  };

  const attackNearbyEnemy = () => {
    const id = nearbyEnemyRef.current;
    if (!id) return;
    const enemy = dynamicEnemyState[id];
    if (!enemy || enemy.dead) return;
    void play('attack_swing');
    enemy.hp -= 25;
    if (enemy.hp <= 0) enemy.dead = true;
    setFlash(true);
    window.setTimeout(() => setFlash(false), 80);
  };

  // V toggles first-person ↔ aerial; E talks; F is HELD to chop (handled below).
  useEffect(() => {
    if (!exploring) return;
    const onDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'KeyV') {
        switchView();
        return;
      }
      if (view !== 'fp') return; // interactions are first-person only
      if (e.code === 'KeyE' && nearbyRef.current) activateNearbyNpc();
      if (e.code === 'KeyF') fHeldRef.current = true;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyF') fHeldRef.current = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [activateNearbyNpc, buildDraftDirty, exploring, switchView, view]);

  // Chopping takes time: hold F near a tree to fill a progress bar, then it falls.
  useEffect(() => {
    if (!fpExploring) {
      chopRef.current = 0;
      setChopPct(0);
      fHeldRef.current = false;
      return;
    }
    const PER_UNIT_MS = 5000; // ~5s of holding F = 1 unit of wood
    const TICK = 80;
    const id = window.setInterval(() => {
      const tree = nearbyTreeRef.current;
      const canChop = fHeldRef.current && tree !== null && !isChopped(tree) && !woodIsFull();
      if (canChop) {
        chopRef.current = Math.min(100, chopRef.current + (TICK / PER_UNIT_MS) * 100);
        if (chopRef.current >= 100) {
          const { depleted } = harvestTree(tree!); // grant 1 unit; deplete after TREE_WOOD
          void play('axe_chop');
          chopRef.current = 0;
          if (depleted) setNearbyTree(null); // tree gone; Player repicks next frame
        }
      } else if (chopRef.current !== 0) {
        chopRef.current = 0;
      }
      setChopPct(chopRef.current); // React skips re-render when unchanged
    }, TICK);
    return () => window.clearInterval(id);
  }, [fpExploring, play]);

  // Player combat listener
  useEffect(() => {
    if (!exploring) return;
    const onMouseDown = (e: MouseEvent) => {
      // Only trigger if locked (first person) and left click
      if (document.pointerLockElement && e.button === 0 && nearbyEnemyRef.current) {
        const enemy = dynamicEnemyState[nearbyEnemyRef.current];
        if (enemy && !enemy.dead) {
          void play('attack_swing');
          enemy.hp -= 25;
          if (enemy.hp <= 0) enemy.dead = true;
          setFlash(true);
          setTimeout(() => setFlash(false), 80);
        }
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [exploring, play]);
  
  // Sync player HP to UI and handle death / respawn
  useEffect(() => {
    const interval = setInterval(() => {
      // Sync HP display
      if (dynamicPlayerState.hp !== playerHp && !dynamicPlayerState.dead) {
        setPlayerHp(Math.max(0, dynamicPlayerState.hp));
      }
      // Trigger death state
      if (dynamicPlayerState.dead && !playerDead) {
        setPlayerDead(true);
        setRespawnCountdown(5);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [playerHp, playerDead]);

  // Respawn countdown tick
  useEffect(() => {
    if (!playerDead) return;
    const tick = setInterval(() => {
      setRespawnCountdown((c) => {
        if (c <= 1) {
          // Respawn
          dynamicPlayerState.hp = dynamicPlayerState.maxHp;
          dynamicPlayerState.dead = false;
          posRef.current = { x: SPAWN_XZ[0], z: SPAWN_XZ[1], heading: 0 };
          setPlayerHp(dynamicPlayerState.maxHp);
          setPlayerDead(false);
          return 5;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [playerDead]);

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
          gl={{ antialias: true, toneMappingExposure: 1.6 }}
        >
          <color attach="background" args={[dn.bg]} />
          <fog attach="fog" args={[dn.fog, 30, 110]} />

          {/* Skydome — the sun position follows the player's local clock, so the
              drei <Sky> shader paints day, dusk and night automatically. */}
          {dn.skyVisible && (
            <Sky distance={450000} sunPosition={dn.sunPos} turbidity={dn.turbidity} rayleigh={dn.rayleigh} mieCoefficient={0.02} mieDirectionalG={0.86} />
          )}

          {/* Lighting scales with time of day: warm strong sun at noon, dim cool
              moonlight at night (the key light follows the same sun/moon arc). */}
          <ambientLight intensity={dn.ambIntensity} color={dn.ambColor} />
          <hemisphereLight args={[dn.hemiSky, dn.hemiGround, dn.hemiIntensity]} />
          <directionalLight
            position={dn.dirPos}
            intensity={dn.dirIntensity}
            color={dn.dirColor}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-near={1}
            shadow-camera-far={80}
            shadow-camera-left={-26}
            shadow-camera-right={26}
            shadow-camera-top={26}
            shadow-camera-bottom={-26}
          />
          <NightFillLight active={dn.torchesLit} />

          {dn.starsVisible && <Stars radius={80} depth={45} count={1800} factor={3.2} saturation={0} fade speed={0.5} />}
          {dn.sunVisible && <Celestial position={dn.sunDiscPos} sun />}
          {dn.moonVisible && <Celestial position={dn.moonDiscPos} />}

          {/* Cinematic rig on the title/loading screen; first-person controls
              once Aldenmoor is explorable. */}
          {!explorable && <CameraRig active={active} />}
          {/* Player stays mounted across dialogues/views (movement gated by
              `enabled`) so switching back resumes where you stood, not at spawn. */}
          {fpExploring && (
            <Player
              posRef={posRef}
              enabled={true}
              touchMove={isTouchDevice ? touchMove : undefined}
              touchLook={isTouchDevice ? touchLookRef : undefined}
              onNearbyChange={setNearby}
              onNearbyTreeChange={setNearbyTree}
              onNearbyEnemyChange={setNearbyEnemy}
              onFootstep={() => void play('footstep_grass')}
              onJump={() => void play('jump')}
              onLand={() => void play('land')}
            />
          )}
          {fpExploring && !isTouchDevice && <PointerLockControls onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />}
          {aerialExploring && (
            <>
              <AerialRig
                enabled={aerialExploring}
                posRef={posRef}
                touchMove={touchMove}
                onNearbyChange={setNearby}
                onNearbyTreeChange={setNearbyTree}
                onNearbyEnemyChange={setNearbyEnemy}
              />
              <Avatar posRef={posRef} />
              {explorable && buildMode && !isTouchDevice && <BuildController mode={buildMode} onDraftChange={markBuildDraftDirty} />}
              {explorable && buildMode && buildMode !== 'demolish' && isTouchDevice && (
                <MobileBuildGhost mode={buildMode} posRef={posRef} rot={buildRot} />
              )}
            </>
          )}
          {explorable && active && view === 'fp' && <TalkFraming active={active} />}

          <Village torchesLit={dn.torchesLit} />
          <Fireflies active={dn.torchesLit} />
          {explorable && <Buildings />}
          {explorable && aiPreview && aiOrigin && <AIPreviewGhosts pieces={aiPreview} origin={aiOrigin} />}
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
              interactive={interactive && (!explorable || isTouchDevice)}
              aerial={view === 'aerial'}
              onSelect={onSelect}
            />
          ))}
        </Canvas>
      </KeyboardControls>

      {/* Shared HUD while exploring (either view): inventory + view toggle. */}
      {exploring && (
        <>
          <div className="pointer-events-none absolute top-20 left-4 z-10 flex flex-col items-start gap-1.5 text-sm text-[#f4e8d0]">
            <span className="inline-flex items-center rounded-md bg-black/45 px-2.5 py-1" title="Wood"><WoodIcon />{world.inventory.wood}/{MAX_WOOD}</span>
            <span className="inline-flex items-center rounded-md bg-black/45 px-2.5 py-1" title="Coin"><CoinIcon />{world.inventory.coin}</span>
          </div>
          <button
            onClick={switchView}
            className="absolute top-20 right-4 z-30 rounded-md border border-[#5a4a28] bg-black/50 px-3 py-1.5 text-sm text-[#f4e8d0] hover:border-[#d6b84a]"
          >
            {view === 'fp' ? (isTouchDevice ? '🦅 Aerial' : '🦅 Aerial (V)') : isTouchDevice ? '🚶 First person' : '🚶 First person (V)'}
          </button>

          {/* Build palette (aerial only). */}
          {aerialExploring && (
            <div className="absolute top-32 right-4 z-10 flex flex-col items-end gap-1.5">
              {([
                ['wall', `🧱 Wall (${BUILD_COST.wall}+🪵)`],
                ['house', `🏠 House (${BUILD_COST.house}+🪵)`],
                ['demolish', '🧨 Demolish'],
              ] as const).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setBuildMode((cur) => (cur === m ? null : m))}
                  className="rounded-md border px-3 py-1.5 text-sm text-[#f4e8d0]"
                  style={{
                    background: buildMode === m ? 'rgba(95,150,90,0.85)' : 'rgba(0,0,0,0.5)',
                    borderColor: buildMode === m ? '#8fd06a' : '#5a4a28',
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => {
                  setBuildMode(null);
                  setAiMsg(null);
                  setAiOpen(true);
                }}
                className="rounded-md border border-[#7a6ad6] bg-black/50 px-3 py-1.5 text-sm text-[#f4e8d0] hover:border-[#b98bff]"
              >
                🤖 Build with AI
              </button>
              <button
                onClick={publishWorld}
                disabled={publishStatus === 'saving'}
                className="rounded-md border bg-black/50 px-3 py-1.5 text-sm text-[#f4e8d0] hover:border-[#70d6ff] disabled:cursor-wait disabled:opacity-70"
                style={{ borderColor: publishStatus === 'saved' ? '#8fd06a' : publishStatus === 'error' ? '#d06a5f' : '#4a8aa8' }}
              >
                {publishStatus === 'saving' ? 'Saving...' : 'Save World'}
              </button>
              <span className="max-w-[15rem] rounded bg-black/60 px-2 py-1 text-right text-xs text-[#f4e8d0]/75">
                {publishMsg ?? (buildDraftDirty ? 'Unsaved changes.' : 'Save before leaving aerial view.')}
              </span>
              {buildMode && (
                <span className="rounded bg-black/60 px-2 py-1 text-xs text-[#f4e8d0]/80">
                  {buildMode === 'demolish' ? 'Tap a building to demolish' : 'Tap ground to place · tap tool to cancel'}
                </span>
              )}
            </div>
          )}

          {/* AI build modal: describe → /api/build → place around the avatar. */}
          {aiOpen && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => !aiBusy && setAiOpen(false)}>
              <div
                className="w-full max-w-md rounded-2xl border border-[#5a4a28] bg-[rgba(20,16,10,0.97)] p-5 text-[#f4e8d0] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-lg font-bold text-[#b98bff]">🤖 Build with AI</span>
                  <span className="text-xs text-[#f4e8d0]/60">spent ${aiSpent.toFixed(4)}</span>
                </div>
                <p className="mb-3 text-xs text-[#f4e8d0]/70">
                  Describe a structure. It&apos;s built around you (drive somewhere open, outside the village
                  core). Placing costs wood — bigger ideas cost more.
                </p>
                <p className="mb-3 rounded-md border border-[#7a6ad6]/40 bg-[#2a2340]/60 px-2.5 py-1.5 text-[11px] text-[#f4e8d0]/80">
                  ⚠️ Generating a design calls the AI and <b>costs a few cents of tokens even if you Discard</b>
                  (the wood is only spent when you Place, and refunded if you don&apos;t save).
                </p>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="e.g. a small walled compound with two houses and a gate"
                  className="w-full rounded-lg border border-[#5a4a28] bg-black/40 p-2 text-sm outline-none focus:border-[#b98bff]"
                />
                <details className="mt-2 text-xs text-[#f4e8d0]/70">
                  <summary className="cursor-pointer">Use my own Anthropic key + spend limit (optional)</summary>
                  <input
                    value={aiKey}
                    onChange={(e) => setAiKey(e.target.value)}
                    type="password"
                    placeholder="sk-ant-…  (sent to the server for this request only, never stored)"
                    className="mt-2 w-full rounded-lg border border-[#5a4a28] bg-black/40 p-2 text-sm outline-none focus:border-[#b98bff]"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <span className="whitespace-nowrap">Max $ this session:</span>
                    <input
                      value={aiBudget}
                      onChange={(e) => updateBudget(e.target.value)}
                      inputMode="decimal"
                      placeholder="e.g. 0.50"
                      className="w-24 rounded-lg border border-[#5a4a28] bg-black/40 p-1.5 text-sm outline-none focus:border-[#b98bff]"
                    />
                    <span className="text-[#f4e8d0]/60">spent ${aiSpent.toFixed(4)}</span>
                  </div>
                </details>
                {aiMsg && <div className="mt-3 text-sm text-[#d6b84a]">{aiMsg}</div>}
                {aiPreview && (
                  <div className="mt-1 text-xs text-[#f4e8d0]/70">Generation cost ≈ <span className="text-[#d6b84a]">${aiCost.toFixed(4)}</span> · purple = will place, red = blocked.</div>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setAiOpen(false)} disabled={aiBusy} className="rounded-lg border border-[#5a4a28] px-4 py-2 text-sm disabled:opacity-50">
                    Close
                  </button>
                  {aiPreview ? (
                    <>
                      <button
                        onClick={() => {
                          setAiPreview(null);
                          setAiOrigin(null);
                          setAiMsg(null);
                        }}
                        className="rounded-lg border border-[#5a4a28] px-4 py-2 text-sm"
                      >
                        Discard
                      </button>
                      <button onClick={placeAIPreview} className="rounded-lg border border-[#8fd06a] bg-[#22301a] px-4 py-2 text-sm font-semibold">
                        ⬇ Place ({aiPreview.length})
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={requestAIBuild}
                      disabled={aiBusy || !aiPrompt.trim()}
                      className="rounded-lg border border-[#b98bff] bg-[#3a2d5a] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      {aiBusy ? 'Designing…' : 'Preview'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* First-person HUD (crosshair, proximity prompts, controls). */}
      {fpExploring && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <div className="h-1.5 w-1.5 rounded-full bg-white/70 shadow-[0_0_4px_rgba(0,0,0,0.8)]" />
          </div>

          {flash && <div className="absolute inset-0 pointer-events-none bg-white/20 mix-blend-overlay z-20" />}

          {/* ── Death / Respawn overlay ── */}
          {playerDead && (
            <div
              className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(80,0,0,0.75) 0%, rgba(0,0,0,0.92) 100%)',
                animation: 'fadeInDeath 0.6s ease-out both',
              }}
            >
              <style>{`
                @keyframes fadeInDeath {
                  from { opacity: 0; }
                  to   { opacity: 1; }
                }
                @keyframes pulseRed {
                  0%, 100% { text-shadow: 0 0 18px #ff2200, 0 0 40px #ff0000; }
                  50%       { text-shadow: 0 0 40px #ff4400, 0 0 80px #ff2200; }
                }
              `}</style>
              <div
                style={{
                  fontFamily: 'var(--engram-serif, serif)',
                  fontSize: 'clamp(3rem, 10vw, 6rem)',
                  fontWeight: 900,
                  letterSpacing: '0.12em',
                  color: '#cc2200',
                  animation: 'pulseRed 1.4s ease-in-out infinite',
                }}
              >
                YOU DIED
              </div>
              <div
                style={{
                  marginTop: '1.5rem',
                  color: '#f4e8d0',
                  fontSize: '1.2rem',
                  opacity: 0.85,
                  fontFamily: 'var(--engram-serif, serif)',
                  letterSpacing: '0.05em',
                }}
              >
                Respawning in{' '}
                <span style={{ color: '#ffaa44', fontWeight: 700, fontSize: '1.4rem' }}>
                  {respawnCountdown}
                </span>
                …
              </div>
            </div>
          )}
          
          <div className="absolute bottom-[4.5rem] left-4 pointer-events-none select-none drop-shadow-md z-10">
            <div className="text-white/80 text-sm mb-1 font-bold tracking-wide">HP: {Math.max(0, playerHp)}</div>
            <div className="w-40 h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
              <div className="h-full bg-red-500/90 transition-all duration-200" style={{ width: `${Math.max(0, playerHp)}%` }} />
            </div>
          </div>

          {!controlsArmed && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="rounded-full bg-black/55 px-5 py-2 text-sm text-[#f4e8d0]/90">
                Click to look around · WASD to walk · V for aerial view
              </div>
            </div>
          )}

          {controlsArmed && nearbyNpc && (
            <div className="pointer-events-none absolute bottom-28 left-1/2 z-10 -translate-x-1/2">
              <div
                className="rounded-full border px-5 py-2 text-sm font-semibold text-[#f4e8d0] shadow-lg"
                style={{ background: 'rgba(20,16,10,0.88)', borderColor: nearbyNpc.accent }}
              >
                Press <span style={{ color: nearbyNpc.accent }}>E</span> to speak with {nearbyNpc.name}
              </div>
            </div>
          )}

          {controlsArmed && !isTouchDevice && nearbyTree !== null && !nearbyNpc && (
            <div className="pointer-events-none absolute bottom-28 left-1/2 z-10 -translate-x-1/2">
              {world.inventory.wood >= MAX_WOOD ? (
                <div className="rounded-full border border-[#8a6a4a] px-5 py-2 text-sm font-semibold text-[#f4e8d0] shadow-lg" style={{ background: 'rgba(20,16,10,0.9)' }}>
                  Wood full ({MAX_WOOD}) - can&apos;t carry more
                </div>
              ) : (
                <div className="rounded-2xl border border-[#6a8a4a] px-5 py-2.5 text-center text-sm font-semibold text-[#f4e8d0] shadow-lg" style={{ background: 'rgba(16,20,10,0.9)' }}>
                  Hold <span className="text-[#8fd06a]">F</span> to chop
                  <div className="mt-1.5 h-2 w-40 overflow-hidden rounded-full bg-black/55">
                    <div className="h-full rounded-full bg-[#8fd06a] transition-[width] duration-75" style={{ width: `${chopPct}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {controlsArmed && nearbyEnemy && !nearbyNpc && !nearbyTree && (
            <div className="pointer-events-none absolute bottom-28 left-1/2 z-10 -translate-x-1/2">
              <div className="rounded-full border border-red-500/60 px-5 py-2 text-sm font-semibold text-red-100 shadow-lg" style={{ background: 'rgba(30,10,10,0.88)' }}>
                <span className="text-red-400">Left Click</span> to attack Enemy
              </div>
            </div>
          )}

          {!isTouchDevice && (
            <div className="pointer-events-none absolute bottom-4 left-4 z-10 text-xs text-[#f4e8d0]/55">
              WASD move · Space jump · Mouse look · E talk · F chop · Click attack · V aerial · Esc release cursor
            </div>
          )}
        </>
      )}

      {/* Aerial HUD. */}
      {aerialExploring && !isTouchDevice && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 text-xs text-[#f4e8d0]/60">
          WASD move (W=north) · Scroll to zoom · V back to first person
        </div>
      )}
      {isTouchDevice && exploring && (
        <>
          {/* Drag the left zone to move; in first person drag the right zone to look. */}
          <TouchJoystick onChange={setTouchMove} />
          {fpExploring && <TouchLook lookRef={touchLookRef} />}

          {/* Action buttons sit above the drag zones (higher z). */}
          <div className="absolute right-0 bottom-0 z-30 flex flex-col items-end gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {nearbyNpc && (
              <button
                onClick={activateNearbyNpc}
                className="rounded-2xl border px-4 py-3 text-sm font-semibold text-[#f4e8d0]"
                style={{ background: 'rgba(20,16,10,0.92)', borderColor: nearbyNpc.accent }}
              >
                Talk to {nearbyNpc.name}
              </button>
            )}
            {nearbyTree !== null && !nearbyNpc && (
              world.inventory.wood >= MAX_WOOD ? (
                <div className="rounded-2xl border border-[#8a6a4a] bg-[rgba(20,16,10,0.92)] px-4 py-3 text-sm font-semibold text-[#f4e8d0]">
                  Wood full ({MAX_WOOD})
                </div>
              ) : (
                <button
                  onPointerDown={() => {
                    fHeldRef.current = true;
                  }}
                  onPointerUp={() => {
                    fHeldRef.current = false;
                  }}
                  onPointerLeave={() => {
                    fHeldRef.current = false;
                  }}
                  onPointerCancel={() => {
                    fHeldRef.current = false;
                  }}
                  className="rounded-2xl border border-[#6a8a4a] bg-[rgba(16,20,10,0.92)] px-4 py-3 text-center text-sm font-semibold text-[#f4e8d0]"
                >
                  Hold to chop
                  <div className="mt-1.5 h-2 w-32 overflow-hidden rounded-full bg-black/55">
                    <div className="h-full rounded-full bg-[#8fd06a] transition-[width] duration-75" style={{ width: `${chopPct}%` }} />
                  </div>
                </button>
              )
            )}
            {nearbyEnemy && !nearbyNpc && nearbyTree === null && (
              <button
                onClick={attackNearbyEnemy}
                className="rounded-2xl border border-red-500/60 bg-[rgba(30,10,10,0.92)] px-4 py-3 text-sm font-semibold text-red-100"
              >
                Attack
              </button>
            )}
          </div>

          {/* Build controls: drive the avatar to aim the ghost, then place. */}
          {buildMode && (
            <div className="absolute bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2">
              {buildMode !== 'demolish' && (
                <button
                  onClick={() => setBuildRot((r) => (r + Math.PI / 4) % (Math.PI * 2))}
                  className="rounded-2xl border border-[#5a4a28] bg-black/70 px-4 py-3 text-sm font-semibold text-[#f4e8d0]"
                >
                  ⟳ Rotate
                </button>
              )}
              <button
                onClick={placeMobileBuilding}
                className="rounded-2xl border border-[#8fd06a] bg-[rgba(16,20,10,0.95)] px-5 py-3 text-sm font-semibold text-[#f4e8d0]"
              >
                {buildMode === 'demolish' ? '🧨 Demolish nearby' : '⬇ Place here'}
              </button>
            </div>
          )}

          {buildMode && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-center text-[11px] text-[#f4e8d0]/65">
              {buildMode === 'demolish' ? 'Move next to a building · tap Demolish' : 'Drive to aim the ghost · tap Place'}
            </div>
          )}
        </>
      )}
    </div>
  );
}
