import { useLocalSearchParams } from "expo-router";
import { PostScreen } from "@/features/post/components/PostScreen";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function PostRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) {
    return <PlaceholderScreen title="Post" description="Missing post id." />;
  }
  return <PostScreen postId={id} />;
}
