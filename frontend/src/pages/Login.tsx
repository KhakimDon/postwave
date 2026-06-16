import { useState } from "react";
import {
  Stack,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Anchor,
  Box,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { Logo } from "../components/Logo";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { api, tokenStore, type AuthUser } from "../api/client";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

const inputStyles = {
  label: { color: "rgba(255,255,255,0.9)", marginBottom: 4 },
  input: {
    background: "rgba(255,255,255,0.10)",
    borderColor: "rgba(255,255,255,0.25)",
    color: "#fff",
  },
} as const;

export function Login({ onAuth }: { onAuth: (user: AuthUser) => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState<string | undefined>("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!phone || !isValidPhoneNumber(phone)) {
      notifications.show({ color: "red", message: t("err_phone") });
      return;
    }
    if (password.length < 6) {
      notifications.show({ color: "red", message: t("err_password") });
      return;
    }
    setLoading(true);
    try {
      const res =
        mode === "register"
          ? await api.register(phone, password, name.trim() || undefined)
          : await api.login(phone, password);
      tokenStore.set(res.token);
      notifications.show({ color: "teal", message: t("welcome") });
      onAuth(res.user);
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backgroundImage:
          "linear-gradient(135deg, rgba(90,40,160,0.55), rgba(40,20,70,0.55)), url('/login-bg.jpg'), linear-gradient(135deg, #7d52f9, #b06bf9 60%, #f59ac0)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Box
        style={{
          width: "100%",
          maxWidth: 400,
          padding: 32,
          borderRadius: 20,
          background: "rgba(255,255,255,0.12)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          border: "1px solid rgba(255,255,255,0.25)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        }}
      >
        <Stack gap="lg">
          <Group justify="space-between">
            <Group gap={10}>
              <Logo size={24} color="#fff" />
              <Text fw={800} fz={24} c="#fff" tt="uppercase" style={{ letterSpacing: 1 }}>
                Postwave
              </Text>
            </Group>
            <LanguageSwitcher light variant="outline" />
          </Group>

          <Stack gap="sm">
            {mode === "register" && (
              <TextInput
                label={t("name")}
                placeholder={t("name_ph")}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                styles={inputStyles}
                classNames={{ input: "login-input" }}
              />
            )}

            <Box>
              <Text fz="sm" mb={4} style={{ color: "rgba(255,255,255,0.9)" }}>
                {t("phone")}
              </Text>
              <PhoneInput
                international
                defaultCountry="UZ"
                value={phone}
                onChange={setPhone}
                className="pw-phone"
              />
            </Box>

            <PasswordInput
              label={t("password")}
              placeholder={t("password_ph")}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              styles={{
                label: inputStyles.label,
                input: inputStyles.input,
                innerInput: { color: "#fff" },
              }}
              classNames={{ input: "login-input", innerInput: "login-input" }}
            />
          </Stack>

          <Button
            fullWidth
            size="md"
            loading={loading}
            onClick={submit}
            variant="gradient"
            gradient={{ from: "brand.6", to: "grape.5", deg: 135 }}
          >
            {mode === "login" ? t("sign_in") : t("sign_up")}
          </Button>

          <Text ta="center" fz="sm" style={{ color: "rgba(255,255,255,0.8)" }}>
            {mode === "login" ? t("no_account") : t("have_account")}{" "}
            <Anchor
              fw={700}
              c="#fff"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? t("create_link") : t("login_link")}
            </Anchor>
          </Text>
        </Stack>
      </Box>
    </Box>
  );
}
