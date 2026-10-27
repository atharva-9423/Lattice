import React from 'react';
import { useMagnetic } from '../motion/magnetic';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
  magnetic?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  magnetic = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const magRef = useMagnetic<HTMLButtonElement>(magnetic || variant === 'primary' ? 6 : 0);

  return (
    <button
      ref={magRef}
      data-cursor="link"
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
