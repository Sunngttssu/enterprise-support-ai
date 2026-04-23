import { useId } from "react";

function mapRange(value, fromLow, fromHigh, toLow, toHigh) {
  if (fromLow === fromHigh) {
    return toLow;
  }
  const percentage = (value - fromLow) / (fromHigh - fromLow);
  return toLow + percentage * (toHigh - toLow);
}

const useInstanceId = () => {
  const id = useId();
  const cleanId = id.replace(/:/g, "");
  return `shadowoverlay-${cleanId}`;
};

export default function RuixenBackground({ children }) {
  const sizing = "stretch";
  // Restored full aggressive parameters from the 21st.dev Ethereal component
  const animation = { scale: 100, speed: 90 };
  const noise = { opacity: 0.15, scale: 1.2 };

  const id = useInstanceId();
  const animationEnabled = animation && animation.scale > 0;

  const displacementScale = animation ? mapRange(animation.scale, 1, 100, 20, 100) : 0;
  // Duration in seconds for the CSS animation (speed 90 → ~1.44s per revolution)
  const animationDurationSec = animation
    ? mapRange(animation.speed, 1, 100, 40, 1.5)
    : 1;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "var(--bg-glass-heavy)",
        overflow: "hidden",
      }}
    >
      {/*
        Scoped CSS keyframe: rotates the hue on the SVG feColorMatrix
        purely via CSS — zero JS thread involvement at 60fps.
        The unique `id` scopes this so multiple instances don't collide.
      */}
      {animationEnabled && (
        <style>{`
          @keyframes hueRotate-${id} {
            from { values: 0; }
            to   { values: 360; }
          }
          #feHueRotate-${id} {
            animation: hueRotate-${id} ${animationDurationSec}s linear infinite;
          }
        `}</style>
      )}
      <div
        style={{
          position: "absolute",
          inset: -displacementScale,
          filter: animationEnabled ? `url(#${id}) blur(4px)` : "none",
          zIndex: 0,
        }}
      >
        {animationEnabled && (
          <svg style={{ position: "absolute", width: 0, height: 0 }}>
            <defs>
              <filter id={id}>
                <feTurbulence
                  result="undulation"
                  numOctaves="2"
                  baseFrequency={`${mapRange(animation.scale, 0, 100, 0.001, 0.0005)},${mapRange(
                    animation.scale,
                    0,
                    100,
                    0.004,
                    0.002
                  )}`}
                  seed="0"
                  type="turbulence"
                />
                {/*
                  id="feHueRotate-${id}" is the hook for the CSS animation above.
                  CSS animates the SVG `values` attribute directly on the
                  compositor thread — no JS frame callbacks needed.
                */}
                <feColorMatrix
                  id={`feHueRotate-${id}`}
                  in="undulation"
                  type="hueRotate"
                  values="0"
                />
                <feColorMatrix
                  in="dist"
                  result="circulation"
                  type="matrix"
                  values="4 0 0 0 1  4 0 0 0 1  4 0 0 0 1  1 0 0 0 0"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="circulation"
                  scale={displacementScale}
                  result="dist"
                />
                <feDisplacementMap
                  in="dist"
                  in2="undulation"
                  scale={displacementScale}
                  result="output"
                />
              </filter>
            </defs>
          </svg>
        )}
        <div
          style={{
            /* Neutral grayscale mask color linked to theme variables */
            backgroundColor: "var(--bg-mask)",
            maskImage: `url('https://framerusercontent.com/images/ceBGguIpUU8luwByxuQz79t7To.png')`,
            maskSize: sizing === "stretch" ? "100% 100%" : "cover",
            maskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskImage: `url('https://framerusercontent.com/images/ceBGguIpUU8luwByxuQz79t7To.png')`,
            WebkitMaskSize: sizing === "stretch" ? "100% 100%" : "cover",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            width: "100%",
            height: "100%",
          }}
        />
      </div>

      {noise && noise.opacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("https://framerusercontent.com/images/g0QcWrxr87K0ufOxIUFBakwYA8.png")`,
            backgroundSize: noise.scale * 200,
            backgroundRepeat: "repeat",
            opacity: noise.opacity,
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      )}

      {/* App Content */}
      <div style={{ position: "relative", zIndex: 10, width: "100%", height: "100%" }}>
        {children}
      </div>
    </div>
  );
}
