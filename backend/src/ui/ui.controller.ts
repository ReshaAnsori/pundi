import { Controller, Get, Header } from '@nestjs/common';
import fs from 'node:fs';
import path from 'node:path';
import { Public } from '../common/decorators/public.decorator.js';

@Controller('app')
export class UiController {
  @Public()
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getIndex(): string {
    const filePath = path.resolve(process.cwd(), 'public/index.html');
    return fs.readFileSync(filePath, 'utf-8');
  }
}
