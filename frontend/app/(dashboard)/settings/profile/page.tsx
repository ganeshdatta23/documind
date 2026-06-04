import { redirect } from "next/navigation";

// The profile lives under the unified Settings page (Profile tab).
export default function SettingsProfileRedirect() {
  redirect("/settings");
}
