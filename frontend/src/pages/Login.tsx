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
  Input,
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
      notifications.show({ color: "red", message: t("login.errPhone") });
      return;
    }
    if (password.length < 6) {
      notifications.show({ color: "red", message: t("login.errPassword") });
      return;
    }
    setLoading(true);
    try {
      const res =
        mode === "register"
          ? await api.register(phone, password, name.trim() || undefined)
          : await api.login(phone, password);
      tokenStore.set(res.token);
      notifications.show({ color: "teal", message: t("login.welcome") });
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
        position: "relative",
        zIndex: 1,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backgroundImage:
          "linear-gradient(135deg, rgba(8,10,22,0.72), rgba(20,12,40,0.78)), url('/login-bg.jpg'), linear-gradient(135deg, #6f3df0, #7d52f9 60%, #4aa3ff)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Box
        className="pw-rise"
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 36,
          borderRadius: 28,
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(30px) saturate(150%)",
          WebkitBackdropFilter: "blur(30px) saturate(150%)",
          border: "1px solid rgba(255,255,255,0.16)",
          boxShadow:
            "0 30px 90px -24px rgba(0,0,0,0.85), 0 0 60px -20px rgba(125,82,249,0.5), inset 0 1px 0 0 rgba(255,255,255,0.1)",
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
                label={t("login.name")}
                placeholder={t("login.namePh")}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                styles={inputStyles}
                classNames={{ input: "login-input" }}
              />
            )}

            <Input.Wrapper label={t("login.phone")} styles={{ label: inputStyles.label }}>
              <PhoneInput
                international
                defaultCountry="UZ"
                value={phone}
                onChange={setPhone}
                className="pw-phone"
              />
            </Input.Wrapper>

            <PasswordInput
              label={t("login.password")}
              placeholder={t("login.passwordPh")}
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
            {mode === "login" ? t("login.signIn") : t("login.signUp")}
          </Button>

          <Text ta="center" fz="sm" style={{ color: "rgba(255,255,255,0.8)" }}>
            {mode === "login" ? t("login.noAccount") : t("login.haveAccount")}{" "}
            <Anchor
              fw={700}
              c="#fff"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? t("login.createLink") : t("login.loginLink")}
            </Anchor>
          </Text>
        </Stack>
      </Box>
    </Box>
  );
}
