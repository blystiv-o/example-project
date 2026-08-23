import { Controller, Get } from '@nestjs/common';

const APP_VERSION = 1;

interface VersionResponse {
  version: number;
}

@Controller('version')
export class VersionController {
  @Get()
  getVersion(): VersionResponse {
    return { version: APP_VERSION };
  }
}
