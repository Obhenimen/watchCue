import { useLocalSearchParams } from "expo-router";
import { UserProfileScreen } from "@/features/profile/components/UserProfileScreen";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function UserRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) {
    return <PlaceholderScreen title="User" description="Missing user id." />;
  }
  return <UserProfileScreen userId={id} />;
}
