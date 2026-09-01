interface ModuleStubProps {
  moduleName: string;
  agent: string;
}

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
