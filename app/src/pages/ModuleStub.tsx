interface ModuleStubProps {
  moduleName: string;
  agent: string;
}

/**
 * Placeholder for an unbuilt module mount point. Agent 2 replaces the
 * /recruit/* mount, Agent 3 the /sales/* mount — see App.tsx.
 */
export function ModuleStub({ moduleName, agent }: ModuleStubProps) {
  return (
    <div className="stub-panel">
      <h1>{moduleName} — under construction</h1>
      <p className="text-secondary">
        This mount point is reserved for {agent}. The shell, auth, design
        system, and shared components are ready; routes plug in here.
      </p>
    </div>
  );
}
