"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, Hud, PerspectiveCamera, RoundedBox, Text, useCursor } from "@react-three/drei";
import type { Group } from "three";

export interface SceneParticipant {
  name: string;
  isAdmin: boolean;
  voted: boolean;
  /** Offener Wert nach dem Aufdecken (null = „?", undefined = noch verdeckt). */
  revealedPoints?: number | null;
}

export interface SceneHand {
  /** Kartenwerte der eigenen Hand (null = „?"). */
  cards: (number | null)[];
  /** Eigene Wahl (undefined = noch keine, null = „?"). */
  selected?: number | null;
  hasSelection: boolean;
  onPick: (points: number | null) => void;
}

/** Pastellige Clay-Farben wie im Referenzbild. */
const CLAY_COLORS = ["#a8c8a1", "#b3a4d6", "#7b9bd6", "#dccdaa", "#dfa48f", "#9fc4cf", "#d6a4c0", "#c0c8a0"];
const TABLE_RADIUS = 2.3;

function label(points: number | null | undefined): string {
  if (points === null) return "?";
  if (points === undefined) return "";
  return Number.isInteger(points) ? String(points) : String(points).replace(".", ",");
}

/**
 * Die in der Hand gehaltene Karte: wächst beim Abstimmen ein, Rückseite zum
 * Tisch; beim Aufdecken dreht sie sich um und zeigt den Wert.
 */
function HeldCard({ voted, revealed, points }: { voted: boolean; revealed: boolean; points: number | null | undefined }) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    const targetFlip = revealed ? Math.PI : 0;
    const targetScale = voted ? 1 : 0.001;
    group.current.rotation.y += (targetFlip - group.current.rotation.y) * Math.min(1, delta * 6);
    const s = group.current.scale.x + (targetScale - group.current.scale.x) * Math.min(1, delta * 8);
    group.current.scale.setScalar(s);
  });
  return (
    <group position={[0, 1.32, 0.36]} rotation={[-0.15, 0, 0]}>
      <group ref={group} scale={0.001}>
        {/* Rückseite zeigt zum Tisch (und damit zur Kamera) */}
        <RoundedBox args={[0.34, 0.5, 0.02]} radius={0.015}>
          <meshStandardMaterial color="#6e8ff6" roughness={0.7} />
        </RoundedBox>
        {/* Wertseite zeigt zur Figur, bis die Karte gedreht ist */}
        <group rotation={[0, Math.PI, 0]}>
          <RoundedBox args={[0.34, 0.5, 0.02]} radius={0.015} position={[0, 0, 0.011]}>
            <meshStandardMaterial color="#f4f6fa" roughness={0.85} />
          </RoundedBox>
          <Text position={[0, 0, 0.025]} fontSize={0.2} color="#31415f" fontWeight={700}>
            {label(points)}
          </Text>
        </group>
      </group>
    </group>
  );
}

/**
 * Clay-Figur auf einem Stuhl, Blick zum Tisch (lokal +z zeigt zur Tischmitte):
 * Kapsel-Körper, Kugel-Kopf, Arme mit Kugel-Händen. In den Händen liegt vor
 * der Abstimmung ein kleiner Kartenfächer, danach die gespielte Karte.
 */
function Figure({
  color,
  angle,
  name,
  voted,
  revealed,
  points,
  cardsInHand = true,
}: {
  color: string;
  angle: number;
  name: string;
  voted: boolean;
  revealed: boolean;
  points: number | null | undefined;
  /** false (Draufsicht): Karte liegt auf dem Tisch statt in den Händen. */
  cardsInHand?: boolean;
}) {
  const r = TABLE_RADIUS + 0.62;
  const x = Math.sin(angle) * r;
  const z = -Math.cos(angle) * r;
  return (
    <group position={[x, 0, z]} rotation={[0, -angle, 0]}>
      {/* Stuhl: Sitzfläche, Lehne (vom Tisch abgewandt), Holzbeine */}
      <RoundedBox args={[0.62, 0.09, 0.6]} radius={0.04} position={[0, 0.48, -0.1]}>
        <meshStandardMaterial color="#cfd4dc" roughness={1} />
      </RoundedBox>
      <RoundedBox args={[0.62, 0.78, 0.09]} radius={0.04} position={[0, 0.9, -0.38]}>
        <meshStandardMaterial color="#cfd4dc" roughness={1} />
      </RoundedBox>
      {[[-0.24, 0.1], [0.24, 0.1], [-0.24, -0.3], [0.24, -0.3]].map(([ox, oz]) => (
        <mesh key={`${ox}:${oz}`} position={[ox, 0.22, oz]}>
          <cylinderGeometry args={[0.032, 0.032, 0.46, 12]} />
          <meshStandardMaterial color="#c9a86b" roughness={1} />
        </mesh>
      ))}
      {/* Körper */}
      <mesh position={[0, 0.88, -0.08]}>
        <capsuleGeometry args={[0.22, 0.36, 8, 20]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      {/* Oberarme: von der Schulter schräg nach vorn-unten zum Tisch */}
      {[-0.22, 0.22].map((ox) => (
        <mesh key={ox} position={[ox, 1.0, 0.12]} rotation={[0.9, 0, ox > 0 ? -0.3 : 0.3]}>
          <capsuleGeometry args={[0.06, 0.3, 6, 12]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      ))}
      {/* Hände auf der Tischkante */}
      {[-0.15, 0.15].map((ox) => (
        <mesh key={ox} position={[ox, 1.12, 0.3]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      ))}
      {/* Kartenfächer zwischen den Händen, bis eine Karte gespielt ist */}
      {cardsInHand && !voted && (
        <group position={[0, 1.22, 0.3]} rotation={[-0.35, 0, 0]}>
          {[-1, 0, 1].map((i) => (
            <RoundedBox key={i} args={[0.16, 0.24, 0.012]} radius={0.01} position={[i * 0.07, 0.02, i * 0.006]} rotation={[0, 0, -i * 0.25]}>
              <meshStandardMaterial color="#6e8ff6" roughness={0.7} />
            </RoundedBox>
          ))}
        </group>
      )}
      {/* Die gespielte Karte in den Händen */}
      {cardsInHand && <HeldCard voted={voted} revealed={revealed} points={points} />}
      {/* Kopf */}
      <mesh position={[0, 1.46, -0.1]}>
        <sphereGeometry args={[0.23, 24, 24]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      {/* Namensschild */}
      <Billboard position={[0, 1.9, -0.1]}>
        <Text fontSize={0.14} color="#3a404d" outlineWidth={0.008} outlineColor="#ffffff">
          {name}
        </Text>
      </Billboard>
    </group>
  );
}

/**
 * Gespielte Karte in der Tischmitte: fliegt beim Abstimmen ein und dreht sich
 * beim Aufdecken vom Rücken auf die Wertseite.
 */
function PlayedCard({ angle, voted, revealed, points, radius = 0.85 }: { angle: number; voted: boolean; revealed: boolean; points: number | null | undefined; radius?: number }) {
  const group = useRef<Group>(null);
  const x = Math.sin(angle) * radius;
  const z = -Math.cos(angle) * radius;

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

/** Eine klickbare Karte im Fächer (HUD-Raum): Position/Drehung um den Drehpunkt. */
function HandCard({
  value,
  theta,
  zIndex,
  selected,
  onPick,
}: {
  value: number | null;
  /** Fächerwinkel der Karte (0 = Mitte). */
  theta: number;
  zIndex: number;
  selected: boolean;
  onPick: (points: number | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  // Karten drehen sich um einen gemeinsamen Punkt unterhalb der Hand —
  // dadurch entsteht der echte Fächer wie im Referenzbild.
  const R = 1.15;
  const lift = selected ? 0.22 : hovered ? 0.1 : 0;
  const x = Math.sin(theta) * (R + lift);
  const y = Math.cos(theta) * (R + lift) - R;
  return (
    <group
      position={[x, y, zIndex * 0.012]}
      rotation={[0, 0, -theta]}
      onClick={(e) => {
        e.stopPropagation();
        onPick(value);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <RoundedBox args={[0.46, 0.68, 0.025]} radius={0.02}>
        <meshStandardMaterial color={selected ? "#6e8ff6" : hovered ? "#ffffff" : "#f4f6fa"} roughness={0.85} />
      </RoundedBox>
      {/* Wert oben links wie bei echten Spielkarten, plus groß in der Mitte */}
      <Text position={[0, 0.06, 0.02]} fontSize={0.22} color={selected ? "#10131b" : "#31415f"} fontWeight={700}>
        {value === null ? "?" : Number.isInteger(value) ? String(value) : String(value).replace(".", ",")}
      </Text>
    </group>
  );
}

/**
 * Die eigene Hand als HUD-Overlay in Ego-Perspektive (eigene Kamera und
 * Beleuchtung, immer lesbar über der Tisch-Szene). Zwei Hände greifen den
 * Fächer von unten in der Mitte — Finger vor den Karten, Ärmel laufen
 * unten aus dem Bild, wie im Referenzbild.
 */
function FirstPersonHand({ hand }: { hand: SceneHand }) {
  const n = hand.cards.length;
  const maxTheta = 0.62;
  return (
    <Hud renderPriority={1}>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={40} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[2, 4, 5]} intensity={0.9} />
      <group position={[0, -1.28, 0]} rotation={[0.12, 0, 0]}>
        {hand.cards.map((value, i) => (
          <HandCard
            key={value === null ? "?" : value}
            value={value}
            theta={n === 1 ? 0 : -maxTheta + (2 * maxTheta * i) / (n - 1)}
            zIndex={i}
            selected={hand.hasSelection && hand.selected === value}
            onPick={hand.onPick}
          />
        ))}
        {/* Zwei Hände greifen den Fächer unten in der Mitte */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.3, -0.42, 0]}>
            {/* Handballen hinter den Karten */}
            <mesh position={[0, -0.06, -0.03]}>
              <sphereGeometry args={[0.17, 20, 20]} />
              <meshStandardMaterial color="#e8b08c" roughness={1} />
            </mesh>
            {/* Finger greifen VOR die Karten */}
            {[0, 1, 2].map((f) => (
              <mesh
                key={f}
                position={[side * (0.02 + f * 0.09), 0.1 - f * 0.02, 0.12]}
                rotation={[0, 0, side * (-0.25 - f * 0.18)]}
              >
                <capsuleGeometry args={[0.045, 0.16, 6, 12]} />
                <meshStandardMaterial color="#e8b08c" roughness={1} />
              </mesh>
            ))}
            {/* Daumen von innen */}
            <mesh position={[side * -0.1, 0.04, 0.12]} rotation={[0, 0, side * 0.5]}>
              <capsuleGeometry args={[0.05, 0.14, 6, 12]} />
              <meshStandardMaterial color="#e8b08c" roughness={1} />
            </mesh>
            {/* Ärmel-Unterarm läuft schräg nach unten aus dem Bild */}
            <mesh position={[side * 0.42, -0.62, -0.05]} rotation={[0, 0, side * -0.55]}>
              <capsuleGeometry args={[0.16, 0.7, 8, 16]} />
              <meshStandardMaterial color="#e6e2dc" roughness={1} />
            </mesh>
          </group>
        ))}
      </group>
    </Hud>
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
      {/* Tischplatte mit Kante */}
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, 0.12, 64]} />
        <meshStandardMaterial color="#e5cfa5" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.93, 0]}>
        <cylinderGeometry args={[TABLE_RADIUS - 0.02, TABLE_RADIUS - 0.06, 0.04, 64]} />
        <meshStandardMaterial color="#d9bd8c" roughness={0.9} />
      </mesh>
      {/* Vier schräg gestellte Holzbeine */}
      {[Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4].map((a) => (
        <mesh
          key={a}
          position={[Math.sin(a) * (TABLE_RADIUS - 0.55), 0.47, -Math.cos(a) * (TABLE_RADIUS - 0.55)]}
          rotation={[Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12]}
        >
          <cylinderGeometry args={[0.055, 0.075, 0.96, 16]} />
          <meshStandardMaterial color="#c9a86b" roughness={0.95} />
        </mesh>
      ))}
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
  hand,
  viewpoint = "first-person",
}: {
  participants: SceneParticipant[];
  revealed: boolean;
  /** Eigener Name — in der Ego-Perspektive wird die eigene Figur nicht gerendert. */
  youName: string | null;
  /** Eigene Kartenhand (null = gerade nicht wählbar, z. B. nach dem Aufdecken). */
  hand: SceneHand | null;
  /** Teilnehmer sitzen am Tisch (first-person), der Moderator schaut von oben (top). */
  viewpoint?: "first-person" | "top";
}) {
  const top = viewpoint === "top";

  // Am Tisch sitzen nur die Schätzenden — Moderatoren stehen daneben.
  // Ego-Perspektive: alle anderen im Bogen gegenüber; Draufsicht: alle rundum.
  const seats = useMemo(() => {
    const seated = participants.filter((p) => !p.isAdmin);
    if (top) {
      return {
        others: seated.map((p, i) => ({
          participant: p,
          angle: Math.PI + (2 * Math.PI * i) / seated.length,
        })),
        you: null,
      };
    }
    const others = seated.filter((p) => p.name !== youName);
    const you = seated.find((p) => p.name === youName) ?? null;
    const spread = Math.min(Math.PI * 1.25, others.length * 0.55);
    return {
      others: others.map((p, i) => ({
        participant: p,
        angle: others.length === 1 ? 0 : -spread / 2 + (spread * i) / (others.length - 1),
      })),
      you,
    };
  }, [participants, youName, top]);

  return (
    <Canvas
      // Draufsicht bewusst schräg (~65°), damit die Szene räumlich bleibt.
      camera={{ position: top ? [0, 7.1, 3.1] : [0, 2.15, 4.35], fov: top ? 40 : 44 }}
      onCreated={({ camera }) => camera.lookAt(0, top ? 0.9 : 0.95, 0)}
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
            name={participant.name}
            voted={participant.voted}
            revealed={revealed}
            points={participant.revealedPoints}
            cardsInHand={!top}
          />
          {/* Draufsicht: die verdeckt gelegte Karte liegt vor jedem Platz auf dem Tisch */}
          {top && (
            <PlayedCard
              angle={angle}
              voted={participant.voted}
              revealed={revealed}
              points={participant.revealedPoints}
              radius={1.55}
            />
          )}
        </group>
      ))}
      {/* Ego-Perspektive: die eigene gespielte Karte liegt vor dir am Tischrand … */}
      {seats.you && (
        <PlayedCard angle={Math.PI} voted={seats.you.voted} revealed={revealed} points={seats.you.revealedPoints} radius={1.45} />
      )}
      {/* … und die eigene Hand hältst du vor dir (HUD, immer im Vordergrund). */}
      {!top && hand && <FirstPersonHand hand={hand} />}
    </Canvas>
  );
}
