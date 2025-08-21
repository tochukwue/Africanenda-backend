import { Controller, Get, Post, HttpCode, HttpStatus, Query, BadRequestException, Body } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IpslistService } from './ipslist.service';
import { IpsActivity } from './schema/ipslist.schema';
import { GetByCategoriesDto } from './dto/ipslist.dto';

@ApiTags('IPS Activity')
@Controller('ipslist')
export class IpslistController {
  constructor(private readonly ipslistService: IpslistService) { }


  @Get('general-data/search-system-names')
  @ApiQuery({
    name: 'term',
    required: true,
    example: 'Pay',
    description: 'Partial or full system name to search (case-insensitive). Min 2 characters.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of matching system names.',
    schema: {
      example: [
        { systemName: 'PayNow' },
        { systemName: 'MobilePay' },
      ],
    },
  })
  async searchSystemNames(@Query('term') term: string) {
    return this.ipslistService.searchSystemNames(term);
  }

  @Get('general-data/by-geographic-reach')
  @ApiQuery({
    name: 'geographicReach',
    required: true,
    example: 'Nigeria',
    description: 'Exact geographic reach value (case-insensitive).',
  })
  @ApiResponse({
    status: 200,
    description: 'List of GeneralData records matching the given geographic reach.',
    schema: {
      example: [
        {
          systemName: 'PayNow',
          geographicReach: 'Nigeria',
          supportedUseCases: ['P2P', 'Retail'],
          participantTypes: ['Bank'],
          paymentInitiationChannels: ['Mobile App', 'Internet Banking'],
        },
      ],
    },
  })
  async getByGeographicReach(@Query('geographicReach') geographicReach: string) {
    return this.ipslistService.getByGeographicReach(geographicReach);
  }
  @Post('value-data/graph/value')
  @ApiOperation({ summary: 'Get ValueData with country codes by system names' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        systemNames: {
          type: 'array',
          items: { type: 'string' },
          example: ['eKash', 'EIPS']
        }
      }
    }
  })
  async getValueData(@Body('systemNames') systemNames: string[]) {
    return this.ipslistService.getValueDataWithCountryCode(systemNames);
  }

  @Post('volume-data/graph/volume')
  @ApiOperation({ summary: 'Get VolumeData with country codes by system names' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        systemNames: {
          type: 'array',
          items: { type: 'string' },
          example: ['eKash', 'EIPS']
        }
      }
    }
  })
  async getVolumeData(@Body('systemNames') systemNames: string[]) {
    return this.ipslistService.getVolumeDataWithCountryCode(systemNames);
  }


  @Get('value/all-except-total')
  @ApiOperation({ summary: 'Fetch all ValueData except the one with systemName "Total"' })
  async getAllValueDataExceptTotal() {
    return this.ipslistService.getAllValueDataExceptTotal();
  }

  @Get('value/total')
  @ApiOperation({ summary: 'Fetch ValueData where systemName = "Total"' })
  async getValueDataTotal() {
    return this.ipslistService.getValueDataTotal();
  }

  @Get('volume/all-except-total')
  @ApiOperation({ summary: 'Fetch all VolumeData except the one with systemName "Total"' })
  async getAllVolumeDataExceptTotal() {
    return this.ipslistService.getAllVolumeDataExceptTotal();
  }

  @Get('volume/total')
  @ApiOperation({ summary: 'Fetch VolumeData where systemName = "Total"' })
  async getVolumeDataTotal() {
    return this.ipslistService.getVolumeDataTotal();
  }

  @Get('ips-profile/grouped-by-region')
  @ApiOperation({
    summary: 'Get General Data grouped by geographic region',
    description: 'Fetches all General Data records grouped by geographicRegion, including countryCode for each record.',
  })
  async getGeneralDataGroupedByRegion() {
    return this.ipslistService.getGeneralDataGroupedByRegionAndCountry();
  }


  @Get('categories/summary')
  @ApiOperation({
    summary: 'Get IPS categories summary',
    description:
      'Returns counts of IPS activities grouped into **Domestic** and **Regional**, with each category having a short alias (LIVE, IN DEVELOPMENT, NO IPS, PILOT).',
  })
  async getCategorySummary() {
    return this.ipslistService.countByDomesticAndRegional();
  }

  // Option 1: POST endpoint with request body (RECOMMENDED)
  @Post('by-categories')
  @ApiOperation({
    summary: 'Get IPS data by categories with filters',
    description: 'Retrieve IPS records filtered by categories and optional additional filters'
  })
  @ApiResponse({
    status: 200,
    description: 'List of IPS records enriched with country code and extra data.',
    schema: {
      example: {
        categories: ['LIVE: DOMESTIC IPS'],
        totalCategories: 1,
        results: [
          {
            category: 'LIVE: DOMESTIC IPS',
            total: 2,
            data: [
              {
                category: 'LIVE: DOMESTIC IPS',
                ipsName: 'Example IPS',
                geography: 'Kenya',
                countryCode: 'KE',
                supportedUseCases: ['P2P', 'Retail'],
                volumes2024: 500000,
                values2024: 2000000
              }
            ]
          }
        ]
      }
    }
  })
  async getByCategoriesPost(@Body() dto: GetByCategoriesDto) {
    console.log('Categories:', dto.categories);
    console.log('Filters:', dto.filters);

    return this.ipslistService.getByCategoriesEnriched(dto.categories, dto.filters);
  }
  //   @Get('by-categories')
  //   @ApiOperation({
  //     summary: 'Get IPS activity by category',
  //     description: `
  // Fetch IPS activity grouped and enriched based on one or multiple categories.  
  // Enrichment rules:  
  // - **LIVE: DOMESTIC IPS** → Includes volumes2024, values2024, supportedUseCases  
  // - **DOMESTIC: IN DEVELOPMENT** → Includes geography + status  
  // - **Countries with no domestic IPS activity** → Includes geography + status  
  // - **LIVE: REGIONAL IPS** → Expands geographyCountries into separate country entries with country codes  
  // - **REGIONAL: IN DEVELOPMENT** → Same as above + region  
  // - **IN PILOT PHASE** → Same as above + region  
  // - **Countries with no regional IPS activity** → Includes geography only
  //     `,
  //   })
  //   @ApiQuery({
  //     name: 'categories',
  //     required: true,
  //     type: [String],
  //     example: [
  //       'LIVE: DOMESTIC IPS',
  //       'REGIONAL: IN DEVELOPMENT',
  //     ],
  //     description: 'One or multiple IPS activity categories to fetch',
  //   })
  //   @ApiResponse({
  //     status: 200,
  //     description: 'Successfully fetched IPS activity data grouped by category',
  //   })
  //   @ApiResponse({
  //     status: 400,
  //     description: 'Invalid or missing category input',
  //   })
  //   async getIpsByCategories(@Query('categories') categories: string | string[]) {
  //     if (!categories) {
  //       throw new BadRequestException('At least one category must be provided.');
  //     }

  //     const categoriesArray = Array.isArray(categories) ? categories : [categories];

  //     return this.ipslistService.getByCategoriesEnriched(categoriesArray);
  //   }


  @Get()
  @ApiOperation({
    summary: 'Get all IPS Activity records',
    description:
      'Retrieves all IPS Activity records currently stored in MongoDB. These are updated automatically via cron job or manually via the sync endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of IPS Activity records',
    type: [IpsActivity],
  })
  async findAll(): Promise<IpsActivity[]> {
    return this.ipslistService.findAll();
  }

  @Post('manual-sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually sync IPS Activity data from Google Sheets',
    description:
      'Triggers a manual synchronization of IPS Activity data from the configured Google Sheet into MongoDB. Useful for on-demand updates without waiting for the scheduled cron job.',
  })
  @ApiResponse({ status: 200, description: 'IPS Activity data synced successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async manualSync() {
    return this.ipslistService.manualSyncIpsActivity();
  }
}
