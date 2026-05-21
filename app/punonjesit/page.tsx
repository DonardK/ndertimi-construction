import { redirect } from "next/navigation";

export default function PunonjesitRedirectPage() {
  redirect("/personeli?tab=employees");
}
