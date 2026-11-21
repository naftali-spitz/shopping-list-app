'use client';

import { supabase } from '@/lib/supabase';

export type Intent = {
  id: string; household_id: string; type: string;
  payload: Record<string, unknown>; expected_version: number | null;
  correlation_id: string; issued_ms: number; expires_ms: number;
};
export type CategoryRecord = { id: string; household_id: string; name: string; icon: string; version: number; created_at: string; deleted_at?: string | null };
export type ProductRecord = { id: string; household_id: string; category_id: string; name: string; checked: boolean; quantity: number; display_order: number | null; usage_count: number; version: number; created_at: string; deleted_at?: string | null };
export type HistoryRecord = { id: string; household_id: string; items: { id: string; name: string; quantity: number; category_id: string }[]; exported_at: string; version: number; deleted_at?: string | null };
export type Snapshot = { household: { id: string; name: string; version: number }; categories: CategoryRecord[]; products: ProductRecord[]; shopping_history: HistoryRecord[] };
export type OperationResult = { status: string; data: unknown; operation_id?: string; household_id?: string; correlation_id?: string };
export type PendingOperation = {
  intent: Intent; state: 'Saving' | 'Saved' | 'Offline/pending' | 'Failed' | 'Conflict requiring reconciliation';
  result?: OperationResult; confirmed_ms?: number; attempted?: boolean; accepted?: boolean;
  reconciliation?: Intent; reconcileRequested?: boolean; reserved_household_version?: number; tap_ms?: number; acceptance_ms?: number;
};
export type MutationResponse = { data: unknown; error: Error | null };
type ApiStatus = { result?: OperationResult; state?: string; error?: string; duplicate?: boolean };
class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }
const logicalType = (type: string) => type.replace(/^stage4\./, '');
const namespace = (type: string, mode: 'stage3' | 'stage4') => mode === 'stage3' ? type.replace(/^stage4\./, '') : type.startsWith('stage4.') ? type : `stage4.${type}`;
const finishedState = (result: OperationResult): PendingOperation['state'] => result.status === 'committed' || result.status === 'snapshot' ? 'Saved' : result.status === 'version_conflict' ? 'Conflict requiring reconciliation' : 'Failed';
const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJson((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value);
};
const isSnapshot = (value: unknown): value is Snapshot => Boolean(value && typeof value === 'object' && 'household' in value && 'categories' in value && 'products' in value && 'shopping_history' in value);

export function createIntent(householdId: string, type: string, payload: Record<string, unknown>, expectedVersion: number | null, mode: 'stage3' | 'stage4' = 'stage4'): Intent {
  const now = Date.now();
  return { id: crypto.randomUUID(), household_id: householdId, type: namespace(type, mode), payload: structuredClone(payload), expected_version: expectedVersion, correlation_id: crypto.randomUUID(), issued_ms: now, expires_ms: now + 300000 };
}

/** Only a provider session for the pinned development project is used; no JWT decoding or browser-supplied identity. */
export async function authenticatedApi(body: unknown, userId?: string): Promise<ApiStatus> {
  const { data } = await supabase.auth.getSession();
  if (!data.session || userId && data.session.user.id !== userId) throw new ApiError('Sign in again to reconcile pending operations.', 401);
  const response = await fetch('/api/stage3', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(20000), redirect: 'error',
  });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new ApiError('Development Preview access is unavailable.', response.status);
  const status: ApiStatus = await response.json();
  if (!response.ok) throw new ApiError(status.error || 'Request could not be verified.', response.status);
  return status;
}

/** Shared durable Stage3 protocol client for the original app and development proof surface. */
export class ShoppingClient {
  readonly storageKey: string;
  private snapshot: Snapshot | null = null;
  private queue: PendingOperation[] = [];
  private listeners = new Set<() => void>();
  private waiters = new Map<string, (response: MutationResponse) => void>();
  private readers = new Set<{ resolve: (snapshot: Snapshot) => void; reject: (error: Error) => void }>();
  private snapshotIntent: Intent | null = null;
  private snapshotDue = true;
  private busy = false;
  private disposed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private storageError: Error | null = null;
  private lastSnapshotAt = 0;
  private minimumRevision = 0;
  private lastError: Error | null = null;
  private requiresFullSnapshot = false;
  private readonly online = () => this.schedule(0);
  private readonly storage = (event: StorageEvent) => {
    if (this.mode !== 'stage4' || this.disposed || event.key !== this.storageKey && !event.key?.startsWith(this.operationPrefix())) return;
    try {
      const previous = new Map(this.queue.map(operation => [operation.intent.id, Boolean(operation.result)]));
      this.queue = this.mergeStored(this.queue);
      for (const operation of this.queue) if (operation.result && !previous.get(operation.intent.id)) {
        this.apply(operation.result, operation.intent);
        this.waiters.get(operation.intent.id)?.({ data: operation.result.data, error: operation.state === 'Saved' ? null : new Error(operation.result.status) });
        this.waiters.delete(operation.intent.id);
      }
      this.notify(); this.schedule(0);
    } catch { this.storageError = new Error('Pending operation storage changed unexpectedly. Preserve browser data before retrying.'); this.stopTimer(); this.notify(); }
  };

  constructor(readonly userId: string, readonly householdId: string, readonly mode: 'stage3' | 'stage4' = 'stage4') {
    this.storageKey = `shopping-stage3-v2:${userId}:${householdId}${mode === 'stage4' ? ':stage4' : ''}`;
    if (typeof window === 'undefined') throw new Error('ShoppingClient requires a browser.');
    try {
      const stored = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      if (!Array.isArray(stored)) throw new Error('Invalid pending storage');
      this.queue = stored.filter((p: PendingOperation) => p?.intent?.household_id === householdId && typeof p.intent.id === 'string');
      if (mode === 'stage4') this.persist(this.queue);
      // Existing Stage3 queue entries may have been accepted before a page refresh.
      for (const pending of this.queue) if (!pending.result) pending.attempted = true;
    } catch { this.storageError = new Error('Pending storage could not be read. Preserve browser data before retrying.'); }
    window.addEventListener('online', this.online);
    window.addEventListener('storage', this.storage);
  }

  current(): Snapshot | null { return this.snapshot; }
  error(): Error | null { return this.storageError || this.lastError; }
  operations(): readonly PendingOperation[] { return this.queue; }
  subscribe(listener: () => void): () => void {
    if (this.disposed) return () => undefined;
    this.listeners.add(listener); this.schedule(0);
    return () => { this.listeners.delete(listener); if (!this.needed()) this.stopTimer(); };
  }
  private needed() { return !this.disposed && !this.storageError && (this.listeners.size > 0 || this.waiters.size > 0 || this.readers.size > 0); }
  private notify() { for (const listener of this.listeners) listener(); }
  private operationPrefix() { return this.storageKey + ':operation:'; }
  private mergeStored(next: PendingOperation[]): PendingOperation[] {
    const merged = new Map(next.map(operation => [operation.intent.id, operation]));
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(this.operationPrefix())) continue;
      const operation: PendingOperation = JSON.parse(localStorage.getItem(key) || 'null');
      if (!operation?.intent || operation.intent.household_id !== this.householdId || key !== this.operationPrefix() + operation.intent.id) throw new Error('Invalid pending record');
      const local = merged.get(operation.intent.id);
      if (!local) { merged.set(operation.intent.id, operation); continue; }
      if (stableJson(local.intent) !== stableJson(operation.intent)) throw new Error('Pending intent changed');
      if (local.result && operation.result && stableJson(local.result) !== stableJson(operation.result)) throw new Error('Pending result changed');
      if (!local.result && operation.result) Object.assign(local, operation);
      else if (!local.result) {
        // A different tab may already have attempted this exact ID. Retrying
        // status first avoids an unnecessary publish, never changes intent.
        local.attempted ||= operation.attempted;
        local.accepted ||= operation.accepted;
        local.reconciliation ??= operation.reconciliation;
      }
    }
    return [...merged.values()];
  }
  private persist(next = this.queue) {
    // The compatibility queue is an index. Per-operation records are the durable
    // Stage4 source, so interleaved tab writes cannot remove one another's IDs.
    const all = this.mode === 'stage4' ? this.mergeStored(next) : next;
    const unresolved = all.filter(p => !p.result), finished = all.filter(p => p.result).slice(-30);
    const trimmed = [...finished, ...unresolved];
    if (this.mode === 'stage4') {
      for (const operation of trimmed) {
        const key = this.operationPrefix() + operation.intent.id, value = JSON.stringify(operation);
        if (localStorage.getItem(key) !== value) localStorage.setItem(key, value);
      }
      // Only terminal records are eligible for retention cleanup. Unresolved
      // records are never deleted, including records written by another tab.
      const retained = new Set(trimmed.map(operation => operation.intent.id));
      for (const operation of all) if (operation.result && !retained.has(operation.intent.id)) localStorage.removeItem(this.operationPrefix() + operation.intent.id);
      this.queue = trimmed;
      // A failed compatibility index cannot undo an already durable operation.
      // Refresh can reconstruct every intent from its individual record.
      try { localStorage.setItem(this.storageKey, JSON.stringify(trimmed)); } catch { /* Durable records remain authoritative. */ }
    } else {
      localStorage.setItem(this.storageKey, JSON.stringify(trimmed)); this.queue = trimmed;
    }
  }
  private stopTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  private schedule(delay: number) {
    if (!this.needed()) return;
    this.stopTimer(); this.timer = setTimeout(() => { this.timer = null; void this.tick(); }, delay);
  }
  async read(options: { refresh?: boolean } = {}): Promise<Snapshot> {
    if (this.storageError) throw this.storageError;
    if (this.disposed) throw new Error('Session changed.');
    if (this.snapshot && !options.refresh && !this.requiresFullSnapshot && Number(this.snapshot.household.version) >= this.minimumRevision) return this.snapshot;
    this.snapshotDue = true;
    return new Promise((resolve, reject) => { this.readers.add({ resolve, reject }); this.schedule(0); });
  }
  mutate(type: string, payload: Record<string, unknown>, expectedVersion: number | null): Promise<MutationResponse> {
    if (this.disposed || this.storageError) return Promise.resolve({ data: null, error: this.storageError || new Error('Session changed.') });
    const intent = createIntent(this.householdId, type, payload, expectedVersion, this.mode);
    const pending: PendingOperation = { intent, state: navigator.onLine ? 'Saving' : 'Offline/pending', tap_ms: performance.now(), reserved_household_version: this.view()?.household.version };
    try { this.persist([...this.queue, pending]); }
    catch { return Promise.resolve({ data: null, error: new Error('Cannot persist pending operation. Free browser storage before changing this list.') }); }
    const result = new Promise<MutationResponse>(resolve => this.waiters.set(pending.intent.id, resolve));
    this.notify(); this.schedule(0); return result;
  }
  getOperations(): readonly PendingOperation[] { return this.queue; }
  /** Reserve versions for prior local queued changes; never silently rebase over another user's edit. */
  mutateLatest(type: string, payload: Record<string, unknown>): Promise<MutationResponse> {
    const logical = logicalType(type), view = this.view();
    if (logical.endsWith('.create') && !logical.startsWith('invite.')) return this.mutate(type, payload, 0);
    if (logical.startsWith('invite.') || logical === 'household.list' || logical === 'household.members') return this.mutate(type, payload, null);
    if (!view) return Promise.resolve({ data: null, error: new Error('Load the authoritative list before changing it.') });
    const entity = logical.split('.')[0];
    const rows = entity === 'product' ? view.products : entity === 'category' ? view.categories : entity === 'history' ? view.shopping_history : null;
    const version = rows ? Number(rows.find(row => row.id === payload.id)?.version) : Number(view.household.version);
    if (!Number.isSafeInteger(version) || version <= 0) return Promise.resolve({ data: null, error: new Error('Record is no longer available. Refresh the list.') });
    return this.mutate(type, payload, version);
  }

  /** Pending patches are presentation only; current() remains authoritative. */
  view(): Snapshot | null {
    if (!this.snapshot) return null;
    const snapshot = structuredClone(this.snapshot);
    for (const pending of this.queue) {
      if (pending.result) continue;
      const type = logicalType(pending.intent.type), p = pending.intent.payload;
      const entity = type.split('.')[0], verb = type.split('.')[1];
      const advancesHousehold = ['category', 'product', 'history', 'list'].includes(entity) || ['household.rename', 'household.delete', 'household.seed', 'membership.remove'].includes(type);
      if (advancesHousehold) snapshot.household.version = Math.max(Number(snapshot.household.version), Number(pending.reserved_household_version ?? snapshot.household.version) + 1);
      if (type === 'list.export') {
        snapshot.products = snapshot.products.map(product => product.checked ? { ...product, checked: false, version: Number(product.version) + 1 } : product);
      } else if (type === 'list.restore') {
        const ids = new Set(p.product_ids as string[]);
        snapshot.products = snapshot.products.map(product => ids.has(product.id) ? { ...product, checked: true, version: Number(product.version) + 1 } : product);
      }
      const rows = entity === 'product' ? snapshot.products : entity === 'category' ? snapshot.categories : entity === 'history' ? snapshot.shopping_history : null;
      if (!rows) continue;
      const index = rows.findIndex(row => row.id === p.id);
      if (verb === 'delete') {
        if (index >= 0) rows.splice(index, 1);
        if (entity === 'category') snapshot.products = snapshot.products.filter(row => row.category_id !== p.id);
      } else if (verb === 'update' && index >= 0) {
        Object.assign(rows[index], p, { version: Number(pending.intent.expected_version) + 1 });
      } else if (verb === 'create' && index < 0) {
        const row = { household_id: this.householdId, created_at: new Date(pending.intent.issued_ms).toISOString(), version: 1, icon: 'general', checked: false, quantity: 1, usage_count: 0, display_order: null, ...p };
        // Entity-specific validation is applied by the shared server contract before execution.
        (rows as unknown[]).push(row);
      }
    }
    return snapshot;
  }

  private apply(result: OperationResult, intent: Intent) {
    if (result.status === 'snapshot' && isSnapshot(result.data)) {
      const next = result.data;
      if (Number(next.household.version) < this.minimumRevision) return;
      if (!this.snapshot || Number(next.household.version) >= Number(this.snapshot.household.version)) this.snapshot = next;
      this.requiresFullSnapshot = false;
      this.lastSnapshotAt = Date.now();
      if (this.snapshot) for (const reader of this.readers) reader.resolve(this.snapshot);
      this.readers.clear(); this.notify(); return;
    }
    if (result.status !== 'committed' || !this.snapshot || !result.data || typeof result.data !== 'object') return;
    const data = result.data as { record?: unknown; household_version?: number };
    const revision = Number(data.household_version);
    if (Number.isSafeInteger(revision)) this.minimumRevision = Math.max(this.minimumRevision, revision);
    if (!Number.isSafeInteger(revision) || revision < Number(this.snapshot.household.version)) return;
    const [entity, verb] = logicalType(intent.type).split('.');
    const rows = entity === 'product' ? this.snapshot.products : entity === 'category' ? this.snapshot.categories : entity === 'history' ? this.snapshot.shopping_history : null;
    // List-wide mutations require their full authoritative snapshot before advancing revision.
    if (!rows) { this.requiresFullSnapshot = true; this.snapshotDue = true; return; }
    const record = data.record as { id?: string; version?: number } | undefined;
    if (!record?.id) { this.snapshotDue = true; return; }
    const index = rows.findIndex(row => row.id === record.id);
    if (verb === 'delete') {
      if (entity === 'history') this.requiresFullSnapshot = true;
      if (index >= 0) rows.splice(index, 1);
      if (entity === 'category') this.snapshot.products = this.snapshot.products.filter(row => row.category_id !== record.id);
    } else if (index < 0) (rows as unknown[]).push(record);
    else if (Number(record.version) >= Number(rows[index].version)) Object.assign(rows[index], record);
    // A contiguous full record result completely describes a single product or
    // category mutation. Reuse it instead of downloading the entire list again.
    // Revision gaps and mutations with other record effects still require a full
    // snapshot, and an already-requested refresh is never cancelled here.
    const contiguous = revision === Number(this.snapshot.household.version) + 1;
    const alreadyIncluded = revision === Number(this.snapshot.household.version);
    if (contiguous) this.snapshot.household.version = revision;
    if ((!contiguous && !alreadyIncluded) || entity === 'history' || entity === 'category' && verb === 'delete') this.snapshotDue = true;
  }
  private settle(pending: PendingOperation, result: OperationResult) {
    pending.result = result; pending.state = finishedState(result); pending.confirmed_ms = Date.now();
    this.apply(result, pending.intent);
    if (result.status === 'forbidden') this.invalidateSnapshot(new Error('Household access is no longer authorized.'));
    this.persist(); this.notify();
    this.waiters.get(pending.intent.id)?.({ data: result.data, error: pending.state === 'Saved' ? null : new Error(result.status) });
    this.waiters.delete(pending.intent.id);
  }
  private async api(body: unknown) { return authenticatedApi(body, this.userId); }
  reconcileOperation(operationId: string) {
    const pending = this.queue.find(p => p.intent.id === operationId && !p.result);
    if (!pending) return;
    pending.reconcileRequested = true; this.persist(); this.schedule(0);
  }
  private async reconcile(pending: PendingOperation) {
    if (!pending.reconciliation || pending.reconciliation.expires_ms <= Date.now()) {
      pending.reconciliation = createIntent(this.householdId, 'operation.status', { operation_id: pending.intent.id }, null, this.mode);
      this.persist(); await this.api({ action: 'command', intent: pending.reconciliation });
    }
    let check: ApiStatus;
    try { check = await this.api({ action: 'status', household_id: this.householdId, id: pending.reconciliation.id }); }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      check = await this.api({ action: 'command', intent: pending.reconciliation });
    }
    if (check.result?.status === 'found') this.settle(pending, check.result.data as OperationResult);
    else if (check.result?.status === 'not_found' && pending.intent.expires_ms <= pending.reconciliation.issued_ms) this.settle(pending, { status: 'expired', data: null });
    else pending.state = 'Conflict requiring reconciliation';
  }
  private async sendIntent(pending: PendingOperation): Promise<ApiStatus> {
    try { return await this.api({ action: 'command', intent: pending.intent }); }
    catch (error) {
      // This call is made only for a never-sent intent or after an authenticated
      // missing-acceptance lookup. A schema/validation HTTP rejection occurs before
      // durable acceptance and must surface as Failed, never an endless pending UI.
      if (error instanceof ApiError && error.status === 400) {
        this.settle(pending, { status: 'request_rejected', data: null }); return {};
      }
      throw error;
    }
  }
  private async process(pending: PendingOperation) {
    if (pending.intent.expires_ms <= Date.now()) {
      if (this.mode === 'stage3' && !pending.reconcileRequested && !pending.reconciliation) {
        pending.state = 'Conflict requiring reconciliation'; this.persist(); this.notify(); return;
      }
      await this.reconcile(pending); return;
    }
    let status: ApiStatus;
    if (!pending.attempted) {
      pending.attempted = true; this.persist();
      status = await this.sendIntent(pending);
      if (pending.result) return;
      pending.accepted = true; pending.acceptance_ms = performance.now();
    } else {
      try { status = await this.api({ action: 'status', household_id: this.householdId, id: pending.intent.id }); }
      catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
        // A verified missing durable acceptance permits retry of precisely the same intent and ID.
        status = await this.sendIntent(pending); if (pending.result) return; pending.accepted = true;
      }
    }
    if (this.disposed) return;
    if (status.result) this.settle(pending, status.result);
    else { pending.state = status.state === 'reconciliation_required' ? 'Conflict requiring reconciliation' : status.state === 'failed_retryable' ? 'Offline/pending' : 'Saving'; this.persist(); this.notify(); }
  }
  private invalidateSnapshot(error: Error) {
    this.snapshot = null; this.lastError = error;
    for (const reader of this.readers) reader.reject(error);
    this.readers.clear(); this.notify();
  }
  private consumeSnapshotResult(result: OperationResult, intent: Intent) {
    if (result.status !== 'snapshot' || !isSnapshot(result.data)) {
      const error = new Error(result.status === 'forbidden' ? 'Household access is no longer authorized.' : 'Could not load this household.');
      this.invalidateSnapshot(error); throw error;
    }
    this.apply(result, intent); this.snapshotDue = false;
  }
  private async pollSnapshot() {
    if (!this.snapshotIntent) {
      this.snapshotIntent = createIntent(this.householdId, 'snapshot', {}, null, this.mode);
      const accepted = await this.api({ action: 'command', intent: this.snapshotIntent });
      if (this.disposed) return;
      if (accepted.result) {
        const intent = this.snapshotIntent; this.snapshotIntent = null;
        this.consumeSnapshotResult(accepted.result, intent); return;
      }
    }
    let status: ApiStatus;
    try { status = await this.api({ action: 'status', household_id: this.householdId, id: this.snapshotIntent.id }); }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      if (this.snapshotIntent.expires_ms <= Date.now()) { this.snapshotIntent = null; return; }
      status = await this.api({ action: 'command', intent: this.snapshotIntent });
    }
    if (this.disposed) return;
    if (status.result) {
      const intent = this.snapshotIntent; this.snapshotIntent = null;
      this.consumeSnapshotResult(status.result, intent);
    } else if (this.snapshotIntent.expires_ms <= Date.now()) { this.snapshotIntent = null; throw new Error('Snapshot expired; reconnect to retry.'); }
  }
  private async tick() {
    if (this.busy || !this.needed()) return;
    this.busy = true;
    try {
      if (!navigator.onLine) {
        for (const pending of this.queue) if (!pending.result) pending.state = 'Offline/pending';
        this.persist(); this.notify(); return;
      }
      // Serial own mutations reserve expected versions and cannot overtake predecessors.
      const pending = this.queue.find(p => !p.result);
      if (pending) await this.process(pending);
      if (this.disposed) return;
      this.lastError = null;
      if (this.readers.size || this.listeners.size && (this.snapshotIntent || this.snapshotDue || Date.now() - this.lastSnapshotAt >= 5000)) await this.pollSnapshot();
    } catch (error) {
      if (!this.disposed) {
        this.lastError = error instanceof Error ? error : new Error('Development backend unavailable.');
        if (error instanceof ApiError && [401, 403].includes(error.status)) this.snapshot = null;
        for (const pending of this.queue) if (!pending.result) pending.state = 'Offline/pending';
        try { this.persist(); } catch { this.storageError = new Error('Pending browser storage is unavailable.'); }
        this.notify();
        // Initial loads fail visibly; existing snapshots and durable pending IDs survive provider failures.
        for (const reader of this.readers) reader.reject(error instanceof Error ? error : new Error('Development backend unavailable.'));
        this.readers.clear();
      }
    } finally {
      this.busy = false;
      this.schedule(this.queue.some(p => !p.result) || this.snapshotIntent ? 650 : 2500);
    }
  }
  dispose() {
    this.disposed = true; this.stopTimer(); window.removeEventListener('online', this.online); window.removeEventListener('storage', this.storage);
    for (const reader of this.readers) reader.reject(new Error('Session changed.'));
    this.readers.clear();
    for (const resolve of this.waiters.values()) resolve({ data: null, error: new Error('Session changed. Pending operation IDs are preserved.') });
    this.waiters.clear(); this.listeners.clear(); this.snapshot = null;
  }
}

const clients = new Map<string, ShoppingClient>();
export function getShoppingClient(userId: string, householdId: string, mode: 'stage3' | 'stage4' = 'stage4'): ShoppingClient {
  const key = `${mode}:${userId}:${householdId}`;
  let client = clients.get(key);
  if (!client) { client = new ShoppingClient(userId, householdId, mode); clients.set(key, client); }
  return client;
}
export function disposeShoppingClients() { for (const client of clients.values()) client.dispose(); clients.clear(); }
