import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Ikon home-screen iOS (apple-touch-icon). Digenerate saat build — tanpa file
 * biner di repo, konsisten dengan icon.svg aplikasi (latar hijau + daun putih).
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#16a34a",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Daun: dua bentuk tumpang tindih, meniru ikon aplikasi */}
          <div
            style={{
              display: "flex",
              width: 62,
              height: 62,
              background: "#ffffff",
              borderRadius: "62px 6px 62px 62px",
              transform: "rotate(-12deg)",
            }}
          />
          <div
            style={{
              display: "flex",
              width: 12,
              height: 40,
              background: "#ffffff",
              borderRadius: 6,
              marginTop: -14,
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
