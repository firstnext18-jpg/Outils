package ch.gestion.mobile;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.util.TypedValue;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Premier lancement : adresse de l'outil. Ensuite : changer d'adresse et
 * activer les notifications instantanées. Écran construit sans mise en page XML.
 */
public class SettingsActivity extends Activity {
    private EditText address;
    private TextView error;
    private Button save;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(24);
        root.setPadding(pad, pad, pad, pad);

        root.addView(title("Adresse de l'outil de gestion"));
        root.addView(text("Indiquez l'adresse que vous utilisez dans votre navigateur pour ouvrir l'outil "
                + "(elle commence par https://). Vous vous connecterez ensuite avec votre email et votre "
                + "mot de passe habituels.", true));

        address = new EditText(this);
        address.setHint("https://gestion.exemple.ch");
        address.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        address.setImeOptions(EditorInfo.IME_ACTION_DONE);
        address.setSingleLine(true);
        String server = Settings.server(this);
        if (server != null) address.setText(server);
        address.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                saveAddress();
                return true;
            }
            return false;
        });
        root.addView(address);

        error = text("", false);
        error.setTextColor(Color.rgb(220, 38, 38));
        root.addView(error);

        save = new Button(this);
        save.setText(server == null ? "Continuer" : "Enregistrer l'adresse");
        save.setOnClickListener(v -> saveAddress());
        root.addView(save);

        if (server != null) {
            View gap = new View(this);
            gap.setLayoutParams(new LinearLayout.LayoutParams(1, dp(32)));
            root.addView(gap);
            root.addView(title("Notifications"));
            Switch instant = new Switch(this);
            instant.setText("Notifications instantanées");
            instant.setChecked(Settings.instant(this));
            instant.setPadding(0, dp(8), 0, dp(8));
            instant.setOnCheckedChangeListener((button, checked) -> setInstant(checked));
            root.addView(instant);
            root.addView(text("Activée : les nouveaux messages sont vérifiés toutes les 30 secondes, avec une "
                    + "petite notification permanente (exigée par Android). Désactivée : vérification "
                    + "toutes les 15 minutes environ, sans notification permanente.", true));
        }

        ScrollView scroll = new ScrollView(this);
        scroll.addView(root);
        setContentView(scroll);
    }

    private void saveAddress() {
        String server = Settings.normalize(address.getText().toString());
        if (server == null) {
            error.setText("Adresse invalide. Exemple : https://gestion.exemple.ch");
            return;
        }
        error.setText("");
        save.setEnabled(false);
        save.setText("Vérification…");
        new Thread(() -> {
            String problem = check(server);
            runOnUiThread(() -> {
                save.setEnabled(true);
                save.setText("Enregistrer l'adresse");
                if (problem != null) {
                    error.setText(problem);
                    return;
                }
                if (!server.equals(Settings.server(this))) Settings.setServer(this, server);
                finish();
            });
        }, "verification").start();
    }

    /** null si l'outil répond à cette adresse, sinon le message à afficher. */
    private static String check(String server) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(server + "/connexion").openConnection();
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(15_000);
            int code = connection.getResponseCode();
            return code == 200 ? null : "Le serveur répond avec une erreur (" + code + ").";
        } catch (Exception e) {
            return "Serveur injoignable. Vérifiez l'adresse et la connexion à internet.";
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void setInstant(boolean enabled) {
        Settings.setInstant(this, enabled);
        if (enabled) {
            if (Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, 1);
            }
            InstantService.start(this);
        } else {
            InstantService.stop(this);
        }
    }

    @Override
    public void onBackPressed() {
        // Sans adresse, l'application ne peut rien afficher : on la ferme.
        if (Settings.server(this) == null) {
            finishAffinity();
        } else {
            super.onBackPressed();
        }
    }

    private TextView title(String value) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        view.setTypeface(Typeface.DEFAULT_BOLD);
        view.setPadding(0, 0, 0, dp(8));
        return view;
    }

    private TextView text(String value, boolean muted) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        if (muted) view.setAlpha(0.75f);
        view.setPadding(0, dp(4), 0, dp(12));
        return view;
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }
}
