export function KpiCard({
  label,
  value,
  unit,
  hint,
  monoHint = false,
  size = "lg",
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  monoHint?: boolean;
  size?: "lg" | "md";
}) {
  return (
    <div className={`card ${size === "lg" ? "px-[18px] pb-4 pt-[18px]" : "p-[18px]"}`}>
      <div className="mono-label">{label}</div>
      <div
        className={`font-semibold leading-none ${
          size === "lg" ? "mt-3 text-[41px] tracking-[-0.038em]" : "mt-2.5 text-[34px] tracking-[-0.035em]"
        }`}
      >
        {value}
        {unit && <span className={`ml-[5px] font-medium text-dim ${size === "lg" ? "text-base" : "text-[15px]"}`}>{unit}</span>}
      </div>
      {hint && <div className={`mt-2 text-xs text-dim ${monoHint ? "font-mono" : ""}`}>{hint}</div>}
    </div>
  );
}
