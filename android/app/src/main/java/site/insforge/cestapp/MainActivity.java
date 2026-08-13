package site.insforge.cestapp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeBrowserPlugin.class);
        registerPlugin(NativeSessionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
