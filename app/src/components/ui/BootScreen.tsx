interface BootScreenProps {
  title?: string;
  message?: string;
  label?: string;
}

export function BootScreen({
  title = 'Taking you to Front Office OS',
  message = 'Checking your access and loading your workspace.',
  label = 'Loading Front Office OS',
}: BootScreenProps) {
  return (
    <div className="fo-boot" role="status" aria-label={label}>
      <div className="fo-boot-card">
        <img
          className="fo-boot-logo"
          src="/ventvest-logo.webp"
          alt="VentVest"
          width={1038}
          height={231}
        />
        <p className="fo-boot-title">{title}</p>
        <p className="fo-boot-message">{message}</p>
        <div className="fo-boot-bar">
          <span className="fo-boot-bar-fill" />
        </div>
      </div>
    </div>
  );
}
