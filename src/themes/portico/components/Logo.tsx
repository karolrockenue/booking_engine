import Image from "next/image";

// Real Portico wordmark. Two PNGs with transparent backgrounds:
//   - portico-logo.png       — black ink (use on light surfaces)
//   - portico-logo-white.png — white ink (use on dark surfaces / over photos)

const NATURAL_W = 696;
const NATURAL_H = 145;
const ASPECT = NATURAL_W / NATURAL_H; // ≈ 4.8

interface Props {
  height?: number;
  surface: "light" | "dark";
}

export function PorticoLogo({ height = 42, surface }: Props) {
  const width = Math.round(height * ASPECT);
  const src = surface === "dark" ? "/portico/portico-logo-white.png" : "/portico/portico-logo.png";
  return (
    <Image
      src={src}
      alt="The Portico Hotel"
      width={NATURAL_W}
      height={NATURAL_H}
      priority
      style={{
        height,
        width,
        objectFit: "contain",
      }}
    />
  );
}
