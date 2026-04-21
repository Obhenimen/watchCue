import { useRef, useState } from "react";
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
    player.play();
  });

  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  const [isMuted, setIsMuted] = useState(true);

  const toggleMute = () => {
    const next = !isMuted;
    player.muted = next;
    player.volume = next ? 0 : 1;
    setIsMuted(next);
  };

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
      {!isPlaying && (
        <Pressable
          onPress={() => player.play()}
          style={styles.playOverlay}
        >
          <View style={styles.playBtn}>
            <Play width={22} height={22} color="#fff" fill="#fff" />
          </View>
        </Pressable>
      )}
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
