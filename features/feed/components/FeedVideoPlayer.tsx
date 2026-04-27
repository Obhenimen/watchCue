import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useEvent } from "expo";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Play, Volume2, VolumeX } from "lucide-react-native";

type Props = {
  uri: string;
  posterUri?: string | null;
  isVisible: boolean;
  style?: object;
  onPress?: () => void;
};

export function FeedVideoPlayer({
  uri,
  posterUri,
  isVisible,
  style,
  onPress,
}: Props) {
  if (isVisible) {
    return (
      <ActiveVideoPlayer
        uri={uri}
        posterUri={posterUri}
        style={style}
        onPress={onPress}
      />
    );
  }

  return (
    <Pressable onPress={onPress} style={[styles.container, style]}>
      {posterUri ? (
        <Image
          source={{ uri: posterUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <View style={StyleSheet.absoluteFill} />
      )}
      <View style={styles.playOverlay}>
        <View style={styles.playBtn}>
          <Play width={22} height={22} color="#fff" fill="#fff" />
        </View>
      </View>
    </Pressable>
  );
}

function ActiveVideoPlayer({
  uri,
  posterUri,
  style,
  onPress,
}: Omit<Props, "isVisible">) {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = true;
    player.muted = true;
    // Don't call play() here — the source may not be readyToPlay yet on
    // remote URLs. We trigger play on the statusChange → readyToPlay event
    // below. Calling play() on an idle player is a no-op on some platforms.
  });

  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  // Surface load errors. `statusChange` fires with { status, error } when
  // the source transitions between idle | loading | readyToPlay | error.
  // The hook's initial value is null until the first event fires, so we
  // fall back to the player's current status property.
  const statusEvent = useEvent(player, "statusChange");
  const status = statusEvent?.status ?? player.status;
  const error = statusEvent?.error;

  // Auto-play once the source is actually ready. Using a ref so we only
  // attempt the initial play once per mount — manual play uses the overlay.
  const triedPlayRef = useRef(false);
  useEffect(() => {
    if (status === "readyToPlay" && !triedPlayRef.current) {
      triedPlayRef.current = true;
      try {
        player.play();
      } catch (e) {
        if (__DEV__) console.warn("[FeedVideoPlayer] play() failed", uri, e);
      }
    }
    if (__DEV__ && status === "error") {
      console.warn(
        "[FeedVideoPlayer] failed to load video",
        uri,
        error?.message ?? error,
      );
    }
  }, [status, error, player, uri]);

  const [isMuted, setIsMuted] = useState(true);

  const toggleMute = () => {
    const next = !isMuted;
    player.muted = next;
    player.volume = next ? 0 : 1;
    setIsMuted(next);
  };

  const isLoading = status === "loading" || status === "idle";
  const hasError = status === "error";

  // Video failed to load (404, codec, network, etc.) — fall back to the
  // poster image so the post still shows something rather than a black box.
  if (hasError) {
    return (
      <Pressable onPress={onPress} style={[styles.container, style]}>
        {posterUri ? (
          <Image
            source={{ uri: posterUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View style={StyleSheet.absoluteFill} />
        )}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={[styles.container, style]}>
      {posterUri && (
        <Image
          source={{ uri: posterUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      )}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      {!isPlaying ? (
        <Pressable
          onPress={() => {
            triedPlayRef.current = true;
            player.play();
          }}
          style={styles.playOverlay}
        >
          <View style={styles.playBtn}>
            <Play width={22} height={22} color="#fff" fill="#fff" />
          </View>
        </Pressable>
      ) : null}
      {isPlaying && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          style={styles.muteBtn}
          hitSlop={10}
        >
          {isMuted ? (
            <VolumeX width={16} height={16} color="#fff" />
          ) : (
            <Volume2 width={16} height={16} color="#fff" />
          )}
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 220,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 3,
  },
  muteBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
