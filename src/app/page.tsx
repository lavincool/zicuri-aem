import { MapScreen } from "@/features/map/components/map-screen";
import { env } from "@/lib/env";

export default function Home() {
  return (
    <main className="flex-1">
      <MapScreen demoMode={env().DEMO_MODE} />
    </main>
  );
}
