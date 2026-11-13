package ch.gestion.mobile;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * Fenêtre de l'outil de gestion. Seules les pages de l'outil s'y ouvrent ; les
 * autres liens (sites des clients, e-banking…) partent dans le navigateur.
 */
public class MainActivity extends Activity {
    private static final int FILE_REQUEST = 1;
    private static final int PERMISSION_REQUEST = 2;

    private WebView web;
    private String loadedServer;
    private String pendingPath = "/";
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Poller.createChannels(this);
        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(web);
        configure(web);
        readIntent(getIntent());
    }

    private void configure(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        // Permet à l'outil de reconnaître l'application (notifications gérées ici).
        settings.setUserAgentString(settings.getUserAgentString() + " GestionMobile/" + versionName());
        CookieManager.getInstance().setAcceptCookie(true);

        view.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                return handleLink(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                saveSession();
            }
        });

        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = params.createIntent();
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                try {
                    startActivityForResult(intent, FILE_REQUEST);
                    return true;
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
            }
        });

        // Factures, PDF, fichiers partagés : téléchargés avec la session de l'outil.
        view.setDownloadListener((url, userAgent, disposition, mimeType, length) -> {
            if (!url.startsWith("https://")) return;
            if (Build.VERSION.SDK_INT < 29 && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[] {Manifest.permission.WRITE_EXTERNAL_STORAGE}, PERMISSION_REQUEST);
                Toast.makeText(this, "Autorisez l'accès, puis touchez à nouveau le lien.", Toast.LENGTH_LONG).show();
                return;
            }
            String name = URLUtil.guessFileName(url, disposition, mimeType);
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
                    .setMimeType(mimeType)
                    .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url))
                    .addRequestHeader("User-Agent", userAgent)
                    .setTitle(name)
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            getSystemService(DownloadManager.class).enqueue(request);
            Toast.makeText(this, "Téléchargement : " + name, Toast.LENGTH_SHORT).show();
        });
    }

    private String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (PackageManager.NameNotFoundException e) {
            return "1";
        }
    }

    /** true si le lien est traité ici (réglages, autre site) ; false pour l'ouvrir dans la fenêtre. */
    private boolean handleLink(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        if ("gestion-app".equals(scheme)) {
            if ("reglages".equals(uri.getHost())) startActivity(new Intent(this, SettingsActivity.class));
            return true;
        }
        String server = Settings.server(this);
        if (server != null && server.equals(origin(uri))) return false;
        if (scheme.equals("http") || scheme.equals("https") || scheme.equals("mailto") || scheme.equals("tel")) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException ignored) {
                // Aucune application pour ce lien.
            }
        }
        return true;
    }

    private static String origin(Uri uri) {
        if (uri.getScheme() == null || uri.getHost() == null) return "";
        return uri.getScheme().toLowerCase() + "://" + uri.getHost().toLowerCase()
                + (uri.getPort() > 0 ? ":" + uri.getPort() : "");
    }

    /** Notification ou raccourci : gestion-app://page/discussions/… → page de l'outil. */
    private void readIntent(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !"gestion-app".equals(data.getScheme()) || !"page".equals(data.getHost())) return;
        String path = data.getEncodedPath() == null ? "/" : data.getEncodedPath();
        if (data.getEncodedQuery() != null) path += "?" + data.getEncodedQuery();
        pendingPath = path.startsWith("/") ? path : "/";
        if (loadedServer != null) {
            web.loadUrl(loadedServer + pendingPath);
            pendingPath = "/";
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readIntent(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        String server = Settings.server(this);
        if (server == null) {
            startActivity(new Intent(this, SettingsActivity.class));
            return;
        }
        if (!server.equals(loadedServer)) {
            loadedServer = server;
            web.loadUrl(server + pendingPath);
            pendingPath = "/";
        }
        PollJob.schedule(this);
        if (Settings.instant(this)) InstantService.start(this);
        askNotificationPermission();
    }

    @Override
    protected void onPause() {
        saveSession();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    /** Copie la session de l'outil pour la lecture des notifications en arrière-plan. */
    private void saveSession() {
        String server = Settings.server(this);
        if (server == null) return;
        String cookie = CookieManager.getInstance().getCookie(server);
        if (cookie != null) Settings.setCookie(this, cookie);
    }

    private void askNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33) return;
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        if (getPreferences(MODE_PRIVATE).getBoolean("notificationsAsked", false)) return;
        getPreferences(MODE_PRIVATE).edit().putBoolean("notificationsAsked", true).apply();
        requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, PERMISSION_REQUEST);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != FILE_REQUEST || fileCallback == null) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                result = new Uri[count];
                for (int i = 0; i < count; i++) result[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                result = new Uri[] {data.getData()};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
