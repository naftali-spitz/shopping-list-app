'use client';
import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { disposeShoppingClients, getShoppingClient, type PendingOperation, type ShoppingClient, type Snapshot } from '@/integration/stage3/client';

export default function Stage3Client() {
  const [session, setSession] = useState<Session | null>(null);
  const [households, setHouseholds] = useState<{ household_id: string; household_name: string }[]>([]);
  const [household, setHousehold] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [message, setMessage] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [operations, setOperations] = useState<PendingOperation[]>([]), [name, setName] = useState('');
  const client = useRef<ShoppingClient | null>(null);
  const userId = session?.user.id;
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase.rpc('list_my_households').then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setMessage('Sign in again to load households.'); return; }
      setHouseholds(data || []); setHousehold(data?.[0]?.household_id || '');
    });
    return () => { cancelled = true; };
  }, [userId]);
  useEffect(() => {
    if (!userId || !household) return;
    let cancelled = false;
    const active = getShoppingClient(userId, household, 'stage3'); client.current = active;
    const render = () => {
      if (cancelled) return;
      setSnapshot(active.view()); setOperations([...active.operations()]);
      setMessage(active.error()?.message || (active.current() ? 'Connected to the development backend.' : 'Loading the development household…'));
    };
    const unsubscribe = active.subscribe(render); render();
    void active.read().then(render).catch(() => { if (!cancelled) setMessage('Offline/pending, or session expired. Pending IDs are preserved; sign in again if needed.'); });
    return () => { cancelled = true; unsubscribe(); client.current = null; };
  }, [userId, household]);
  async function login(event: React.FormEvent) {
    event.preventDefault(); setMessage('Signing in…');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPassword(''); setMessage(error ? 'Sign-in failed.' : 'Signed in.');
  }
  function enqueue(type: string, payload: Record<string, unknown>, version: number) {
    const active = client.current;
    if (!active) return;
    void active.mutate(type, payload, version).then(result => { if (result.error) setMessage(result.error.message); });
  }
  const products = snapshot?.products || [];
  return <main className="mx-auto max-w-3xl space-y-6 p-6" dir="ltr">
    <h1 className="text-2xl font-bold">Shopping List · Development integration</h1>
    <p role="status">{message}</p>
    {!session ? <form onSubmit={login} className="flex flex-col gap-3">
      <label>Email <input className="border p-2" aria-label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" /></label>
      <label>Password <input className="border p-2" aria-label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></label>
      <button className="rounded bg-cyan-600 p-2" type="submit">Sign in</button>
    </form> : <>
      <div className="flex gap-4"><label>Household <select aria-label="Household" className="border p-2" value={household} onChange={e => setHousehold(e.target.value)}>{households.map(h => <option key={h.household_id} value={h.household_id}>{h.household_name}</option>)}</select></label>
        <button onClick={async () => { await supabase.auth.signOut({ scope: 'local' }); disposeShoppingClients(); setSnapshot(null); setOperations([]); }}>Sign out</button></div>
      <p>Authoritative household revision: <span data-testid="revision">{snapshot?.household.version || 'Loading'}</span></p>
      {snapshot && !snapshot.categories.length ? <button className="border p-2" onClick={() => enqueue('category.create', { id: crypto.randomUUID(), name: 'Groceries', icon: 'general' }, 0)}>Create groceries category</button> : null}
      {snapshot?.categories.length ? <form className="flex gap-3" onSubmit={e => { e.preventDefault(); enqueue('product.create', { id: crypto.randomUUID(), category_id: snapshot.categories[0].id, name: name.trim(), quantity: 1 }, 0); setName(''); }}>
        <label>Product name <input aria-label="Product name" className="border p-2" maxLength={120} value={name} onChange={e => setName(e.target.value)} required /></label><button className="border p-2" type="submit">Add product</button>
      </form> : null}
      <ul className="space-y-3">{products.map(p => <li className="flex items-center justify-between border p-3" key={p.id} data-product-id={p.id}>
        <span>{p.name}</span><span>Quantity: <span data-testid="quantity">{Number(p.quantity)}</span></span>
        <button aria-label={`Increase ${p.name}`} disabled={operations.some(o => !o.result && o.intent.payload.id === p.id)} className="border p-2 disabled:opacity-50" onClick={() => enqueue('product.update', { id: p.id, quantity: Number(p.quantity) + 1 }, Number(p.version))}>+1</button>
      </li>)}</ul>
      <h2 className="text-xl">Operation status</h2>
      <ul className="space-y-2" aria-live="polite">{operations.map(p => <li key={p.intent.id} data-operation-id={p.intent.id} data-state={p.state} className="border p-2"><strong>{p.state}</strong> · {p.intent.type} · <code>{p.intent.id}</code>{p.state === 'Conflict requiring reconciliation' && !p.result ? <button className="ml-3 underline" onClick={() => client.current?.reconcileOperation(p.intent.id)}>Reconcile</button> : null}</li>)}</ul>
      <Link className="underline" href="/">Original development app</Link>
    </>}
  </main>;
}
