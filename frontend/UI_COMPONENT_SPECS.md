# dhakadsnazzy UI Component Specifications

## Loaders

### 1. Exclusive Route & Reload Loader (`IconLoader.tsx` + `useRouteLoader.ts`)
This is the primary Lottie-based animation loader that triggers exclusively during route changes and full page reloads.

**Behavior:**
- **Trigger Points:**
  - **Full Page Reload:** Visible immediately upon page load (initialized to `true` in `LoadingProvider`).
  - **In-App Navigation:** Triggers on every `location.pathname` change detected by `useRouteLoader`.
- **Inactivity (Hidden):**
  - Component-level state changes.
  - API requests (unless specifically part of a route transition).
  - Modal openings/closings.
- **Timing:**
  - **Minimum Duration:** 1000ms (1 second) to ensure smooth transition and brand visibility.
  - **Fade Duration:** 300ms smooth opacity transition.
- **Asset Optimization:**
  - Uses `loading.json` fetched from `/animations/`.
  - Preloaded in `index.html` via `<link rel="preload">`.

### 2. API Request State (`LoadingContext.tsx`)
The application maintains a separate `isLoading` state for background API requests.

**Behavior:**
- **Inclusion:** Triggers for all requests made via the standard `api` axios instance.
- **Exclusion:** Does NOT trigger the global Lottie `IconLoader`. This state can be used for smaller, local UI indicators (like skeletons or progress bars) without interrupting the main navigation flow.
- **Concurrency:** Uses a counter (`activeRequests`) to track overlapping API calls.
- **Timing:** 1000ms minimum display time (if UI indicators are implemented for this state).

---

## Performance Targets
- **Time to Interactive (Initial):** < 1500ms on 3G networks.
- **Route Transition:** < 1200ms (including animation duration).
- **Transition Smoothness:** 60fps for Lottie and fade animations.

## Performance Notes
- **Preloading:** The Lottie JSON is preloaded to ensure zero delay on the first route change.
- **State Separation:** By separating `isRouteLoading` from `isLoading`, we ensure that background data syncs don't cause unexpected full-screen overlays.

