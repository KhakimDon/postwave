import { ActionIcon, Box, Group, ScrollArea, Stack, Tabs, Text } from "@mantine/core";
import { IconGif, IconMoodSmile, IconSticker, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

/** Боковая панель ввода как в Telegram: вкладки Эмодзи / Стикеры / GIF.
 *  Эмодзи вставляются в поле сообщения (панель не закрывается — можно набрать
 *  несколько подряд). */
const CATEGORIES: { key: string; emojis: string[] }[] = [
  {
    key: "smileys",
    emojis: [
      "😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰",
      "😘","😗","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏",
      "😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠",
      "😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥",
      "😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","🤐","🥴",
      "🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👻","💀","☠️","👽","🤖","🎃",
    ],
  },
  {
    key: "gestures",
    emojis: [
      "👍","👎","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋",
      "🤚","🖐️","🖖","👋","🤝","🙏","✊","👊","🤛","🤜","👏","🙌","👐","🤲","💪","🖕",
      "✍️","🤳","💅","👀","👁️","👅","👄","🧠","🫶","🤝",
    ],
  },
  {
    key: "hearts",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💔","❣️","💕","💞","💓","💗","💖",
      "💘","💝","💟","❤️‍🔥","❤️‍🩹","💋","💯","🔥","✨","⭐","🌟","💫",
    ],
  },
  {
    key: "animals",
    emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔",
      "🐧","🐦","🐤","🦄","🐝","🦋","🐢","🐠","🐳","🐬","🐙","🦀","🦕","🐉","🌸","🌹",
      "🌻","🌷","🍀","🌴","🌵","🌲",
    ],
  },
  {
    key: "food",
    emojis: [
      "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍒","🍑","🥭","🍍","🥥","🥝",
      "🍅","🥑","🌽","🥕","🍔","🍟","🍕","🌭","🍿","🍩","🍪","🎂","🍰","🧁","🍫","🍬",
      "🍭","🍦","☕","🍵","🍺","🍷","🥂","🍾",
    ],
  },
  {
    key: "activities",
    emojis: [
      "⚽","🏀","🏈","⚾","🎾","🏐","🏉","🎱","🏓","🏸","🥊","🎯","🎮","🎲","🎸","🎺",
      "🎻","🎤","🎧","🎬","🎨","🏆","🥇","🎁","🎉","🎊","🚗","✈️","🚀","🚁","⛵","🏍️",
      "🚲","🗺️","🗽","🏰","🏖️","🌋","🎡","🎢",
    ],
  },
  {
    key: "objects",
    emojis: [
      "⌚","📱","💻","⌨️","🖥️","📷","📸","🎥","📞","☎️","📺","📻","⏰","💡","🔦","🔋",
      "💰","💳","💎","🔧","🔨","🔑","🔒","📌","📎","✂️","📝","📚","✅","❌","❓","❗",
      "‼️","💬","🔔","🔕","➕","➖","✔️","🆕",
    ],
  },
];

export function EmojiPanel({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Box
      className="pw-emoji-panel"
      style={{
        width: 320,
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        borderLeft: "1px solid var(--glass-border)",
        background: "var(--surface-1)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <Group justify="space-between" p="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
        <Text fw={700} fz="sm">
          {t("inbox.emojiTitle")}
        </Text>
        <ActionIcon variant="subtle" color="gray" onClick={onClose} aria-label="Close">
          <IconX size={16} />
        </ActionIcon>
      </Group>

      <Tabs
        defaultValue="emoji"
        keepMounted={false}
        style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <Tabs.List grow>
          <Tabs.Tab value="emoji" leftSection={<IconMoodSmile size={16} />} />
          <Tabs.Tab value="stickers" leftSection={<IconSticker size={16} />} />
          <Tabs.Tab value="gif" leftSection={<IconGif size={16} />} />
        </Tabs.List>

        <Tabs.Panel value="emoji" style={{ flex: 1, minHeight: 0 }}>
          <ScrollArea h="100%" type="auto">
            <Stack gap="xs" p="xs">
              {CATEGORIES.map((cat) => (
                <Box key={cat.key}>
                  <Text fz={10} c="dimmed" fw={700} tt="uppercase" mb={4}>
                    {t(`inbox.emojiCat.${cat.key}`)}
                  </Text>
                  <Box
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, 1fr)",
                      gap: 2,
                    }}
                  >
                    {cat.emojis.map((e, i) => (
                      <Box
                        key={`${cat.key}-${i}`}
                        component="button"
                        onClick={() => onPick(e)}
                        className="pw-emoji"
                      >
                        {e}
                      </Box>
                    ))}
                  </Box>
                </Box>
              ))}
            </Stack>
          </ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="stickers" style={{ flex: 1, minHeight: 0 }}>
          <ComingSoon icon={<IconSticker size={30} />} text={t("inbox.comingSoon")} />
        </Tabs.Panel>
        <Tabs.Panel value="gif" style={{ flex: 1, minHeight: 0 }}>
          <ComingSoon icon={<IconGif size={30} />} text={t("inbox.comingSoon")} />
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}

function ComingSoon({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Stack align="center" justify="center" h="100%" gap={8} c="dimmed" p="xl">
      {icon}
      <Text fz="sm" ta="center">
        {text}
      </Text>
    </Stack>
  );
}
