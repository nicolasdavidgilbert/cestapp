package site.insforge.cestapp;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.CookieManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "NativeSession")
public class NativeSessionPlugin extends Plugin {
    private static final String KEYSTORE_PROVIDER = "AndroidKeyStore";
    private static final String KEY_ALIAS = "cestapp_refresh_token_v1";
    private static final String PREFERENCES_NAME = "cestapp_secure_session";
    private static final String CIPHERTEXT_KEY = "refresh_token_ciphertext";
    private static final String IV_KEY = "refresh_token_iv";
    private static final String LEGACY_ACCESS_COOKIE = "insforge_client_access_token";
    private static final String LEGACY_REFRESH_COOKIE = "insforge_client_refresh_token";
    private static final String LEGACY_CSRF_COOKIE = "insforge_csrf_token";
    private static final int CONNECT_TIMEOUT_MS = 15_000;
    private static final int READ_TIMEOUT_MS = 20_000;
    private static final int MAX_RESPONSE_CHARS = 1_048_576;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void signIn(PluginCall call) {
        String email = requiredString(call, "email");
        String password = requiredString(call, "password");
        if (email == null || password == null) return;

        JSONObject body = new JSONObject();
        put(body, "email", email);
        put(body, "password", password);
        executeSessionRequest(call, "/api/auth/native/sign-in", body, false);
    }

    @PluginMethod
    public void signUp(PluginCall call) {
        String email = requiredString(call, "email");
        String password = requiredString(call, "password");
        String name = requiredString(call, "name");
        if (email == null || password == null || name == null) return;

        JSONObject body = new JSONObject();
        put(body, "email", email);
        put(body, "password", password);
        put(body, "name", name);
        executeSessionRequest(call, "/api/auth/native/sign-up", body, true);
    }

    @PluginMethod
    public void verifyEmail(PluginCall call) {
        String email = requiredString(call, "email");
        String code = requiredString(call, "code");
        if (email == null || code == null) return;

        JSONObject body = new JSONObject();
        put(body, "email", email);
        put(body, "code", code);
        executeSessionRequest(call, "/api/auth/native/verify-email", body, false);
    }

    @PluginMethod
    public void exchangeOAuthCode(PluginCall call) {
        String code = requiredString(call, "code");
        String codeVerifier = requiredString(call, "codeVerifier");
        if (code == null || codeVerifier == null) return;

        JSONObject body = new JSONObject();
        put(body, "code", code);
        put(body, "codeVerifier", codeVerifier);
        executeSessionRequest(call, "/api/auth/native/oauth/exchange", body, false);
    }

    @PluginMethod
    public void refreshSession(PluginCall call) {
        executor.execute(() -> {
            try {
                String refreshToken = readRefreshToken();
                if (refreshToken == null) {
                    call.reject("No hay una sesión nativa guardada.", "NO_SESSION");
                    return;
                }

                JSONObject body = new JSONObject();
                put(body, "refreshToken", refreshToken);
                JSONObject response = postJson("/api/auth/native/refresh", body);
                storeSessionResponse(response);
                call.resolve(toPublicSession(response));
            } catch (NativeAuthException error) {
                if (error.statusCode == 401 || error.statusCode == 403) {
                    clearStoredSession(false);
                    call.reject(error.getMessage(), "INVALID_SESSION");
                } else {
                    call.reject(error.getMessage(), error.code);
                }
            } catch (Exception error) {
                call.reject("No se pudo renovar la sesión nativa.", "NATIVE_SESSION_ERROR", error);
            }
        });
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        executor.execute(() -> {
            try {
                String refreshToken = readRefreshToken();
                if (refreshToken != null) {
                    JSONObject body = new JSONObject();
                    put(body, "refreshToken", refreshToken);
                    try {
                        postJson("/api/auth/native/sign-out", body);
                    } catch (Exception ignored) {
                        // Local logout must succeed even if the server is unavailable.
                    }
                }
            } catch (Exception ignored) {
                // Corrupt local state is removed below.
            } finally {
                clearStoredSession(false);
                clearLegacyCookies();
                call.resolve();
            }
        });
    }

    @PluginMethod
    public void clearSession(PluginCall call) {
        executor.execute(() -> {
            clearStoredSession(false);
            clearLegacyCookies();
            call.resolve();
        });
    }

    @PluginMethod
    public void migrateLegacySession(PluginCall call) {
        executor.execute(() -> {
            try {
                boolean migrated = false;
                boolean hasSecureSession;
                try {
                    hasSecureSession = readRefreshToken() != null;
                } catch (Exception ignored) {
                    clearStoredSession(true);
                    hasSecureSession = false;
                }

                if (!hasSecureSession) {
                    String legacyRefreshToken = readLegacyCookie(LEGACY_REFRESH_COOKIE);
                    if (legacyRefreshToken != null && !legacyRefreshToken.isEmpty()) {
                        storeRefreshToken(legacyRefreshToken);
                        migrated = true;
                    }
                }

                clearLegacyCookies();
                call.resolve(new JSObject().put("migrated", migrated));
            } catch (Exception error) {
                clearStoredSession(true);
                clearLegacyCookies();
                call.reject("No se pudo migrar la sesión anterior.", "MIGRATION_ERROR", error);
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    private void executeSessionRequest(PluginCall call, String path, JSONObject body, boolean allowsVerification) {
        executor.execute(() -> {
            try {
                JSONObject response = postJson(path, body);
                if (allowsVerification && response.optBoolean("requireVerification", false)) {
                    call.resolve(new JSObject().put("requireVerification", true));
                    return;
                }

                storeSessionResponse(response);
                call.resolve(toPublicSession(response));
            } catch (NativeAuthException error) {
                call.reject(error.getMessage(), error.code);
            } catch (Exception error) {
                call.reject("No se pudo guardar la sesión nativa.", "NATIVE_SESSION_ERROR", error);
            }
        });
    }

    private JSONObject postJson(String path, JSONObject body) throws Exception {
        URL url = buildTrustedUrl(path);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setRequestProperty("X-Cestapp-Native", "android-v1");
        connection.setRequestProperty("User-Agent", "CestaPlusPlus-Android/1");

        byte[] requestBytes = body.toString().getBytes(StandardCharsets.UTF_8);
        connection.setFixedLengthStreamingMode(requestBytes.length);

        try (OutputStream output = connection.getOutputStream()) {
            output.write(requestBytes);
        }

        int statusCode = connection.getResponseCode();
        InputStream stream = statusCode >= 200 && statusCode < 300
            ? connection.getInputStream()
            : connection.getErrorStream();
        String responseBody = readLimited(stream);
        connection.disconnect();

        JSONObject response = responseBody.isEmpty() ? new JSONObject() : new JSONObject(responseBody);
        if (statusCode < 200 || statusCode >= 300) {
            String message = response.optString("error", "No se pudo completar la autenticación nativa.");
            String code = statusCode == 401 || statusCode == 403 ? "INVALID_SESSION" : "HTTP_" + statusCode;
            throw new NativeAuthException(message, code, statusCode);
        }

        return response;
    }

    private URL buildTrustedUrl(String path) throws Exception {
        String configuredUrl = getBridge().getServerUrl();
        if (configuredUrl == null || configuredUrl.isEmpty()) {
            throw new NativeAuthException("La aplicación no tiene un servidor HTTPS configurado.", "INVALID_SERVER", 0);
        }

        Uri configuredUri = Uri.parse(configuredUrl);
        String scheme = configuredUri.getScheme();
        String host = configuredUri.getHost();
        boolean isHttpsServer = "https".equalsIgnoreCase(scheme) && host != null;

        if (!isHttpsServer) {
            throw new NativeAuthException("El servidor nativo configurado no es seguro.", "INVALID_SERVER", 0);
        }

        return new URL(new URL(configuredUrl), path);
    }

    private String readLimited(InputStream stream) throws Exception {
        if (stream == null) return "";

        StringBuilder result = new StringBuilder();
        char[] buffer = new char[4096];
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            int count;
            while ((count = reader.read(buffer)) != -1) {
                if (result.length() + count > MAX_RESPONSE_CHARS) {
                    throw new NativeAuthException("La respuesta de autenticación es demasiado grande.", "INVALID_RESPONSE", 0);
                }
                result.append(buffer, 0, count);
            }
        }
        return result.toString();
    }

    private void storeSessionResponse(JSONObject response) throws Exception {
        String accessToken = response.optString("accessToken", "");
        String refreshToken = response.optString("refreshToken", "");
        JSONObject user = response.optJSONObject("user");
        if (accessToken.isEmpty() || refreshToken.isEmpty() || user == null) {
            throw new NativeAuthException("El servidor no devolvió una sesión válida.", "INVALID_RESPONSE", 0);
        }

        storeRefreshToken(refreshToken);
    }

    private JSObject toPublicSession(JSONObject response) {
        return new JSObject()
            .put("accessToken", response.optString("accessToken", ""))
            .put("user", response.optJSONObject("user"));
    }

    private void storeRefreshToken(String refreshToken) throws Exception {
        SecretKey key = getOrCreateKey();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key);

        byte[] ciphertext = cipher.doFinal(refreshToken.getBytes(StandardCharsets.UTF_8));
        boolean saved = preferences().edit()
            .putString(CIPHERTEXT_KEY, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
            .putString(IV_KEY, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
            .commit();

        if (!saved) {
            throw new NativeAuthException("No se pudo guardar la sesión cifrada.", "STORAGE_ERROR", 0);
        }
    }

    private String readRefreshToken() throws Exception {
        String encodedCiphertext = preferences().getString(CIPHERTEXT_KEY, null);
        String encodedIv = preferences().getString(IV_KEY, null);
        if (encodedCiphertext == null || encodedIv == null) return null;

        try {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
            keyStore.load(null);
            SecretKey key = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
            if (key == null) throw new IllegalStateException("Keystore key is missing");

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                Cipher.DECRYPT_MODE,
                key,
                new GCMParameterSpec(128, Base64.decode(encodedIv, Base64.NO_WRAP))
            );
            byte[] plaintext = cipher.doFinal(Base64.decode(encodedCiphertext, Base64.NO_WRAP));
            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (Exception error) {
            clearStoredSession(true);
            throw new NativeAuthException("La sesión guardada no es válida.", "INVALID_SESSION", 401);
        }
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
        keyStore.load(null);
        SecretKey existingKey = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        if (existingKey != null) return existingKey;

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER);
        generator.init(
            new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .build()
        );
        return generator.generateKey();
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }

    private void clearStoredSession(boolean deleteKey) {
        preferences().edit().clear().commit();
        if (!deleteKey) return;

        try {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
            keyStore.load(null);
            keyStore.deleteEntry(KEY_ALIAS);
        } catch (Exception ignored) {
            // The encrypted value has already been removed.
        }
    }

    private String readLegacyCookie(String name) throws Exception {
        String serverUrl = getBridge().getServerUrl();
        if (serverUrl == null) return null;

        String cookies = CookieManager.getInstance().getCookie(serverUrl);
        if (cookies == null) return null;

        for (String part : cookies.split(";")) {
            String cookie = part.trim();
            int separator = cookie.indexOf('=');
            if (separator <= 0 || !name.equals(cookie.substring(0, separator))) continue;
            return URLDecoder.decode(cookie.substring(separator + 1), StandardCharsets.UTF_8.name());
        }

        return null;
    }

    private void clearLegacyCookies() {
        String serverUrl = getBridge().getServerUrl();
        if (serverUrl == null) return;

        CookieManager manager = CookieManager.getInstance();
        expireCookie(manager, serverUrl, LEGACY_ACCESS_COOKIE);
        expireCookie(manager, serverUrl, LEGACY_REFRESH_COOKIE);
        expireCookie(manager, serverUrl, LEGACY_CSRF_COOKIE);
        manager.flush();
    }

    private void expireCookie(CookieManager manager, String serverUrl, String name) {
        manager.setCookie(serverUrl, name + "=; Path=/; Max-Age=0; SameSite=Lax; Secure");
    }

    private String requiredString(PluginCall call, String name) {
        String value = call.getString(name);
        if (value == null || value.isEmpty()) {
            call.reject("Falta el campo obligatorio: " + name, "INVALID_INPUT");
            return null;
        }
        return value;
    }

    private void put(JSONObject object, String key, String value) {
        try {
            object.put(key, value);
        } catch (Exception ignored) {
            // JSONObject only rejects unsupported values; strings are safe here.
        }
    }

    private static final class NativeAuthException extends Exception {
        final String code;
        final int statusCode;

        NativeAuthException(String message, String code, int statusCode) {
            super(message);
            this.code = code;
            this.statusCode = statusCode;
        }
    }
}
