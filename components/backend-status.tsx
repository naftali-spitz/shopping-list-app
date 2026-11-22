"use client";
import { useEffect, useState } from "react";
import { PerformanceInspector } from "./performance-inspector";
import { homeClient } from "@/lib/backend/home";
import type { PendingOperation } from "@/integration/stage3/client";

export function BackendStatus({ userId, householdId, hebrew }: { userId: string; householdId: string; hebrew: boolean }) {
  const [operations, setOperations] = useState<readonly PendingOperation[]>([]);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void homeClient(householdId).then(client => {
      if (cancelled || client.userId !== userId) return;
      const update = () => {
        setError(Boolean(client.error()));
        setOperations([...client.operations()]);
        setRevision(Number(client.current()?.household.version ?? 0));
      };
      unsubscribe = client.subscribe(update); update();
    });
    return () => { cancelled = true; unsubscribe?.(); };
  }, [userId, householdId]);
  useEffect(() => {void homeClient(householdId).then(client => {if(client.userId===userId)for(const operation of operations)client.confirmRendered(operation);}).catch(()=>{});},[userId,householdId,operations]);
  const pending = operations.filter(operation => !operation.result);
  const failed = operations.filter(operation => operation.result && !["committed", "snapshot"].includes(operation.result.status));
  const text = error ? (hebrew ? "החיבור או ההרשאה השתנו. השינויים הממתינים נשמרו במכשיר." : "Connection or access changed. Pending IDs are preserved on this device.") : pending.length ? (hebrew ? `שומר… (${pending.length})` : `Saving… (${pending.length})`) : failed.length ? (hebrew ? "יש שינוי שלא נשמר — בדוק פרטים" : "A change was not saved — review details") : operations.length ? (hebrew ? "נשמר" : "Saved") : (hebrew ? "מחובר" : "Connected");
  return <div className="mt-2 text-xs opacity-70" data-backend="home" data-revision={revision}>
    <p role="status" aria-live="polite">{text}{pending.some(operation => operation.state === "Offline/pending") ? (hebrew ? " · ממתין לחיבור" : " · Offline/pending") : ""}</p>
    {operations.length ? <details className="mt-1"><summary className="cursor-pointer">{hebrew ? "פרטי שמירה" : "Save details"}</summary>
      <ul className="max-h-32 overflow-auto">{operations.slice(-10).map(operation => <li key={operation.intent.id} data-operation-id={operation.intent.id} data-state={operation.state}>{operation.state} · {operation.intent.type.replace("stage4.", "")} · <span dir="ltr">{operation.intent.id.slice(0, 8)}</span></li>)}</ul>
    </details> : null}
    <PerformanceInspector userId={userId} householdId={householdId} hebrew={hebrew} />
  </div>;
}
