/**
 * Stat — a single metric card (label + value + icon). Consolidates the three
 * near-identical inline StatCard/Metric/StatTile that were duplicated across the
 * dashboard, analytics, and admin pages.
 */
import type { ElementType } from "react";
import { Card } from "./Card";
import { Skeleton } from "./Skeleton";

export function Stat({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  icon: ElementType;
  loading?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <Icon className="h-4 w-4 text-subtle" />
      </div>
      {loading ? <Skeleton className="h-8 w-20" /> : <p className="text-stat text-fg">{value}</p>}
    </Card>
  );
}
