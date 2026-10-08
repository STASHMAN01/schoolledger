package za.co.crechely.app

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/** The big "Stop" screen that appears over the lock screen when an alarm rings. */
@Suppress("UnspecifiedRegisterReceiverFlag")
class AlarmActivity : Activity() {
    private val stopped = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) = finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val title = intent.getStringExtra(AlarmService.EXTRA_TITLE) ?: "Alarm"
        val body = intent.getStringExtra(AlarmService.EXTRA_BODY) ?: ""
        val screen = intent.getStringExtra(AlarmService.EXTRA_SCREEN) ?: "todos"

        val filter = IntentFilter(AlarmService.ACTION_STOPPED)
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(stopped, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(stopped, filter)
        }

        val pad = (32 * resources.displayMetrics.density).toInt()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0670B8"))
            setPadding(pad, pad, pad, pad)
        }
        root.addView(TextView(this).apply {
            text = title; setTextColor(Color.WHITE); textSize = 34f; typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER
        })
        root.addView(TextView(this).apply {
            text = body; setTextColor(Color.WHITE); textSize = 20f; gravity = Gravity.CENTER
            setPadding(0, pad / 2, 0, pad)
        })
        // Big Stop first: that is what someone reaches for when it is ringing.
        root.addView(Button(this).apply {
            text = "Stop"; textSize = 26f; isAllCaps = false
            setTextColor(Color.parseColor("#0670B8")); setBackgroundColor(Color.WHITE)
            setOnClickListener { stopAlarm() }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, (88 * resources.displayMetrics.density).toInt()))
        root.addView(Button(this).apply {
            text = "Stop and open Crechely"; textSize = 18f; isAllCaps = false
            setTextColor(Color.WHITE); setBackgroundColor(Color.parseColor("#0670B8"))
            setOnClickListener {
                AlarmService.stop(this@AlarmActivity)
                startActivity(
                    Intent(this@AlarmActivity, MainActivity::class.java).putExtra("screen", screen)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                )
                finish()
            }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, (64 * resources.displayMetrics.density).toInt()).apply { topMargin = (12 * resources.displayMetrics.density).toInt() })
        setContentView(root)
    }

    private fun stopAlarm() {
        AlarmService.stop(this)
        finish()
    }

    // Back stops the alarm too, so it can never be left ringing behind a
    // dismissed screen.
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        stopAlarm()
    }

    override fun onDestroy() {
        runCatching { unregisterReceiver(stopped) }
        super.onDestroy()
    }
}
