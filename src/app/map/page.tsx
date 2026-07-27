import { Nav } from "@/components/Nav";
import { StockMapClient } from "@/components/StockMapClient";

export default function MapPage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Nav active="map" />
      <div className="flex min-h-0 flex-1 flex-col">
        <StockMapClient />
      </div>
    </div>
  );
}
