import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }];
  },
  // Isolate the bounded local live-class POC by loopback hostname so each
  // browser tab can hold an independent Supabase session. This allowlist is
  // consulted only by the Next.js development server.
  allowedDevOrigins: [
    "127.0.0.1",
    "127.0.0.2",
    "127.0.0.3",
    "127.0.0.4",
    "127.0.0.5",
    "127.0.0.6",
  ],
};

export default nextConfig;
