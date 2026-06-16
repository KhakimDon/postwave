import { Text, Image, Avatar, Box, Group, Stack } from "@mantine/core";
import {
  IconBrandInstagram,
  IconHeart,
  IconMessageCircle,
  IconSend,
  IconBookmark,
  IconEye,
  IconShare3,
  IconDots,
  IconMusic,
  IconPlayerPlayFilled,
  IconMapPin,
} from "@tabler/icons-react";
import type { IgPostType, Platform } from "../api/types";

export interface PreviewMedia {
  url: string;
  isVideo: boolean;
}

interface Props {
  platform: Platform;
  content: string;
  media: PreviewMedia[];
  accountName?: string;
  igPostType?: IgPostType;
  location?: string;
}

/** Универсальный показ медиа: видео автоиграет, фото — картинкой. */
function MediaView({
  item,
  h,
  rounded,
}: {
  item?: PreviewMedia;
  h: number | string;
  rounded?: number;
}) {
  if (!item) return null;
  const style = {
    width: "100%",
    height: h,
    objectFit: "cover" as const,
    borderRadius: rounded,
    display: "block",
  };
  if (item.isVideo) {
    return (
      <video src={item.url} style={style} autoPlay muted loop playsInline />
    );
  }
  return <Image src={item.url} h={h} fit="cover" radius={rounded} />;
}

export function PlatformPreview({
  platform,
  content,
  media,
  accountName,
  igPostType = "feed",
  location,
}: Props) {
  if (platform === "instagram") {
    return (
      <InstagramPreview
        content={content}
        media={media}
        name={accountName}
        postType={igPostType}
        location={location}
      />
    );
  }
  return <TelegramPreview content={content} media={media} name={accountName} />;
}

function initial(name?: string) {
  return (name?.replace(/^@/, "")[0] ?? "К").toUpperCase();
}

/* ----------------------------- Telegram ----------------------------- */
function TelegramPreview({
  content,
  media,
  name,
}: {
  content: string;
  media: PreviewMedia[];
  name?: string;
}) {
  const channel = name?.replace(/^@/, "") ?? "ваш канал";
  const hasMedia = media.length > 0;

  return (
    <Box
      style={{
        borderRadius: 18,
        padding: "20px 14px",
        background:
          "linear-gradient(180deg, #dfe9f3 0%, #d3e2f0 50%, #c7dbec 100%)",
      }}
    >
      <Group align="flex-end" gap={8} wrap="nowrap">
        <Avatar
          size={32}
          radius="xl"
          variant="gradient"
          gradient={{ from: "#2ea6da", to: "#1c93d2", deg: 135 }}
        >
          <Text fz="sm" fw={700} c="white">
            {initial(name)}
          </Text>
        </Avatar>

        <Box
          style={{
            background: "#fff",
            borderRadius: 14,
            borderBottomLeftRadius: 4,
            boxShadow: "0 1px 2px rgba(16,35,47,.15)",
            overflow: "hidden",
            maxWidth: 320,
            width: "100%",
          }}
        >
          {hasMedia && (
            <Box style={{ position: "relative" }}>
              <MediaView item={media[0]} h={media.length > 1 ? 150 : 190} />
              {media.length > 1 && (
                <Box
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    background: "rgba(0,0,0,.6)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 10,
                  }}
                >
                  1/{media.length}
                </Box>
              )}
            </Box>
          )}

          <Box px={12} pt={hasMedia ? 8 : 10} pb={6}>
            <Text fz="sm" fw={700} c="#168acd" mb={2}>
              {channel}
            </Text>
            <Text
              fz="sm"
              c="#0f1419"
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {content || "Текст поста появится здесь…"}
            </Text>
            <Group gap={6} justify="flex-end" mt={4} c="#8a9aa9" wrap="nowrap">
              <IconShare3 size={13} />
              <Group gap={2} align="center">
                <IconEye size={13} />
                <Text fz={11}>1,2K</Text>
              </Group>
              <Text fz={11}>12:00</Text>
            </Group>
          </Box>
        </Box>
      </Group>
    </Box>
  );
}

/* ----------------------------- Instagram ----------------------------- */
function IgAvatar({ size = 30 }: { size?: number }) {
  return (
    <Box
      style={{
        padding: 2,
        borderRadius: "50%",
        background:
          "linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)",
      }}
    >
      <Avatar size={size} radius="xl" style={{ border: "2px solid #fff" }}>
        <IconBrandInstagram size={size / 2} />
      </Avatar>
    </Box>
  );
}

function InstagramPreview({
  content,
  media,
  name,
  postType,
  location,
}: {
  content: string;
  media: PreviewMedia[];
  name?: string;
  postType: IgPostType;
  location?: string;
}) {
  const user = name?.replace(/^@/, "") ?? "your_brand";
  if (postType === "stories") return <StoriesPreview media={media} user={user} />;
  if (postType === "reels")
    return <ReelsPreview content={content} media={media} user={user} />;
  return (
    <FeedPreview
      content={content}
      media={media}
      user={user}
      carousel={postType === "carousel"}
      location={location}
    />
  );
}

function MediaPlaceholder({ h, text }: { h: number; text: string }) {
  return (
    <Box
      h={h}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fafafa",
        color: "#8e8e8e",
        fontSize: 13,
        textAlign: "center",
        padding: 16,
      }}
    >
      {text}
    </Box>
  );
}

function FeedPreview({
  content,
  media,
  user,
  carousel,
  location,
}: {
  content: string;
  media: PreviewMedia[];
  user: string;
  carousel: boolean;
  location?: string;
}) {
  return (
    <Box
      style={{
        background: "#fff",
        border: "1px solid #dbdbdb",
        borderRadius: 12,
        overflow: "hidden",
        maxWidth: 340,
        width: "100%",
      }}
    >
      <Group p={10} gap={10} wrap="nowrap" justify="space-between">
        <Group gap={10} wrap="nowrap">
          <IgAvatar />
          <Box>
            <Text fz="sm" fw={600} c="#262626" lh={1.1}>
              {user}
            </Text>
            {location && (
              <Text fz={11} c="#262626">
                {location}
              </Text>
            )}
          </Box>
        </Group>
        <IconDots size={18} color="#262626" />
      </Group>

      {media[0] ? (
        <Box style={{ position: "relative" }}>
          <MediaView item={media[0]} h={300} />
          {carousel && (
            <>
              <Box
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  background: "rgba(0,0,0,.6)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                1/{Math.max(media.length, 2)}
              </Box>
              <Group
                gap={4}
                justify="center"
                style={{ position: "absolute", bottom: 10, left: 0, right: 0 }}
              >
                {Array.from({ length: Math.max(media.length, 2) }).map((_, i) => (
                  <Box
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: i === 0 ? "#3897f0" : "rgba(255,255,255,.7)",
                    }}
                  />
                ))}
              </Group>
            </>
          )}
        </Box>
      ) : (
        <MediaPlaceholder h={300} text="Добавьте фото для ленты" />
      )}

      <Group justify="space-between" px={12} pt={10}>
        <Group gap={14} c="#262626">
          <IconHeart size={24} />
          <IconMessageCircle size={24} />
          <IconSend size={24} />
        </Group>
        <IconBookmark size={24} color="#262626" />
      </Group>

      <Box px={12} pt={8} pb={12}>
        <Text fz="sm" fw={600} c="#262626" mb={2}>
          Нравится: 1 248
        </Text>
        <Text
          fz="sm"
          c="#262626"
          lineClamp={3}
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          <Text span fw={600} fz="sm">
            {user}{" "}
          </Text>
          {content || "Подпись к фото появится здесь…"}
        </Text>
      </Box>
    </Box>
  );
}

function ReelsPreview({
  content,
  media,
  user,
}: {
  content: string;
  media: PreviewMedia[];
  user: string;
}) {
  return (
    <Box
      style={{
        position: "relative",
        maxWidth: 240,
        width: "100%",
        aspectRatio: "9 / 16",
        borderRadius: 14,
        overflow: "hidden",
        background: "#000",
        margin: "0 auto",
      }}
    >
      {media[0] ? (
        <MediaView item={media[0]} h="100%" />
      ) : (
        <Box
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            gap: 8,
          }}
        >
          <IconPlayerPlayFilled size={40} />
          <Text fz="xs" c="gray.4" ta="center" px="md">
            Загрузите вертикальное видео
          </Text>
        </Box>
      )}

      <Box
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,.25) 0%, transparent 30%, transparent 55%, rgba(0,0,0,.65) 100%)",
          pointerEvents: "none",
        }}
      />

      <Stack
        gap={16}
        align="center"
        style={{ position: "absolute", right: 8, bottom: 70, color: "#fff" }}
      >
        <IconHeart size={26} />
        <IconMessageCircle size={26} />
        <IconSend size={26} />
        <IconDots size={26} />
      </Stack>

      <Box
        style={{ position: "absolute", left: 10, right: 44, bottom: 12, color: "#fff" }}
      >
        <Group gap={6} mb={6}>
          <Avatar size={22} radius="xl" style={{ border: "1px solid #fff" }}>
            <IconBrandInstagram size={12} />
          </Avatar>
          <Text fz="xs" fw={700} c="#fff">
            {user}
          </Text>
        </Group>
        <Text fz={11} c="#fff" lineClamp={2} style={{ whiteSpace: "pre-wrap" }}>
          {content || "Подпись к Reels…"}
        </Text>
        <Group gap={4} mt={6} c="#fff">
          <IconMusic size={12} />
          <Text fz={10} c="#fff">
            Оригинальный звук · {user}
          </Text>
        </Group>
      </Box>
    </Box>
  );
}

function StoriesPreview({
  media,
  user,
}: {
  media: PreviewMedia[];
  user: string;
}) {
  return (
    <Box
      style={{
        position: "relative",
        maxWidth: 240,
        width: "100%",
        aspectRatio: "9 / 16",
        borderRadius: 14,
        overflow: "hidden",
        background: "#1a1a1a",
        margin: "0 auto",
      }}
    >
      {media[0] ? (
        <MediaView item={media[0]} h="100%" />
      ) : (
        <MediaPlaceholder h={420} text="Фото или видео для Stories" />
      )}

      <Group gap={3} style={{ position: "absolute", top: 8, left: 8, right: 8 }}>
        <Box style={{ flex: 1, height: 2, borderRadius: 2, background: "#fff" }} />
        <Box
          style={{ flex: 1, height: 2, borderRadius: 2, background: "rgba(255,255,255,.4)" }}
        />
        <Box
          style={{ flex: 1, height: 2, borderRadius: 2, background: "rgba(255,255,255,.4)" }}
        />
      </Group>

      <Group
        gap={8}
        style={{ position: "absolute", top: 18, left: 10, color: "#fff" }}
      >
        <Avatar size={26} radius="xl" style={{ border: "1px solid #fff" }}>
          <IconBrandInstagram size={14} />
        </Avatar>
        <Text fz="xs" fw={700} c="#fff">
          {user}
        </Text>
        <Text fz={11} c="gray.3">
          сейчас
        </Text>
      </Group>

      <Group
        gap={6}
        style={{ position: "absolute", bottom: 12, left: 10, right: 10, color: "#fff" }}
      >
        <IconMapPin size={14} />
        <Text fz={11} c="#fff">
          История · 24 часа
        </Text>
      </Group>
    </Box>
  );
}
