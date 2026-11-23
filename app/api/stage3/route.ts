import { handle } from '@/integration/stage3/server.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function POST(request: Request) { return handle(request); }
