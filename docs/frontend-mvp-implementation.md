# Web Frontend MVP Implementation

This document describes the implementation details of the React Web MVP for the Enterprise Agent Hub.

## 1. Overview and Goal
The `apps/web` package has been upgraded from a skeleton/manifest-only directory to a fully runnable React Single Page Application powered by Vite. The MVP provides a real user interface using React, TanStack Query, and Zustand, allowing developers to interact with the existing memory-based core runtimes without needing a fully deployed HTTP API backend.

## 2. Design Aesthetics (Apple Style)
The UI has been completely restyled from the default Ant Design appearance to align with the Apple Human Interface Guidelines (macOS / iOS mixture):
- **Glassmorphism Components**: The sidebar and top-bar use a frosted glass effect (`backdrop-filter`) with semi-transparent backgrounds.
- **Typography and Softness**: Global styles reset the font-family to Apple's system stack. Borders have been stripped or replaced entirely with subtle box-shadows and large border radii (`16px`/`8px` config overrides).
- **Icons**: Dropped generic Ant Design icons in favor of `lucide-react`, capturing a modern line-art vector style.

## 3. Technology Stack & Directory Structure
- **Core Builder**: Vite + React 18
- **State Management**: Zustand (for `useAuthStore` session sync) & TanStack React Query (for async data flow)
- **UI Base**: Ant Design (`^5.15.0`) with heavy `ConfigProvider` theming

**Folder Layout:**
```
apps/web/src/
  ├── adapters/       # mockService.js translating existing workflow APIs to React Query Promises
  ├── layouts/        # AppLayout.jsx global shell
  ├── pages/          # Business routes (Login, Home, Market, MySkill, Review, etc.)
  ├── stores/         # Zustand store (useAuthStore.js)
  ├── styles/         # Global token configurations (theme.js) & CSS overrides (global.css)
  ├── live/           # (Kept intact) Underlying phase execution workflow models
```

## 4. Adapters & Data Mock Layer
Since the actual backend persistent HTTP layer is not yet shipped, we intercept all UI calls inside `src/adapters/mockService.js`.
- It dynamically initialises `createPhase1LiveWebFlow` and `createPhase2LiveWebWorkflow` from the legacy live slice descriptors.
- During bootstrapping, the mockService injects an `admin` account with a valid permission scope so that developers can log in immediately with Username: `admin` and Password: `<any_string>`.

## 5. Completed MVP Pages
The following business surfaces are functionally operational against the memory snapshot:
1. **/login**: Aesthetic Auth screen connected to `authController.login`.
2. **/home**: Dashboard overview rendering active task counts.
3. **/market**: Searchable catalog of approved packages.
4. **/my-skill**: Skill publication portal with a mock modal hitting `publishFromMySkill`.
5. **/review**: Admin queue allowing `Claim` and `Approve` state machines.
6. **/notifications**: Real-time mock polling center testing SSE reconnection logic constraints.
7. **/user-management** & **/skill-management**: Administrative tables for platform provisioning.

*Note: Navigation links like `/tools`, `/projects`, and `/settings` are mapped to a `Placeholder` component to maintain visual structure until implemented.*

## 6. Next Steps
1. **Network Adapters Transformation**: When NestJS API controllers are stable, adapt `mockService.js` to a real HTTP/Axios client wrapper.
2. **True SSE integration**: Replace the mock event-array drain mechanism in `/notifications` with standard `EventSource`.
