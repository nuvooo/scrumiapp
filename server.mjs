/**
 * Custom-Server: Next.js plus echter WebSocket für die Refinement-Räume.
 *
 * Next-Route-Handler können keine WebSocket-Upgrades annehmen — deshalb läuft
 * die App über diesen kleinen Server. Der Socket ist ein reiner
 * Benachrichtigungskanal: bei jeder Änderung (Vote, Aufdecken, Wurf, …) ruft
 * bumpRefinement() den hier registrierten globalThis-Hook auf und alle
 * verbundenen Clients des Raums bekommen "changed" gepusht; den eigentlichen
 * Zustand holen sie dann per GET /api/refinement/[id]/state.
 *
 * Die Verbindung ist außerdem der Anwesenheits-Heartbeat: solange der Socket
 * offen ist, wird lastSeenAt aktualisiert; beim Trennen wird es geleert, damit
 * die Person sofort vom Tisch verschwindet.
 *
 * Start: `node server.mjs` (Dev) bzw. `node server.mjs --prod` nach `next build`.
 */

const prod = process.argv.includes("--prod");
process.env.NODE_ENV = prod ? "production" : process.env.NODE_ENV ?? "development";

const { createServer } = await import("http");
const { parse } = await import("url");
const { default: next } = await import("next");
const { WebSocketServer } = await import("ws");
const { PrismaClient } = await import("@prisma/client");

const port = Number(process.env.PORT ?? 3000);
const app = next({ dev: !prod });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

/** refinementId -> offene Sockets in diesem Raum */
const rooms = new Map();

function broadcast(refinementId) {
  const sockets = rooms.get(refinementId);
  if (!sockets) return;
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) ws.send("changed");
  }
}

// Hook für bumpRefinement() aus dem Next-Code (gleicher Prozess, gleiche globalThis).
globalThis.scrumiRefinementNotify = broadcast;

const HEARTBEAT_MS = 5000;

await app.prepare();
// Erst nach prepare() verfügbar — reicht Nexts eigene Sockets (HMR) durch.
const upgrade = app.getUpgradeHandler();

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", async (ws, req) => {
  const { query } = parse(req.url ?? "", true);
  const refinementId = String(query.id ?? "");
  const token = String(query.token ?? "");
  if (!refinementId) return ws.close();

  const sockets = rooms.get(refinementId) ?? new Set();
  sockets.add(ws);
  rooms.set(refinementId, sockets);

  // Anwesenheit: Teilnehmer über sein Geräte-Token erkennen und regelmäßig
  // als „da" markieren, solange die Verbindung steht.
  let participant = null;
  try {
    const found = token ? await prisma.refinementParticipant.findUnique({ where: { token } }) : null;
    if (found && found.refinementId === refinementId) participant = found;
  } catch {
    // DB kurz nicht erreichbar — Verbindung trotzdem halten, nur ohne Heartbeat.
  }

  const beat = () =>
    participant &&
    prisma.refinementParticipant
      .update({ where: { id: participant.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  await beat();
  if (participant) broadcast(refinementId);
  const timer = setInterval(beat, HEARTBEAT_MS);

  ws.on("close", async () => {
    sockets.delete(ws);
    clearInterval(timer);
    if (participant) {
      // Sofort als abwesend markieren — der Sitz räumt sich ohne Timeout.
      await prisma.refinementParticipant
        .update({ where: { id: participant.id }, data: { lastSeenAt: null } })
        .catch(() => {});
      broadcast(refinementId);
    }
  });
});

const server = createServer((req, res) => handle(req, res, parse(req.url ?? "", true)));

server.on("upgrade", (req, socket, head) => {
  const { pathname } = parse(req.url ?? "", true);
  if (pathname === "/ws/refinement") {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else {
    // Nexts eigene Sockets (HMR im Dev-Modus) weiterreichen
    upgrade(req, socket, head);
  }
});

server.listen(port, () => {
  console.log(`scrumiapp läuft auf http://localhost:${port} (${prod ? "production" : "dev"}, WebSocket aktiv)`);
});
