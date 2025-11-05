import { Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { VolumedataService } from './volumedata.service';
import { VolumeData } from './schema/volumedatum.schema';


@ApiTags('Volume Data')
@Controller('volume-data')
export class VolumedataController {
  constructor(private readonly volumeDataService: VolumedataService) {}

  @Get()
  @ApiOperation({ summary: 'Get all Volume Data records from database' })
  async findAll(): Promise<VolumeData[]> {
    return this.volumeDataService.findAll();
  }

      @Post('sync')
    @ApiOperation({ summary: 'Manually sync General Data from Google Sheets' })
    @ApiResponse({ status: 200, description: 'Sync started' })
    async syncFromGoogleSheet() {
      return this.volumeDataService.syncFromGoogleSheet();
    }

          @Post('freanch/sync')
    @ApiOperation({ summary: 'Manually sync General Data from Google Sheets' })
    @ApiResponse({ status: 200, description: 'Sync started' })
    async FrenchsyncFromGoogleSheet() {
      return this.volumeDataService.FrenchsyncFromGoogleSheet();
    }
}
