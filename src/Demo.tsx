import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const TOTAL_FRAMES = 90;
export const OUTPUT_NAME = "demo.mp4";

export const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 12 } });
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0e0e12",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          opacity,
          color: "#f5f2ea",
          fontSize: 96,
          fontFamily: "sans-serif",
          fontWeight: 700,
        }}
      >
        Halo, Pijar
      </div>
      <div
        style={{
          opacity,
          color: "#9a958a",
          fontSize: 36,
          fontFamily: "sans-serif",
          marginTop: 24,
        }}
      >
        Komposisi contoh, ganti dengan karyamu.
      </div>
    </AbsoluteFill>
  );
};
