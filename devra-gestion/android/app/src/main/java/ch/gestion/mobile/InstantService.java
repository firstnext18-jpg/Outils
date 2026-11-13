package ch.gestion.mobile;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;

/**
 * Option « notifications instantanées » : lecture toutes les 30 secondes,
 * avec une notification discrète et permanente (exigée par Android).
 */
public class InstantService extends Service {
    private static final int NOTIFICATION_ID = Integer.MAX_VALUE;
    private static final long EVERY_MS = 30_000;

    private HandlerThread thread;
    private Handler handler;
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            Poller.poll(InstantService.this);
            handler.postDelayed(this, EVERY_MS);
        }
    };

    static void start(Context context) {
        context.startForegroundService(new Intent(context, InstantService.class));
    }

    static void stop(Context context) {
        context.stopService(new Intent(context, InstantService.class));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!Settings.instant(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        Poller.createChannels(this);
        PendingIntent settings = PendingIntent.getActivity(this, 0,
                new Intent(this, SettingsActivity.class), PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(this, Poller.CHANNEL_SERVICE)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle("Notifications instantanées actives")
                .setContentText("Toucher pour modifier les réglages")
                .setContentIntent(settings)
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        if (thread == null) {
            thread = new HandlerThread("notifications-instantanees");
            thread.start();
            handler = new Handler(thread.getLooper());
            handler.post(tick);
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (handler != null) handler.removeCallbacks(tick);
        if (thread != null) thread.quitSafely();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
