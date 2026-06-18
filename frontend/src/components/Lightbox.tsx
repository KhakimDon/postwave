import { useEffect } from "react";
import { ActionIcon, Box, Group, Modal, Text } from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";

/** Фуллскрин-просмотрщик изображений. Для альбома (несколько фото) —
 *  слайдер: стрелки, клавиатура (←/→/Esc), счётчик и лента превью. */
export function Lightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: string[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const count = images.length;
  const go = (i: number) => onIndexChange((i + count) % count);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && count > 1) go(index - 1);
      else if (e.key === "ArrowRight" && count > 1) go(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count]);

  return (
    <Modal
      opened
      onClose={onClose}
      fullScreen
      withCloseButton={false}
      padding={0}
      transitionProps={{ transition: "fade", duration: 160 }}
      styles={{ body: { padding: 0, height: "100dvh", background: "rgba(0,0,0,0.95)" } }}
    >
      <Box
        onClick={onClose}
        style={{
          position: "relative",
          height: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <ActionIcon
          variant="filled"
          color="dark"
          radius="xl"
          size="lg"
          style={{ position: "absolute", top: 16, right: 16, zIndex: 3 }}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close"
        >
          <IconX size={18} />
        </ActionIcon>

        <img
          key={index}
          src={images[index]}
          className="pw-fade"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: "100%",
            maxHeight: count > 1 ? "calc(100dvh - 110px)" : "100dvh",
            objectFit: "contain",
          }}
        />

        {count > 1 && (
          <>
            <ActionIcon
              variant="filled"
              color="dark"
              radius="xl"
              size="xl"
              style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", zIndex: 3 }}
              onClick={(e) => {
                e.stopPropagation();
                go(index - 1);
              }}
              aria-label="Previous"
            >
              <IconChevronLeft size={24} />
            </ActionIcon>
            <ActionIcon
              variant="filled"
              color="dark"
              radius="xl"
              size="xl"
              style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", zIndex: 3 }}
              onClick={(e) => {
                e.stopPropagation();
                go(index + 1);
              }}
              aria-label="Next"
            >
              <IconChevronRight size={24} />
            </ActionIcon>

            <Text
              c="#fff"
              fz="sm"
              fw={600}
              style={{ position: "absolute", top: 20, left: 0, right: 0, textAlign: "center", opacity: 0.85 }}
            >
              {index + 1} / {count}
            </Text>

            {/* Лента превью */}
            <Group
              gap={8}
              justify="center"
              wrap="nowrap"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                bottom: 16,
                left: 0,
                right: 0,
                padding: "0 16px",
                overflowX: "auto",
              }}
            >
              {images.map((src, i) => (
                <Box
                  key={i}
                  onClick={() => onIndexChange(i)}
                  style={{
                    width: 60,
                    height: 60,
                    flexShrink: 0,
                    borderRadius: 10,
                    overflow: "hidden",
                    cursor: "pointer",
                    border:
                      i === index
                        ? "2px solid #fff"
                        : "2px solid rgba(255,255,255,0.25)",
                    opacity: i === index ? 1 : 0.6,
                    transition: "opacity 160ms ease, border-color 160ms ease",
                  }}
                >
                  <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </Box>
              ))}
            </Group>
          </>
        )}
      </Box>
    </Modal>
  );
}
