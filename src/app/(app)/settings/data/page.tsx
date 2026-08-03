import { BackupPanel } from "@/components/BackupPanel";

export const dynamic = "force-dynamic";

export default function DataPage() {
  return (
    <div>
      <h1 className="text-[29px] font-semibold tracking-[-0.028em]">Daten</h1>
      <div className="mt-[7px] text-[13px] text-muted">
        Datenbestand als Backup exportieren oder aus einer Backup-Datei wiederherstellen
      </div>
      <BackupPanel />
    </div>
  );
}
