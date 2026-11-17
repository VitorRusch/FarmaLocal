import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { db, type Medication, type Movement } from "@/lib/pharmacy/database";
export function useInventory() {
  const [data, setData] = useState<{
    meds: Medication[];
    moves: Movement[];
    ready: boolean;
    error: string;
  }>({ meds: [], moves: [], ready: false, error: "" });
  useEffect(() => {
    const subscription = liveQuery(async () => ({
      meds: await db().medications.toArray(),
      moves: (await db().movements.toArray()).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
      ready: true,
      error: "",
    })).subscribe({
      next: setData,
      error: (e: unknown) =>
        setData((d) => ({
          ...d,
          ready: true,
          error: e instanceof Error ? e.message : "Não foi possível abrir o armazenamento local.",
        })),
    });
    return () => subscription.unsubscribe();
  }, []);
  return data;
}
