import { Injectable } from '@nestjs/common';

@Injectable()
export class CategoriesClock {
  now(): Date {
    return new Date();
  }
}
