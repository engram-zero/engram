'use client';

// ─── Engram — Aldenmoor in 3D ─────────────────────────────────────────────────
// A low-poly, night-time render of the village built with @react-three/fiber +
// @react-three/drei. This is *only* the visual layer: it receives the player's
// memories, which NPC is active, and a select callback — all game/memory/dialogue
// logic still lives in client-page.tsx. The 2D dialogue box overlays this Canvas.

import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Html, ContactShadows, Text } from '@react-three/drei';
import * as THREE from 'three';
import { NPC_LIST } from '@/lib/npcs';
import type { NPCName, NPCMemory } from '@/lib/types';

// Where each villager stands. Shared by the characters and the camera rig.
const NPC_POS: Record<NPCName, [number, number, number]> = {
  aldric: [-3.4, 0, 0.4],
  maren: [0, 0, -0.3],
  sable: [3.4, 0, 0.4],
};

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
      const [x, , z] = NPC_POS[active];
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

// ─── Scenery ──────────────────────────────────────────────────────────────────

function Cottage({
  position,
  body,
  roof,
  scale = 1,
}: {
  position: [number, number, number];
  body: string;
  roof: string;
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.6, 0]}>
        <boxGeometry args={[1.6, 1.2, 1.4]} />
        <meshStandardMaterial color={body} flatShading />
      </mesh>
      {/* Pyramid roof — a 4-sided cone. */}
      <mesh castShadow position={[0, 1.6, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.4, 0.9, 4]} />
        <meshStandardMaterial color={roof} flatShading />
      </mesh>
      {/* Warm window glow. */}
      <mesh position={[0, 0.55, 0.71]}>
        <planeGeometry args={[0.34, 0.34]} />
        <meshBasicMaterial color="#ffcf7a" />
      </mesh>
    </group>
  );
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 1, 6]} />
        <meshStandardMaterial color="#5a3f28" flatShading />
      </mesh>
      <mesh castShadow position={[0, 1.4, 0]}>
        <coneGeometry args={[0.7, 1.6, 7]} />
        <meshStandardMaterial color="#33502f" flatShading />
      </mesh>
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
    <group position={[0, 0, 2.6]}>
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

function Village() {
  return (
    <group>
      {/* Ground. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[26, 48]} />
        <meshStandardMaterial color="#3e4a32" />
      </mesh>

      <Cottage position={[-7, 0, -4]} body="#7a5a3a" roof="#8a3a2a" scale={1.1} />
      <Cottage position={[-4.5, 0, -6.5]} body="#6a4a32" roof="#7a4a2a" scale={0.95} />
      <Cottage position={[4.5, 0, -6]} body="#7a5a3a" roof="#5a3a6a" />
      <Cottage position={[7.5, 0, -3.5]} body="#6a4a32" roof="#8a3a2a" scale={1.1} />

      <Tree position={[-9, 0, 0]} scale={1.2} />
      <Tree position={[9.5, 0, -1]} scale={1.1} />
      <Tree position={[-6, 0, 3]} scale={0.9} />
      <Tree position={[6.5, 0, 3.5]} scale={1} />

      <Campfire />

      {/* Moon. */}
      <mesh position={[10, 9, -18]}>
        <sphereGeometry args={[2.4, 24, 24]} />
        <meshBasicMaterial color="#fff7e0" />
      </mesh>
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
  if (npc === 'maren') {
    // Guard captain: armoured, helmeted, holds a spear.
    return (
      <group>
        <mesh castShadow position={[0, 0.7, 0]}>
          <capsuleGeometry args={[0.42, 0.8, 4, 12]} />
          <meshStandardMaterial color="#4a5a6a" flatShading metalness={0.4} roughness={0.6} />
        </mesh>
        <mesh castShadow position={[0, 1.55, 0]}>
          <sphereGeometry args={[0.3, 12, 12]} />
          <meshStandardMaterial color="#e8c4a0" flatShading />
        </mesh>
        {/* Helmet. */}
        <mesh castShadow position={[0, 1.66, 0]}>
          <sphereGeometry args={[0.34, 12, 12, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
          <meshStandardMaterial color={accent} flatShading metalness={0.5} roughness={0.4} />
        </mesh>
        {/* Spear. */}
        <mesh position={[0.5, 1, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 2.4, 6]} />
          <meshStandardMaterial color="#6a4a2a" flatShading />
        </mesh>
        <mesh position={[0.5, 2.25, 0]}>
          <coneGeometry args={[0.09, 0.3, 6]} />
          <meshStandardMaterial color="#cdd3da" flatShading metalness={0.6} />
        </mesh>
      </group>
    );
  }

  if (npc === 'sable') {
    // Broker: slender, hooded robe, glinting eyes.
    return (
      <group>
        <mesh castShadow position={[0, 0.7, 0]}>
          <coneGeometry args={[0.55, 1.5, 10]} />
          <meshStandardMaterial color="#2a1d40" flatShading />
        </mesh>
        <mesh castShadow position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.27, 12, 12]} />
          <meshStandardMaterial color="#e8c4a0" flatShading />
        </mesh>
        {/* Hood. */}
        <mesh castShadow position={[0, 1.62, -0.02]}>
          <coneGeometry args={[0.4, 0.7, 10]} />
          <meshStandardMaterial color={accent} flatShading />
        </mesh>
        {/* Glinting eyes. */}
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

  // Aldric — merchant: round, robed, gold trim, a floating coin.
  return (
    <group>
      <mesh castShadow position={[0, 0.65, 0]}>
        <capsuleGeometry args={[0.48, 0.6, 4, 12]} />
        <meshStandardMaterial color="#7a5a2a" flatShading />
      </mesh>
      {/* Belt / trim. */}
      <mesh position={[0, 0.6, 0]}>
        <torusGeometry args={[0.49, 0.06, 8, 20]} />
        <meshStandardMaterial color={accent} flatShading metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial color="#e8c4a0" flatShading />
      </mesh>
      {/* Cap. */}
      <mesh castShadow position={[0, 1.72, 0]}>
        <cylinderGeometry args={[0.26, 0.3, 0.18, 10]} />
        <meshStandardMaterial color="#8a3a2a" flatShading />
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
  const [hovered, setHovered] = useState(false);
  const pos = NPC_POS[npc];
  const tmpScale = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const phase = pos[0] * 1.7; // stagger each villager
    const speed = talking ? 6 : 2.4;
    const amp = talking ? 0.16 : 0.11;
    // Bouncier vertical bob…
    group.current.position.y = pos[1] + Math.abs(Math.sin(t * speed + phase)) * amp;
    // …plus a gentle side-to-side sway and lean so they feel alive.
    group.current.rotation.y = Math.sin(t * 0.9 + phase) * 0.16;
    group.current.rotation.z = Math.sin(t * 1.5 + phase) * 0.05;
    const target = active ? 1.14 : hovered ? 1.07 : 1;
    tmpScale.set(target, target, target);
    group.current.scale.lerp(tmpScale, 0.12);
  });

  const canClick = interactive && !dim && !active;

  return (
    <group ref={group} position={pos}>
      {/* Invisible hit target — generous, so the whole figure is clickable. */}
      <mesh
        position={[0, 1, 0]}
        visible={false}
        onPointerOver={(e) => {
          if (!canClick) return;
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
        onClick={(e) => {
          if (!canClick) return;
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
        <div style={{ textAlign: 'center', fontFamily: 'var(--engram-serif, serif)', color: '#f4e8d0', textShadow: '0 2px 6px #000', userSelect: 'none', width: 120 }}>
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
}

export default function Scene3D({ memories = null, active = null, talking = false, onSelect = () => {}, interactive = true, showTitle = false }: Scene3DProps) {
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 3.1, 9], fov: 50 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#0f1320']} />
        <fog attach="fog" args={['#0f1320', 12, 30]} />

        {/* Moonlight + soft ambient + cool fill. */}
        <ambientLight intensity={0.35} color="#9fb3d6" />
        <directionalLight
          position={[10, 12, -8]}
          intensity={1.1}
          color="#cdd9ff"
          castShadow
          shadow-mapSize={[1024, 1024]}
        />

        <Stars radius={60} depth={40} count={1500} factor={3} saturation={0} fade speed={0.5} />

        <CameraRig active={active} />
        <Village />
        {showTitle && <FloatingTitle />}

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
            interactive={interactive}
            onSelect={onSelect}
          />
        ))}
      </Canvas>
    </div>
  );
}
