// Compile-time check that the integrator contract exports exist with the
// right shapes. Not imported by the app at runtime.

import { SalesRoutes, salesNavItems, type SalesNavItem } from './index';

export const __salesModuleContract: {
  routes: typeof SalesRoutes;
  navItems: SalesNavItem[];
} = {
  routes: SalesRoutes,
  navItems: salesNavItems,
};
