import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IpsActivity, IpsActivityDocument } from './schema/ipslist.schema';
import { ValueData, ValueDataDocument } from 'src/valuedata/schema/valuedatum.schema';
import { VolumeData, VolumeDataDocument } from 'src/volumedata/schema/volumedatum.schema';
import { GeneralData, GeneralDataDocument } from 'src/generaldata/schema/generaldatum.schema';
import countryCodeLookup from 'country-code-lookup'; // npm install country-code-lookup
import * as Fuse from 'fuse.js';

@Injectable()
export class IpslistService {
  private readonly logger = new Logger(IpslistService.name);

  constructor(
    @InjectModel(IpsActivity.name) private readonly ipsActivityModel: Model<IpsActivityDocument>,
    @InjectModel(ValueData.name)
    private readonly valueDataModel: Model<ValueDataDocument>,
    @InjectModel(VolumeData.name)
    private readonly volumeDataModel: Model<VolumeDataDocument>,
    @InjectModel(GeneralData.name)
    private readonly generalDataModel: Model<GeneralDataDocument>,
  ) { }

  async searchSystemNames(term: string): Promise<{ systemName: string }[]> {
    if (!term || term.trim().length < 2) {
      throw new BadRequestException('Search term must be at least 2 characters long.');
    }

    const regex = new RegExp(term, 'i'); // case-insensitive contains
    const results = await this.generalDataModel
      .find({ systemName: { $regex: regex } }, { systemName: 1, geographicReach:1, _id: 0 })
      .lean()
      .exec();

    return results;
  }

  /**
   * Get GeneralData list by geographicReach
   */
  async getByGeographicReach(geographicReach: string): Promise<GeneralData[]> {
    if (!geographicReach) {
      throw new BadRequestException('geographicReach is required.');
    }

    return this.generalDataModel
      .find({ geographicReach: { $regex: new RegExp(`^${geographicReach}$`, 'i') } })
      .lean()
      .exec();
  }

async getValueDataWithCountryCode(systemNames: string[], startYear?: number, endYear?: number) {
  if (!Array.isArray(systemNames) || systemNames.length === 0) {
    throw new BadRequestException('systemNames must be a non-empty array.');
  }

  if (startYear && endYear && startYear > endYear) {
    throw new BadRequestException('startYear cannot be greater than endYear.');
  }

  const includeTotal = systemNames.some(name => name.toLowerCase() === 'total');

  const results = includeTotal
    ? await this.valueDataModel.find({}).lean()
    : await this.valueDataModel.find({ systemName: { $in: systemNames } }).lean();

  // ✅ If systemNames = ['total'], group by geographicReach
  let mapped: any[] = [];

  if (systemNames.length === 1 && systemNames[0].toLowerCase() === 'total') {
    const grouped = results.reduce((acc, item) => {
      const key = item.geographicReach || 'UNKNOWN';
      if (!acc[key]) {
        acc[key] = {
          geographicReach: key,
          countryCode: this.getCountryCode(key),
          systemNames: [],
        };

        if (startYear && endYear) {
          for (let y = startYear; y <= endYear; y++) {
            acc[key][`values${y}`] = 0;
          }
        } else {
          for (let y = 2020; y <= 2024; y++) {
            acc[key][`values${y}`] = 0;
          }
        }
      }

      acc[key].systemNames.push(item.systemName);

      const fields = Object.keys(item).filter(k => k.startsWith('values'));
      for (const field of fields) {
        const yearMatch = field.match(/(\d{4})$/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1], 10);
          if (!startYear || !endYear || (year >= startYear && year <= endYear)) {
            const val = item[field];
            if (val !== null && val !== undefined && val !== '') {
              const num = Number(val);
              if (!isNaN(num)) {
                acc[key][field] = (acc[key][field] || 0) + num;
              }
            }
          }
        }
      }

      return acc;
    }, {} as Record<string, any>);

    mapped = Object.values(grouped);
  } else {
    // ✅ Filter years for non-total systems
    mapped = results.map(item => {
      const filteredItem: any = {
        geographicReach: item.geographicReach,
        countryCode: this.getCountryCode(item.geographicReach),
        systemNames: [item.systemName],
      };

      const fields = Object.keys(item).filter(k => k.startsWith('values'));
      for (const field of fields) {
        const yearMatch = field.match(/(\d{4})$/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1], 10);
          if (!startYear || !endYear || (year >= startYear && year <= endYear)) {
            filteredItem[field] = item[field];
          }
        }
      }

      return filteredItem;
    });
  }

  if (includeTotal) {
    const totalObj = mapped.find(item =>
      item.systemNames.some(name => name.toLowerCase() === 'total')
    );

    const otherNames = systemNames
      .filter(name => name.toLowerCase() !== 'total')
      .map(name => name.toLowerCase());

    let data;

    if (otherNames.length === 0) {
      data = mapped.filter(item =>
        !item.systemNames.some(name => name.toLowerCase() === 'total')
      );
    } else {
      data = mapped.filter(item =>
        item.systemNames.some(name => otherNames.includes(name.toLowerCase()))
      );
    }

    return {
      total: totalObj || null,
      data,
    };
  }

  return mapped;
}

async getVolumeDataWithCountryCode(systemNames: string[], startYear?: number, endYear?: number) {
  if (!Array.isArray(systemNames) || systemNames.length === 0) {
    throw new BadRequestException('systemNames must be a non-empty array.');
  }

  if (startYear && endYear && startYear > endYear) {
    throw new BadRequestException('startYear cannot be greater than endYear.');
  }

  const includeTotal = systemNames.some(name => name.toLowerCase() === 'total');

  const results = includeTotal
    ? await this.volumeDataModel.find({}).lean()
    : await this.volumeDataModel.find({ systemName: { $in: systemNames } }).lean();

  let mapped: any[] = [];

  if (systemNames.length === 1 && systemNames[0].toLowerCase() === 'total') {
    const grouped = results.reduce((acc, item) => {
      const key = item.geographicReach || 'UNKNOWN';
      if (!acc[key]) {
        acc[key] = {
          geographicReach: key,
          countryCode: this.getCountryCode(key),
          systemNames: [],
        };

        if (startYear && endYear) {
          for (let y = startYear; y <= endYear; y++) {
            acc[key][`volumes${y}`] = 0;
          }
        } else {
          for (let y = 2020; y <= 2024; y++) {
            acc[key][`volumes${y}`] = 0;
          }
        }
      }

      acc[key].systemNames.push(item.systemName);

      const fields = Object.keys(item).filter(k => k.startsWith('volumes'));
      for (const field of fields) {
        const yearMatch = field.match(/(\d{4})$/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1], 10);
          if (!startYear || !endYear || (year >= startYear && year <= endYear)) {
            const val = item[field];
            if (val !== null && val !== undefined && val !== '') {
              const num = Number(val);
              if (!isNaN(num)) {
                acc[key][field] = (acc[key][field] || 0) + num;
              }
            }
          }
        }
      }

      return acc;
    }, {} as Record<string, any>);

    mapped = Object.values(grouped);
  } else {
    // ✅ Filter years for non-total systems
    mapped = results.map(item => {
      const filteredItem: any = {
        geographicReach: item.geographicReach,
        countryCode: this.getCountryCode(item.geographicReach),
        systemNames: [item.systemName],
      };

      const fields = Object.keys(item).filter(k => k.startsWith('volumes'));
      for (const field of fields) {
        const yearMatch = field.match(/(\d{4})$/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1], 10);
          if (!startYear || !endYear || (year >= startYear && year <= endYear)) {
            filteredItem[field] = item[field];
          }
        }
      }

      return filteredItem;
    });
  }

  if (includeTotal) {
    const totalObj = mapped.find(item =>
      item.systemNames.some(name => name.toLowerCase() === 'total')
    );

    const otherNames = systemNames
      .filter(name => name.toLowerCase() !== 'total')
      .map(name => name.toLowerCase());

    let data;

    if (otherNames.length === 0) {
      data = mapped.filter(item =>
        !item.systemNames.some(name => name.toLowerCase() === 'total')
      );
    } else {
      data = mapped.filter(item =>
        item.systemNames.some(name => otherNames.includes(name.toLowerCase()))
      );
    }

    return {
      total: totalObj || null,
      data,
    };
  }

  return mapped;
}



  // async getValueDataWithCountryCode(systemNames: string[], startYear?: number, endYear?: number) {
  //   if (!Array.isArray(systemNames) || systemNames.length === 0) {
  //     throw new BadRequestException('systemNames must be a non-empty array.');
  //   }

  //   if (startYear && endYear && startYear > endYear) {
  //     throw new BadRequestException('startYear cannot be greater than endYear.');
  //   }

  //   const includeTotal = systemNames.some(name => name.toLowerCase() === 'total');

  //   const results = includeTotal
  //     ? await this.valueDataModel.find({}).lean()
  //     : await this.valueDataModel.find({ systemName: { $in: systemNames } }).lean();

  //   const grouped = results.reduce((acc, item) => {
  //     const key = item.geographicReach || 'UNKNOWN';
  //     if (!acc[key]) {
  //       acc[key] = {
  //         geographicReach: key,
  //         countryCode: this.getCountryCode(key),
  //         systemNames: [],
  //       };

  //       // Dynamically initialize only the filtered years
  //       if (startYear && endYear) {
  //         for (let y = startYear; y <= endYear; y++) {
  //           acc[key][`values${y}`] = 0;
  //         }
  //       } else {
  //         // Default: all years
  //         for (let y = 2020; y <= 2025; y++) {
  //           acc[key][`values${y}`] = 0;
  //         }
  //       }
  //     }

  //     acc[key].systemNames.push(item.systemName);

  //     const fields = Object.keys(item).filter(k => k.startsWith('values'));
  //     for (const field of fields) {
  //       const yearMatch = field.match(/(\d{4})$/);
  //       if (yearMatch) {
  //         const year = parseInt(yearMatch[1], 10);
  //         if (!startYear || !endYear || (year >= startYear && year <= endYear)) {
  //           const val = item[field];
  //           if (val !== null && val !== undefined && val !== '') {
  //             const num = Number(val);
  //             if (!isNaN(num)) {
  //               acc[key][field] = (acc[key][field] || 0) + num;
  //             }
  //           }
  //         }
  //       }
  //     }

  //     return acc;
  //   }, {} as Record<string, any>);

  //   const mapped = Object.values(grouped);

  //   if (includeTotal) {
  //     const totalObj = mapped.find(item =>
  //       item.systemNames.some(name => name.toLowerCase() === 'total')
  //     );

  //     const otherNames = systemNames
  //       .filter(name => name.toLowerCase() !== 'total')
  //       .map(name => name.toLowerCase());

  //     let data;

  //     if (otherNames.length === 0) {
  //       data = mapped.filter(item =>
  //         !item.systemNames.some(name => name.toLowerCase() === 'total')
  //       );
  //     } else {
  //       data = mapped.filter(item =>
  //         item.systemNames.some(name => otherNames.includes(name.toLowerCase()))
  //       );
  //     }

  //     return {
  //       total: totalObj || null,
  //       data,
  //     };
  //   }

  //   return mapped;
  // }

  // async getVolumeDataWithCountryCode(systemNames: string[], startYear?: number, endYear?: number) {
  //   if (!Array.isArray(systemNames) || systemNames.length === 0) {
  //     throw new BadRequestException('systemNames must be a non-empty array.');
  //   }

  //   if (startYear && endYear && startYear > endYear) {
  //     throw new BadRequestException('startYear cannot be greater than endYear.');
  //   }

  //   const includeTotal = systemNames.some(name => name.toLowerCase() === 'total');

  //   const results = includeTotal
  //     ? await this.volumeDataModel.find({}).lean()
  //     : await this.volumeDataModel.find({ systemName: { $in: systemNames } }).lean();

  //   const grouped = results.reduce((acc, item) => {
  //     const key = item.geographicReach || 'UNKNOWN';
  //     if (!acc[key]) {
  //       acc[key] = {
  //         geographicReach: key,
  //         countryCode: this.getCountryCode(key),
  //         systemNames: [],
  //       };

  //       if (startYear && endYear) {
  //         for (let y = startYear; y <= endYear; y++) {
  //           acc[key][`volumes${y}`] = 0;
  //         }
  //       } else {
  //         for (let y = 2020; y <= 2025; y++) {
  //           acc[key][`volumes${y}`] = 0;
  //         }
  //       }
  //     }

  //     acc[key].systemNames.push(item.systemName);

  //     const fields = Object.keys(item).filter(k => k.startsWith('volumes'));
  //     for (const field of fields) {
  //       const yearMatch = field.match(/(\d{4})$/);
  //       if (yearMatch) {
  //         const year = parseInt(yearMatch[1], 10);
  //         if (!startYear || !endYear || (year >= startYear && year <= endYear)) {
  //           const val = item[field];
  //           if (val !== null && val !== undefined && val !== '') {
  //             const num = Number(val);
  //             if (!isNaN(num)) {
  //               acc[key][field] = (acc[key][field] || 0) + num;
  //             }
  //           }
  //         }
  //       }
  //     }

  //     return acc;
  //   }, {} as Record<string, any>);

  //   const mapped = Object.values(grouped);

  //   if (includeTotal) {
  //     const totalObj = mapped.find(item =>
  //       item.systemNames.some(name => name.toLowerCase() === 'total')
  //     );

  //     const otherNames = systemNames
  //       .filter(name => name.toLowerCase() !== 'total')
  //       .map(name => name.toLowerCase());

  //     let data;

  //     if (otherNames.length === 0) {
  //       data = mapped.filter(item =>
  //         !item.systemNames.some(name => name.toLowerCase() === 'total')
  //       );
  //     } else {
  //       data = mapped.filter(item =>
  //         item.systemNames.some(name => otherNames.includes(name.toLowerCase()))
  //       );
  //     }

  //     return {
  //       total: totalObj || null,
  //       data,
  //     };
  //   }

  //   return mapped;
  // }

  async getAllValueDataExceptTotal() {
    const records = await this.valueDataModel
      .find({ systemName: { $ne: 'Total' } })
      .lean();

    return records.map(record => ({
      ...record,
      countryCode: this.getCountryCode(record.geographicReach),
    }));
  }

  async getValueDataTotal() {
    const record = await this.valueDataModel
      .findOne({ systemName: 'Total' })
      .lean();

    return record
      ? { ...record, countryCode: this.getCountryCode(record.geographicReach) }
      : null;
  }

  async getAllVolumeDataExceptTotal() {
    const records = await this.volumeDataModel
      .find({ systemName: { $ne: 'Total' } })
      .lean();

    return records.map(record => ({
      ...record,
      countryCode: this.getCountryCode(record.geographicReach),
    }));
  }

  async getVolumeDataTotal() {
    const record = await this.volumeDataModel
      .findOne({ systemName: 'Total' })
      .lean();

    return record
      ? { ...record, countryCode: this.getCountryCode(record.geographicReach) }
      : null;
  }


  async getGeneralDataGroupedByRegionAndCountry() {
    const records = await this.generalDataModel.find().lean();

    // Group by geographicRegion and then geographicReach
    const groupedByRegion = records.reduce((acc, record) => {
      const region = record.geographicRegion || 'Unknown';
      const country = record.geographicReach || 'Unknown';

      if (!acc[region]) {
        acc[region] = {};
      }
      if (!acc[region][country]) {
        acc[region][country] = [];
      }

      acc[region][country].push({
        systemName: record.systemName,
        geographicReach: record.geographicReach,
        geographicRegion: record.geographicRegion,
        countryCode: this.getCountryCode(record.geographicReach),
      });

      return acc;
    }, {} as Record<string, Record<string, any[]>>);

    // Convert into structured array
    return Object.entries(groupedByRegion).map(([region, countries]) => ({
      region,
      totalCountries: Object.keys(countries).length,
      countries: Object.entries(countries).map(([country, data]) => ({
        country,
        countryCode: this.getCountryCode(country),
        totalSystems: data.length,
        data,
      })),
    }));
  }


  //////////////////////////////////////////CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////CATEGORY FILTERS////////////////////////////////////////////

  async countByDomesticAndRegional() {
    const categoryAliases: Record<string, string> = {
      'LIVE: DOMESTIC IPS': 'LIVE',
      'DOMESTIC: IN DEVELOPMENT': 'IN-DEVELOPMENT',
      'Countries with no domestic IPS activity': 'NO IPS ACTIVITY',
      'LIVE: REGIONAL IPS': 'LIVE',
      'REGIONAL: IN DEVELOPMENT': 'IN-DEVELOPMENT',
      'IN PILOT PHASE': 'PILOT',
      'Countries with no regional IPS activity': 'NO IPS ACTIVITY',
      'IN PILOT': 'PILOT',
    };

    const domesticCategories = [
      'LIVE: DOMESTIC IPS',
      'DOMESTIC: IN DEVELOPMENT',
      'Countries with no domestic IPS activity',
      'IN PILOT',
    ];

    const regionalCategories = [
      'LIVE: REGIONAL IPS',
      'REGIONAL: IN DEVELOPMENT',
      'IN PILOT PHASE',
      'Countries with no regional IPS activity',
    ];

    const buildGroup = async (groupName: string, categories: string[], isRegional = false) => {
      const categoriesWithCounts = await Promise.all(
        categories.map(async (category) => {
          const docs = await this.ipsActivityModel.find({ category }).lean().exec();
          const total = docs.length;

          // For regional only: collect unique ipsName values
          let ipsNames: string[] = [];
          if (isRegional) {
            ipsNames = [
              ...new Set(
                docs
                  .map((doc) => doc.ipsName)
                  .filter((name): name is string => !!name) // filter out null/undefined
              ),
            ];
          }

          return {
            category,
            alias: categoryAliases[category] || category,
            total,
            ...(isRegional ? { ipsNames } : {}), // only add ipsNames for regional
          };
        })
      );

      const total = categoriesWithCounts.reduce((sum, c) => sum + c.total, 0);

      return {
        group: groupName,
        total,
        categories: categoriesWithCounts,
      };
    };

    const domestic = await buildGroup('Domestic', domesticCategories);
    const regional = await buildGroup('Regional', regionalCategories, true);

    return {
      totalGroups: 2,
      groups: [domestic, regional],
    };
  }






  async getByCategoriesEnriched(
    categories: string[],
    filters?: any,
    ipsNameFilter?: string | string[]
  ) {
    const validCategories = [
      'LIVE: DOMESTIC IPS',
      'DOMESTIC: IN DEVELOPMENT',
      'Countries with no domestic IPS activity',

      'LIVE: REGIONAL IPS',
      'REGIONAL: IN DEVELOPMENT',
      'IN PILOT PHASE',
      'Countries with no regional IPS activity',
    ];

    // ✅ If no categories provided but filters exist, default to ['LIVE: DOMESTIC IPS']
    if ((!categories || categories.length === 0) && filters && Object.keys(filters).length > 0) {
      categories = ['LIVE: DOMESTIC IPS'];
    }

    // ✅ Validate categories
    if (!Array.isArray(categories) || categories.length === 0) {
      throw new BadRequestException('Categories must be a non-empty array.');
    }

    categories.forEach((c) => {
      if (!validCategories.includes(c)) {
        throw new BadRequestException(`Invalid category: ${c}`);
      }
    });

    // ✅ If filters exist, ensure 'LIVE: DOMESTIC IPS' is included
    if (filters && Object.keys(filters).length > 0 && !categories.includes('LIVE: DOMESTIC IPS')) {
      categories.push('LIVE: DOMESTIC IPS');
    }

    let allResults = [];

    for (const category of categories) {
      let ipsList = await this.ipsActivityModel.find({ category }).lean().exec();
      let enrichedData = [];

      switch (category) {
        // ✅ LIVE: DOMESTIC IPS with aggregation
        case 'LIVE: DOMESTIC IPS': {
          let filteredIpsList = ipsList;

          // ✅ Apply GeneralData-based filters
          if (filters && Object.keys(filters).length > 0) {
            const filterQueries = [];

            for (const [field, values] of Object.entries(filters)) {
              if (!Array.isArray(values)) continue;
              const regexConditions = values.map((v) => ({
                [field]: { $regex: v, $options: 'i' }
              }));
              filterQueries.push({ $or: regexConditions });
            }

            // ✅ Get systemNames that match the filters in GeneralData
            const matchingGeneral = await this.generalDataModel
              .find({ $and: filterQueries })
              .select('systemName')
              .lean();

            const matchingNames = new Set(matchingGeneral.map(g => g.systemName));
            filteredIpsList = ipsList.filter(ips => matchingNames.has(ips.ipsName));
          }

          // ✅ Helper to safely sum numeric fields
          const sumFields = (obj: any, fields: string[]) => {
            return fields.reduce((sum, field) => {
              const val = obj?.[field];
              if (val !== null && val !== undefined && val !== '') {
                const num = Number(val);
                if (!isNaN(num)) {
                  sum += num;
                }
              }
              return sum;
            }, 0);
          };

          // ✅ Step 1: Fetch enriched data for each IPS
          const rawEnrichedData = await Promise.all(
            filteredIpsList.map(async (ips) => {
              const volume = await this.volumeDataModel.findOne({ systemName: ips.ipsName }).lean();
              const value = await this.valueDataModel.findOne({ systemName: ips.ipsName }).lean();
              const general = await this.generalDataModel.findOne({ systemName: ips.ipsName }).lean();

              const totalVolumes = sumFields(volume, [
                // 'volumes2020',
                // 'volumes2021',
                // 'volumes2022',
                // 'volumes2023',
                'volumes2024',
                // 'volumes2025',
              ]);

              const totalValues = sumFields(value, [
                // 'values2020',
                // 'values2021',
                // 'values2022',
                // 'values2023',
                'values2024',
                // 'values2025',
              ]);

              return {
                geography: ips.geography,
                countryCode: this.getCountryCode(ips.geography),
                ipsName: ips.ipsName,
                supportedUseCases: general?.supportedUseCases || null,
                volumes2024: totalVolumes || 0,
                values2024: totalValues || 0,
              };
            })
          );

          // ✅ Step 2: Group by geography and aggregate
          const groupedData = rawEnrichedData.reduce((acc, item) => {
            const existing = acc[item.geography];
            if (existing) {
              existing.volumes2024 += item.volumes2024;
              existing.values2024 += item.values2024;
              existing.ipsNames.push(item.ipsName);
              if (item.supportedUseCases) {
                existing.supportedUseCasesSet.add(item.supportedUseCases);
              }
            } else {
              acc[item.geography] = {
                category,
                geography: item.geography,
                countryCode: item.countryCode,
                volumes2024: item.volumes2024,
                values2024: item.values2024,
                ipsNames: [item.ipsName],
                supportedUseCasesSet: new Set(
                  item.supportedUseCases ? [item.supportedUseCases] : []
                ),
              };
            }
            return acc;
          }, {} as Record<string, any>);

          // ✅ Convert sets to arrays and finalize
          enrichedData = Object.values(groupedData).map((item: any) => ({
            category: item.category,
            geography: item.geography,
            countryCode: item.countryCode,
            volumes2024: item.volumes2024,
            values2024: item.values2024,
            ipsNames: item.ipsNames,
            supportedUseCases: Array.from(item.supportedUseCasesSet),
          }));
          break;
        }

        // ✅ Domestic In Development & No Domestic
        case 'DOMESTIC: IN DEVELOPMENT':
        case 'Countries with no domestic IPS activity':
          enrichedData = ipsList.map((ips) => ({
            category,
            geography: ips.geography,
            countryCode: this.getCountryCode(ips.geography),
            status: ips.status || null,
          }));
          break;

        // ✅ Regional categories
        case 'LIVE: REGIONAL IPS':
        case 'REGIONAL: IN DEVELOPMENT':
        case 'IN PILOT PHASE': {
          // ✅ Apply ipsNameFilter if provided
          if (ipsNameFilter) {
            const filterNames = Array.isArray(ipsNameFilter)
              ? ipsNameFilter.map((v: string) => v.toLowerCase())
              : [String(ipsNameFilter).toLowerCase()];

            ipsList = ipsList.filter((ips) =>
              ips.ipsName && filterNames.includes(ips.ipsName.toLowerCase())
            );
          }

          enrichedData = ipsList.flatMap((ips) => {
            const countries = this.splitCountries(ips.geographyCountries);
            return countries.map((country) => ({
              category,
              country,
              countryCode: this.getCountryCode(country),
              ipsName: ips.ipsName,
              ...(category !== 'LIVE: REGIONAL IPS' && { region: ips.region || null }),
            }));
          });
          break;
        }

        // ✅ Countries with no regional IPS activity
        case 'Countries with no regional IPS activity':
          enrichedData = ipsList.map((ips) => ({
            category,
            geography: ips.geography,
            countryCode: this.getCountryCode(ips.geography),
          }));
          break;
      }

      allResults.push({
        category,
        total: enrichedData.length,
        data: enrichedData,
      });
    }

    return {
      categories,
      totalCategories: categories.length,
      results: allResults,
    };
  }

  private splitCountries(geoCountries?: string) {
    if (!geoCountries) return [];
    return geoCountries.split(',').map((c) => c.trim()).filter(Boolean);
  }

  private africanCountries = [
    'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi',
    'Cabo Verde', 'Cameroon', 'Central African Republic', 'Chad', 'Comoros',
    'Congo', 'Congo, The Democratic Republic of the', 'Côte d\'Ivoire', 'Djibouti',
    'Egypt', 'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon',
    'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia',
    'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco',
    'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'Sao Tome and Principe',
    'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan',
    'Sudan', 'Tanzania, United Republic of', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'
  ];

  private africanCountriesFuse = new (Fuse as any)(this.africanCountries, {
    includeScore: true,
    threshold: 0.3
  });

  private getCountryCode(countryName?: string) {
    if (!countryName) return null;

    const cleanedName = countryName.trim();

    // Manual mapping for African countries (most reliable approach)
    const countryCodeMap: { [key: string]: string } = {
      'Algeria': 'DZ',
      'Angola': 'AO',
      'Benin': 'BJ',
      'Botswana': 'BW',
      'Burkina Faso': 'BF',
      'Burundi': 'BI',
      'Cabo Verde': 'CV',
      'Cape Verde': 'CV',
      'Cameroon': 'CM',
      'Central African Republic': 'CF',
      'Chad': 'TD',
      'Comoros': 'KM',
      'Congo': 'CG',
      'Democratic Republic of the Congo': 'CD',
      'Congo, The Democratic Republic of the': 'CD',
      'Côte d\'Ivoire': 'CI',
      'Ivory Coast': 'CI',
      'Djibouti': 'DJ',
      'Egypt': 'EG',
      'Equatorial Guinea': 'GQ',
      'Eritrea': 'ER',
      'Eswatini': 'SZ',
      'Swaziland': 'SZ',
      'Ethiopia': 'ET',
      'Gabon': 'GA',
      'Gambia': 'GM',
      'Ghana': 'GH',
      'Guinea': 'GN',
      'Guinea-Bissau': 'GW',
      'Kenya': 'KE',
      'Lesotho': 'LS',
      'Liberia': 'LR',
      'Libya': 'LY',
      'Madagascar': 'MG',
      'Malawi': 'MW',
      'Mali': 'ML',
      'Mauritania': 'MR',
      'Mauritius': 'MU',
      'Morocco': 'MA',
      'Mozambique': 'MZ',
      'Namibia': 'NA',
      'Niger': 'NE',
      'Nigeria': 'NG',
      'Rwanda': 'RW',
      'Sao Tome and Principe': 'ST',
      'São Tomé and Príncipe': 'ST',
      'Senegal': 'SN',
      'Seychelles': 'SC',
      'Sierra Leone': 'SL',
      'Somalia': 'SO',
      'South Africa': 'ZA',
      'South Sudan': 'SS',
      'Sudan': 'SD',
      'Tanzania': 'TZ',
      'Tanzania, United Republic of': 'TZ',
      'Togo': 'TG',
      'Tunisia': 'TN',
      'Uganda': 'UG',
      'Zambia': 'ZM',
      'Zimbabwe': 'ZW'
    };

    // Direct mapping lookup
    if (countryCodeMap[cleanedName]) {
      return countryCodeMap[cleanedName];
    }

    // Try fuzzy matching if direct lookup fails
    const fuzzyResult = this.africanCountriesFuse.search(cleanedName);
    if (fuzzyResult.length > 0 && fuzzyResult[0].score <= 0.3) {
      const matchedCountry = fuzzyResult[0].item;
      if (countryCodeMap[matchedCountry]) {
        return countryCodeMap[matchedCountry];
      }
    }

    // Fallback to library lookup
    try {
      const lookup = countryCodeLookup.byCountry(cleanedName);
      if (lookup?.iso2) return lookup.iso2;
    } catch { }

    return null;
  }

  async findAll(): Promise<IpsActivity[]> {
    return this.ipsActivityModel.find().exec();
  }
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////
  ///////////////////////////CRON JOB FOR SYNCYING IPS//////////////////////////////////////////

  async manualSyncIpsActivity() {
    return this.fetchAndSyncIpsActivity();
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async fetchAndSyncIpsActivity() {
    try {
      const credentials = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, '../../../config/authentication-411609-dcd87bcd1c0b.json'),
          'utf8',
        ),
      );

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const spreadsheetId = '1VBLgF2JRCHh4RKPHhTB66yCD-Zc5Ru0wCxX3ZEDtTR0';
      const range = 'Live IPS List!B1:ZZ';

      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      const rows = res.data.values || [];

      if (!rows.length) {
        this.logger.warn('No IPS Activity data found.');
        return;
      }

      // Define structure for categories
      const categoriesConfig = [
        {
          category: 'LIVE: DOMESTIC IPS',
          headers: ['ipsName', 'geography', 'region', 'ipsType'],
          start: 3,
          end: 33,
        },
        {
          category: 'DOMESTIC: IN DEVELOPMENT',
          headers: ['geography', 'status'],
          start: 40,
          end: 57,
        },
        {
          category: 'Countries with no domestic IPS activity',
          headers: ['geography'],
          start: 60,
          end: 68,
        },
        {
          category: 'LIVE: REGIONAL IPS',
          headers: ['ipsName', 'geographyCountries', 'region', 'ipsType'],
          start: 71,
          end: 73,
        },
        {
          category: 'REGIONAL: IN DEVELOPMENT',
          headers: ['ipsName', 'geographyCountries', 'region'],
          start: 75,
          end: 78,
        },
        {
          category: 'IN PILOT PHASE',
          headers: ['ipsName', 'geographyCountries', 'region'],
          start: 80,
          end: 81,
        },
        {
          category: 'Countries with no regional IPS activity',
          headers: ['geography'],
          start: 83,
          end: 86,
        },
      ];

      const ops = [];

      for (const config of categoriesConfig) {
        for (let i = config.start; i <= config.end; i++) {
          const row = rows[i] || [];
          if (row.every(cell => !cell || cell.trim() === '')) continue; // Skip empty rows

          const doc: any = { category: config.category };

          // Map headers to row data
          config.headers.forEach((header, idx) => {
            doc[header] = row[idx] || '';
          });

          // Build a dynamic unique filter
          const filter: any = { category: doc.category };

          if (doc.ipsName) filter.ipsName = doc.ipsName;
          if (doc.geography) filter.geography = doc.geography;
          if (doc.geographyCountries) filter.geographyCountries = doc.geographyCountries;

          ops.push({
            updateOne: {
              filter,
              update: { $set: doc },
              upsert: true,
            },
          });
        }
      }

      if (ops.length) {
        const bulkRes = await this.ipsActivityModel.bulkWrite(ops);
        this.logger.log(`IPS Activity data synced: ${JSON.stringify(bulkRes)}`);
      } else {
        this.logger.log('No valid IPS Activity rows to upsert.');
      }
    } catch (error) {
      this.logger.error('Error fetching IPS Activity from Google Sheets', error);
    }
  }

  // async fetchAndSyncIpsActivity() {
  //   try {
  //     const credentials = JSON.parse(
  //       fs.readFileSync(
  //         path.resolve(__dirname, '../../../config/authentication-411609-dcd87bcd1c0b.json'),
  //         'utf8',
  //       ),
  //     );

  //     const auth = new google.auth.GoogleAuth({
  //       credentials,
  //       scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  //     });

  //     const sheets = google.sheets({ version: 'v4', auth });
  //     const spreadsheetId = '1VBLgF2JRCHh4RKPHhTB66yCD-Zc5Ru0wCxX3ZEDtTR0';
  //     const range = 'Live IPS List!B1:ZZ';

  //     const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  //     const rows = res.data.values || [];

  //     if (!rows.length) {
  //       this.logger.warn('No IPS Activity data found.');
  //       return;
  //     }

  //     // Define fixed structure
  //     const categoriesConfig = [
  //       {
  //         category: 'LIVE: DOMESTIC IPS',
  //         headers: ['ipsName', 'geography', 'region', 'ipsType'],
  //         start: 3,
  //         end: 33,
  //       },
  //       {
  //         category: 'DOMESTIC: IN DEVELOPMENT', // enum value
  //         headers: ['geography', 'status'],
  //         start: 40,
  //         end: 57,
  //       },
  //       {
  //         category: 'Countries with no domestic IPS activity',
  //         headers: ['geography'],
  //         start: 60,
  //         end: 68,
  //       },
  //       {
  //         category: 'LIVE: REGIONAL IPS',
  //         headers: ['ipsName', 'geographyCountries', 'region', 'ipsType'],
  //         start: 71,
  //         end: 73,
  //       },
  //       {
  //         category: 'REGIONAL: IN DEVELOPMENT', // enum value
  //         headers: ['ipsName', 'geographyCountries', 'region'],
  //         start: 75,
  //         end: 78,
  //       },
  //       {
  //         category: 'IN PILOT PHASE',
  //         headers: ['ipsName', 'geographyCountries', 'region'],
  //         start: 80,
  //         end: 81,
  //       },
  //       {
  //         category: 'Countries with no regional IPS activity',
  //         headers: ['geography'],
  //         start: 83,
  //         end: 86,
  //       },
  //     ];


  //     const ops = [];

  //     for (const config of categoriesConfig) {
  //       for (let i = config.start; i <= config.end; i++) {
  //         const row = rows[i] || [];
  //         if (row.every(cell => !cell || cell.trim() === '')) continue; // skip empty row

  //         const doc: any = { category: config.category };

  //         config.headers.forEach((header, idx) => {
  //           doc[header] = row[idx] || '';
  //         });

  //         ops.push({
  //           updateOne: {
  //             filter: { category: doc.category, ...this.buildKeyFilter(doc) },
  //             update: { $set: doc },
  //             upsert: true,
  //           },
  //         });
  //       }
  //     }

  //     if (ops.length) {
  //       const bulkRes = await this.ipsActivityModel.bulkWrite(ops);
  //       this.logger.log(`IPS Activity data synced: ${JSON.stringify(bulkRes)}`);
  //     } else {
  //       this.logger.log('No valid IPS Activity rows to upsert.');
  //     }

  //   } catch (error) {
  //     this.logger.error('Error fetching IPS Activity from Google Sheets', error);
  //   }
  // }

  // private buildKeyFilter(doc: any) {
  //   if (doc.geography) return { geography: doc.geography };
  //   if (doc.ipsName) return { ipsName: doc.ipsName };
  //   return {};
  // }
}
