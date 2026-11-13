package ch.gestion.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Après un redémarrage du téléphone ou une mise à jour : notifications relancées. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) return;
        if (Settings.server(context) == null) return;
        PollJob.schedule(context);
        if (Settings.instant(context)) {
            try {
                InstantService.start(context);
            } catch (Exception ignored) {
                // Démarrage refusé par le système : la tâche périodique prend le relais.
            }
        }
    }
}
