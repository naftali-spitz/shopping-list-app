import ShoppingApp from "@/components/shopping-app";
import { BackendProvider } from "@/components/backend-provider";
import { stage4Enabled } from "@/integration/stage3/server.mjs";

export const dynamic = "force-dynamic";

export default function Home() {
  return <BackendProvider backend={stage4Enabled() ? "home" : "supabase"}><ShoppingApp /></BackendProvider>;
}
