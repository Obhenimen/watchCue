import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Check, ChevronLeft, ChevronRight, Upload } from "lucide-react-native";
import { Logo } from "@/components/Logo";
import { colors } from "@/constants/theme";

const movieGenres = [
  "Action",
  "Comedy",
  "Drama",
  "Horror",
  "Sci-Fi",
  "Romance",
  "Thriller",
  "Documentary",
  "Animation",
  "Fantasy",
  "Crime",
  "Mystery",
  "Adventure",
  "Western",
  "Musical",
  "War",
];

const popularMovies = [
  { id: 1, title: "The Shawshank Redemption", year: 1994, poster: "🎬" },
  { id: 2, title: "The Godfather", year: 1972, poster: "🎭" },
  { id: 3, title: "The Dark Knight", year: 2008, poster: "🦇" },
  { id: 4, title: "Pulp Fiction", year: 1994, poster: "💼" },
  { id: 5, title: "Forrest Gump", year: 1994, poster: "🏃" },
  { id: 6, title: "Inception", year: 2010, poster: "🌀" },
  { id: 7, title: "Fight Club", year: 1999, poster: "🥊" },
  { id: 8, title: "The Matrix", year: 1999, poster: "💊" },
  { id: 9, title: "Goodfellas", year: 1990, poster: "🔫" },
  { id: 10, title: "Interstellar", year: 2014, poster: "🚀" },
  { id: 11, title: "Parasite", year: 2019, poster: "🏠" },
  { id: 12, title: "Joker", year: 2019, poster: "🃏" },
];

export function OnboardingScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const [accountData, setAccountData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [profileData, setProfileData] = useState({
    username: "",
    bio: "",
    profilePicture: null as string | null,
  });

  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedMovies, setSelectedMovies] = useState<number[]>([]);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setProfileData((p) => ({ ...p, profilePicture: result.assets[0].uri }));
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      router.replace("/feed");
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const toggleMovie = (movieId: number) => {
    setSelectedMovies((prev) =>
      prev.includes(movieId)
        ? prev.filter((id) => id !== movieId)
        : [...prev, movieId]
    );
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return !!(accountData.name && accountData.email && accountData.password);
      case 1:
        return !!profileData.username;
      case 2:
        return selectedGenres.length >= 3;
      case 3:
        return selectedMovies.length >= 1;
      default:
        return false;
    }
  };

  const progress = ((currentStep + 1) / 4) * 100;

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientMid, colors.gradientStart]}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoWrap}>
            <Logo size="lg" />
          </View>

          <View style={styles.progressHeader}>
            <Text style={styles.muted}>
              Step {currentStep + 1} of 4
            </Text>
            <Text style={styles.muted}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress}%` }]} />
          </View>

          <View style={styles.card}>
            {currentStep === 0 && (
              <View>
                <Text style={styles.h1}>Create an Account</Text>
                <Text style={styles.sub}>
                  Join our community of film enthusiasts
                </Text>
                <View style={styles.field}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    value={accountData.name}
                    onChangeText={(name) =>
                      setAccountData({ ...accountData, name })
                    }
                    placeholder="John Doe"
                    placeholderTextColor="#6B7280"
                    style={styles.input}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    value={accountData.email}
                    onChangeText={(email) =>
                      setAccountData({ ...accountData, email })
                    }
                    placeholder="john@example.com"
                    placeholderTextColor="#6B7280"
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    value={accountData.password}
                    onChangeText={(password) =>
                      setAccountData({ ...accountData, password })
                    }
                    placeholder="••••••••"
                    placeholderTextColor="#6B7280"
                    style={styles.input}
                    secureTextEntry
                  />
                </View>
              </View>
            )}

            {currentStep === 1 && (
              <View>
                <Text style={styles.h1}>Create Your Profile</Text>
                <Text style={styles.sub}>Let others know who you are</Text>
                <View style={styles.avatarRow}>
                  <View style={styles.avatarOuter}>
                    <LinearGradient
                      colors={[colors.accentPink, colors.accent]}
                      style={styles.avatarRing}
                    >
                      <View style={styles.avatarInner}>
                        {profileData.profilePicture ? (
                          <Image
                            source={{ uri: profileData.profilePicture }}
                            style={styles.avatarImage}
                            contentFit="cover"
                          />
                        ) : (
                          <Text style={styles.avatarLetter}>
                            {(accountData.name || "?").charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                    </LinearGradient>
                    <Pressable
                      onPress={pickAvatar}
                      style={styles.uploadBtn}
                      accessibilityLabel="Upload profile photo"
                    >
                      <Upload width={16} height={16} color="#fff" />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Username</Text>
                  <TextInput
                    value={profileData.username}
                    onChangeText={(username) =>
                      setProfileData({ ...profileData, username })
                    }
                    placeholder="@filmcritic123"
                    placeholderTextColor="#6B7280"
                    style={styles.input}
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Bio (Optional)</Text>
                  <TextInput
                    value={profileData.bio}
                    onChangeText={(bio) =>
                      setProfileData({ ...profileData, bio })
                    }
                    placeholder="Tell us about your love for cinema..."
                    placeholderTextColor="#6B7280"
                    style={[styles.input, styles.textarea]}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>
            )}

            {currentStep === 2 && (
              <View>
                <Text style={styles.h1}>Pick Your Favorite Genres</Text>
                <Text style={styles.sub}>
                  Select at least 3 genres you enjoy (you can change these later)
                </Text>
                <View style={styles.genreGrid}>
                  {movieGenres.map((genre) => {
                    const isSelected = selectedGenres.includes(genre);
                    return (
                      <Pressable
                        key={genre}
                        onPress={() => toggleGenre(genre)}
                        style={[
                          styles.genreChip,
                          isSelected && styles.genreChipOn,
                        ]}
                      >
                        {isSelected && (
                          <Check
                            width={16}
                            height={16}
                            color={colors.accent}
                            style={styles.check}
                          />
                        )}
                        <Text
                          style={[
                            styles.genreText,
                            isSelected && styles.genreTextOn,
                          ]}
                        >
                          {genre}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.counter}>
                  {selectedGenres.length} selected
                  {selectedGenres.length < 3 &&
                    ` (select at least ${3 - selectedGenres.length} more)`}
                </Text>
              </View>
            )}

            {currentStep === 3 && (
              <View>
                <Text style={styles.h1}>What Have You Been Watching?</Text>
                <Text style={styles.sub}>
                  Select movies you've watched recently to help us personalize your
                  experience
                </Text>
                <ScrollView
                  style={styles.movieScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.movieGrid}>
                    {popularMovies.map((movie) => {
                      const isSelected = selectedMovies.includes(movie.id);
                      return (
                        <Pressable
                          key={movie.id}
                          onPress={() => toggleMovie(movie.id)}
                          style={[
                            styles.movieCard,
                            isSelected && styles.movieCardOn,
                          ]}
                        >
                          {isSelected && (
                            <View style={styles.movieCheck}>
                              <Check width={14} height={14} color="#fff" />
                            </View>
                          )}
                          <Text style={styles.posterEmoji}>{movie.poster}</Text>
                          <Text style={styles.movieTitle} numberOfLines={2}>
                            {movie.title}
                          </Text>
                          <Text style={styles.movieYear}>{movie.year}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
                <Text style={styles.counter}>
                  {selectedMovies.length} selected
                </Text>
              </View>
            )}
          </View>

          <View style={styles.navRow}>
            {currentStep > 0 ? (
              <Pressable onPress={handleBack} style={styles.backBtn}>
                <ChevronLeft width={20} height={20} color="#fff" />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            ) : (
              <View style={styles.navSpacer} />
            )}
            <Pressable
              onPress={handleNext}
              disabled={!canProceed()}
              style={[
                styles.nextBtn,
                !canProceed() && styles.nextBtnDisabled,
              ]}
            >
              <Text style={styles.nextText}>
                {currentStep === 3 ? "Finish" : "Next"}
              </Text>
              <ChevronRight width={20} height={20} color="#fff" />
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  logoWrap: { alignItems: "center", marginBottom: 32 },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  muted: { fontSize: 14, color: "#9CA3AF" },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#1F2937",
    overflow: "hidden",
    marginBottom: 32,
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  card: {
    backgroundColor: "rgba(74, 74, 94, 0.35)",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#374151",
  },
  h1: {
    fontSize: 28,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  sub: { color: "#9CA3AF", marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, color: "#D1D5DB", marginBottom: 8 },
  input: {
    backgroundColor: "#1F2937",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
  },
  textarea: { minHeight: 88, textAlignVertical: "top" },
  avatarRow: { alignItems: "center", marginBottom: 24 },
  avatarOuter: { position: "relative" },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { fontSize: 36, color: "#fff", fontWeight: "600" },
  avatarImage: { width: 92, height: 92, borderRadius: 46 },
  uploadBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: colors.accentPink,
    padding: 8,
    borderRadius: 999,
  },
  genreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  genreChip: {
    position: "relative",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#374151",
    backgroundColor: "rgba(31, 41, 55, 0.5)",
    minWidth: "30%",
    flexGrow: 1,
  },
  genreChipOn: {
    borderColor: colors.accent,
    backgroundColor: "rgba(0, 201, 177, 0.15)",
  },
  genreText: { color: "#D1D5DB", textAlign: "center" },
  genreTextOn: { color: "#fff", fontWeight: "500" },
  check: { position: "absolute", top: 8, right: 8 },
  counter: {
    marginTop: 16,
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 14,
  },
  movieScroll: { maxHeight: 360 },
  movieGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  movieCard: {
    width: "31%",
    minWidth: 100,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#374151",
    backgroundColor: "rgba(31, 41, 55, 0.5)",
  },
  movieCardOn: {
    borderColor: colors.accentPink,
    backgroundColor: "rgba(255, 77, 109, 0.15)",
  },
  movieCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accentPink,
    alignItems: "center",
    justifyContent: "center",
  },
  posterEmoji: { fontSize: 36, marginBottom: 8 },
  movieTitle: { fontSize: 13, color: "#F3F4F6", fontWeight: "500" },
  movieYear: { fontSize: 11, color: "#6B7280", marginTop: 4 },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
  },
  navSpacer: { width: 100 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#1F2937",
  },
  backText: { color: "#fff", fontWeight: "500" },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  nextBtnDisabled: {
    backgroundColor: "#1F2937",
    opacity: 0.6,
  },
  nextText: { color: "#fff", fontWeight: "600" },
});
