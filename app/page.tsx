import { redirect } from "next/navigation";

// The root route — middleware handles the actual redirect to /login or
// /dashboard based on session state. This is a fallback in case middleware
// doesn't fire for some reason.
export default function RootPage() {
  redirect("/dashboard");
}
