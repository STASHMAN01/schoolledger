package za.co.crechely.app

import android.app.TimePickerDialog
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import kotlinx.coroutines.launch

private val Brand = Color(0xFF0670B8)

@Composable
private fun Title(text: String) =
    Text(text, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 8.dp))

private fun toast(context: Context, text: String) = Toast.makeText(context, text, Toast.LENGTH_LONG).show()

// ---------------------------------------------------------------- To-do

@Composable
fun TodosScreen(org: Org) {
    Loader(key = org.id, load = { Api.todos(org.id, todayIso()) }) { todos, reload ->
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Title("To-do")
                TextButton(onClick = reload) { Text("Refresh") }
            }
            if (todos.isEmpty()) {
                Text("All done. Nothing needs doing right now.")
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(todos) { t ->
                        Card(Modifier.fillMaxWidth()) {
                            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text(t.label, Modifier.weight(1f))
                                if (t.count > 0) Text("${t.count}", color = Brand, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- Register

@Composable
fun RegisterScreen(org: Org) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    // A teacher always gets their own class; anyone else picks one.
    var classId by remember(org.id) { mutableStateOf(org.assignedCategoryId) }
    val needsPicker = org.role != "TEACHER"

    if (classId == null) {
        if (!needsPicker) {
            Text("No class has been assigned to you yet. Ask your school admin.", Modifier.padding(16.dp))
        } else {
            Loader(key = "classes-${org.id}", load = { Api.classes(org.id) }) { classes, _ ->
                Column(Modifier.padding(16.dp)) {
                    Title("Pick a class")
                    classes.forEach { c -> OutlinedButton(onClick = { classId = c.id }, Modifier.fillMaxWidth().padding(bottom = 8.dp)) { Text(c.name) } }
                }
            }
        }
        return
    }

    val date = remember { todayIso() }
    Loader(key = "register-$classId-$date", load = { Api.register(org.id, classId!!, date) }) { kids, reload ->
        val marks: SnapshotStateMap<String, String> = remember(kids) {
            mutableStateMapOf<String, String>().apply { kids.forEach { k -> k.status?.let { put(k.id, it) } } }
        }
        var saving by remember { mutableStateOf(false) }
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Title("Register · $date")
                if (needsPicker) TextButton(onClick = { classId = null }) { Text("Change class") }
            }
            Row(Modifier.padding(bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { kids.forEach { if (marks[it.id] == null) marks[it.id] = "PRESENT" } }) { Text("Everyone else present") }
                Text("${marks.size} of ${kids.size} marked", Modifier.padding(top = 12.dp))
            }
            LazyColumn(Modifier.weight(1f)) {
                items(kids) { k ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(k.name, Modifier.weight(1f))
                        val present = marks[k.id] == "PRESENT"
                        val absent = marks[k.id] == "ABSENT"
                        Button(
                            onClick = { marks[k.id] = "PRESENT" },
                            colors = if (present) ButtonDefaults.buttonColors(containerColor = Color(0xFF1B7F3B)) else ButtonDefaults.outlinedButtonColors(),
                        ) { Text("Present", color = if (present) Color.White else Color.DarkGray) }
                        Button(
                            onClick = { marks[k.id] = "ABSENT" },
                            modifier = Modifier.padding(start = 8.dp),
                            colors = if (absent) ButtonDefaults.buttonColors(containerColor = Color(0xFFC0392B)) else ButtonDefaults.outlinedButtonColors(),
                        ) { Text("Absent", color = if (absent) Color.White else Color.DarkGray) }
                    }
                    HorizontalDivider()
                }
            }
            Button(
                enabled = !saving && marks.isNotEmpty(),
                onClick = {
                    saving = true
                    scope.launch {
                        try {
                            Api.saveRegister(org.id, classId!!, date, marks.toMap())
                            toast(context, "Register saved.")
                            reload()
                        } catch (e: Exception) {
                            toast(context, friendly(e))
                        } finally {
                            saving = false
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            ) { Text(if (saving) "Saving…" else "Save register") }
        }
    }
}

// ---------------------------------------------------------------- Children

@Composable
fun ChildrenScreen(org: Org) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var search by remember { mutableStateOf("") }
    var showAdd by remember { mutableStateOf(false) }

    Loader(key = "children-${org.id}", load = { Api.children(org.id) }) { all, reload ->
        val shown = all.filter { it.name.contains(search, ignoreCase = true) || it.className.contains(search, ignoreCase = true) }
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Title("Children (${all.size})")
                if (org.can("MANAGE_CHILDREN")) Button(onClick = { showAdd = true }) { Text("Quick add") }
            }
            OutlinedTextField(
                value = search, onValueChange = { search = it }, label = { Text("Search name or class") },
                singleLine = true, modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
            )
            LazyColumn(Modifier.weight(1f)) {
                items(shown) { c ->
                    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                        Text(c.name, fontWeight = FontWeight.Medium)
                        if (c.className.isNotBlank()) Text(c.className, color = Color.Gray, style = MaterialTheme.typography.bodySmall)
                    }
                    HorizontalDivider()
                }
            }
        }
        if (showAdd) QuickAddDialog(
            org = org,
            onDismiss = { showAdd = false },
            onAdded = { showAdd = false; toast(context, "Child added."); reload() },
        )
    }
}

@Composable
private fun QuickAddDialog(org: Org, onDismiss: () -> Unit, onAdded: () -> Unit) {
    val scope = rememberCoroutineScope()
    var first by remember { mutableStateOf("") }
    var last by remember { mutableStateOf("") }
    var classId by remember { mutableStateOf(org.assignedCategoryId) }
    var className by remember { mutableStateOf<String?>(null) }
    var classes by remember { mutableStateOf<List<ClassItem>>(emptyList()) }
    var menu by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val needsPicker = org.role != "TEACHER"

    androidx.compose.runtime.LaunchedEffect(org.id) {
        if (needsPicker) runCatching { classes = Api.classes(org.id) }.onFailure { error = friendly(it as Exception) }
    }

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Quick add a child") },
        text = {
            Column {
                Text("Just a name and a class. The rest can be filled in later.", Modifier.padding(bottom = 8.dp))
                OutlinedTextField(first, { first = it }, label = { Text("First name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(last, { last = it }, label = { Text("Surname") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
                if (needsPicker) {
                    OutlinedButton(onClick = { menu = true }, Modifier.fillMaxWidth().padding(top = 8.dp)) { Text(className ?: "Choose a class") }
                    DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                        classes.forEach { c -> DropdownMenuItem(text = { Text(c.name) }, onClick = { classId = c.id; className = c.name; menu = false }) }
                    }
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp)) }
            }
        },
        confirmButton = {
            Button(
                enabled = !busy && first.isNotBlank() && last.isNotBlank() && classId != null,
                onClick = {
                    busy = true; error = null
                    scope.launch {
                        try {
                            Api.quickAddChild(org.id, classId!!, first.trim(), last.trim(), todayIso())
                            onAdded()
                        } catch (e: Exception) {
                            error = friendly(e)
                        } finally {
                            busy = false
                        }
                    }
                },
            ) { Text(if (busy) "Adding…" else "Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !busy) { Text("Cancel") } },
    )
}

// ---------------------------------------------------------------- Files

@Composable
fun FilesScreen(org: Org) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val mode = if (org.can("VIEW_CENTRE")) "centre" else "accounting"
    // Where we are: a stack of query parameters, root first.
    var stack by remember(org.id) { mutableStateOf(listOf<Map<String, String>>(emptyMap())) }
    val current = stack.last()
    BackHandler(enabled = stack.size > 1) { stack = stack.dropLast(1) }
    var busyFile by remember { mutableStateOf<String?>(null) }

    fun fetch(f: FileRow, share: Boolean) {
        busyFile = f.name
        scope.launch {
            try {
                val file = Api.download(context, f.downloadHref, f.name)
                val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
                val intent = if (share) {
                    Intent.createChooser(
                        Intent(Intent.ACTION_SEND).setType("application/pdf").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),
                        f.name,
                    )
                } else {
                    Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/pdf").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                try { context.startActivity(intent) } catch (e: ActivityNotFoundException) { toast(context, "No app on this tablet can open PDFs.") }
            } catch (e: Exception) {
                toast(context, friendly(e))
            } finally {
                busyFile = null
            }
        }
    }

    Loader(key = "files-${org.id}-$current", load = { Api.files(org.id, mode, current) }) { page, _ ->
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (stack.size > 1) Button(onClick = { stack = stack.dropLast(1) }) { Text("← Back") }
                Title("Files")
            }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(page.folders) { f ->
                    Card(Modifier.fillMaxWidth().clickable { stack = stack + listOf(f.params) }) {
                        Column(Modifier.padding(16.dp)) {
                            Text(f.title, fontWeight = FontWeight.Medium)
                            f.subtitle?.let { Text(it, color = Color.Gray, style = MaterialTheme.typography.bodySmall) }
                        }
                    }
                }
                items(page.files) { f -> FileCard(f, busyFile == f.name) { share -> fetch(f, share) } }
                items(page.children) { c ->
                    Column {
                        Text(c.name, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp))
                        if (c.files.isEmpty()) Text(c.emptyText, color = Color.Gray, style = MaterialTheme.typography.bodySmall)
                        c.files.forEach { f -> FileCard(f, busyFile == f.name) { share -> fetch(f, share) } }
                    }
                }
            }
        }
    }
}

@Composable
private fun FileCard(f: FileRow, busy: Boolean, onAction: (share: Boolean) -> Unit) {
    Card(Modifier.fillMaxWidth().padding(top = 6.dp)) {
        Column(Modifier.padding(12.dp)) {
            Text(f.name, fontWeight = FontWeight.Medium)
            Text(f.detail, color = Color.Gray, style = MaterialTheme.typography.bodySmall)
            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { onAction(false) }, enabled = !busy) { Text(if (busy) "Preparing…" else "Open") }
                if (f.shareable) OutlinedButton(onClick = { onAction(true) }, enabled = !busy) { Text("Share") }
            }
        }
    }
}

// ---------------------------------------------------------------- Alarms

@Composable
fun AlarmsScreen() {
    val context = LocalContext.current
    var alarms by remember { mutableStateOf(Prefs.alarms) }
    fun save(list: List<DailyAlarm>) {
        Prefs.alarms = list
        alarms = list
        list.forEach { AlarmScheduler.schedule(context, it) }
    }

    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Title("Alarms")
            Text("A loud alarm that rings even when the tablet is on silent, until you tap Stop. It works without internet.")
            Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = {
                    TimePickerDialog(context, { _, h, m ->
                        val id = (alarms.maxOfOrNull { it.id } ?: 0) + 1
                        save(alarms + DailyAlarm(id, h, m, "Take the register", weekdaysOnly = true, enabled = true))
                    }, 8, 30, true).show()
                }) { Text("Add alarm") }
                OutlinedButton(onClick = { AlarmService.ring(context, "Test alarm", "This is how loud it will be. Tap Stop.") }) { Text("Test it") }
            }
        }
        items(alarms) { a ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("%02d:%02d".format(a.hour, a.minute), style = MaterialTheme.typography.headlineSmall)
                            Text(a.label + if (a.weekdaysOnly) " · weekdays" else " · every day", color = Color.Gray)
                        }
                        Switch(checked = a.enabled, onCheckedChange = { on -> save(alarms.map { if (it.id == a.id) it.copy(enabled = on) else it }) })
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = { save(alarms.map { if (it.id == a.id) it.copy(weekdaysOnly = !it.weekdaysOnly) else it }) }) {
                            Text(if (a.weekdaysOnly) "Ring weekends too" else "Weekdays only")
                        }
                        TextButton(onClick = {
                            val am = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
                            am.cancelAll(context, a.id)
                            save(alarms.filterNot { it.id == a.id })
                        }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
                    }
                }
            }
        }
        item {
            Text("For alarms to be reliable", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 12.dp))
            Text("Turn off battery saving for Crechely, and allow notifications. Alarms keep working after a restart.")
            OutlinedButton(
                onClick = { context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))) },
                modifier = Modifier.padding(top = 8.dp),
            ) { Text("Open app settings") }
        }
    }
}

private fun android.app.AlarmManager.cancelAll(context: Context, id: Int) {
    cancel(
        android.app.PendingIntent.getBroadcast(
            context, 5000 + id, Intent(context, AlarmReceiver::class.java).putExtra("alarmId", id),
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE,
        ),
    )
}
