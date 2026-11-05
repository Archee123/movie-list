import { profile } from "@/lib/auth";
import Frame from "./ui";
export const dynamic = "force-dynamic";
export default async function Page() {
  return <Frame initialProfile={await profile()} />;
}
