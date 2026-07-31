import { useEffect, useMemo, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { toSharePointDownloadUrl } from '../../shared/sharePointUrl';

type SignatureImageProps = {
  src: string;
  alt: string;
  className: string;
};

const SignatureImage = ({ src, alt, className }: SignatureImageProps) => {
  const [failed, setFailed] = useState(false);
  const imageSrc = useMemo(() => toSharePointDownloadUrl(src), [src]);

  useEffect(() => {
    setFailed(false);
  }, [imageSrc]);

  if (failed) {
    return (
      <span className="sig-image-error" role="img" aria-label={`${alt} could not be displayed`}>
        <ImageOff size={18} aria-hidden="true" />
        <span>Signature image unavailable</span>
        <a href={src} target="_blank" rel="noreferrer">
          Open file
        </a>
      </span>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
};

export { SignatureImage };
