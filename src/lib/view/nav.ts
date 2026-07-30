/** Navigationsstruktur — gemeinsame Quelle für Sidebar (Desktop) und MobileNav. */
export const NAV_GROUPS = [
  {
    title: "Analyse",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/standup", label: "Standup" },
      { href: "/burndown", label: "Burndown" },
      { href: "/velocity", label: "Velocity" },
      { href: "/capacity", label: "Kapazität" },
    ],
  },
  {
    title: "Verwaltung",
    items: [{ href: "/settings/teams", label: "Teams / Jira" }],
  },
] as const;
