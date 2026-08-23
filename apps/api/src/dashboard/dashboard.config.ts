import { Injectable } from '@nestjs/common';

@Injectable()
export class DashboardConfig {
  readonly timeZone: string;

  constructor() {
    const timeZone = process.env.APP_TIME_ZONE ?? 'Europe/Kyiv';
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
    } catch {
      throw new Error(`APP_TIME_ZONE must be a valid IANA time zone, received "${timeZone}"`);
    }
    this.timeZone = timeZone;
  }
}
