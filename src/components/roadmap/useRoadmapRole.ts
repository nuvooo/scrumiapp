"use client";

import { useEffect, useState } from "react";
import { storedProfile, onProfileSaved } from "@/components/ProfileDock";

/**
 * Ob der aktuelle Nutzer laut Profil Roadmap-Moderator ist. Startet als `false`
 * (Server- und erster Client-Render stimmen überein — kein Hydration-Mismatch)
 * und schaltet nach dem Mount auf den localStorage-Wert um. Reagiert live auf
 * Profil-Speicherungen aus dem ProfileDock.
 */
export function useIsRoadmapModerator(): boolean {
  const [isModerator, setIsModerator] = useState(false);
  useEffect(() => {
    const read = () => setIsModerator(storedProfile().roadmapRole === "moderator");
    read();
    return onProfileSaved(read);
  }, []);
  return isModerator;
}
