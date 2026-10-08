package za.co.crechely.app

import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Receives push messages from the server, even when the app is closed. The
 * server sends "data" messages, so this always runs: a message marked alarm=1
 * starts the loud alarm, anything else is an ordinary notification.
 */
class PushService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        // The website page tells the server about the new token the next time the app opens.
        Prefs.init(applicationContext)
        Prefs.fcmToken = token
    }

    override fun onMessageReceived(message: RemoteMessage) {
        Prefs.init(applicationContext)
        val d = message.data
        val title = d["title"] ?: "Crechely"
        val body = d["body"] ?: ""
        val screen = d["screen"] ?: "todos"
        if (d["alarm"] == "1") {
            AlarmService.ring(this, title, body, screen)
            return
        }
        val open = PendingIntent.getActivity(
            this, 1, Intent(this, MainActivity::class.java).putExtra("screen", screen).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        // "sales" (Dylan, 8 Oct 2026): a new school signing up or paying --
        // platform-owner only, rings the distinct ka-ching channel instead
        // of the ordinary reminder tone. Anything else uses the general
        // channel as before.
        val channel = if (d["channel"] == "sales") CrechelyApp.CHANNEL_SALES else CrechelyApp.CHANNEL_GENERAL
        val n = NotificationCompat.Builder(this, channel)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title).setContentText(body)
            .setAutoCancel(true).setContentIntent(open).build()
        runCatching { NotificationManagerCompat.from(this).notify(System.currentTimeMillis().toInt(), n) }
    }
}
