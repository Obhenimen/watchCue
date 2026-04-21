import { Redirect, Stack } from "expo-router";
import { getAccessToken } from "@/lib/storage";

export default function AppGroupLayout() {
  const hasToken = !!getAccessToken();

  if (!hasToken) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
