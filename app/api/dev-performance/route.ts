import { handleMonitoring } from '@/integration/monitoring/server.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function POST(request: Request) { return handleMonitoring(request); }
