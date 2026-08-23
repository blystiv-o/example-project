import { Controller, Get } from '@nestjs/common';
import { API_VERSION, type HealthResponse } from '@money-tracker/shared';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'money-tracker-api',
      version: API_VERSION,
    };
  }
}
