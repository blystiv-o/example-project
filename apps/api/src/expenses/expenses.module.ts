import { Module } from '@nestjs/common';

import { AuthModule } from '@/auth/auth.module';

import { ExpensesCalendar } from './expenses.calendar';
import { ExpensesController } from './expenses.controller';
import { ExpensesRepository } from './expenses.repository';
import { ExpensesRequestGuard } from './expenses.request.guard';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [AuthModule],
  controllers: [ExpensesController],
  providers: [ExpensesCalendar, ExpensesRepository, ExpensesRequestGuard, ExpensesService],
})
export class ExpensesModule {}
