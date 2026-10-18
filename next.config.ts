import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * create-next-app turns on cacheComponents + partialPrefetching by default.
   * Every screen in BeeRoute sits behind auth and reads per-user rows, so each
   * one would need `instant = false` or a <Suspense> wrapper just to build —
   * for no cache benefit, since nothing is shared between users.
   *
   * Worth revisiting if the public-company search (is_public = true) grows:
   * that query IS the same for everybody and would cache well.
   */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
