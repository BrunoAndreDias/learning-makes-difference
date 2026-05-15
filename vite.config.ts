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
          file: "modules/workspace-shell/app-shell/root-route.tsx",
          children: [
            {
              type: "layout",
              id: "_public",
              file: "modules/access/public-entry/public-layout-route.tsx",
              children: [
                {
                  type: "index",
                  file: "modules/access/public-entry/public-index-route.tsx",
                },
              ],
            },
            {
              type: "layout",
              id: "_auth",
              file: "modules/access/session/auth-layout-route.tsx",
              children: [
                {
                  type: "route",
                  path: "/forgot-password",
                  file: "modules/access/session/forgot-password-route.tsx",
                },
                {
                  type: "route",
                  path: "/login",
                  file: "modules/access/session/login-route.tsx",
                },
                {
                  type: "route",
                  path: "/register",
                  file: "modules/access/session/register-route.tsx",
                },
              ],
            },
            {
              type: "layout",
              id: "_protected",
              file: "modules/workspace-shell/app-shell/protected-route.tsx",
              children: [
                {
                  type: "route",
                  path: "/labels",
                  file: "modules/labels/label-management/labels-route.tsx",
                },
                {
                  type: "route",
                  path: "/study-notes",
                  file: "modules/study-notes/study-notes-route.tsx",
                },
                {
                  type: "route",
                  path: "/focus",
                  file: "modules/focus/focus-route.tsx",
                },
                {
                  type: "route",
                  path: "/insights",
                  file: "modules/study-guidance/study-guidance-route.tsx",
                },
                {
                  type: "route",
                  path: "/recall",
                  file: "modules/recall/recall-route.tsx",
                  children: [
                    {
                      type: "index",
                      file: "modules/recall/recall-results-workspace-route.tsx",
                    },
                    {
                      type: "route",
                      path: "/select",
                      file: "modules/recall/recall-selection-route.tsx",
                    },
                    {
                      type: "route",
                      path: "/session",
                      file: "modules/recall/recall-session-route.tsx",
                    },
                  ],
                },
                {
                  type: "route",
                  path: "/settings",
                  file: "modules/access/session/settings-route.tsx",
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
