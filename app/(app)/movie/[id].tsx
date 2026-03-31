import { useLocalSearchParams } from "expo-router";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function MovieDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PlaceholderScreen
      title={`Movie ${id ?? ""}`}
      description="Port from WatchCueWeb/src/app/components/movie-detail.tsx."
    />
  );
}
