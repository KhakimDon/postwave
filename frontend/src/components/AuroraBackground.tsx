/** Живой aurora/mesh-фон: парящие размытые цветовые пятна за стеклом интерфейса.
 *  Монтируется один раз в корне (за AppShell и экраном входа). */
export function AuroraBackground() {
  return (
    <div className="aurora" aria-hidden>
      <div
        className="aurora__blob"
        style={{
          width: 540,
          height: 540,
          top: "-10%",
          left: "-6%",
          background: "radial-gradient(circle, rgba(124,82,249,0.55), transparent 70%)",
          animation: "pwFloat 19s ease-in-out infinite",
        }}
      />
      <div
        className="aurora__blob"
        style={{
          width: 460,
          height: 460,
          top: "8%",
          right: "-8%",
          background: "radial-gradient(circle, rgba(38,160,238,0.5), transparent 70%)",
          animation: "pwFloat 23s ease-in-out infinite reverse",
        }}
      />
      <div
        className="aurora__blob"
        style={{
          width: 520,
          height: 520,
          bottom: "-14%",
          left: "22%",
          background: "radial-gradient(circle, rgba(20,210,180,0.42), transparent 70%)",
          animation: "pwFloat 27s ease-in-out infinite",
        }}
      />
      <div
        className="aurora__blob"
        style={{
          width: 400,
          height: 400,
          bottom: "4%",
          right: "12%",
          background: "radial-gradient(circle, rgba(190,90,240,0.45), transparent 70%)",
          animation: "pwFloat 21s ease-in-out infinite",
        }}
      />
    </div>
  );
}
