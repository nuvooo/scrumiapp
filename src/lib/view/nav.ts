/** Navigationsstruktur — gemeinsame Quelle für Sidebar (Desktop) und MobileNav. */
export const NAV_GROUPS = [
  {
    title: "Analyse",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/standup", label: "Standup" },
      { href: "/planning", label: "Planning" },
      { href: "/refinement", label: "Refinement" },
      { href: "/retro", label: "Retro" },
      { href: "/burndown", label: "Burndown" },
      { href: "/velocity", label: "Velocity" },
      { href: "/capacity", label: "Kapazität" },
      { href: "/report", label: "Report" },
    ],
  },
  {
    title: "Verwaltung",
    items: [
      { href: "/settings/teams", label: "Teams / Jira" },
      { href: "/settings/data", label: "Daten" },
    ],
  },
] as const;
