import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
      router: {
        routesDirectory: ".",
        virtualRouteConfig: {
          type: "root",
          file: "modules/workspace-shell/routes/root-route.tsx",
          children: [
            {
              type: "layout",
              id: "_public",
              file: "modules/access/routes/public-layout-route.tsx",
              children: [
                {
                  type: "index",
                  file: "modules/access/routes/public-index-route.tsx",
                },
              ],
            },
            {
              type: "layout",
              id: "_auth",
              file: "modules/access/routes/auth-layout-route.tsx",
              children: [
                {
                  type: "route",
                  path: "/forgot-password",
                  file: "modules/access/routes/forgot-password-route.tsx",
                },
                {
                  type: "route",
                  path: "/login",
                  file: "modules/access/routes/login-route.tsx",
                },
                {
                  type: "route",
                  path: "/register",
                  file: "modules/access/routes/register-route.tsx",
                },
              ],
            },
            {
              type: "layout",
              id: "_protected",
              file: "modules/workspace-shell/routes/protected-route.tsx",
              children: [
                {
                  type: "route",
                  path: "/labels",
                  file: "modules/labels/routes/labels-route.tsx",
                },
                {
                  type: "route",
                  path: "/notes",
                  file: "modules/learning-loop/routes/notes-route.tsx",
                },
                {
                  type: "route",
                  path: "/focus",
                  file: "modules/learning-loop/routes/focus-route.tsx",
                },
                {
                  type: "route",
                  path: "/recall",
                  file: "modules/learning-loop/routes/recall-route.tsx",
                  children: [
                    {
                      type: "index",
                      file: "modules/learning-loop/routes/recall-results-workspace-route.tsx",
                    },
                    {
                      type: "route",
                      path: "/select",
                      file: "modules/learning-loop/routes/recall-selection-route.tsx",
                    },
                    {
                      type: "route",
                      path: "/session",
                      file: "modules/learning-loop/routes/recall-session-route.tsx",
                    },
                  ],
                },
                {
                  type: "route",
                  path: "/settings",
                  file: "modules/access/routes/settings-route.tsx",
                },
              ],
            },
          ],
        },
      },
    }),
    viteReact(),
    nitro(),
  ],
});
