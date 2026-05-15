import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disabled in dev because react-email-editor 1.x mounts a fresh Unlayer
  // iframe on every mount and doesn't tear the first one down. With Strict
  // Mode's double-mount this produces two stacked editors in the email
  // composer. Strict Mode is a dev-only check; production never double-renders.
  reactStrictMode: false,
};

export default nextConfig;
