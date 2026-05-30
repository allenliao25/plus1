import os from "os";
import type { NextConfig } from "next";

function isPublicIPv4(family: string | number) {
  return family === "IPv4" || family === 4;
}

function getLocalIPv4Addresses() {
  const addresses = new Set<string>();

  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const net of interfaces ?? []) {
      if (isPublicIPv4(net.family) && !net.internal) {
        addresses.add(net.address);
      }
    }
  }

  if (process.env.DEV_ORIGIN) {
    addresses.add(process.env.DEV_ORIGIN);
  }

  return [...addresses];
}

const allowedDevOrigins = getLocalIPv4Addresses();

if (process.env.NODE_ENV !== "production") {
  console.log(
    `\n📱 Phone testing: allowedDevOrigins = ${
      allowedDevOrigins.length > 0
        ? allowedDevOrigins.join(", ")
        : "(none — set DEV_ORIGIN in .env.local)"
    }\n   Restart \`npm run dev\` after your Mac IP changes.\n`,
  );
}

const nextConfig: NextConfig = {
  // Allow phone testing over LAN even when your Mac IP changes.
  allowedDevOrigins,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
