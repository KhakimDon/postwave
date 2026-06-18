import { useRef, useState } from "react";
import { ActionIcon, Box, Group, Text } from "@mantine/core";
import { IconPlayerPlayFilled, IconPlayerPauseFilled } from "@tabler/icons-react";

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, "0")}`;
}

/** Компактный плеер голосовых/аудио: кнопка + дорожка прогресса + время.
 *  dark — для исходящих пузырей (тёмный фон). */
export function AudioPlayer({ src, dark }: { src: string; dark?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = ref.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * a.duration;
  }

  const fg = dark ? "#fff" : "var(--mantine-color-brand-6)";
  const track = dark ? "rgba(255,255,255,0.3)" : "var(--mantine-color-gray-3)";
  const timeColor = dark ? "rgba(255,255,255,0.85)" : "var(--mantine-color-dimmed)";

  return (
    <Group gap={8} wrap="nowrap" style={{ minWidth: 190, padding: "2px 4px" }}>
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          setCur(a.currentTime);
          setProgress(a.duration ? a.currentTime / a.duration : 0);
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setCur(0);
        }}
      />
      <ActionIcon
        variant="filled"
        radius="xl"
        size={34}
        color={dark ? "gray" : "brand"}
        onClick={toggle}
        style={dark ? { background: "rgba(255,255,255,0.25)" } : undefined}
      >
        {playing ? (
          <IconPlayerPauseFilled size={16} />
        ) : (
          <IconPlayerPlayFilled size={16} />
        )}
      </ActionIcon>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Box
          onClick={seek}
          style={{
            height: 4,
            borderRadius: 2,
            background: track,
            cursor: "pointer",
          }}
        >
          <Box
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              borderRadius: 2,
              background: fg,
            }}
          />
        </Box>
        <Text fz={10} mt={3} style={{ color: timeColor }}>
          {fmt(cur)} / {fmt(dur)}
        </Text>
      </Box>
    </Group>
  );
}
