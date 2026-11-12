import type { Metadata } from "next";
import { DemoClient } from "./demo-client";

export const metadata: Metadata = {
  title: "walquest demo",
  description: "Explore walquest with fictional territories. No account needed.",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <DemoClient />;
}
