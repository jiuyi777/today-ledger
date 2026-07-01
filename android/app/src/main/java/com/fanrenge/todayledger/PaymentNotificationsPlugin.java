package com.fanrenge.todayledger;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.provider.Settings;
import android.text.TextUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "PaymentNotifications")
public class PaymentNotificationsPlugin extends Plugin {
    @PluginMethod
    public void isEnabled(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", isNotificationListenerEnabled(getContext()));
        result.put("accessibilityEnabled", isAccessibilityServiceEnabled(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getCaptureSettings(PluginCall call) {
        call.resolve(buildSettingsResult());
    }

    @PluginMethod
    public void saveCaptureSettings(PluginCall call) {
        JSArray whitelist = call.getArray("appWhitelist");
        JSArray keywords = call.getArray("paymentKeywords");
        boolean autoRecordEnabled = call.getBoolean("autoRecordEnabled", true);
        PaymentCaptureStore.saveSettings(getContext(), whitelist, keywords, autoRecordEnabled);
        call.resolve(buildSettingsResult());
    }

    @PluginMethod
    public void getDetectedPayments(PluginCall call) {
        JSObject result = new JSObject();
        result.put("records", toJSArray(PaymentCaptureStore.readRecords(getContext())));
        call.resolve(result);
    }

    @PluginMethod
    public void clearDetectedPayments(PluginCall call) {
        PaymentCaptureStore.clearRecords(getContext());
        call.resolve();
    }

    @PluginMethod
    public void listInstalledApps(PluginCall call) {
        PackageManager packageManager = getContext().getPackageManager();
        List<ApplicationInfo> apps = new ArrayList<>(packageManager.getInstalledApplications(PackageManager.GET_META_DATA));
        apps.sort(Comparator.comparing((ApplicationInfo app) -> {
            CharSequence label = packageManager.getApplicationLabel(app);
            return label == null ? app.packageName : label.toString();
        }, String.CASE_INSENSITIVE_ORDER));

        JSONArray rows = new JSONArray();
        for (ApplicationInfo app : apps) {
            if (app == null || TextUtils.isEmpty(app.packageName)) continue;
            JSONObject row = new JSONObject();
            try {
                CharSequence label = packageManager.getApplicationLabel(app);
                row.put("packageName", app.packageName);
                row.put("label", label == null ? app.packageName : label.toString());
                row.put("system", (app.flags & ApplicationInfo.FLAG_SYSTEM) != 0);
                rows.put(row);
            } catch (JSONException ignored) {
                // Skip malformed rows and keep the picker usable.
            }
        }

        JSObject result = new JSObject();
        result.put("apps", toJSArray(rows));
        call.resolve(result);
    }

    private static boolean isNotificationListenerEnabled(Context context) {
        String enabledListeners = Settings.Secure.getString(
            context.getContentResolver(),
            "enabled_notification_listeners"
        );
        if (TextUtils.isEmpty(enabledListeners)) return false;
        String packageName = context.getPackageName();
        for (String listener : enabledListeners.split(":")) {
            ComponentName componentName = ComponentName.unflattenFromString(listener);
            if (componentName != null && TextUtils.equals(packageName, componentName.getPackageName())) {
                return true;
            }
        }
        return false;
    }

    private static boolean isAccessibilityServiceEnabled(Context context) {
        String enabledServices = Settings.Secure.getString(
            context.getContentResolver(),
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        );
        if (TextUtils.isEmpty(enabledServices)) return false;
        String packageName = context.getPackageName();
        for (String service : enabledServices.split(":")) {
            ComponentName componentName = ComponentName.unflattenFromString(service);
            if (componentName == null) continue;
            boolean samePackage = TextUtils.equals(packageName, componentName.getPackageName());
            boolean sameClass = PaymentAccessibilityService.class.getName().equals(componentName.getClassName());
            if (samePackage && sameClass) return true;
        }
        return false;
    }

    private JSObject buildSettingsResult() {
        JSONObject settings = PaymentCaptureStore.readSettings(getContext());
        JSONArray whitelist = settings.optJSONArray("appWhitelist");
        JSONArray keywords = settings.optJSONArray("paymentKeywords");
        JSObject result = new JSObject();
        result.put("appWhitelist", toJSArray(whitelist == null ? new JSONArray() : whitelist));
        result.put("paymentKeywords", toJSArray(keywords == null ? new JSONArray() : keywords));
        result.put("autoRecordEnabled", settings.optBoolean("autoRecordEnabled", true));
        return result;
    }

    private JSArray toJSArray(JSONArray array) {
        try {
            return new JSArray(array);
        } catch (JSONException error) {
            return new JSArray();
        }
    }
}