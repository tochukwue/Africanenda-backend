import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { GeneraldataService } from './generaldata.service';
import { CreateGeneraldatumDto } from './dto/generaldatum.dto';
import { UpdateGeneraldatumDto } from './dto/update-generaldatum.dto';
import { GeneralData } from './schema/generaldatum.schema';


@ApiTags('General Data')
@Controller('generaldata')
export class GeneraldataController {
  constructor(private readonly generaldataService: GeneraldataService) {}

  @Get()
  @ApiOperation({ summary: 'Fetch all General Data records' })
  @ApiResponse({ status: 200, description: 'List of all General Data records', type: [GeneralData] })
  async getAll() {
    return this.generaldataService.findAll();
  }

    @Post('sync')
  @ApiOperation({ summary: 'Manually sync General Data from Google Sheets' })
  @ApiResponse({ status: 200, description: 'Sync started' })
  async syncFromGoogleSheet() {
    return this.generaldataService.syncFromGoogleSheet();
  }

     @Post('french/sync')
  @ApiOperation({ summary: 'Manually sync General Data from Google Sheets' })
  @ApiResponse({ status: 200, description: 'Sync started' })
  async FrenchfetchAndSyncGeneralData() {
    return this.generaldataService.FrenchfetchAndSyncGeneralData();
  }
}
