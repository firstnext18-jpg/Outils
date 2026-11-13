package ch.gestion.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Lit les nouvelles notifications de l'utilisateur connecté
 * (GET /api/notifications?apres=n, avec la session de l'application) et les
 * affiche dans celles d'Android.
 */
final class Poller {
    static final String CHANNEL_MESSAGES = "messages";
    static final String CHANNEL_SERVICE = "service";

    private Poller() {}

    static void createChannels(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel messages = new NotificationChannel(
                CHANNEL_MESSAGES, "Messages et alertes", NotificationManager.IMPORTANCE_HIGH);
        messages.setDescription("Nouveaux messages, fichiers des clients, sites hors ligne, renouvellements");
        manager.createNotificationChannel(messages);
        NotificationChannel service = new NotificationChannel(
                CHANNEL_SERVICE, "Notifications instantanées", NotificationManager.IMPORTANCE_MIN);
        service.setDescription("Indique que les notifications instantanées sont actives");
        service.setShowBadge(false);
        manager.createNotificationChannel(service);
    }

    /** Une lecture ; jamais deux en même temps (tâche périodique et mode instantané). */
    static synchronized void poll(Context context) {
        String server = Settings.server(context);
        String cookie = Settings.cookie(context);
        if (server == null || cookie == null || cookie.isEmpty()) return;
        long cursor = Settings.cursor(context);
        HttpURLConnection connection = null;
        try {
            URL url = new URL(server + "/api/notifications" + (cursor >= 0 ? "?apres=" + cursor : ""));
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestProperty("Cookie", cookie);
            connection.setRequestProperty("Accept", "application/json");
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(15_000);
            connection.setUseCaches(false);
            if (connection.getResponseCode() != 200) return; // déconnecté ou serveur indisponible
            JSONObject data = new JSONObject(read(connection.getInputStream()));
            JSONArray items = data.optJSONArray("notifications");
            if (cursor >= 0 && items != null && items.length() > 0) {
                Context app = context.getApplicationContext();
                createChannels(app);
                if (items.length() > 3) {
                    // Après une longue absence : un seul résumé.
                    JSONObject last = items.getJSONObject(items.length() - 1);
                    show(app, 1, "Gestion", items.length() + " nouvelles notifications", last.optString("url", "/"));
                } else {
                    for (int i = 0; i < items.length(); i++) {
                        JSONObject item = items.getJSONObject(i);
                        show(app, item.optInt("id", i + 2), item.optString("title", "Gestion"),
                                item.optString("body", ""), item.optString("url", "/"));
                    }
                }
            }
            long latest = data.optLong("latest", cursor);
            if (latest != cursor) Settings.setCursor(context, latest);
        } catch (Exception ignored) {
            // Hors ligne : nouvel essai à la prochaine lecture.
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String read(InputStream input) throws Exception {
        try (InputStream in = input; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) > 0) {
                out.write(buffer, 0, n);
                if (out.size() > 1_000_000) throw new IllegalStateException("réponse trop longue");
            }
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }

    private static void show(Context context, int id, String title, String body, String path) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (!manager.areNotificationsEnabled()) return;
        Intent open = new Intent(context, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .setData(Uri.parse("gestion-app://page" + (path.startsWith("/") ? path : "/")))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
                context, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(context, CHANNEL_MESSAGES)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(pending)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_MESSAGE)
                .build();
        manager.notify(id, notification);
    }
}
