package za.co.crechely.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.util.Calendar

/** Alarms set on this tablet (Alarms tab). They work with no internet and no Firebase. */
object AlarmScheduler {
    private fun pending(context: Context, id: Int): PendingIntent = PendingIntent.getBroadcast(
        context, 5000 + id,
        Intent(context, AlarmReceiver::class.java).putExtra("alarmId", id),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    /** The next time this alarm should ring after [from], skipping weekends if asked. */
    fun nextTrigger(a: DailyAlarm, from: Calendar = Calendar.getInstance()): Calendar {
        val c = (from.clone() as Calendar).apply {
            set(Calendar.HOUR_OF_DAY, a.hour); set(Calendar.MINUTE, a.minute)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }
        if (!c.after(from)) c.add(Calendar.DAY_OF_YEAR, 1)
        while (a.weekdaysOnly && (c.get(Calendar.DAY_OF_WEEK) == Calendar.SATURDAY || c.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY)) {
            c.add(Calendar.DAY_OF_YEAR, 1)
        }
        return c
    }

    fun schedule(context: Context, a: DailyAlarm) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        if (!a.enabled) { am.cancel(pending(context, a.id)); return }
        val at = nextTrigger(a).timeInMillis
        // setAlarmClock is exact, survives Doze and needs no special permission.
        am.setAlarmClock(AlarmManager.AlarmClockInfo(at, pending(context, a.id)), pending(context, a.id))
    }

    fun cancel(context: Context, id: Int) {
        (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pending(context, id))
    }

    fun rescheduleAll(context: Context) {
        Prefs.alarms.forEach { schedule(context, it) }
    }
}

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getIntExtra("alarmId", -1)
        Prefs.init(context)
        val alarm = Prefs.alarms.firstOrNull { it.id == id } ?: return
        if (!alarm.enabled) return
        AlarmService.ring(context, alarm.label.ifBlank { "Alarm" }, "Tap Stop when you've seen this.", "todos")
        AlarmScheduler.schedule(context, alarm) // set tomorrow's
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Prefs.init(context)
        AlarmScheduler.rescheduleAll(context)
    }
}
