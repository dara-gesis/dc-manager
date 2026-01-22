// Simple route helper for switching tabs.
export type RouteKey = 'manager' | 'upload' | 'advanced';

// Activate a tab via its Bootstrap data target.
export const setRoute = (route: RouteKey): void => {
  const tabButton = document.querySelector<HTMLButtonElement>(
    `[data-bs-target="#tab-pane-${route === 'manager' ? 'manager' : route === 'upload' ? 'upload' : 'adv-batch'}"]`
  );
  tabButton?.click();
};
