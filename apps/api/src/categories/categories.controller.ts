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
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type {
  CategoryListResponse,
  CategoryResponse,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '@money-tracker/shared';
import { createCategoryRequestSchema, updateCategoryRequestSchema } from '@money-tracker/shared';

import { ZodValidationPipe } from '@/auth/zod-validation.pipe';
import { SessionGuard, type AuthenticatedRequest } from '@/auth/guards/session.guard';
import { AuthError } from '@/auth/auth.error';
import { NoStoreInterceptor } from '@/common/no-store.interceptor';

import { CategoriesRequestGuard } from './categories.request.guard';
import { CategoriesService } from './categories.service';

function parseIfMatch(value: string | undefined): number {
  if (!value) {
    throw new AuthError(
      'VERSION_REQUIRED',
      HttpStatus.PRECONDITION_REQUIRED,
      'Потрібен заголовок If-Match із поточною версією категорії',
    );
  }
  const match = value.match(/^"(\d+)"$/);
  if (!match) {
    throw new AuthError(
      'VERSION_REQUIRED',
      HttpStatus.PRECONDITION_REQUIRED,
      'Потрібен заголовок If-Match із поточною версією категорії',
    );
  }
  return Number.parseInt(match[1] ?? '', 10);
}

@Controller('categories')
@UseGuards(SessionGuard, CategoriesRequestGuard)
@UseInterceptors(NoStoreInterceptor)
export class CategoriesController {
  constructor(@Inject(CategoriesService) private readonly categoriesService: CategoriesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<CategoryListResponse> {
    return this.categoriesService.list(request.authUser.id, request.traceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createCategoryRequestSchema)) input: CreateCategoryRequest,
  ): Promise<CategoryResponse> {
    return this.categoriesService.create(request.authUser.id, input, request.traceId);
  }

  @Patch(':categoryId')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body(new ZodValidationPipe(updateCategoryRequestSchema)) input: UpdateCategoryRequest,
  ): Promise<CategoryResponse> {
    return this.categoriesService.update(
      request.authUser.id,
      categoryId,
      parseIfMatch(ifMatch),
      input,
      request.traceId,
    );
  }

  @Delete(':categoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(
    @Req() request: AuthenticatedRequest,
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @Headers('if-match') ifMatch: string | undefined,
  ): Promise<void> {
    await this.categoriesService.archive(
      request.authUser.id,
      categoryId,
      parseIfMatch(ifMatch),
      request.traceId,
    );
  }
}
