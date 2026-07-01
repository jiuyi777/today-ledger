package com.fanrenge.todayledger;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public class PaymentNotificationListener extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) return;
        String packageName = sbn.getPackageName();
        if (!PaymentCaptureStore.isAutoRecordEnabled(this)) return;
        if (!PaymentCaptureStore.isAllowedPackage(this, packageName)) return;

        Bundle extras = sbn.getNotification().extras;
        String title = readExtra(extras, Notification.EXTRA_TITLE);
        String text = readExtra(extras, Notification.EXTRA_TEXT);
        String bigText = readExtra(extras, Notification.EXTRA_BIG_TEXT);
        String content = (title + " " + text + " " + bigText).trim();
        if (!PaymentCaptureStore.looksLikePayment(this, content)) return;

        Double amount = PaymentCaptureStore.parseAmount(content);
        if (amount == null || amount <= 0) return;

        PaymentCaptureStore.saveRecord(this, packageName, title, text.isEmpty() ? bigText : text, amount, sbn.getPostTime(), "notification");
    }

    private static String readExtra(Bundle extras, String key) {
        if (extras == null) return "";
        Object value = extras.get(key);
        return value == null ? "" : String.valueOf(value);
    }
}