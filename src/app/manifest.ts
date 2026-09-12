import type { MetadataRoute } from "next";

/**
 * Makes Galley installable to a phone home screen. Android needs 192 and 512 icons plus a
 * maskable pair (it crops to a circle or squircle); iOS uses the apple-touch-icon instead.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Galley",
    short_name: "Galley",
    description: "Tasks, copy, schedules and files for every project you run.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: "#EFEEEA",
    background_color: "#EFEEEA",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My tasks", short_name: "Tasks", url: "/me/tasks" },
      { name: "Calendar", short_name: "Calendar", url: "/calendar" },
      { name: "Suppliers", short_name: "Suppliers", url: "/suppliers" },
    ],
  };
}
