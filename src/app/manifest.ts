import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Galley",
    short_name: "Galley",
    description: "Tasks, copy and media for every website you build.",
    start_url: "/",
    display: "standalone",
    theme_color: "#2F6B4F",
    background_color: "#FBFBFA",
    icons: [{ src: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  };
}
