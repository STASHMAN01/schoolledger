package za.co.crechely.app

import org.json.JSONArray
import org.json.JSONObject

data class Org(
    val id: String,
    val name: String,
    val role: String,
    val permissions: Set<String>,
    val assignedCategoryId: String?,
) {
    fun can(p: String) = p in permissions
}

data class Me(val name: String, val email: String, val orgs: List<Org>)
data class Todo(val id: String, val label: String, val count: Int)
data class ClassItem(val id: String, val name: String)
data class RegChild(val id: String, val name: String, val status: String?) // PRESENT / ABSENT / null
data class ChildItem(val id: String, val name: String, val className: String)

data class FolderRow(val title: String, val subtitle: String?, val params: Map<String, String>)
data class FileRow(val name: String, val detail: String, val href: String, val downloadHref: String, val shareable: Boolean)
data class ChildFiles(val name: String, val files: List<FileRow>, val emptyText: String)
data class FilesPage(
    val level: String,
    val folders: List<FolderRow>,
    val files: List<FileRow>,
    val children: List<ChildFiles>,
)

fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
fun JSONObject.str(key: String): String? = if (isNull(key)) null else optString(key)

fun parseMe(j: JSONObject): Me {
    val user = j.getJSONObject("user")
    val orgs = j.getJSONArray("organizations").objects().map { o ->
        val perms = o.getJSONArray("permissions")
        Org(
            id = o.getString("id"),
            name = o.getString("name"),
            role = o.getString("role"),
            permissions = (0 until perms.length()).map { perms.getString(it) }.toSet(),
            assignedCategoryId = o.str("assignedCategoryId"),
        )
    }
    return Me(user.getString("name"), user.getString("email"), orgs)
}

fun parseTodos(j: JSONObject): List<Todo> =
    j.getJSONArray("todos").objects().map { Todo(it.getString("id"), it.getString("label"), it.optInt("count", 0)) }

fun parseClasses(j: JSONObject): List<ClassItem> =
    j.getJSONArray("categories").objects().map { ClassItem(it.getString("id"), it.getString("name")) }

fun parseRegister(j: JSONObject): List<RegChild> =
    j.getJSONArray("children").objects().map {
        RegChild(it.getString("id"), "${it.getString("firstName")} ${it.getString("lastName")}", it.str("status"))
    }

fun parseChildren(j: JSONObject): List<ChildItem> =
    j.getJSONArray("children").objects().map {
        ChildItem(
            it.getString("id"),
            "${it.getString("firstName")} ${it.getString("lastName")}",
            it.optJSONObject("category")?.optString("name") ?: "",
        )
    }

private fun parseFile(o: JSONObject) = FileRow(
    o.getString("name"), o.optString("detail"), o.getString("href"), o.getString("downloadHref"), o.optBoolean("shareable", false),
)

fun parseFiles(j: JSONObject, current: Map<String, String>): FilesPage {
    val level = j.getString("level")
    val folders = mutableListOf<FolderRow>()
    when (level) {
        "root" -> j.getJSONArray("folders").objects().forEach {
            folders += FolderRow(it.getString("label"), it.str("hint"), mapOf("folder" to it.getString("key")))
        }
        "months" -> j.getJSONArray("months").objects().forEach {
            folders += FolderRow(it.getString("label"), null, current + ("month" to it.getString("key")))
        }
        "classes" -> j.getJSONArray("classes").objects().forEach {
            folders += FolderRow(it.getString("name"), it.str("summary"), current + ("classId" to it.getString("id")))
        }
    }
    val files = if (level == "class") j.getJSONArray("files").objects().map(::parseFile) else emptyList()
    val children = if (level == "class") {
        j.getJSONArray("children").objects().map { c ->
            ChildFiles(c.getString("name"), c.getJSONArray("files").objects().map(::parseFile), c.optString("emptyText"))
        }
    } else emptyList()
    return FilesPage(level, folders, files, children)
}
