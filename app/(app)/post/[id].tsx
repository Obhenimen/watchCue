import { useLocalSearchParams } from "expo-router";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function PostRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PlaceholderScreen
      title={`Post ${id ?? ""}`}
      description="Port from WatchCueWeb/src/app/components/post-view.tsx."
    />
  );
}
