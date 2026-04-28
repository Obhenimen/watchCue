import { useLocalSearchParams } from "expo-router";
import { PostScreen } from "@/features/post/components/PostScreen";
import { PlaceholderScreen } from "@/components/PlaceholderScreen";

export default function PostRoute() {
  const { id, t, muted } = useLocalSearchParams<{
    id: string;
    /** Handoff from ForYouFeed: video position in seconds. */
    t?: string;
    /** Handoff from ForYouFeed: "1" if the feed video was muted. */
    muted?: string;
  }>();
  if (!id) {
    return <PlaceholderScreen title="Post" description="Missing post id." />;
  }
  const startTimeSec = t ? Number(t) : undefined;
  const startMuted = muted === "1" ? true : muted === "0" ? false : undefined;
  return (
    <PostScreen
      postId={id}
      startTimeSec={
        typeof startTimeSec === "number" && Number.isFinite(startTimeSec)
          ? startTimeSec
          : undefined
      }
      startMuted={startMuted}
    />
  );
}
