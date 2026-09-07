interface SpinnerProps {
  label?: string;
}

export function Spinner({ label }: SpinnerProps) {
  if (label === undefined) {
    return (
      <span className="spinner" aria-hidden="true">
        <span className="spinner-ring" />
      </span>
    );
  }
  return (
    <span className="spinner" role="status" aria-label={label}>
      <span className="spinner-ring" />
    </span>
  );
}
