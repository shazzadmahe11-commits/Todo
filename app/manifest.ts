import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kamla.com",
    short_name: "Kamla",
    description: "A simple place to stay on top of things.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e1013",
    theme_color: "#0e1013",
    icons: [
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
