import { Redirect } from "expo-router";
import { getAccessToken } from "@/lib/storage";
import { OnboardingScreen } from "@/features/auth/components/OnboardingScreen";

export default function Index() {
  // MMKV reads are synchronous — no async/loading state needed.
  // If a token is stored the user is considered authenticated and is
  // sent directly to the feed, bypassing onboarding entirely.
  const isAuthenticated = !!getAccessToken();

  if (isAuthenticated) {
    return <Redirect href="/feed" />;
  }

  return <OnboardingScreen />;
}
