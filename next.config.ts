import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  async redirects() {
    return [
      { source: "/punonjesit", destination: "/personeli?tab=employees", permanent: false },
      { source: "/pjesemarrja", destination: "/personeli?tab=attendance", permanent: false },
      { source: "/nafta", destination: "/mjetet?tab=nafta", permanent: false },
    ];
  },
};

export default nextConfig;
