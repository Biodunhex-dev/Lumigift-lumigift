import { redirect } from "next/navigation";

export default function FAQPage() {
  // 301 redirect to /help for SEO consolidation
  redirect("/help");
}