import { redirect } from "next/navigation";

export default function PjesemarrjaRedirectPage() {
  redirect("/personeli?tab=attendance");
}
