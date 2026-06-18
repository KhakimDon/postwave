import { useEffect, useState } from "react";
import { Avatar, Box, Skeleton } from "@mantine/core";

/** Аватар с плавной загрузкой: пока грузится — shimmer (Skeleton),
 *  затем картинка плавно проявляется (fade). Если фото нет — буква-заглушка. */
export function ChatAvatar({
  src,
  name,
  color,
  size = 38,
  radius = "xl",
}: {
  src?: string;
  name?: string;
  color?: string;
  size?: number;
  radius?: string | number;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // при смене src начинаем загрузку заново
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  const showImg = !!src && !failed;

  return (
    <Box style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {showImg && !loaded && (
        <Skeleton
          circle
          height={size}
          width={size}
          style={{ position: "absolute", inset: 0 }}
        />
      )}
      <Avatar
        size={size}
        radius={radius}
        color={color}
        src={showImg ? src : undefined}
        imageProps={{
          onLoad: () => setLoaded(true),
          onError: () => setFailed(true),
          style: { opacity: loaded ? 1 : 0, transition: "opacity 350ms ease" },
        }}
      >
        {name?.[0]?.toUpperCase() ?? "?"}
      </Avatar>
    </Box>
  );
}
