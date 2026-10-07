package za.co.crechely.app

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat

/**
 * Rings a loud alarm until someone taps Stop. It plays the phone's alarm sound
 * on the ALARM volume (which works even when the ringer is on silent) and turns
 * that volume up to the maximum, then shows a full-screen "Stop" screen over
 * the lock screen. It stops by itself after 5 minutes.
 */
class AlarmService : Service() {
    private var player: MediaPlayer? = null
    private var savedVolume: Int? = null
    private val stopHandler = android.os.Handler(android.os.Looper.getMainLooper())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Alarm"
        val body = intent?.getStringExtra(EXTRA_BODY) ?: ""
        val screen = intent?.getStringExtra(EXTRA_SCREEN) ?: "todos"
        startForegroundWithNotification(title, body, screen)
        startSound()
        stopHandler.removeCallbacksAndMessages(null)
        stopHandler.postDelayed({ stopSelf() }, 5 * 60 * 1000L)
        return START_NOT_STICKY
    }

    private fun startForegroundWithNotification(title: String, body: String, screen: String) {
        val open = PendingIntent.getActivity(
            this, 0,
            Intent(this, AlarmActivity::class.java)
                .putExtra(EXTRA_TITLE, title).putExtra(EXTRA_BODY, body).putExtra(EXTRA_SCREEN, screen)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stop = PendingIntent.getService(
            this, 1, Intent(this, AlarmService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val n: Notification = NotificationCompat.Builder(this, CrechelyApp.CHANNEL_ALARM)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title)
            .setContentText(body)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setOngoing(true)
            .setContentIntent(open)
            .setFullScreenIntent(open, true)
            .addAction(0, "Stop", stop)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(NOTIFICATION_ID, n)
        }
    }

    private fun startSound() {
        if (player != null) return
        val audio = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        savedVolume = audio.getStreamVolume(AudioManager.STREAM_ALARM)
        audio.setStreamVolume(AudioManager.STREAM_ALARM, audio.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0)

        val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        player = MediaPlayer().apply {
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            setDataSource(this@AlarmService, uri)
            isLooping = true
            prepare()
            start()
        }
        vibrate()
    }

    @Suppress("DEPRECATION")
    private fun vibrate() {
        val pattern = longArrayOf(0, 800, 600)
        val v: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
        v?.vibrate(VibrationEffect.createWaveform(pattern, 0))
    }

    override fun onDestroy() {
        stopHandler.removeCallbacksAndMessages(null)
        player?.runCatching { stop(); release() }
        player = null
        savedVolume?.let {
            // Put the volume back the way the person had it.
            (getSystemService(Context.AUDIO_SERVICE) as AudioManager).setStreamVolume(AudioManager.STREAM_ALARM, it, 0)
        }
        savedVolume = null
        sendBroadcast(Intent(ACTION_STOPPED).setPackage(packageName))
        super.onDestroy()
    }

    companion object {
        const val ACTION_STOP = "za.co.crechely.app.STOP_ALARM"
        const val ACTION_STOPPED = "za.co.crechely.app.ALARM_STOPPED"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"
        const val EXTRA_SCREEN = "screen"
        private const val NOTIFICATION_ID = 4001

        fun ring(context: Context, title: String, body: String, screen: String = "todos") {
            val i = Intent(context, AlarmService::class.java)
                .putExtra(EXTRA_TITLE, title).putExtra(EXTRA_BODY, body).putExtra(EXTRA_SCREEN, screen)
            androidx.core.content.ContextCompat.startForegroundService(context, i)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, AlarmService::class.java))
        }
    }
}
