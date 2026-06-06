import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
          borderRadius: 8,
          color: "white",
          fontSize: 16,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        啄米
      </div>
    ),
    { ...size }
  );
}
