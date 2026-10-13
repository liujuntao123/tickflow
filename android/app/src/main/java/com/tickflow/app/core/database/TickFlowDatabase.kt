package com.tickflow.app.core.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Database(
    entities = [
        TaskEntity::class,
        ListEntity::class,
        FolderEntity::class,
        TagEntity::class,
        HabitEntity::class,
        SettingsEntity::class,
        TombstoneEntity::class,
        ScheduledAlarmEntity::class,
    ],
    version = 2,
    exportSchema = false,
)
@TypeConverters(Converters::class)
abstract class TickFlowDatabase : RoomDatabase() {
    abstract fun taskDao(): TaskDao
    abstract fun listDao(): ListDao
    abstract fun folderDao(): FolderDao
    abstract fun tagDao(): TagDao
    abstract fun habitDao(): HabitDao
    abstract fun settingsDao(): SettingsDao
    abstract fun tombstoneDao(): TombstoneDao
    abstract fun scheduledAlarmDao(): ScheduledAlarmDao
}

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): TickFlowDatabase =
        Room.databaseBuilder(context, TickFlowDatabase::class.java, "tickflow.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides fun provideTaskDao(db: TickFlowDatabase): TaskDao = db.taskDao()
    @Provides fun provideListDao(db: TickFlowDatabase): ListDao = db.listDao()
    @Provides fun provideFolderDao(db: TickFlowDatabase): FolderDao = db.folderDao()
    @Provides fun provideTagDao(db: TickFlowDatabase): TagDao = db.tagDao()
    @Provides fun provideHabitDao(db: TickFlowDatabase): HabitDao = db.habitDao()
    @Provides fun provideSettingsDao(db: TickFlowDatabase): SettingsDao = db.settingsDao()
    @Provides fun provideTombstoneDao(db: TickFlowDatabase): TombstoneDao = db.tombstoneDao()
    @Provides fun provideScheduledAlarmDao(db: TickFlowDatabase): ScheduledAlarmDao = db.scheduledAlarmDao()
}