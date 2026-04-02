/**
 * TypingIndicator.jsx — Premium three-dot typing animation with Framer Motion
 */
import { motion } from 'framer-motion';

const DOT_COLORS = ['#6d7ef7', '#9d5bf7', '#5a67f2'];

export default function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 0' }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: DOT_COLORS[i],
            display: 'block',
            boxShadow: `0 0 8px ${DOT_COLORS[i]}88`,
          }}
          animate={{
            y: [0, -8, 0],
            opacity: [0.5, 1, 0.5],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            delay: i * 0.18,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
