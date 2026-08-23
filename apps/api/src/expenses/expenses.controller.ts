import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type {
  CreateExpenseRequest,
  ExpenseListQuery,
  ExpenseListResponse,
  ExpenseResponse,
  UpdateExpenseRequest,
} from '@money-tracker/shared';
import {
  createExpenseRequestSchema,
  expenseListQuerySchema,
  updateExpenseRequestSchema,
} from '@money-tracker/shared';

import { AuthError } from '@/auth/auth.error';
import { SessionGuard, type AuthenticatedRequest } from '@/auth/guards/session.guard';
import { ZodValidationPipe } from '@/auth/zod-validation.pipe';
import { NoStoreInterceptor } from '@/common/no-store.interceptor';

import { ExpensesRequestGuard } from './expenses.request.guard';
import { ExpensesService } from './expenses.service';

function parseIfMatch(value: string | undefined): number {
  const match = value?.match(/^"(\d+)"$/);
  if (!match) {
    throw new AuthError(
      'EXPENSE_VERSION_REQUIRED',
      HttpStatus.PRECONDITION_REQUIRED,
      'Потрібен заголовок If-Match із поточною версією витрати',
    );
  }
  return Number.parseInt(match[1] ?? '', 10);
}

@Controller('expenses')
@UseGuards(SessionGuard, ExpensesRequestGuard)
@UseInterceptors(NoStoreInterceptor)
export class ExpensesController {
  constructor(@Inject(ExpensesService) private readonly expensesService: ExpensesService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query(new ZodValidationPipe(expenseListQuerySchema)) query: ExpenseListQuery,
  ): Promise<ExpenseListResponse> {
    return this.expensesService.list(request.authUser.id, query, request.traceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createExpenseRequestSchema)) input: CreateExpenseRequest,
  ): Promise<ExpenseResponse> {
    return this.expensesService.create(request.authUser.id, input, request.traceId);
  }

  @Patch(':expenseId')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('expenseId', new ParseUUIDPipe()) expenseId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body(new ZodValidationPipe(updateExpenseRequestSchema)) input: UpdateExpenseRequest,
  ): Promise<ExpenseResponse> {
    return this.expensesService.update(
      request.authUser.id,
      expenseId,
      parseIfMatch(ifMatch),
      input,
      request.traceId,
    );
  }

  @Delete(':expenseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Req() request: AuthenticatedRequest,
    @Param('expenseId', new ParseUUIDPipe()) expenseId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ): Promise<void> {
    await this.expensesService.delete(
      request.authUser.id,
      expenseId,
      parseIfMatch(ifMatch),
      request.traceId,
    );
  }
}
