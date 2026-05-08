# User Language Uses i18next Behind an App-Owned Module

The app supports one **User Language** in v1: English, Portuguese (Portugal), and Spanish. We will use `i18next` with `react-i18next` for app chrome translation, but expose it through an app-owned language module so product code depends on the app's **User Language** concept rather than directly scattering i18n setup across Access, Notes, Labels, Recall, Focus, and the workspace shell.

Rejected alternatives: hand-rolled translation helpers would recreate mature i18n behavior such as interpolation, pluralization, detection, fallback, and SSR hydration; importing `i18next` directly from every feature would make the library choice leak through the codebase and weaken the domain boundary.
