import { Module } from '@nestjs/common';
import { HabitTemplatesController, HabitsController } from './habits.controller';
import { HabitsService } from './habits.service';

@Module({
  controllers: [HabitsController, HabitTemplatesController],
  providers: [HabitsService],
})
export class HabitsModule {}