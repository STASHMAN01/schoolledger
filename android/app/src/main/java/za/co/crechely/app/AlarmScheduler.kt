package za.co.crechely.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import java.util.Calendar

/** Alarms set on this tablet (Alarms tab). They work with no internet and no Firebase. */
object AlarmScheduler {
    /**
     * Sets an alarm without ever crashing the app. Since Android 12,
     * setAlarmClock needs an exact-alarm permission (see the manifest:
     * USE_EXACT_ALARM / SCHEDULE_EXACT_ALARM). Without one it throws a
     * SecurityException, and because CrechelyApp.onCreate reschedules
     * every alarm at start-up, that closed the app the moment it opened
     * on an Android 13+ tablet once a class routine had synced (8 Oct
     * 2026). If a tablet still refuses exact alarms, fall back to a
     * slightly inexact one rather than throwing.
     */
    private fun setAlarm(am: AlarmManager, at: Long, pi: PendingIntent) {
        val canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
        if (canExact) {
            try {
                am.setAlarmClock(AlarmManager.AlarmClockInfo(at, pi), pi)
                return
            } catch (e: SecurityException) {
                Log.w("CrechelyAlarm", "Exact alarm refused; using an inexact one", e)
            }
        }
        runCatching { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi) }
            .onFailure { e -> Log.e("CrechelyAlarm", "Could not set alarm", e) }
    }

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
        // Exact and survives Doze (permission: see setAlarm).
        setAlarm(am, at, pending(context, a.id))
    }

    fun cancel(context: Context, id: Int) {
        (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pending(context, id))
    }

    // ---- class routine: one alarm per timetable entry, repeating every week ----
    private const val ROUTINE_BASE = 20000
    private const val ROUTINE_MAX = 120

    private fun routinePending(context: Context, index: Int): PendingIntent = PendingIntent.getBroadcast(
        context, ROUTINE_BASE + index,
        Intent(context, RoutineReceiver::class.java).putExtra("index", index),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    fun nextRoutineTrigger(item: RoutineItem, from: Calendar = Calendar.getInstance()): Calendar {
        val c = (from.clone() as Calendar).apply {
            set(Calendar.HOUR_OF_DAY, item.hour); set(Calendar.MINUTE, item.minute)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }
        fun isoDay(x: Calendar) = (x.get(Calendar.DAY_OF_WEEK) + 5) % 7 + 1 // Monday = 1
        var guard = 0
        while ((!c.after(from) || isoDay(c) != item.day) && guard++ < 14) c.add(Calendar.DAY_OF_YEAR, 1)
        return c
    }

    fun scheduleRoutine(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (i in 0 until ROUTINE_MAX) am.cancel(routinePending(context, i))
        if (!Prefs.routineEnabled) return
        Prefs.routine.take(ROUTINE_MAX).forEachIndexed { i, item ->
            val at = nextRoutineTrigger(item).timeInMillis
            setAlarm(am, at, routinePending(context, i))
        }
    }

    fun rescheduleAll(context: Context) {
        scheduleRoutine(context)
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

class RoutineReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Prefs.init(context)
        val item = Prefs.routine.getOrNull(intent.getIntExtra("index", -1)) ?: return
        if (!Prefs.routineEnabled) return
        AlarmService.ring(context, "Time for: ${item.activity}", "The routine has changed. Tap Stop.", "todos", seconds = 30)
        AlarmScheduler.scheduleRoutine(context) // sets next week's
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Prefs.init(context)
        AlarmScheduler.rescheduleAll(context)
    }
}
