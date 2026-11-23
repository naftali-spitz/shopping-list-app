import { notFound } from 'next/navigation';
import { developmentConfig } from '@/integration/stage3/server.mjs';
import Stage3Client from './stage3-client';
export const dynamic = 'force-dynamic';
export default function Stage3Page() {
  try { developmentConfig(); } catch { notFound(); }
  return <Stage3Client />;
}
