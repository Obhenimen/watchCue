import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useEvent } from "expo";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Pause, Play, Volume2, VolumeX } from "lucide-react-native";

/** Format seconds as m:ss (or h:mm:ss for long videos). */
function formatTime(sec: number): string {
  const total = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = s.toString().padStart(2, "0");
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

/** Snapshot the active player passes to onPress so callers can hand the
 *  current position + mute state off to another screen (e.g. the feed →
 *  post detail handoff). Static (non-active) taps invoke onPress() with
 *  no argument. */
export type PlaybackHandoff = { currentTimeSec: number; muted: boolean };

type Props = {
  uri: string;
  posterUri?: string | null;
  isVisible: boolean;
  style?: object;
  onPress?: (handoff?: PlaybackHandoff) => void;
  /** Initial seek position when the player becomes ready (seconds). */
  startTimeSec?: number;
  /** Initial mute state. Defaults to true (feed-style autoplay). */
  startMuted?: boolean;
  /**
   * If true, render a progress bar with timestamps and let the user
   * tap the video to toggle play/pause (post-screen UX). When false
   * (feed UX) tapping invokes onPress instead.
   */
  showControls?: boolean;
};

export function FeedVideoPlayer({
  uri,
  posterUri,
  isVisible,
  style,
  onPress,
  startTimeSec,
  startMuted,
  showControls,
}: Props) {
  if (isVisible) {
    return (
      <ActiveVideoPlayer
        uri={uri}
        posterUri={posterUri}
        style={style}
        onPress={onPress}
        startTimeSec={startTimeSec}
        startMuted={startMuted}
        showControls={showControls}
      />
    );
  }

  return (
    <Pressable onPress={() => onPress?.()} style={[styles.container, style]}>
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
  startTimeSec,
  startMuted,
  showControls,
}: Omit<Props, "isVisible">) {
  const initialMuted = startMuted ?? true;
  const player = useVideoPlayer(uri, (player) => {
    player.loop = true;
    player.muted = initialMuted;
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
  // If a handoff position was provided, seek before play so the post screen
  // resumes where the feed left off.
  const triedPlayRef = useRef(false);
  useEffect(() => {
    if (status === "readyToPlay" && !triedPlayRef.current) {
      triedPlayRef.current = true;
      try {
        if (typeof startTimeSec === "number" && startTimeSec > 0) {
          player.currentTime = startTimeSec;
        }
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
  }, [status, error, player, uri, startTimeSec]);

  const [isMuted, setIsMuted] = useState(initialMuted);

  const toggleMute = () => {
    const next = !isMuted;
    player.muted = next;
    player.volume = next ? 0 : 1;
    setIsMuted(next);
  };

  // Poll currentTime/duration for the controls bar. expo-video doesn't expose
  // a per-frame React event for time updates, so a 250ms tick is the simplest
  // way to drive a smooth-enough progress bar without re-rendering on every
  // frame.
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => {
    if (!showControls) return;
    const tick = () => {
      setCurrentTime(player.currentTime ?? 0);
      setDuration(player.duration ?? 0);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [player, showControls]);

  // Show the centered pause button briefly each time playback starts, then
  // auto-hide so it doesn't sit in the middle of the video. Tapping the
  // video re-shows it (handled in handleOuterTap).
  const [pauseVisible, setPauseVisible] = useState(false);
  useEffect(() => {
    if (!showControls) return;
    if (!isPlaying) {
      setPauseVisible(false);
      return;
    }
    setPauseVisible(true);
    const id = setTimeout(() => setPauseVisible(false), 2500);
    return () => clearTimeout(id);
  }, [isPlaying, showControls]);

  const isLoading = status === "loading" || status === "idle";
  const hasError = status === "error";

  // Outer tap behavior depends on mode:
  //   - feed (no controls): hand playback off to the parent for navigation
  //   - post (controls): toggle play/pause in place
  const handleOuterTap = () => {
    if (showControls) {
      if (isPlaying) player.pause();
      else player.play();
      return;
    }
    if (!onPress) return;
    onPress({ currentTimeSec: player.currentTime ?? 0, muted: isMuted });
  };

  const seekToFraction = (fraction: number) => {
    if (!Number.isFinite(duration) || duration <= 0) return;
    const clamped = Math.max(0, Math.min(1, fraction));
    player.currentTime = clamped * duration;
    setCurrentTime(clamped * duration);
  };

  const progressPct =
    duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;

  // Video failed to load (404, codec, network, etc.) — fall back to the
  // poster image so the post still shows something rather than a black box.
  if (hasError) {
    return (
      <Pressable onPress={handleOuterTap} style={[styles.container, style]}>
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
    <Pressable onPress={handleOuterTap} style={[styles.container, style]}>
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
      ) : showControls && pauseVisible ? (
        // Centered pause affordance shown briefly each time playback starts,
        // then auto-hidden by the pauseVisible timer above.
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            player.pause();
          }}
          style={styles.pauseHitArea}
          hitSlop={10}
        >
          <View style={styles.pauseBtn}>
            <Pause width={18} height={18} color="#fff" fill="#fff" />
          </View>
        </Pressable>
      ) : null}
      {isPlaying && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          style={showControls ? styles.muteBtnTop : styles.muteBtn}
          hitSlop={10}
        >
          {isMuted ? (
            <VolumeX width={16} height={16} color="#fff" />
          ) : (
            <Volume2 width={16} height={16} color="#fff" />
          )}
        </Pressable>
      )}
      {showControls && (
        <View style={styles.controlsBar} pointerEvents="box-none">
          <Text style={styles.timeLabel}>{formatTime(currentTime)}</Text>
          <Pressable
            style={styles.progressHit}
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
            onPress={(e) => {
              if (barWidth <= 0) return;
              seekToFraction(e.nativeEvent.locationX / barWidth);
            }}
          >
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPct * 100}%` },
                ]}
              />
            </View>
          </Pressable>
          <Text style={styles.timeLabel}>{formatTime(duration)}</Text>
        </View>
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
  // In controls mode the bottom row holds the progress bar, so move mute up.
  muteBtnTop: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  // Center pause affordance while playing in controls mode.
  pauseHitArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  pauseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  // Bottom controls row: timestamps + tappable progress bar.
  controlsBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    minWidth: 32,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 2,
  },
  // Wraps the visible bar in a taller hit area for easier seeking.
  progressHit: {
    flex: 1,
    height: 22,
    justifyContent: "center",
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.32)",
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#fff",
  },
});
