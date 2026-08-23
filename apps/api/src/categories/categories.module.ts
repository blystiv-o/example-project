import { Module } from '@nestjs/common';

import { AuthModule } from '@/auth/auth.module';

import { CategoriesClock } from './categories.clock';
import { CategoriesConfig } from './categories.config';
import { CategoriesController } from './categories.controller';
import { CategoriesPeriodService } from './categories.period';
import { CategoryRepository } from './categories.repository';
import { CategoriesRequestGuard } from './categories.request.guard';
import { CategoriesService } from './categories.service';

@Module({
  imports: [AuthModule],
  controllers: [CategoriesController],
  providers: [
    CategoriesConfig,
    CategoriesClock,
    CategoriesPeriodService,
    CategoriesRequestGuard,
    CategoryRepository,
    CategoriesService,
  ],
})
export class CategoriesModule {}
