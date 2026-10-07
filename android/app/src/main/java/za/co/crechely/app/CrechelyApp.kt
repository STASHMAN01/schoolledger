package za.co.crechely.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build

class CrechelyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Prefs.init(this)
        createChannels()
        AlarmScheduler.rescheduleAll(this)
    }

    private fun createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ALARM, "Alarms", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Loud alarms, e.g. take the register."
                // The sound itself is played by AlarmService on the alarm volume; the
                // channel stays silent so the two don't double up.
                setSound(null, null)
                enableVibration(true)
                setBypassDnd(true)
            },
        )
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_GENERAL, "Reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Ordinary reminders and updates."
                setSound(
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                    AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build(),
                )
            },
        )
    }

    companion object {
        const val CHANNEL_ALARM = "alarm"
        const val CHANNEL_GENERAL = "general"
    }
}
