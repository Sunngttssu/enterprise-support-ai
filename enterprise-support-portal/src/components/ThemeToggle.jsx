import { useEffect, useState, useRef, memo } from 'react';
import { flushSync } from 'react-dom';
import { Sun, Moon } from 'lucide-react';

// memo: ThemeToggle is self-contained — no props, so it never needs
// to re-render due to parent state changes.
export default memo(function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);
  const buttonRef = useRef(null);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = async () => {
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    const willBeDark = !isCurrentlyDark;

    // Fallback: no View Transition API support
    if (!document.startViewTransition) {
      document.documentElement.classList.toggle('dark', willBeDark);
      setIsDark(willBeDark);
      return;
    }

    // Get the button's center position to originate the circle from
    const btn = buttonRef.current;
    const rect = btn ? btn.getBoundingClientRect() : { left: window.innerWidth, top: 0, width: 0, height: 0 };
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;

    // Max radius needed to cover entire screen from that origin
    const maxRadius = Math.hypot(
      Math.max(originX, window.innerWidth - originX),
      Math.max(originY, window.innerHeight - originY)
    );

    const transition = document.startViewTransition(() => {
      flushSync(() => {
        document.documentElement.classList.toggle('dark', willBeDark);
        setIsDark(willBeDark);
      });
    });

    await transition.ready;

    // Radial circle-reveal expanding from the button outward
    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${originX}px ${originY}px)`,
          `circle(${maxRadius}px at ${originX}px ${originY}px)`,
        ],
      },
      {
        duration: 500,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        pseudoElement: '::view-transition-new(root)',
      }
    );
  };

  return (
    <button
      ref={buttonRef}
      onClick={toggleTheme}
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: 'var(--bg-glass-light)',
        border: '1px solid var(--border-light)',
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.2s, color 0.2s',
      }}
      title="Toggle theme"
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--accent-hover)';
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-glass-light)';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
    >
      {isDark ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
    </button>
  );
});
