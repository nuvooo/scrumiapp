"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Anmeldung fehlgeschlagen");
      }
    } catch {
      setError("Server nicht erreichbar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-[360px] p-[22px]">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Scrumi</h1>
        <p className="mt-1 text-[13px] text-muted">Bitte melde dich an</p>
        <label className="mono-label mb-[7px] mt-5 block" htmlFor="password">
          Passwort
        </label>
        <input
          id="password"
          type="password"
          autoFocus
          className="input-field w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="mt-2.5 text-[13px] text-red-400">{error}</p>}
        <button type="submit" className="btn-primary mt-4 w-full px-4 py-2.5" disabled={busy}>
          {busy ? "Anmelden…" : "Anmelden"}
        </button>
      </form>
    </div>
  );
}
