import type { ImgHTMLAttributes } from 'react';

type BrandLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string;
};

export default function BrandLogo({ className = '', alt = 'ParkJom logo', src = '/branding/parkjom-logo.png', ...props }: BrandLogoProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={`brand-logo ${className}`.trim()}
      decoding="async"
      draggable={false}
      {...props}
    />
  );
}
