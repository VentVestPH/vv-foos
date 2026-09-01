import { SalesRoutes, salesNavItems, type SalesNavItem } from './index';

export const __salesModuleContract: {
  routes: typeof SalesRoutes;
  navItems: SalesNavItem[];
} = {
  routes: SalesRoutes,
  navItems: salesNavItems,
};
