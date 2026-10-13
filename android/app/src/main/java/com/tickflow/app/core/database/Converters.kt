package com.tickflow.app.core.database

import androidx.room.TypeConverter
import com.tickflow.app.core.network.dto.ChecklistItemDto
import com.tickflow.app.core.network.dto.ReminderDto
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json

class Converters {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true; explicitNulls = false }

    @TypeConverter
    fun fromStringList(value: List<String>): String = json.encodeToString(ListSerializer(String.serializer()), value)

    @TypeConverter
    fun toStringList(value: String?): List<String> =
        value?.let { runCatching { json.decodeFromString(ListSerializer(String.serializer()), it) }.getOrNull() }
            ?: emptyList()

    @TypeConverter
    fun fromIntList(value: List<Int>): String = json.encodeToString(ListSerializer(Int.serializer()), value)

    @TypeConverter
    fun toIntList(value: String?): List<Int> =
        value?.let { runCatching { json.decodeFromString(ListSerializer(Int.serializer()), it) }.getOrNull() }
            ?: emptyList()

    @TypeConverter
    fun fromReminders(value: List<ReminderDto>?): String? =
        value?.let { json.encodeToString(ListSerializer(ReminderDto.serializer()), it) }

    @TypeConverter
    fun toReminders(value: String?): List<ReminderDto>? =
        value?.let { runCatching { json.decodeFromString(ListSerializer(ReminderDto.serializer()), it) }.getOrNull() }

    @TypeConverter
    fun fromChecklist(value: List<ChecklistItemDto>?): String? =
        value?.let { json.encodeToString(ListSerializer(ChecklistItemDto.serializer()), it) }

    @TypeConverter
    fun toChecklist(value: String?): List<ChecklistItemDto>? =
        value?.let { runCatching { json.decodeFromString(ListSerializer(ChecklistItemDto.serializer()), it) }.getOrNull() }
}