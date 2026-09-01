import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "BookFlow AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background:
          "linear-gradient(135deg, #1a1f1c 0%, #2d3a32 55%, #3d5a4c 100%)",
        color: "#f4f1ea",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: "-0.03em" }}>
        BookFlow AI
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 32,
          color: "rgba(244,241,234,0.78)",
          maxWidth: 800,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Booking and business management for service businesses
      </div>
    </div>,
    { ...size },
  );
}
