import { useLocalSearchParams } from "expo-router";
import { HubDetailScreen } from "@/features/hubs/components/HubDetailScreen";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function HubDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) {
    return <PlaceholderScreen title="Hub" description="Missing hub id." />;
  }
  return <HubDetailScreen hubId={id} />;
}
