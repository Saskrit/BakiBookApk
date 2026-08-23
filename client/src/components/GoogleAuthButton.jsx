import { useEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import './GoogleAuthButton.css';

function GoogleAuthButton({ onSuccess, onError, disabled, text = 'continue_with' }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(null);
  const measuredOnce = useRef(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || measuredOnce.current) return undefined;

    const measure = () => {
      const next = Math.round(node.offsetWidth);
      if (!next) return;
      measuredOnce.current = true;
      setWidth(next);
    };

    // Defer one frame so layout is settled; avoid resize-driven re-inits.
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`google-auth-btn ${disabled ? 'google-auth-btn--disabled' : ''}`}
    >
      {width ? (
        <GoogleLogin
          onSuccess={onSuccess}
          onError={onError}
          text={text}
          shape="rectangular"
          theme="outline"
          size="large"
          width={String(width)}
          useOneTap={false}
        />
      ) : (
        <div className="google-auth-btn__placeholder" aria-hidden="true" />
      )}
    </div>
  );
}

export default GoogleAuthButton;
