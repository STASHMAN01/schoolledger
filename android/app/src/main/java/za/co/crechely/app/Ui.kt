package za.co.crechely.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.launch
import java.time.LocalDate

private val Brand = Color(0xFF0670B8)

@Composable
fun CrechelyTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(primary = Brand, onPrimary = Color.White, secondary = Brand),
        content = content,
    )
}

fun todayIso(): String = LocalDate.now().toString()

// ---------------------------------------------------------------- loading

sealed interface LoadState<out T> {
    data object Loading : LoadState<Nothing>
    data class Ok<T>(val value: T) : LoadState<T>
    data class Err(val message: String) : LoadState<Nothing>
}

fun friendly(e: Exception) = (e as? ApiException)?.message ?: "Something went wrong. Please try again."

/** Loads data, shows a spinner or a retry message, then hands the result to [content]. */
@Composable
fun <T> Loader(key: Any?, load: suspend () -> T, content: @Composable (T, () -> Unit) -> Unit) {
    var state by remember(key) { mutableStateOf<LoadState<T>>(LoadState.Loading) }
    var tick by remember(key) { mutableIntStateOf(0) }
    LaunchedEffect(key, tick) {
        state = try {
            LoadState.Ok(load())
        } catch (e: Exception) {
            LoadState.Err(friendly(e))
        }
    }
    when (val s = state) {
        is LoadState.Loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
        is LoadState.Err -> Column(Modifier.fillMaxSize().padding(24.dp), Arrangement.Center, Alignment.CenterHorizontally) {
            Text(s.message)
            Button(onClick = { tick++; state = LoadState.Loading }, modifier = Modifier.padding(top = 16.dp)) { Text("Try again") }
        }
        is LoadState.Ok -> content(s.value) { tick++ }
    }
}

// ---------------------------------------------------------------- root

@Composable
fun Root(startScreen: MutableState<String?>) {
    var signedIn by remember { mutableStateOf(Prefs.token != null) }
    DisposableEffect(Unit) {
        val handler = android.os.Handler(android.os.Looper.getMainLooper())
        Api.onSignedOut = { handler.post { signedIn = false } }
        onDispose { Api.onSignedOut = null }
    }
    if (!signedIn) {
        LoginScreen(onSignedIn = { signedIn = true })
    } else {
        Loader(key = "me", load = { Api.me() }) { me, _ ->
            if (me.orgs.isEmpty()) {
                Column(Modifier.fillMaxSize().padding(24.dp), Arrangement.Center, Alignment.CenterHorizontally) {
                    Text("Your account isn't part of a school yet. Ask your school admin to invite you.")
                    TextButton(onClick = { Prefs.signOut(); signedIn = false }) { Text("Sign out") }
                }
            } else {
                Home(me, startScreen, onSignOut = { signedIn = false })
            }
        }
    }
}

// ---------------------------------------------------------------- login

@Composable
fun LoginScreen(onSignedIn: () -> Unit) {
    var email by remember { mutableStateOf(Prefs.lastEmail) }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Crechely", style = MaterialTheme.typography.headlineLarge, color = Brand)
        Text("Sign in with your school account", modifier = Modifier.padding(top = 4.dp, bottom = 24.dp))
        OutlinedTextField(
            value = email, onValueChange = { email = it }, label = { Text("Email") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = password, onValueChange = { password = it }, label = { Text("Password") }, singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        )
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 12.dp)) }
        Button(
            enabled = !busy && email.isNotBlank() && password.isNotEmpty(),
            onClick = {
                busy = true; error = null
                scope.launch {
                    try {
                        val token = Api.login(email.trim(), password, "${Build.MANUFACTURER} ${Build.MODEL}")
                        Prefs.lastEmail = email.trim()
                        Prefs.token = token
                        onSignedIn()
                    } catch (e: Exception) {
                        error = friendly(e)
                    } finally {
                        busy = false
                    }
                }
            },
            modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
        ) { Text(if (busy) "Signing in…" else "Sign in") }
    }
}

// ---------------------------------------------------------------- home

private enum class Tab(val label: String) { Todos("To-do"), Register("Register"), Children("Children"), Files("Files"), Alarms("Alarms") }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Home(me: Me, startScreen: MutableState<String?>, onSignOut: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var org by remember { mutableStateOf(me.orgs.firstOrNull { it.id == Prefs.orgId } ?: me.orgs.first()) }
    LaunchedEffect(org.id) { Prefs.orgId = org.id }

    val tabs = remember(org.id) {
        buildList {
            add(Tab.Todos)
            if (org.can("MANAGE_ATTENDANCE")) add(Tab.Register)
            add(Tab.Children)
            if (org.can("VIEW_MONEY") || org.can("MANAGE_CHILDREN") || org.can("MANAGE_REPORTS") || org.can("MANAGE_ATTENDANCE")) add(Tab.Files)
            add(Tab.Alarms)
        }
    }
    var tab by remember { mutableStateOf(Tab.Todos) }
    LaunchedEffect(startScreen.value, tabs) {
        when (startScreen.value) {
            "attendance" -> if (Tab.Register in tabs) tab = Tab.Register
            "todos" -> tab = Tab.Todos
        }
        startScreen.value = null
    }

    // Ask to show notifications (Android 13+), then tell the server where to send them.
    val askNotifications = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        if (FirebaseApp.getApps(context).isNotEmpty()) {
            runCatching {
                FirebaseMessaging.getInstance().token.addOnSuccessListener { t ->
                    Prefs.fcmToken = t
                    scope.launch { Api.registerPushToken(t) }
                }
            }
        }
    }

    var menu by remember { mutableStateOf(false) }
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(org.name) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Brand, titleContentColor = Color.White, actionIconContentColor = Color.White),
                actions = {
                    TextButton(onClick = { menu = true }) { Text("Menu", color = Color.White) }
                    DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                        if (me.orgs.size > 1) me.orgs.forEach { o ->
                            DropdownMenuItem(text = { Text(o.name) }, onClick = { org = o; menu = false })
                        }
                        DropdownMenuItem(text = { Text("Signed in as ${me.name}") }, onClick = { menu = false }, enabled = false)
                        DropdownMenuItem(
                            text = { Text("Sign out") },
                            onClick = {
                                menu = false
                                scope.launch {
                                    Api.signOut()
                                    Prefs.signOut()
                                    onSignOut()
                                }
                            },
                        )
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                tabs.forEach { t ->
                    NavigationBarItem(
                        selected = tab == t, onClick = { tab = t },
                        icon = { Text(t.label.take(1)) }, label = { Text(t.label, maxLines = 1) },
                    )
                }
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when (tab) {
                Tab.Todos -> TodosScreen(org)
                Tab.Register -> RegisterScreen(org)
                Tab.Children -> ChildrenScreen(org)
                Tab.Files -> FilesScreen(org)
                Tab.Alarms -> AlarmsScreen()
            }
        }
    }
}
