import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { AuthExceptionFilter } from '@/auth/auth-exception.filter';
import { AuthModule } from '@/auth/auth.module';
import { CategoriesModule } from '@/categories/categories.module';
import { TraceMiddleware } from '@/common/trace.middleware';
import { DatabaseModule } from '@/database/database.module';
import { DashboardModule } from '@/dashboard/dashboard.module';
import { ExpensesModule } from '@/expenses/expenses.module';
import { HealthModule } from '@/health/health.module';
import { UsersModule } from '@/users/users.module';
import { VersionModule } from '@/version/version.module';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    VersionModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ExpensesModule,
    DashboardModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AuthExceptionFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceMiddleware).forRoutes('{*path}');
  }
}
