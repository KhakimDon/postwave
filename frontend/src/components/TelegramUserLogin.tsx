import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Divider,
  Loader,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import QRCode from "react-qr-code";
import { api } from "../api/client";

/** Подключение СВОЕГО Telegram-аккаунта (MTProto). Сразу показываем QR, а снизу —
 *  поле для входа по номеру. Кто хочет — сканирует QR, кто хочет — вводит номер.
 *  2FA-пароль (если включён) — общий шаг. По завершении дёргает onConnected. */
export function TelegramUserLogin({ onConnected }: { onConnected: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"start" | "code" | "password">("start");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loginId, setLoginId] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [loading, setLoading] = useState(false);

  // QR-вход активен на стартовом экране: токен + поллинг статуса.
  useEffect(() => {
    if (step !== "start") return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = (lid: string) => {
      timer = setTimeout(async () => {
        if (!alive) return;
        try {
          const res = await api.tgUserLoginQrPoll(lid);
          if (!alive) return;
          if (res.status === "ok") {
            notifications.show({ color: "teal", message: t("inbox.connectedToast") });
            onConnected();
            return;
          }
          if (res.status === "password_needed") {
            setLoginId(lid);
            setStep("password");
            notifications.show({ color: "blue", message: t("inbox.twofaToast") });
            return;
          }
          if (res.url) setQrUrl(res.url);
          poll(lid);
        } catch {
          poll(lid);
        }
      }, 2500);
    };

    setQrUrl("");
    api
      .tgUserLoginQrStart()
      .then((r) => {
        if (!alive) return;
        setQrUrl(r.url);
        poll(r.login_id);
      })
      .catch((e) =>
        notifications.show({ color: "red", message: (e as Error).message })
      );

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function startLogin() {
    setLoading(true);
    try {
      const r = await api.tgUserLoginStart(phone.trim());
      setLoginId(r.login_id);
      setStep("code");
      notifications.show({ color: "blue", message: t("inbox.codeSentToast") });
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function submitCode() {
    setLoading(true);
    try {
      const r = await api.tgUserLoginCode(loginId, code.trim());
      if (r.status === "password_needed") {
        setStep("password");
        notifications.show({ color: "blue", message: t("inbox.twofaToast") });
      } else {
        notifications.show({ color: "teal", message: t("inbox.connectedToast") });
        onConnected();
      }
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function submitPassword() {
    setLoading(true);
    try {
      await api.tgUserLoginPassword(loginId, password);
      notifications.show({ color: "teal", message: t("inbox.connectedToast") });
      onConnected();
    } catch (e) {
      notifications.show({ color: "red", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  if (step === "code") {
    return (
      <Stack>
        <Text fz="sm" c="dimmed">
          {t("inbox.codeHint")}
        </Text>
        <TextInput
          label={t("inbox.codeLabel")}
          placeholder={t("inbox.codePh")}
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
        />
        <Button loading={loading} onClick={submitCode} disabled={!code.trim()}>
          {t("inbox.confirm")}
        </Button>
      </Stack>
    );
  }

  if (step === "password") {
    return (
      <Stack>
        <Text fz="sm" c="dimmed">
          {t("inbox.passwordHint")}
        </Text>
        <PasswordInput
          label={t("inbox.passwordLabel")}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        <Button loading={loading} onClick={submitPassword} disabled={!password}>
          {t("inbox.login")}
        </Button>
      </Stack>
    );
  }

  // step === "start": QR сверху + вход по номеру снизу
  return (
    <Stack gap="md">
      <Stack align="center" gap="sm">
        <Text fz="sm" c="dimmed" ta="center">
          {t("inbox.qrHint")}
        </Text>
        <Box
          style={{
            background: "#fff",
            padding: 16,
            borderRadius: 16,
            width: 232,
            height: 232,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {qrUrl ? <QRCode value={qrUrl} size={200} /> : <Loader />}
        </Box>
      </Stack>

      <Divider label={t("inbox.orPhone")} labelPosition="center" />

      <TextInput
        label={t("inbox.phoneLabel")}
        placeholder={t("inbox.phonePh")}
        value={phone}
        onChange={(e) => setPhone(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && phone.trim().length >= 6) startLogin();
        }}
      />
      <Button
        variant="light"
        loading={loading}
        onClick={startLogin}
        disabled={phone.trim().length < 6}
      >
        {t("inbox.getCode")}
      </Button>
    </Stack>
  );
}
