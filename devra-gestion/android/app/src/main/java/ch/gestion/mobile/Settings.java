package ch.gestion.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import java.net.URI;
import java.util.Locale;

/**
 * Réglages de l'application : adresse de l'outil (saisie au premier lancement,
 * rien n'est écrit dans l'application), session pour les notifications, dernière
 * notification affichée et option « notifications instantanées ».
 */
final class Settings {
    private static final String FILE = "reglages";

    private Settings() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    /** « gestion.exemple.ch » → « https://gestion.exemple.ch », ou null si invalide (https obligatoire). */
    static String normalize(String input) {
        if (input == null) return null;
        String value = input.trim();
        if (value.isEmpty()) return null;
        if (!value.toLowerCase(Locale.ROOT).matches("^[a-z]+://.*")) value = "https://" + value;
        try {
            URI uri = new URI(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) return null;
            String host = uri.getHost().toLowerCase(Locale.ROOT);
            return "https://" + host + (uri.getPort() > 0 ? ":" + uri.getPort() : "");
        } catch (Exception e) {
            return null;
        }
    }

    static String server(Context context) {
        return normalize(prefs(context).getString("server", null));
    }

    /** Nouvelle adresse : la session et la dernière notification vue sont oubliées. */
    static void setServer(Context context, String server) {
        prefs(context).edit()
                .putString("server", server)
                .remove("cookie")
                .remove("cursor")
                .apply();
    }

    /** Cookies de la session de l'outil (copiés depuis la fenêtre à chaque page). */
    static String cookie(Context context) {
        return prefs(context).getString("cookie", null);
    }

    static void setCookie(Context context, String cookie) {
        prefs(context).edit().putString("cookie", cookie).apply();
    }

    /** Numéro de la dernière notification vue, ou -1 (première lecture). */
    static long cursor(Context context) {
        return prefs(context).getLong("cursor", -1);
    }

    static void setCursor(Context context, long cursor) {
        prefs(context).edit().putLong("cursor", cursor).apply();
    }

    static boolean instant(Context context) {
        return prefs(context).getBoolean("instant", false);
    }

    static void setInstant(Context context, boolean instant) {
        prefs(context).edit().putBoolean("instant", instant).apply();
    }
}
