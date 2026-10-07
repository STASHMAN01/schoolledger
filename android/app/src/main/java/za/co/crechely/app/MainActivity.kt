package za.co.crechely.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.mutableStateOf

class MainActivity : ComponentActivity() {
    // Which tab a notification asked for ("todos", "attendance").
    private val startScreen = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startScreen.value = intent.getStringExtra("screen")
        setContent { CrechelyTheme { Root(startScreen) } }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        startScreen.value = intent.getStringExtra("screen")
    }
}
