import { Injectable } from '@nestjs/common';

@Injectable()
export class DashboardClock {
  now(): Date {
    return new Date();
  }
}
