package site.insforge.cestapp;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeBrowser")
public class NativeBrowserPlugin extends Plugin {
    private static final String ALLOWED_OAUTH_HOST = "accounts.google.com";
    private static final String ALLOWED_OAUTH_PATH = "/o/oauth2/v2/auth";

    @PluginMethod
    public void open(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.isEmpty()) {
            call.reject("URL must not be empty");
            return;
        }

        Uri url = Uri.parse(urlString);
        if (!isAllowedOAuthUrl(url)) {
            call.reject("OAuth URL is not allowed");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, url);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);

        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException ex) {
            call.reject("No browser app can open this URL", ex);
        }
    }

    private boolean isAllowedOAuthUrl(Uri url) {
        int port = url.getPort();
        return url.isHierarchical()
            && "https".equalsIgnoreCase(url.getScheme())
            && ALLOWED_OAUTH_HOST.equalsIgnoreCase(url.getHost())
            && ALLOWED_OAUTH_PATH.equals(url.getPath())
            && url.getUserInfo() == null
            && url.getFragment() == null
            && (port == -1 || port == 443);
    }
}
