import { RetroRoom } from "@/components/retro/RetroRoom";

export const dynamic = "force-dynamic";

export default async function RetroDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RetroRoom retroId={id} />;
}
