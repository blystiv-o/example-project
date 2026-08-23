import { Module } from '@nestjs/common';

import { AuthModule } from '@/auth/auth.module';

import { DashboardClock } from './dashboard.clock';
import { DashboardConfig } from './dashboard.config';
import { DashboardController } from './dashboard.controller';
import { DashboardPeriodService } from './dashboard.period';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule],
  controllers: [DashboardController],
  providers: [
    DashboardClock,
    DashboardConfig,
    DashboardPeriodService,
    DashboardRepository,
    DashboardService,
  ],
})
export class DashboardModule {}
