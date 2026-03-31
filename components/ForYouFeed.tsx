import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  Share,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Eye,
  Heart,
  MessageCircle,
  MoreVertical,
  Plus,
  Repeat2,
  Share2,
  TrendingUp,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNav } from "@/components/BottomNav";
import { colors } from "@/constants/theme";

interface Reply {
  id: number;
  username: string;
  avatar: string;
  content: string;
  timestamp: string;
}

interface Post {
  id: number;
  hubName: string;
  username: string;
  avatar: string;
  title: string;
  content: string;
  hasSpoiler: boolean;
  hasImage: boolean;
  imageUrl?: string;
  likes: number;
  comments: number;
  reposts: number;
  timestamp: string;
  isLiked: boolean;
  isReposted: boolean;
  replies?: Reply[];
  isHot?: boolean;
}

const mockPosts: Post[] = [
  {
    id: 1,
    hubName: "Dune: Part Two",
    username: "sci_fi_lover",
    avatar: "🎬",
    title: "The cinematography in this film is absolutely stunning",
    content:
      "Just watched Dune Part Two and I'm blown away by the visual storytelling. The way Villeneuve captures the desert landscapes is mesmerizing...",
    hasSpoiler: false,
    hasImage: true,
    imageUrl:
      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&h=400&fit=crop",
    likes: 234,
    comments: 45,
    reposts: 12,
    timestamp: "2h ago",
    isLiked: false,
    isReposted: false,
    isHot: true,
    replies: [
      {
        id: 101,
        username: "desert_dreamer",
        avatar: "🌵",
        content: "The sandworm sequences were incredible!",
        timestamp: "1h ago",
      },
      {
        id: 102,
        username: "imax_fan",
        avatar: "🎥",
        content: "Saw it in IMAX and it was life-changing",
        timestamp: "45m ago",
      },
    ],
  },
  {
    id: 2,
    hubName: "The Bear",
    username: "foodie_cinephile",
    avatar: "🍳",
    title: "Season 3 theories - Major spoilers!",
    content:
      "I think Carmy's going to lose the restaurant in the finale. The foreshadowing has been there all season...",
    hasSpoiler: true,
    hasImage: false,
    likes: 128,
    comments: 67,
    reposts: 8,
    timestamp: "5h ago",
    isLiked: true,
    isReposted: false,
    replies: [
      {
        id: 201,
        username: "chef_critic",
        avatar: "👨‍🍳",
        content: "I disagree! I think he's going to expand instead.",
        timestamp: "4h ago",
      },
    ],
  },
  {
    id: 3,
    hubName: "Oppenheimer",
    username: "history_buff",
    avatar: "💣",
    title: "Historical accuracy discussion",
    content:
      "After reading American Prometheus, I noticed some interesting creative liberties Nolan took with the timeline...",
    hasSpoiler: false,
    hasImage: false,
    likes: 89,
    comments: 23,
    reposts: 5,
    timestamp: "1d ago",
    isLiked: false,
    isReposted: false,
  },
  {
    id: 4,
    hubName: "True Detective",
    username: "mystery_fan",
    avatar: "🔍",
    title: "Night Country is a return to form",
    content:
      "This season reminds me so much of Season 1. The atmosphere, the mystery, everything just clicks...",
    hasSpoiler: false,
    hasImage: true,
    imageUrl:
      "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=600&h=400&fit=crop",
    likes: 312,
    comments: 91,
    reposts: 24,
    timestamp: "1d ago",
    isLiked: true,
    isReposted: true,
    isHot: true,
    replies: [
      {
        id: 401,
        username: "td_superfan",
        avatar: "🌌",
        content: "Jodie Foster is phenomenal in this role",
        timestamp: "20h ago",
      },
      {
        id: 402,
        username: "alaska_native",
        avatar: "❄️",
        content: "The setting is so atmospheric and eerie",
        timestamp: "18h ago",
      },
    ],
  },
];

export function ForYouFeed() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<Post[]>(mockPosts);
  const [shareModalPost, setShareModalPost] = useState<Post | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());

  const handleLike = (postId: number) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              isLiked: !post.isLiked,
              likes: post.isLiked ? post.likes - 1 : post.likes + 1,
            }
          : post
      )
    );
  };

  const handleRepost = (postId: number) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              isReposted: !post.isReposted,
              reposts: post.isReposted ? post.reposts - 1 : post.reposts + 1,
            }
          : post
      )
    );
  };

  const toggleReplies = (postId: number) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const sharePost = async (post: Post) => {
    try {
      await Share.share({
        message: `${post.title}\n\nwatchcuemobile://post/${post.id}`,
        title: post.title,
      });
    } catch {
      /* ignore */
    }
    setShareModalPost(null);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>For You</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push("/notifications")}
            style={styles.iconBtn}
          >
            <Bell width={22} height={22} color={colors.text} />
            <View style={styles.notifDot} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/create-post")}
            style={styles.createBtn}
          >
            <LinearGradient
              colors={[colors.accentPink, colors.accentPurple, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.createGradient}
            >
              <Plus width={22} height={22} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.feed,
          { paddingBottom: 100 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {posts.map((post) => (
          <View
            key={post.id}
            style={[
              styles.postCard,
              post.isHot && styles.postCardHot,
            ]}
          >
            {post.isHot && (
              <View style={styles.hotRow}>
                <TrendingUp width={14} height={14} color={colors.accentPink} />
                <Text style={styles.hotText}>Trending discussion</Text>
              </View>
            )}

            <View style={styles.postHeader}>
              <View style={styles.postHeaderLeft}>
                <LinearGradient
                  colors={[colors.accentPink, colors.accent]}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarEmoji}>{post.avatar}</Text>
                </LinearGradient>
                <View style={styles.headerMeta}>
                  <LinearGradient
                    colors={[colors.accentPink, colors.accentPurple, colors.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.hubChip}
                  >
                    <Text style={styles.hubChipText}>{post.hubName}</Text>
                  </LinearGradient>
                  <View style={styles.userRow}>
                    <Text style={styles.username}>@{post.username}</Text>
                    <Text style={styles.dot}>·</Text>
                    <Text style={styles.time}>{post.timestamp}</Text>
                  </View>
                </View>
              </View>
              <Pressable hitSlop={8}>
                <MoreVertical width={22} height={22} color="#9CA3AF" />
              </Pressable>
            </View>

            <Pressable onPress={() => router.push(`/post/${post.id}`)}>
              <Text style={styles.postTitle}>{post.title}</Text>
              {post.hasSpoiler ? (
                <View style={styles.spoilerWrap}>
                  <Text style={styles.spoilerTextBlur} numberOfLines={4}>
                    {post.content}
                  </Text>
                  <View style={styles.spoilerOverlay}>
                    <Eye width={18} height={18} color="#fff" />
                    <Text style={styles.spoilerBadge}>SPOILER WARNING</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.body} numberOfLines={3}>
                  {post.content}
                </Text>
              )}
            </Pressable>

            {post.hasImage && post.imageUrl && (
              <Pressable onPress={() => router.push(`/post/${post.id}`)}>
                <Image
                  source={{ uri: post.imageUrl }}
                  style={styles.postImage}
                  contentFit="cover"
                />
              </Pressable>
            )}

            <View style={styles.actions}>
              <Pressable
                onPress={() => handleLike(post.id)}
                style={styles.actionBtn}
              >
                <Heart
                  width={22}
                  height={22}
                  color={post.isLiked ? colors.accentPink : "#9CA3AF"}
                  fill={post.isLiked ? colors.accentPink : "transparent"}
                />
                <Text style={styles.actionCount}>{post.likes}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/post/${post.id}`)}
                style={styles.actionBtn}
              >
                <MessageCircle width={22} height={22} color="#9CA3AF" />
                <Text style={styles.actionCount}>{post.comments}</Text>
              </Pressable>
              <Pressable
                onPress={() => handleRepost(post.id)}
                style={styles.actionBtn}
              >
                <Repeat2
                  width={22}
                  height={22}
                  color={post.isReposted ? colors.accentPurple : "#9CA3AF"}
                />
                <Text style={styles.actionCount}>{post.reposts}</Text>
              </Pressable>
              <Pressable
                onPress={() => setShareModalPost(post)}
                style={styles.actionBtn}
              >
                <Share2 width={22} height={22} color="#9CA3AF" />
              </Pressable>
            </View>

            {post.replies && post.replies.length > 0 && (
              <View style={styles.repliesSection}>
                {!expandedReplies.has(post.id) ? (
                  <View style={styles.replyBlock}>
                    {post.replies.slice(0, 2).map((reply) => (
                      <View key={reply.id} style={styles.replyRow}>
                        <LinearGradient
                          colors={[colors.accentPink, colors.accent]}
                          style={styles.replyAvatar}
                        >
                          <Text style={styles.replyAvatarText}>
                            {reply.avatar}
                          </Text>
                        </LinearGradient>
                        <View style={styles.replyBody}>
                          <View style={styles.userRow}>
                            <Text style={styles.username}>@{reply.username}</Text>
                            <Text style={styles.dot}>·</Text>
                            <Text style={styles.time}>{reply.timestamp}</Text>
                          </View>
                          <Text style={styles.replyContent} numberOfLines={2}>
                            {reply.content}
                          </Text>
                        </View>
                      </View>
                    ))}
                    <Pressable
                      onPress={() => toggleReplies(post.id)}
                      style={styles.viewAllReplies}
                    >
                      <ChevronDown width={16} height={16} color={colors.accent} />
                      <Text style={styles.linkText}>
                        View all {post.comments} replies
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.replyBlock}>
                    {post.replies.map((reply) => (
                      <View key={reply.id} style={styles.replyRow}>
                        <LinearGradient
                          colors={[colors.accentPink, colors.accent]}
                          style={styles.replyAvatar}
                        >
                          <Text style={styles.replyAvatarText}>
                            {reply.avatar}
                          </Text>
                        </LinearGradient>
                        <View style={styles.replyBody}>
                          <View style={styles.userRow}>
                            <Text style={styles.username}>@{reply.username}</Text>
                            <Text style={styles.dot}>·</Text>
                            <Text style={styles.time}>{reply.timestamp}</Text>
                          </View>
                          <Text style={styles.replyContent}>{reply.content}</Text>
                        </View>
                      </View>
                    ))}
                    <Pressable
                      onPress={() => router.push(`/post/${post.id}`)}
                      style={styles.continueThread}
                    >
                      <Text style={styles.linkText}>Continue this conversation →</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => toggleReplies(post.id)}
                      style={styles.viewAllReplies}
                    >
                      <ChevronUp width={16} height={16} color={colors.accent} />
                      <Text style={styles.linkText}>Collapse replies</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <BottomNav />

      <Modal
        visible={shareModalPost !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShareModalPost(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShareModalPost(null)}
          />
          <View style={styles.modalWrap} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Share post</Text>
              {shareModalPost && (
                <Text style={styles.modalPreview} numberOfLines={2}>
                  {shareModalPost.title}
                </Text>
              )}
              <Pressable
                style={styles.modalPrimary}
                onPress={() => shareModalPost && sharePost(shareModalPost)}
              >
                <Text style={styles.modalPrimaryText}>Share via system…</Text>
              </Pressable>
              <Pressable onPress={() => setShareModalPost(null)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1A1A2E",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { padding: 8 },
  notifDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentPink,
  },
  createBtn: { borderRadius: 999, overflow: "hidden" },
  createGradient: {
    padding: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  feed: { padding: 16, gap: 16 },
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    overflow: "hidden",
  },
  postCardHot: {
    borderColor: "rgba(255, 77, 109, 0.45)",
  },
  hotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  hotText: { fontSize: 12, fontWeight: "600", color: colors.accentPink },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  postHeaderLeft: { flexDirection: "row", gap: 12, flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: { fontSize: 20 },
  headerMeta: { flex: 1 },
  hubChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 4,
  },
  hubChipText: { fontSize: 11, fontWeight: "600", color: "#fff" },
  userRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  username: { fontSize: 12, fontWeight: "600", color: colors.text },
  dot: { fontSize: 12, color: colors.muted },
  time: { fontSize: 12, color: colors.muted },
  postTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  body: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  spoilerWrap: {
    marginHorizontal: 16,
    marginBottom: 8,
    minHeight: 72,
    justifyContent: "center",
  },
  spoilerTextBlur: {
    fontSize: 14,
    color: colors.muted,
    opacity: 0.35,
  },
  spoilerOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(13, 13, 15, 0.55)",
    borderRadius: 8,
  },
  spoilerBadge: { color: "#fff", fontWeight: "700", fontSize: 12 },
  postImage: { width: "100%", height: 220, marginTop: 8 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#374151",
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionCount: { fontSize: 14, color: "#9CA3AF" },
  repliesSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#374151",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  replyBlock: { gap: 12 },
  replyRow: {
    flexDirection: "row",
    gap: 10,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(0, 201, 177, 0.35)",
  },
  replyAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  replyAvatarText: { fontSize: 12 },
  replyBody: { flex: 1 },
  replyContent: { fontSize: 14, color: colors.muted, marginTop: 4 },
  viewAllReplies: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 12,
  },
  continueThread: { paddingLeft: 12, paddingVertical: 8 },
  linkText: { color: colors.accent, fontSize: 14, fontWeight: "500" },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalWrap: {
    padding: 24,
    zIndex: 1,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#374151",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  modalPreview: { fontSize: 14, color: colors.muted, marginBottom: 16 },
  modalPrimary: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  modalPrimaryText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  modalCancel: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 16,
    paddingVertical: 8,
  },
});
