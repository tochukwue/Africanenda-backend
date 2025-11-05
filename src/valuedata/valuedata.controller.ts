import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ValueData } from './schema/valuedatum.schema';
import { ValuedataService } from './valuedata.service';

@ApiTags('Value Data') // Groups endpoints in Swagger
@Controller('value-data')
export class ValuedataController {
  constructor(private readonly valueDataService: ValuedataService) { }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually sync Value Data from Google Sheets' })
  @ApiResponse({ status: 200, description: 'Data synced successfully' })
  async syncData() {
    await this.valueDataService.syncFromGoogleSheet();
    return { message: 'Value Data synced successfully' };
  }

    @Post('french/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually sync Value Data from Google Sheets' })
  @ApiResponse({ status: 200, description: 'Data synced successfully' })
  async FrenchsyncFromGoogleSheet() {
    await this.valueDataService.FrenchsyncFromGoogleSheet();
    return { message: 'Value Data synced successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'Get all stored Value Data records' })
  @ApiResponse({
    status: 200,
    description: 'List of Value Data records',
    type: [ValueData],
  })
  async findAll(): Promise<ValueData[]> {
    return this.valueDataService.findAll();
  }
}
