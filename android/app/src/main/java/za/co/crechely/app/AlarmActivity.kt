package za.co.crechely.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** The big "Stop" screen that appears over the lock screen when an alarm rings. */
@Suppress("UnspecifiedRegisterReceiverFlag")
class AlarmActivity : ComponentActivity() {
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

        setContent {
            Column(
                Modifier.fillMaxSize().background(Color(0xFF0670B8)).padding(32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(title, color = Color.White, fontSize = 36.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                Text(body, color = Color.White, fontSize = 20.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 12.dp, bottom = 40.dp))
                Button(
                    onClick = {
                        AlarmService.stop(this@AlarmActivity)
                        startActivity(Intent(this@AlarmActivity, MainActivity::class.java).putExtra("screen", screen).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP))
                        finish()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Color(0xFF0670B8)),
                    modifier = Modifier.fillMaxWidth().height(88.dp),
                ) { Text("Stop and open", fontSize = 26.sp, fontWeight = FontWeight.Bold) }
            }
        }
    }

    override fun onDestroy() {
        runCatching { unregisterReceiver(stopped) }
        super.onDestroy()
    }
}
