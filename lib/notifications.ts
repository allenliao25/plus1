import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type { PluginListenerHandle } from "@capacitor/core";

let nextNotificationId = 1;

export async function requestLocalNotificationPermission() {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const permissions = await LocalNotifications.checkPermissions();

  if (permissions.display === "granted") {
    return true;
  }

  const requested = await LocalNotifications.requestPermissions();
  return requested.display === "granted";
}

export async function notifyLocalEvent(title: string, body: string) {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const granted = await requestLocalNotificationPermission();

  if (!granted) {
    return;
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id: nextNotificationId++,
        title,
        body,
        schedule: { at: new Date(Date.now() + 200) },
      },
    ],
  });
}

export async function registerPushToken(userId: string) {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const permissions = await PushNotifications.requestPermissions();

  if (permissions.receive !== "granted") {
    return;
  }

  await PushNotifications.register();

  await new Promise<void>((resolve) => {
    let registrationSub: PluginListenerHandle | null = null;
    let errorSub: PluginListenerHandle | null = null;
    let settled = false;

    const finish = async () => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      await registrationSub?.remove();
      await errorSub?.remove();
      resolve();
    };

    const timeoutId = window.setTimeout(() => {
      void finish();
    }, 5_000);

    void PushNotifications.addListener(
      "registration",
      async (tokenInfo) => {
        try {
          const platform = Capacitor.getPlatform();
          const supabase = getSupabaseClient();

          await supabase.from("push_tokens").upsert(
            {
              user_id: userId,
              token: tokenInfo.value,
              platform,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "token" },
          );
        } finally {
          await finish();
        }
      },
    ).then((handle) => {
      registrationSub = handle;
    });

    void PushNotifications.addListener(
      "registrationError",
      async () => {
        await finish();
      },
    ).then((handle) => {
      errorSub = handle;
    });
  });
}
