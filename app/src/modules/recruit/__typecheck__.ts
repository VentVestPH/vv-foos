// Standalone compile check: the module's public exports resolve and type.
// The integrator can delete this once App.tsx imports the module directly.

import { RecruitRoutes, recruitNavItems } from './index';

export const recruitModuleExports = { RecruitRoutes, recruitNavItems };
