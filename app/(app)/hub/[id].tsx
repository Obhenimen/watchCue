import { useLocalSearchParams } from "expo-router";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function HubDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PlaceholderScreen
      title={`Hub ${id ?? ""}`}
      description="Port from WatchCueWeb/src/app/components/title-hub-page.tsx."
    />
  );
}
