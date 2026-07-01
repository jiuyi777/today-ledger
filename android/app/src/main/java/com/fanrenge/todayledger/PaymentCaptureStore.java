package com.fanrenge.todayledger;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class PaymentCaptureStore {
    public static final String PREFS_NAME = "payment_notifications";
    public static final String RECORDS_KEY = "records";
    public static final String WHITELIST_KEY = "app_whitelist";
    public static final String KEYWORDS_KEY = "payment_keywords";
    public static final String AUTO_RECORD_KEY = "auto_record_enabled";

    private static final Pattern AMOUNT_PATTERN = Pattern.compile("(?:￥|¥|人民币)?\\s*([0-9]+(?:\\.[0-9]{1,2})?)\\s*元?");
    private static final String[] DEFAULT_WHITELIST = {
        "com.tencent.mm",
        "com.eg.android.AlipayGphone"
    };
    private static final String[] DEFAULT_KEYWORDS = {
        "支付成功",
        "付款成功",
        "已支付",
        "支付",
        "付款",
        "扣款",
        "交易成功",
        "收款",
        "零钱",
        "银行卡",
        "¥",
        "￥",
        "元"
    };

    private PaymentCaptureStore() {}

    public static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static List<String> readWhitelist(Context context) {
        return readStringList(prefs(context).getString(WHITELIST_KEY, ""), DEFAULT_WHITELIST);
    }

    public static List<String> readKeywords(Context context) {
        return readStringList(prefs(context).getString(KEYWORDS_KEY, ""), DEFAULT_KEYWORDS);
    }

    public static boolean isAutoRecordEnabled(Context context) {
        return prefs(context).getBoolean(AUTO_RECORD_KEY, true);
    }

    public static JSONObject readSettings(Context context) {
        JSONObject result = new JSONObject();
        try {
            result.put("appWhitelist", new JSONArray(readWhitelist(context)));
            result.put("paymentKeywords", new JSONArray(readKeywords(context)));
            result.put("autoRecordEnabled", isAutoRecordEnabled(context));
        } catch (JSONException ignored) {
            return new JSONObject();
        }
        return result;
    }

    public static void saveSettings(Context context, JSONArray whitelist, JSONArray keywords, boolean autoRecordEnabled) {
        prefs(context).edit()
            .putString(WHITELIST_KEY, normalizeList(whitelist, DEFAULT_WHITELIST).toString())
            .putString(KEYWORDS_KEY, normalizeList(keywords, DEFAULT_KEYWORDS).toString())
            .putBoolean(AUTO_RECORD_KEY, autoRecordEnabled)
            .apply();
    }

    public static boolean isAllowedPackage(Context context, String packageName) {
        String source = String.valueOf(packageName);
        for (String item : readWhitelist(context)) {
            if (!item.isEmpty() && source.contains(item)) return true;
        }
        return false;
    }

    public static boolean looksLikePayment(Context context, String content) {
        String text = String.valueOf(content);
        for (String keyword : readKeywords(context)) {
            if (!keyword.isEmpty() && text.contains(keyword)) return true;
        }
        return false;
    }

    public static Double parseAmount(String content) {
        Matcher matcher = AMOUNT_PATTERN.matcher(String.valueOf(content));
        Double biggest = null;
        while (matcher.find()) {
            try {
                double value = Double.parseDouble(matcher.group(1));
                if (value > 0 && (biggest == null || value > biggest)) biggest = value;
            } catch (NumberFormatException ignored) {
                return biggest;
            }
        }
        return biggest;
    }

    public static void saveRecord(Context context, String packageName, String title, String text, double amount, long postedAt, String source) {
        SharedPreferences prefs = prefs(context);
        JSONArray records = readRecords(context);
        String safeText = String.valueOf(text);
        if (alreadySavedRecently(records, packageName, amount, safeText, postedAt)) return;

        JSONObject record = new JSONObject();
        try {
            record.put("id", packageName + "-" + postedAt + "-" + Math.round(amount * 100) + "-" + source);
            record.put("packageName", packageName);
            record.put("title", title);
            record.put("text", safeText);
            record.put("amount", amount);
            record.put("postedAt", postedAt);
            record.put("source", source);
            records.put(record);
        } catch (JSONException ignored) {
            return;
        }

        JSONArray trimmed = new JSONArray();
        int start = Math.max(0, records.length() - 80);
        for (int index = start; index < records.length(); index += 1) {
            JSONObject item = records.optJSONObject(index);
            if (item != null) trimmed.put(item);
        }
        prefs.edit().putString(RECORDS_KEY, trimmed.toString()).apply();
    }

    public static JSONArray readRecords(Context context) {
        try {
            return new JSONArray(prefs(context).getString(RECORDS_KEY, "[]"));
        } catch (JSONException error) {
            return new JSONArray();
        }
    }

    public static void clearRecords(Context context) {
        prefs(context).edit().putString(RECORDS_KEY, "[]").apply();
    }

    private static boolean alreadySavedRecently(JSONArray records, String packageName, double amount, String text, long postedAt) {
        String normalizedText = normalizeText(text);
        for (int index = records.length() - 1; index >= 0; index -= 1) {
            JSONObject item = records.optJSONObject(index);
            if (item == null) continue;
            boolean samePackage = String.valueOf(item.optString("packageName")).equals(String.valueOf(packageName));
            boolean sameAmount = Math.abs(item.optDouble("amount", -1) - amount) < 0.001;
            boolean closeTime = Math.abs(item.optLong("postedAt", 0) - postedAt) < 120000;
            boolean similarText = normalizeText(item.optString("text", "")).equals(normalizedText);
            if (samePackage && sameAmount && closeTime && similarText) return true;
        }
        return false;
    }

    private static String normalizeText(String text) {
        return String.valueOf(text).replaceAll("\\s+", " ").trim();
    }

    private static List<String> readStringList(String saved, String[] defaults) {
        JSONArray fallback = new JSONArray();
        for (String item : defaults) fallback.put(item);
        try {
            return jsonArrayToList(saved == null || saved.isEmpty() ? fallback : new JSONArray(saved), defaults);
        } catch (JSONException error) {
            return jsonArrayToList(fallback, defaults);
        }
    }

    private static JSONArray normalizeList(JSONArray array, String[] defaults) {
        JSONArray result = new JSONArray();
        for (String item : jsonArrayToList(array, defaults)) result.put(item);
        return result;
    }

    private static List<String> jsonArrayToList(JSONArray array, String[] defaults) {
        List<String> result = new ArrayList<>();
        JSONArray source = array == null || array.length() == 0 ? new JSONArray() : array;
        if (source.length() == 0) {
            for (String item : defaults) result.add(item);
            return result;
        }
        for (int index = 0; index < source.length(); index += 1) {
            String item = source.optString(index, "").trim();
            if (!item.isEmpty() && !result.contains(item)) result.add(item);
        }
        if (result.isEmpty()) {
            for (String item : defaults) result.add(item);
        }
        return result;
    }
}