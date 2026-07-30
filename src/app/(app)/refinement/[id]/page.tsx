import { RefinementRoom } from "@/components/refinement/RefinementRoom";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RefinementSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exists = await prisma.refinement.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    return <p className="text-muted">Dieses Refinement gibt es nicht (mehr).</p>;
  }
  return <RefinementRoom refinementId={id} />;
}
