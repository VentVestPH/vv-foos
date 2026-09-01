import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : '',
    fullWidth ? 'btn-full' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}
