import { redirect } from "next/navigation";

export default function Home() {
  // Redirect to dashboard (auth handled by middleware)
  redirect("/dashboard");
}
