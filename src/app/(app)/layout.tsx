import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { ProfileDock } from "@/components/ProfileDock";

function jiraHostFromEnv(): string | null {
  const base = process.env.JIRA_BASE_URL;
  if (!base) return null;
  try {
    return new URL(base).host;
  } catch {
    return base;
  }
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar jiraHost={jiraHostFromEnv()} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Nur mobil: Desktop navigiert über die Sidebar. Team/Sprint-Auswahl
            und Jira-Sync liegen unter Verwaltung (Teams / Jira bzw. Daten). */}
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-[rgba(8,11,17,0.66)] px-4 py-3.5 backdrop-blur-xl lg:hidden">
          <MobileNav jiraHost={jiraHostFromEnv()} />
          <div className="text-base font-semibold tracking-[-0.01em]">Scrumi</div>
        </header>
        <main className="max-w-[1320px] flex-1 px-4 pb-10 pt-5 lg:px-[34px] lg:pb-[60px] lg:pt-[34px]">{children}</main>
      </div>
      {/* Profil immer unten links sichtbar (dockt in der Sidebar an) */}
      <ProfileDock />
    </div>
  );
}
