package com.fanrenge.todayledger;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

public class PaymentAccessibilityService extends AccessibilityService {
    private String lastFingerprint = "";
    private long lastSavedAt = 0;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || !PaymentCaptureStore.isAutoRecordEnabled(this)) return;
        CharSequence packageChar = event.getPackageName();
        String packageName = packageChar == null ? "" : packageChar.toString();
        if (!PaymentCaptureStore.isAllowedPackage(this, packageName)) return;

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;
        StringBuilder builder = new StringBuilder();
        collectText(root, builder, 0);
        root.recycle();

        String content = builder.toString().replaceAll("\\s+", " ").trim();
        if (content.length() < 2) return;
        if (!PaymentCaptureStore.looksLikePayment(this, content)) return;

        Double amount = PaymentCaptureStore.parseAmount(content);
        if (amount == null || amount <= 0) return;

        long now = System.currentTimeMillis();
        String fingerprint = packageName + ":" + Math.round(amount * 100) + ":" + content.hashCode();
        if (fingerprint.equals(lastFingerprint) && now - lastSavedAt < 120000) return;
        lastFingerprint = fingerprint;
        lastSavedAt = now;

        PaymentCaptureStore.saveRecord(this, packageName, "支付页面", content, amount, now, "accessibility");
    }

    @Override
    public void onInterrupt() {
        // No long-running speech or gesture action to interrupt.
    }

    private static void collectText(AccessibilityNodeInfo node, StringBuilder builder, int depth) {
        if (node == null || depth > 12) return;
        CharSequence text = node.getText();
        CharSequence description = node.getContentDescription();
        appendText(builder, text);
        appendText(builder, description);
        for (int index = 0; index < node.getChildCount(); index += 1) {
            AccessibilityNodeInfo child = node.getChild(index);
            if (child == null) continue;
            collectText(child, builder, depth + 1);
            child.recycle();
        }
    }

    private static void appendText(StringBuilder builder, CharSequence value) {
        if (value == null) return;
        String text = value.toString().trim();
        if (text.isEmpty()) return;
        if (builder.length() > 0) builder.append(' ');
        builder.append(text);
    }
}