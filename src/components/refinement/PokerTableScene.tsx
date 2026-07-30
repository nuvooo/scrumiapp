"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, RoundedBox, Text } from "@react-three/drei";
import type { Group } from "three";

export interface SceneParticipant {
  name: string;
  isAdmin: boolean;
  voted: boolean;
  /** Offener Wert nach dem Aufdecken (null = „?", undefined = noch verdeckt). */
  revealedPoints?: number | null;
}

/** Pastellige Clay-Farben wie im Referenzbild. */
const CLAY_COLORS = ["#a8c8a1", "#b3a4d6", "#7b9bd6", "#dccdaa", "#dfa48f", "#9fc4cf", "#d6a4c0", "#c0c8a0"];
const TABLE_RADIUS = 2.3;

function label(points: number | null | undefined): string {
  if (points === null) return "?";
  if (points === undefined) return "";
  return Number.isInteger(points) ? String(points) : String(points).replace(".", ",");
}

/** Clay-Figur: Kapsel-Körper, Kugel-Kopf, Ärmchen — sitzt auf einem simplen Stuhl. */
function Figure({ color, angle, isAdmin, name }: { color: string; angle: number; isAdmin: boolean; name: string }) {
  const r = TABLE_RADIUS + 0.55;
  const x = Math.sin(angle) * r;
  const z = -Math.cos(angle) * r;
  return (
    <group position={[x, 0, z]} rotation={[0, -angle + Math.PI, 0]}>
      {/* Stuhl */}
      <RoundedBox args={[0.62, 0.09, 0.6]} radius={0.04} position={[0, 0.48, -0.28]}>
        <meshStandardMaterial color="#cfd4dc" roughness={1} />
      </RoundedBox>
      <RoundedBox args={[0.62, 0.75, 0.09]} radius={0.04} position={[0, 0.9, -0.56]}>
        <meshStandardMaterial color="#cfd4dc" roughness={1} />
      </RoundedBox>
      {[-0.24, 0.24].map((ox) => (
        <mesh key={ox} position={[ox, 0.22, -0.28]}>
          <cylinderGeometry args={[0.035, 0.035, 0.46, 12]} />
          <meshStandardMaterial color="#b9861f" roughness={1} />
        </mesh>
      ))}
      {/* Körper */}
      <mesh position={[0, 0.86, -0.24]}>
        <capsuleGeometry args={[0.21, 0.34, 8, 20]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      {/* Arme zum Tisch */}
      {[-0.2, 0.2].map((ox) => (
        <mesh key={ox} position={[ox, 0.92, -0.02]} rotation={[1.15, 0, ox > 0 ? -0.35 : 0.35]}>
          <capsuleGeometry args={[0.065, 0.3, 6, 12]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      ))}
      {/* Kopf */}
      <mesh position={[0, 1.42, -0.26]}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      {/* Namensschild */}
      <Billboard position={[0, 1.85, -0.26]}>
        <Text fontSize={0.14} color="#3a404d" outlineWidth={0.008} outlineColor="#ffffff">
          {isAdmin ? `★ ${name}` : name}
        </Text>
      </Billboard>
      {isAdmin && (
        <group position={[0, 0.78, 0.34]} rotation={[-0.5, 0, 0]}>
          <RoundedBox args={[0.72, 0.2, 0.03]} radius={0.02}>
            <meshStandardMaterial color="#ffffff" roughness={0.9} />
          </RoundedBox>
          <Text position={[0, 0, 0.02]} fontSize={0.085} color="#3a404d">
            MODERATOR
          </Text>
        </group>
      )}
    </group>
  );
}

/**
 * Gespielte Karte in der Tischmitte: fliegt beim Abstimmen ein und dreht sich
 * beim Aufdecken vom Rücken auf die Wertseite.
 */
function PlayedCard({ angle, voted, revealed, points }: { angle: number; voted: boolean; revealed: boolean; points: number | null | undefined }) {
  const group = useRef<Group>(null);
  const r = 0.85;
  const x = Math.sin(angle) * r;
  const z = -Math.cos(angle) * r;

  useFrame((_, delta) => {
    if (!group.current) return;
    const targetFlip = revealed ? Math.PI : 0;
    const targetScale = voted ? 1 : 0.001;
    group.current.rotation.z += (targetFlip - group.current.rotation.z) * Math.min(1, delta * 6);
    const s = group.current.scale.x + (targetScale - group.current.scale.x) * Math.min(1, delta * 8);
    group.current.scale.setScalar(s);
  });

  return (
    <group position={[x, 1.06, z]} rotation={[0, -angle, 0]}>
      <group ref={group} scale={0.001}>
        {/* Rücken (oben, solange verdeckt) */}
        <RoundedBox args={[0.34, 0.02, 0.5]} radius={0.015}>
          <meshStandardMaterial color="#6e8ff6" roughness={0.7} />
        </RoundedBox>
        {/* Wertseite (zeigt nach unten, bis die Karte gedreht ist) */}
        <group rotation={[0, 0, Math.PI]}>
          <RoundedBox args={[0.34, 0.02, 0.5]} radius={0.015} position={[0, 0.011, 0]}>
            <meshStandardMaterial color="#f4f6fa" roughness={0.85} />
          </RoundedBox>
          <Text position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.2} color="#31415f" fontWeight={700}>
            {label(points)}
          </Text>
        </group>
      </group>
    </group>
  );
}

function TableAndRoom() {
  return (
    <group>
      {/* Boden */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[14, 48]} />
        <meshStandardMaterial color="#e8e6e2" roughness={1} />
      </mesh>
      {/* Tischplatte + Fuß */}
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, 0.12, 64]} />
        <meshStandardMaterial color="#e5cfa5" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.97, 0]}>
        <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, 0.05, 64]} />
        <meshStandardMaterial color="#d9bd8c" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.32, 0.44, 0.95, 32]} />
        <meshStandardMaterial color="#d9bd8c" roughness={0.9} />
      </mesh>
    </group>
  );
}

/**
 * Der Pokertisch als three.js-Szene (Ego-Perspektive): Clay-Figuren der
 * anderen Teilnehmer sitzen um den Tisch, die gespielten Karten liegen im
 * Kreis in der Mitte und drehen sich beim Aufdecken um.
 */
export function PokerTableScene({
  participants,
  revealed,
  youName,
}: {
  participants: SceneParticipant[];
  revealed: boolean;
  /** Eigener Name — die eigene Figur wird nicht gerendert (Ego-Perspektive). */
  youName: string | null;
}) {
  // Stabile Sitzordnung: alle außer dir im Bogen auf der gegenüberliegenden Seite.
  const seats = useMemo(() => {
    const others = participants.filter((p) => p.name !== youName);
    const you = participants.find((p) => p.name === youName) ?? null;
    const spread = Math.min(Math.PI * 1.25, others.length * 0.55);
    return {
      others: others.map((p, i) => ({
        participant: p,
        angle: others.length === 1 ? 0 : -spread / 2 + (spread * i) / (others.length - 1),
      })),
      you,
    };
  }, [participants, youName]);

  return (
    <Canvas
      camera={{ position: [0, 2.35, 4.1], fov: 42 }}
      onCreated={({ camera }) => camera.lookAt(0, 1.05, 0)}
      style={{ touchAction: "pan-y" }}
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 8, 5]} intensity={1.4} />
      <directionalLight position={[-5, 6, -3]} intensity={0.5} />
      <TableAndRoom />
      {seats.others.map(({ participant, angle }, i) => (
        <group key={participant.name}>
          <Figure
            color={CLAY_COLORS[i % CLAY_COLORS.length]}
            angle={angle}
            isAdmin={participant.isAdmin}
            name={participant.name}
          />
          <PlayedCard angle={angle} voted={participant.voted} revealed={revealed} points={participant.revealedPoints} />
        </group>
      ))}
      {/* Die eigene gespielte Karte liegt vor dir am nahen Tischrand. */}
      {seats.you && (
        <PlayedCard angle={Math.PI} voted={seats.you.voted} revealed={revealed} points={seats.you.revealedPoints} />
      )}
    </Canvas>
  );
}
