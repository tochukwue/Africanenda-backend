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
import { FrenchIpsActivity, FrenchIpsActivityDocument } from './schema/fripslist.schema';
import { FrenchGeneralData, FrenchGeneralDataDocument } from 'src/generaldata/schema/frgeneraldatum.schema';
import { FrenchValueData, FrenchValueDataDocument } from 'src/valuedata/schema/frvaluedatum.schema';
import { FrenchVolumeData, FrenchVolumeDataDocument } from 'src/volumedata/schema/frvolumedatum.schema';
import { contentSecurityPolicy } from 'helmet';

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

    @InjectModel(FrenchIpsActivity.name) private readonly frenchipsActivityModel: Model<FrenchIpsActivityDocument>,

    @InjectModel(FrenchGeneralData.name) private frenchgeneralDataModel: Model<FrenchGeneralDataDocument>,

    @InjectModel(FrenchValueData.name)
    private readonly frenchvalueDataModel: Model<FrenchValueDataDocument>,

    @InjectModel(FrenchVolumeData.name)
    private readonly frenchvolumeDataModel: Model<FrenchVolumeDataDocument>,
  ) { }

  async searchSystemNames(term: string): Promise<{ systemName: string }[]> {
    if (!term || term.trim().length < 2) {
      throw new BadRequestException('Search term must be at least 2 characters long.');
    }

    const regex = new RegExp(term, 'i'); // case-insensitive contains
    const results = await this.generalDataModel
      .find({ systemName: { $regex: regex } }, { systemName: 1, geographicReach: 1, _id: 0 })
      .lean()
      .exec();

    return results;
  }

  /**
   * Get GeneralData list by geographicReach
   */
  async getByGeographicReach(geographicReach: string): Promise<any[]> {
    if (!geographicReach) {
      throw new BadRequestException('geographicReach is required.');
    }

    const records = await this.generalDataModel
      .find({ geographicReach: { $regex: new RegExp(`^${geographicReach}$`, 'i') } })
      .lean()
      .exec();

    // Define the desired field order
    const fieldOrder = [
      'systemName',
      'geographicReach',
      'gender',
      'geographicRegion',
      'coverage',
      'yearOfEstablishment',
      'ipsType',
      'interoperabilityArrangement',
      'governanceTypology',
      'ownershipModel',
      'systemOwner',
      'overseer',
      'systemGovernance',
      'operator',
      'settlementAgent',
      'numberOfUniqueIpsEndUsers',
      'totalNumberOfParticipants2025',
      'numberOfDirectParticipantsCommercialBanks',
      'numberOfDirectParticipantsEMoneyIssuers',
      'numberOfDirectParticipantsMFIs',
      'numberOfDirectParticipantsOther',
      'numberOfDirectParticipantsPostOffice',
      'indirectParticipantsType',
      'numberOfIndirectParticipants',
      'supportedUseCases',
      'supportedInstruments',
      'primaryLocalChannel',
      'supportedChannels',
      'qrCodeEnabledType',
      'messagingStandard',
      'proxyId',
      'otherProxyIdType',
      'businessModel',
      'pricingStructure',
      'schemeRulesPublic',
      'additionalRecourseRequirements',
      'disputeResolutionMechanism',
      'apiUseFunction',
      'startupFundingSource',
      'participationInDecisionMaking',
      'mechanismForDecisionMaking',
      'abilityToBecomeDirectParticipants',
      'entitiesThatCannotParticipate',
      'nonBankingFIsSponsorship',
      'minValueForTransactions',
      'corporateStructure',
      'otherCorporateStructure',
      'pullRequestToPayEnabled',
      'thirdPartyConnectionsEnabled',
      'realTimePaymentConfirmation',
      'transactionValidationEnabled',
      'inclusivityRanking',
    ];

    // Reorder fields according to fieldOrder
    return records.map(record => {
      const ordered: Record<string, any> = {};
      fieldOrder.forEach(field => {
        ordered[field] = record[field] ?? '';
      });
      return ordered;
    });
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
      const region = record.geographicRegion?.trim();
      const country = record.geographicReach?.trim();

      // ✅ Skip records without valid region or country
      if (!region || !country) return acc;

      if (!acc[region]) {
        acc[region] = {};
      }
      if (!acc[region][country]) {
        acc[region][country] = [];
      }

      acc[region][country].push({
        systemName: record.systemName?.trim(),
        geographicReach: country,
        geographicRegion: region,
        countryCode: this.getCountryCode(country),
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


  async countByDomesticAndRegional() {
    const categoryAliases: Record<string, string> = {
      'LIVE: DOMESTIC IPS': 'Live',
      'DOMESTIC: IN DEVELOPMENT': 'In-development',
      'Countries with no domestic IPS activity': 'No Domestic IPS Activity',
      'LIVE: REGIONAL IPS': 'Live',
      'REGIONAL: IN DEVELOPMENT': 'In-development',
      'IN PILOT PHASE': 'Pilot',
      'Countries with no regional IPS activity': 'No Cross-Border IPS Activity',
    };

    // Tooltips for categories
    const tooltips: Record<string, string> = {
      'LIVE: DOMESTIC IPS': 'Countries with fully operational IPS',
      'DOMESTIC: IN DEVELOPMENT': 'Countries in planning or development phases',
      'Countries with no domestic IPS activity': 'Countries without an active IPS initiative',
      'LIVE: REGIONAL IPS': 'Regions with functioning cross-border IPS',
      'REGIONAL: IN DEVELOPMENT': 'Regional IPS in planning or development',
      'IN PILOT PHASE': 'Regional IPS is undergoing testing',
      'Countries with no regional IPS activity': 'Regions without regional IPS initiatives',
    };

    const domesticCategories = [
      'LIVE: DOMESTIC IPS',
      'DOMESTIC: IN DEVELOPMENT',
      'Countries with no domestic IPS activity',
    ];

    const regionalCategories = [
      'LIVE: REGIONAL IPS',
      'IN PILOT PHASE',
      'REGIONAL: IN DEVELOPMENT',
      'Countries with no regional IPS activity',
    ];

    const buildGroup = async (groupName: string, categories: string[], isRegional = false) => {
      const categoriesWithCounts = await Promise.all(
        categories.map(async (category) => {
          const docs = await this.ipsActivityModel.find({ category }).lean().exec();
          const total = docs.length;

          // Collect unique ipsNames for regional categories
          let ipsNames: string[] = [];
          if (isRegional) {
            ipsNames = [
              ...new Set(
                docs
                  .map((doc) => doc.ipsName)
                  .filter((name): name is string => !!name && name.trim() !== ''),
              ),
            ];
          }

          return {
            category,
            alias: categoryAliases[category] || category,
            total,
            tooltip: tooltips[category] || '', // add tooltip
            ...(isRegional ? { ipsNames } : {}),
          };
        }),
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



  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  async frenchSearchSystemNames(term: string): Promise<{ systemName: string }[]> {
    if (!term || term.trim().length < 2) {
      throw new BadRequestException('Le terme de recherche doit comporter au moins 2 caractères.');
    }
    const regex = new RegExp(term, 'i');
    const results = await this.frenchgeneralDataModel
      .find({ systemName: { $regex: regex } }, { systemName: 1, geographicReach: 1, _id: 0 })
      .lean()
      .exec();
    return results;
  }

  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  async frenchGetByGeographicReach(geographicReach: string): Promise<any[]> {
    if (!geographicReach) {
      throw new BadRequestException('geographicReach est requis.');
    }
    const records = await this.frenchgeneralDataModel
      .find({ geographicReach: { $regex: new RegExp(`^${geographicReach}$`, 'i') } })
      .lean()
      .exec();

    const fieldOrder = [
      'systemName',
      'geographicReach',
      'gender',
      'geographicRegion',
      'coverage',
      'yearOfEstablishment',
      'ipsType',
      'interoperabilityArrangement',
      'governanceTypology',
      'ownershipModel',
      'systemOwner',
      'overseer',
      'systemGovernance',
      'operator',
      'settlementAgent',
      'numberOfUniqueIpsEndUsers',
      'totalNumberOfParticipants2025',
      'numberOfDirectParticipantsCommercialBanks',
      'numberOfDirectParticipantsEMoneyIssuers',
      'numberOfDirectParticipantsMFIs',
      'numberOfDirectParticipantsOther',
      'numberOfDirectParticipantsPostOffice',
      'indirectParticipantsType',
      'numberOfIndirectParticipants',
      'supportedUseCases',
      'supportedInstruments',
      'primaryLocalChannel',
      'supportedChannels',
      'qrCodeEnabledType',
      'messagingStandard',
      'proxyId',
      'otherProxyIdType',
      'businessModel',
      'pricingStructure',
      'schemeRulesPublic',
      'additionalRecourseRequirements',
      'disputeResolutionMechanism',
      'apiUseFunction',
      'startupFundingSource',
      'participationInDecisionMaking',
      'mechanismForDecisionMaking',
      'abilityToBecomeDirectParticipants',
      'entitiesThatCannotParticipate',
      'nonBankingFIsSponsorship',
      'minValueForTransactions',
      'corporateStructure',
      'otherCorporateStructure',
      'pullRequestToPayEnabled',
      'thirdPartyConnectionsEnabled',
      'realTimePaymentConfirmation',
      'transactionValidationEnabled',
      'inclusivityRanking',
    ];

    return records.map(record => {
      const ordered: Record<string, any> = {};
      fieldOrder.forEach(field => {
        ordered[field] = record[field] ?? '';
      });
      return ordered;
    });
  }

  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  async frenchGetValueDataWithCountryCode(systemNames: string[], startYear?: number, endYear?: number) {
    if (!Array.isArray(systemNames) || systemNames.length === 0) {
      throw new BadRequestException('systemNames doit être un tableau non vide.');
    }
    if (startYear && endYear && startYear > endYear) {
      throw new BadRequestException('startYear ne peut pas être supérieur à endYear.');
    }

    // Normalize and detect if "total" is requested
    const normalized = systemNames.map(n => n.trim().toLowerCase());
    const includeTotal = normalized.includes("total");

    // If "total" was requested, fetch all entries — same as English version
    const results = includeTotal
      ? await this.frenchvalueDataModel.find({}).lean()
      : await this.frenchvalueDataModel.find({
        systemName: { $in: [...systemNames, "Total des taux de change", "total des taux de change"] },
      }).lean();

    let mapped: any[] = [];

    // Handle full TOTAL request (aggregate all)
    if (systemNames.length === 1 && normalized[0] === "total") {
      const grouped = results.reduce((acc, item) => {
        const key = item.geographicReach || 'UNKNOWN';
        if (!acc[key]) {
          acc[key] = {
            geographicReach: key,
            countryCode: this.getCountryCodeFrench(key),
            systemNames: [],
          };
          const range = startYear && endYear ? [startYear, endYear] : [2020, 2024];
          for (let y = range[0]; y <= range[1]; y++) acc[key][`values${y}`] = 0;
        }

        acc[key].systemNames.push(item.systemName);
        const fields = Object.keys(item).filter(k => k.startsWith('values'));
        for (const field of fields) {
          const yearMatch = field.match(/(\d{4})$/);
          if (yearMatch) {
            const year = parseInt(yearMatch[1], 10);
            if (!startYear || !endYear || (year >= startYear && year <= endYear)) {
              const val = item[field];
              const num = Number(val);
              if (!isNaN(num)) acc[key][field] = (acc[key][field] || 0) + num;
            }
          }
        }
        return acc;
      }, {} as Record<string, any>);

      mapped = Object.values(grouped);
    } else {
      // For specific system names
      mapped = results.map(item => {
        const filteredItem: any = {
          geographicReach: item.geographicReach,
          countryCode: this.getCountryCodeFrench(item.geographicReach),
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

    // Combine total + other systems when includeTotal is true
    if (includeTotal) {
      const totalObj = mapped.find(item =>
        item.systemNames.some(name =>
          name.toLowerCase().includes('total des taux de change')
        )
      );

      const otherNames = normalized.filter(name => name !== 'total');
      const data = otherNames.length === 0
        ? mapped.filter(item =>
          !item.systemNames.some(name => name.toLowerCase().includes('total des taux de change'))
        )
        : mapped.filter(item =>
          item.systemNames.some(name => otherNames.includes(name.toLowerCase()))
        );

      return { total: totalObj || null, data };
    }

    return mapped;
  }


  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  async frenchGetVolumeDataWithCountryCode(systemNames: string[], startYear?: number, endYear?: number) {
    if (!Array.isArray(systemNames) || systemNames.length === 0) {
      throw new BadRequestException('systemNames doit être un tableau non vide.');
    }
    if (startYear && endYear && startYear > endYear) {
      throw new BadRequestException('startYear ne peut pas être supérieur à endYear.');
    }

    const normalized = systemNames.map(n => n.trim().toLowerCase());
    const includeTotal = normalized.includes("total");

    const results = includeTotal
      ? await this.frenchvolumeDataModel.find({}).lean()
      : await this.frenchvolumeDataModel.find({
        systemName: { $in: [...systemNames, "Total des taux de change", "total des taux de change"] },
      }).lean();

    let mapped: any[] = [];

    if (systemNames.length === 1 && normalized[0] === "total") {
      const grouped = results.reduce((acc, item) => {
        const key = item.geographicReach || 'UNKNOWN';
        if (!acc[key]) {
          acc[key] = {
            geographicReach: key,
            countryCode: this.getCountryCodeFrench(key),
            systemNames: [],
          };
          const range = startYear && endYear ? [startYear, endYear] : [2020, 2024];
          for (let y = range[0]; y <= range[1]; y++) acc[key][`volumes${y}`] = 0;
        }

        acc[key].systemNames.push(item.systemName);
        const fields = Object.keys(item).filter(k => k.startsWith('volumes'));
        for (const field of fields) {
          const yearMatch = field.match(/(\d{4})$/);
          if (yearMatch) {
            const year = parseInt(yearMatch[1], 10);
            if (!startYear || !endYear || (year >= startYear && year <= endYear)) {
              const val = item[field];
              const num = Number(val);
              if (!isNaN(num)) acc[key][field] = (acc[key][field] || 0) + num;
            }
          }
        }
        return acc;
      }, {} as Record<string, any>);

      mapped = Object.values(grouped);
    } else {
      mapped = results.map(item => {
        const filteredItem: any = {
          geographicReach: item.geographicReach,
          countryCode: this.getCountryCodeFrench(item.geographicReach),
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
        item.systemNames.some(name =>
          name.toLowerCase().includes('total des taux de change')
        )
      );

      const otherNames = normalized.filter(name => name !== 'total');
      const data = otherNames.length === 0
        ? mapped.filter(
          item => !item.systemNames.some(name =>
            name.toLowerCase().includes('total des taux de change')
          )
        )
        : mapped.filter(item =>
          item.systemNames.some(name => otherNames.includes(name.toLowerCase()))
        );

      return { total: totalObj || null, data };
    }

    return mapped;
  }


  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  async frenchGetAllValueDataExceptTotal() {
    const records = await this.frenchvalueDataModel.find({ systemName: { $ne: 'Total des taux de change' } }).lean();
    return records.map(record => ({
      ...record,
      countryCode: this.getCountryCodeFrench(record.geographicReach),
    }));
  }

  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  async frenchGetValueDataTotal() {
    const record = await this.frenchvalueDataModel.findOne({ systemName: 'Total des taux de change' }).lean();
    return record
      ? { ...record, countryCode: this.getCountryCodeFrench(record.geographicReach) }
      : null;
  }

  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  async frenchGetAllVolumeDataExceptTotal() {
    const records = await this.frenchvolumeDataModel.find({ systemName: { $ne: 'Total des taux de change' } }).lean();
    return records.map(record => ({
      ...record,
      countryCode: this.getCountryCodeFrench(record.geographicReach),
    }));
  }

  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  async frenchGetVolumeDataTotal() {
    const record = await this.frenchvolumeDataModel.findOne({ systemName: 'Total des taux de change' }).lean();
    return record
      ? { ...record, countryCode: this.getCountryCodeFrench(record.geographicReach) }
      : null;
  }

  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  async frenchGetGeneralDataGroupedByRegionAndCountry() {
    const records = await this.frenchgeneralDataModel.find().lean();
    const groupedByRegion = records.reduce((acc, record) => {
      const region = record.geographicRegion?.trim();
      const country = record.geographicReach?.trim();
      if (!region || !country) return acc;
      if (!acc[region]) acc[region] = {};
      if (!acc[region][country]) acc[region][country] = [];
      acc[region][country].push({
        systemName: record.systemName?.trim(),
        geographicReach: country,
        geographicRegion: region,
        countryCode: this.getCountryCodeFrench(country),
      });
      return acc;
    }, {} as Record<string, Record<string, any[]>>);

    return Object.entries(groupedByRegion).map(([region, countries]) => ({
      region,
      totalCountries: Object.keys(countries).length,
      countries: Object.entries(countries).map(([country, data]) => ({
        country,
        countryCode: this.getCountryCodeFrench(country),
        totalSystems: data.length,
        data,
      })),
    }));
  }
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  async FrenchcountByDomesticAndRegional() {
    // French-to-English alias mapping for readability or UI labels
    const categoryAliases: Record<string, string> = {
      "EN SERVICE : IPS NATIONAUX": "En cours",
      "DOMESTIQUE : EN DÉVELOPPEMENT ( JUILLET 2024 À MARS 2025)": "En développement",
      "Pays n'ayant pas d'activité IPS au niveau national": "Pas d'activité IPS nationale",
      "EN SERVICE: IPS RÉGIONAL": "En cours",
      "RÉGIONAL : EN DÉVELOPPEMENT ( JUILLET 2024 À MARS 2025)": "En développement",
      "EN PHASE PILOTE": "Pilote",
      "Pays n'ayant pas d'activité régionale en matière d'IPS": "Aucune activité IPS transfrontalière",
    };

    // 🧠 Tooltip mapping (French)
    const categoryTooltips: Record<string, string> = {
      "EN SERVICE : IPS NATIONAUX": "Pays avec un IPS pleinement opérationnel",
      "DOMESTIQUE : EN DÉVELOPPEMENT ( JUILLET 2024 À MARS 2025)": "Pays en phase de planification ou de développement d’un IPS domestique",
      "Pays n'ayant pas d'activité IPS au niveau national": "Pays sans initiative IPS nationale active",
      "EN SERVICE: IPS RÉGIONAL": "Régions avec un IPS transfrontalier opérationnel",
      "RÉGIONAL : EN DÉVELOPPEMENT ( JUILLET 2024 À MARS 2025)": "IPS régional en phase de planification ou de développement",
      "EN PHASE PILOTE": "L’IPS régional est en phase pilote ou de test",
      "Pays n'ayant pas d'activité régionale en matière d'IPS": "Régions sans initiatives d’IPS régional",
    };

    // Domestic (national-level) categories
    const domesticCategories = [
      "EN SERVICE : IPS NATIONAUX",
      "DOMESTIQUE : EN DÉVELOPPEMENT ( JUILLET 2024 À MARS 2025)",
      `Pays n'ayant pas d'activité IPS au niveau national`,
    ];

    // Regional (cross-border) categories
    const regionalCategories = [
      "EN SERVICE: IPS RÉGIONAL",
      "RÉGIONAL : EN DÉVELOPPEMENT ( JUILLET 2024 À MARS 2025)",
      "EN PHASE PILOTE",
      `Pays n'ayant pas d'activité régionale en matière d'IPS`,
    ];

    /**
     * Internal helper to group and count by category.
     * For regional categories, also lists unique IPS names.
     */
    const buildGroup = async (
      groupName: string,
      categories: string[],
      isRegional = false,
    ) => {
      const categoriesWithCounts = await Promise.all(
        categories.map(async (category) => {
          const docs = await this.frenchipsActivityModel.find({ category })
            .lean()
            .exec();

          const total = docs.length;

          // For regional only: collect unique IPS names
          let ipsNames: string[] = [];
          if (isRegional) {
            ipsNames = [
              ...new Set(
                docs
                  .map((doc) => doc.ipsName)
                  .filter((name): name is string => !!name && name.trim() !== ""),
              ),
            ];
          }

          return {
            category,
            alias: categoryAliases[category] || category,
            tooltip: categoryTooltips[category] || "Aucune description disponible",
            total,
            ...(isRegional ? { ipsNames } : {}), // add ipsNames only for regional
          };
        }),
      );

      const total = categoriesWithCounts.reduce((sum, c) => sum + c.total, 0);

      return {
        group: groupName,
        total,
        categories: categoriesWithCounts,
      };
    };

    // Build both groups
    const domestic = await buildGroup("Domestique", domesticCategories);
    const regional = await buildGroup("Régional", regionalCategories, true);

    // Final structure
    return {
      totalGroups: 2,
      groups: [domestic, regional],
    };
  }



  //////////////////////////////////////////FRENCH CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////FRENCH CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////FRENCH CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////FRENCH CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////FRENCH CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////FRENCH CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////FRENCH CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////FRENCH CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////FRENCH CATEGORY FILTERS////////////////////////////////////////////

  async getByCategoriesEnrichedFrench(
    categories: string[],
    filters?: any,
    ipsNameFilter?: string | string[]
  ) {
    const validCategories = [
      "EN SERVICE : IPS NATIONAUX",
      "DOMESTIQUE : EN DÉVELOPPEMENT ( JUILLET 2024 À MARS 2025)",
      "Pays n'ayant pas d'activité IPS au niveau national",
      "EN SERVICE: IPS RÉGIONAL",
      "EN SERVICE : IPS RÉGIONAL",
      "RÉGIONAL : EN DÉVELOPPEMENT ( JUILLET 2024 À MARS 2025)",
      "EN PHASE PILOTE",
      "Pays n'ayant pas d'activité régionale en matière d'IPS",
    ];

    // ✅ If no categories provided but filters exist, default to live IPS categories
    if ((!categories || categories.length === 0) && filters && Object.keys(filters).length > 0) {
      categories = ["EN SERVICE : IPS NATIONAUX", "EN SERVICE: IPS RÉGIONAL"];
    }

    // ✅ Validate categories
    if (!Array.isArray(categories) || categories.length === 0) {
      throw new BadRequestException("Categories must be a non-empty array.");
    }

    categories.forEach((c) => {
      if (!validCategories.includes(c)) {
        throw new BadRequestException(`Invalid category: ${c}`);
      }
    });

    // ✅ If filters exist, ensure both live categories are included
    if (filters && Object.keys(filters).length > 0) {
      if (!categories.includes("EN SERVICE : IPS NATIONAUX")) {
        categories.push("EN SERVICE : IPS NATIONAUX");
      }
      if (!categories.includes("EN SERVICE: IPS RÉGIONAL")) {
        categories.push("EN SERVICE: IPS RÉGIONAL");
      }
    }

    let allResults = [];

    for (const category of categories) {
      let ipsList = await this.frenchipsActivityModel.find({ category }).lean().exec();
      let enrichedData = [];

      switch (category) {
        // ✅ Domestic live IPS
        case "EN SERVICE : IPS NATIONAUX": {
          let filteredIpsList = ipsList;

          // ✅ Apply filters based on general data
          if (filters && Object.keys(filters).length > 0) {
            const filterQueries: any[] = [];

            for (const [field, values] of Object.entries(filters)) {
              if (!Array.isArray(values)) continue;

              if (field === "governanceTypology") {
                const orConditions: any[] = [];
                for (const value of values) {
                  const cleanedValue = String(value).trim();
                  if (cleanedValue === "Règles du système publiquement disponibles") {
                    orConditions.push({ schemeRulesPublic: { $regex: "^oui$", $options: "i" } });
                  } else if (cleanedValue === "Participation indirecte") {
                    orConditions.push({ nonBankingFIsSponsorship: { $regex: "^oui$", $options: "i" } });
                  } else {
                    const normalizedValue =
                      cleanedValue === "Partenariat public-privé (PPP)"
                        ? "Partenariat public-privé"
                        : cleanedValue;
                    orConditions.push({ governanceTypology: { $regex: normalizedValue, $options: "i" } });
                  }
                }
                if (orConditions.length > 0) filterQueries.push({ $or: orConditions });
                continue;

                // const orConditions: any[] = [];
                // for (const value of values) {
                //   const cleanedValue = String(value).trim();
                //   if (cleanedValue === "Scheme rules publicly available") {
                //     orConditions.push({ schemeRulesPublic: { $regex: "^yes$", $options: "i" } });
                //   } else if (cleanedValue === "Indirect Participation") {
                //     orConditions.push({ nonBankingFIsSponsorship: { $regex: "^yes$", $options: "i" } });
                //   } else {
                //     const normalizedValue =
                //       cleanedValue === "Public Private Partnership (PPP)"
                //         ? "Public Private Partnership"
                //         : cleanedValue;
                //     orConditions.push({ governanceTypology: { $regex: normalizedValue, $options: "i" } });
                //   }
                // }
                // if (orConditions.length > 0) filterQueries.push({ $or: orConditions });
                // continue;
              }

              if (field === "IPSFunctionality") {
                const orConditions: any[] = [];
                for (const val of values) {
                  const normalized = String(val).trim().toLowerCase();
                  if (["code qr", "ussd", "application", "navigateur"].includes(normalized)) {
                    orConditions.push({ supportedChannels: { $regex: normalized, $options: "i" } });
                  }
                  if (normalized === "apiusefunction") {
                    orConditions.push({ apiUseFunction: { $regex: "^oui$", $options: "i" } });
                  }
                  if (normalized === "thirdpartyconnectionsenabled") {
                    orConditions.push({ thirdPartyConnectionsEnabled: { $regex: "^oui$", $options: "i" } });
                  }
                  if (normalized === "realtimepaymentconfirmation") {
                    orConditions.push({ realTimePaymentConfirmation: { $regex: "^oui$", $options: "i" } });
                  }
                  if (normalized === "pullrequesttopayenabled") {
                    orConditions.push({ pullRequestToPayEnabled: { $regex: "^oui$", $options: "i" } });
                  }
                }
                if (orConditions.length > 0) filterQueries.push({ $or: orConditions });
              } else {
                const regexConditions = values.map((v) => ({
                  [field]: { $regex: String(v).trim(), $options: "i" },
                }));
                filterQueries.push({ $or: regexConditions });
              }
            }

            const query: any = filterQueries.length > 0 ? { $and: filterQueries } : {};
            const matchingGeneral = await this.frenchgeneralDataModel.find(query).select("systemName").lean();
            const matchingNames = new Set(matchingGeneral.map((g) => g.systemName));
            filteredIpsList = ipsList.filter((ips) => matchingNames.has(ips.ipsName));
          }

          // ✅ Helper to sum numeric fields
          const sumFields = (obj: any, fields: string[]) =>
            fields.reduce((sum, field) => {
              const val = obj?.[field];
              const num = Number(val);
              return !isNaN(num) ? sum + num : sum;
            }, 0);

          // ✅ Enrich with volume, value, and inclusivity data
          const rawEnrichedData = await Promise.all(
            filteredIpsList.map(async (ips) => {
              const volume = await this.frenchvolumeDataModel.findOne({ systemName: ips.ipsName }).lean();
              const value = await this.frenchvalueDataModel.findOne({ systemName: ips.ipsName }).lean();
              const general = await this.frenchgeneralDataModel.findOne({ systemName: ips.ipsName }).lean();

              const totalVolumes = sumFields(volume, ["volumes2024"]);
              const totalValues = sumFields(value, ["values2024"]);

              return {
                geography: ips.geography,
                countryCode: this.getCountryCodeFrench(ips.geography),
                ipsName: ips.ipsName,
                supportedUseCases: general?.supportedUseCases || null,
                inclusivityRanking: general?.inclusivityRanking || null,
                volumes2024: totalVolumes || 0,
                values2024: totalValues || 0,
              };
            })
          );

          // ✅ Group by geography
          const groupedData = rawEnrichedData.reduce((acc, item) => {
            const existing = acc[item.geography];
            if (existing) {
              existing.volumes2024 += item.volumes2024;
              existing.values2024 += item.values2024;
              existing.ipsNames.push(item.ipsName);
              if (item.supportedUseCases) existing.supportedUseCasesSet.add(item.supportedUseCases);
              if (item.inclusivityRanking) existing.inclusivityRankingSet.add(item.inclusivityRanking);
            } else {
              acc[item.geography] = {
                category,
                geography: item.geography,
                countryCode: item.countryCode,
                volumes2024: item.volumes2024,
                values2024: item.values2024,
                ipsNames: [item.ipsName],
                supportedUseCasesSet: new Set(item.supportedUseCases ? [item.supportedUseCases] : []),
                inclusivityRankingSet: new Set(item.inclusivityRanking ? [item.inclusivityRanking] : []),
              };
            }
            return acc;
          }, {} as Record<string, any>);

          enrichedData = Object.values(groupedData).map((item: any) => ({
            category: item.category,
            geography: item.geography,
            countryCode: item.countryCode,
            volumes2024: item.volumes2024,
            values2024: item.values2024,
            ipsNames: item.ipsNames,
            supportedUseCases: Array.from(item.supportedUseCasesSet),
            inclusivityRanking: Array.from(item.inclusivityRankingSet),
          }));
          break;
        }

        // ✅ Domestic development and no IPS activity
        case "DOMESTIQUE : EN DÉVELOPPEMENT ( JUILLET 2024 À MARS 2025)":
        case "Pays n'ayant pas d'activité IPS au niveau national":
          enrichedData = ipsList.map((ips) => ({
            category,
            geography: ips.geography,
            countryCode: this.getCountryCodeFrench(ips.geography),
            status: ips.status || null,
          }));
          break;

        // ✅ Regional IPS categories
        case "EN SERVICE: IPS RÉGIONAL":
        case "EN SERVICE : IPS RÉGIONAL":
        case "RÉGIONAL : EN DÉVELOPPEMENT ( JUILLET 2024 À MARS 2025)":
        case "EN PHASE PILOTE": {
          let filteredIpsList = ipsList;

          // ✅ Apply filters (same logic as English)
          if (filters && Object.keys(filters).length > 0) {
            const filterQueries: any[] = [];

            for (const [field, values] of Object.entries(filters)) {
              if (!Array.isArray(values)) continue;

              if (field === "governanceTypology") {
                const orConditions: any[] = [];
                for (const value of values) {
                  const cleanedValue = String(value).trim();
                  if (cleanedValue === "Règles du système publiquement disponibles") {
                    orConditions.push({ schemeRulesPublic: { $regex: "^oui$", $options: "i" } });
                  } else if (cleanedValue === "Participation indirecte") {
                    orConditions.push({ nonBankingFIsSponsorship: { $regex: "^oui$", $options: "i" } });
                  } else {
                    const normalizedValue =
                      cleanedValue === "Partenariat public-privé (PPP)"
                        ? "Partenariat public-privé"
                        : cleanedValue;
                    orConditions.push({ governanceTypology: { $regex: normalizedValue, $options: "i" } });
                  }
                }
                if (orConditions.length > 0) filterQueries.push({ $or: orConditions });
                continue;

                // const orConditions: any[] = [];
                // for (const value of values) {
                //   const cleanedValue = String(value).trim();
                //   if (cleanedValue === "Scheme rules publicly available") {
                //     orConditions.push({ schemeRulesPublic: { $regex: "^yes$", $options: "i" } });
                //   } else if (cleanedValue === "Indirect Participation") {
                //     orConditions.push({ nonBankingFIsSponsorship: { $regex: "^yes$", $options: "i" } });
                //   } else {
                //     const normalizedValue =
                //       cleanedValue === "Public Private Partnership (PPP)"
                //         ? "Public Private Partnership"
                //         : cleanedValue;
                //     orConditions.push({ governanceTypology: { $regex: normalizedValue, $options: "i" } });
                //   }
                // }
                // if (orConditions.length > 0) filterQueries.push({ $or: orConditions });
                // continue;
              }

              if (field === "IPSFunctionality") {
                const orConditions: any[] = [];
                for (const val of values) {
                  const normalized = String(val).trim().toLowerCase();

                  if (["code qr", "ussd", "application", "navigateur"].includes(normalized)) {
                    orConditions.push({ supportedChannels: { $regex: normalized, $options: "i" } });
                  }
                  if (normalized === "apiusefunction") {
                    orConditions.push({ apiUseFunction: { $regex: "^oui$", $options: "i" } });
                  }
                  if (normalized === "thirdpartyconnectionsenabled") {
                    orConditions.push({ thirdPartyConnectionsEnabled: { $regex: "^oui$", $options: "i" } });
                  }
                  if (normalized === "realtimepaymentconfirmation") {
                    orConditions.push({ realTimePaymentConfirmation: { $regex: "^oui$", $options: "i" } });
                  }
                  if (normalized === "pullrequesttopayenabled") {
                    orConditions.push({ pullRequestToPayEnabled: { $regex: "^oui$", $options: "i" } });
                  }
                }
                if (orConditions.length > 0) filterQueries.push({ $or: orConditions });
              } else {
                const regexConditions = values.map((v) => ({
                  [field]: { $regex: String(v).trim(), $options: "i" },
                }));
                filterQueries.push({ $or: regexConditions });
              }
            }

            const query: any = filterQueries.length > 0 ? { $and: filterQueries } : {};
            const matchingGeneral = await this.frenchgeneralDataModel.find(query).select("systemName").lean();
            const matchingNames = new Set(matchingGeneral.map((g) => g.systemName));
            filteredIpsList = ipsList.filter((ips) => matchingNames.has(ips.ipsName));
          }

          // ✅ Filter by IPS name
          if (ipsNameFilter) {
            const filterNames = Array.isArray(ipsNameFilter)
              ? ipsNameFilter.map((v: string) => String(v).trim().toLowerCase())
              : [String(ipsNameFilter).trim().toLowerCase()];

            filteredIpsList = filteredIpsList.filter(
              (ips) => ips.ipsName && filterNames.includes(String(ips.ipsName).trim().toLowerCase())
            );
          }

          // ✅ Enrich regional data with inclusivity and countries
          const nestedData = await Promise.all(
            filteredIpsList.map(async (ips) => {
              // console.log("Processing IPS:", ips.ipsName);
              // console.log("Fully qualified IPS data:", ips);
              const general = await this.frenchgeneralDataModel.findOne({ systemName: ips.ipsName }).lean();
              const countries = this.splitCountries(ips.geography || ips.geographyCountries);
              // console.log(" - Countries:", countries);
              const regionName = String(ips.region || "").trim() || null;

              return countries.map((country) => ({
                category,
                country: String(country).trim(),
                countryCode: this.getCountryCodeFrench(String(country).trim()),
                ipsName: String(ips.ipsName || "").trim(),
                inclusivityRanking: general?.inclusivityRanking || null,
                ...(category !== "EN SERVICE: IPS RÉGIONAL" && { region: regionName }),
              }));
            })
          );

          enrichedData = nestedData.flat();
          break;
        }

        // ✅ No regional IPS activity
        case "Pays n'ayant pas d'activité régionale en matière d'IPS":
          enrichedData = ipsList.map((ips) => ({
            category,
            geography: String(ips.geography || ips.geographyCountries || "").trim(),
            countryCode: this.getCountryCodeFrench(String(ips.geography || ips.geographyCountries || "").trim()),
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




  //////////////////////////////////////////ENGLISH CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////ENGLISH CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////ENGLISH CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////ENGLISH CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////ENGLISH CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////ENGLISH CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////ENGLISH CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////ENGLISH CATEGORY FILTERS////////////////////////////////////////////
  //////////////////////////////////////////ENGLISH CATEGORY FILTERS////////////////////////////////////////////



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

    // ✅ If no categories provided but filters exist, default to Domestic + Regional Live
    if ((!categories || categories.length === 0) && filters && Object.keys(filters).length > 0) {
      categories = ['LIVE: DOMESTIC IPS', 'LIVE: REGIONAL IPS'];
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

    // ✅ If filters exist, ensure live Domestic & Regional are included
    if (filters && Object.keys(filters).length > 0) {
      if (!categories.includes('LIVE: DOMESTIC IPS')) {
        categories.push('LIVE: DOMESTIC IPS');
      }
      if (!categories.includes('LIVE: REGIONAL IPS')) {
        categories.push('LIVE: REGIONAL IPS');
      }
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
            const filterQueries: any[] = [];

            for (const [field, values] of Object.entries(filters)) {
              if (!Array.isArray(values)) continue;

              // ✅ governanceTypology special handling
              if (field === 'governanceTypology') {
                const orConditions: any[] = [];

                for (const value of values) {
                  const cleanedValue = String(value).trim();

                  if (cleanedValue === 'Scheme rules publicly available') {
                    orConditions.push({ schemeRulesPublic: { $regex: '^yes$', $options: 'i' } });
                  } else if (cleanedValue === 'Indirect Participation') {
                    orConditions.push({ nonBankingFIsSponsorship: { $regex: '^yes$', $options: 'i' } });
                  } else {
                    const normalizedValue =
                      cleanedValue === 'Public Private Partnership (PPP)'
                        ? 'Public Private Partnership'
                        : cleanedValue;

                    orConditions.push({ governanceTypology: { $regex: normalizedValue, $options: 'i' } });
                  }
                }

                if (orConditions.length > 0) filterQueries.push({ $or: orConditions });
                continue;
              }

              if (field === 'IPSFunctionality') {
                const orConditions: any[] = [];

                for (const val of values) {
                  const normalized = String(val).trim().toLowerCase();

                  if (['qr code', 'ussd', 'app', 'browser'].includes(normalized)) {
                    orConditions.push({ supportedChannels: { $regex: normalized, $options: 'i' } });
                  }
                  if (normalized === 'apiusefunction') {
                    orConditions.push({ apiUseFunction: { $regex: '^yes$', $options: 'i' } });
                  }
                  if (normalized === 'thirdpartyconnectionsenabled') {
                    orConditions.push({ thirdPartyConnectionsEnabled: { $regex: '^yes$', $options: 'i' } });
                  }
                  if (normalized === 'realtimepaymentconfirmation') {
                    orConditions.push({ realTimePaymentConfirmation: { $regex: '^yes$', $options: 'i' } });
                  }
                  if (normalized === 'pullrequesttopayenabled') {
                    orConditions.push({ pullRequestToPayEnabled: { $regex: '^yes$', $options: 'i' } });
                  }
                }

                if (orConditions.length > 0) filterQueries.push({ $or: orConditions });
              } else {
                // ✅ default handling
                const regexConditions = values.map((v) => ({
                  [field]: { $regex: String(v).trim(), $options: 'i' },
                }));
                filterQueries.push({ $or: regexConditions });
              }
            }

            const query: any = filterQueries.length > 0 ? { $and: filterQueries } : {};

            const matchingGeneral = await this.generalDataModel.find(query).select('systemName').lean();
            const matchingNames = new Set(matchingGeneral.map((g) => g.systemName));

            filteredIpsList = ipsList.filter((ips) => matchingNames.has(ips.ipsName));
          }

          // ✅ Sum helper
          const sumFields = (obj: any, fields: string[]) =>
            fields.reduce((sum, field) => {
              const val = obj?.[field];
              const num = Number(val);
              return !isNaN(num) ? sum + num : sum;
            }, 0);

          // ✅ Step 1: Fetch enriched
          const rawEnrichedData = await Promise.all(
            filteredIpsList.map(async (ips) => {
              const volume = await this.volumeDataModel.findOne({ systemName: ips.ipsName }).lean();
              const value = await this.valueDataModel.findOne({ systemName: ips.ipsName }).lean();
              const general = await this.generalDataModel.findOne({ systemName: ips.ipsName }).lean();

              const totalVolumes = sumFields(volume, ['volumes2024']);
              const totalValues = sumFields(value, ['values2024']);
              // console.log(general?.inclusivityRanking)
              return {
                geography: ips.geography,
                countryCode: this.getCountryCode(ips.geography),
                ipsName: ips.ipsName,
                supportedUseCases: general?.supportedUseCases || null,
                inclusivityRanking: general?.inclusivityRanking || null, // ✅ ADDED
                volumes2024: totalVolumes || 0,
                values2024: totalValues || 0,
              };
            })
          );


          // ✅ Step 2: Group by geography
          const groupedData = rawEnrichedData.reduce((acc, item) => {
            const existing = acc[item.geography];
            if (existing) {
              existing.volumes2024 += item.volumes2024;
              existing.values2024 += item.values2024;
              existing.ipsNames.push(item.ipsName);
              if (item.supportedUseCases) existing.supportedUseCasesSet.add(item.supportedUseCases);
              if (item.inclusivityRanking) existing.inclusivityRankingSet.add(item.inclusivityRanking); // ✅ ADDED
            } else {
              acc[item.geography] = {
                category,
                geography: item.geography,
                countryCode: item.countryCode,
                volumes2024: item.volumes2024,
                values2024: item.values2024,
                ipsNames: [item.ipsName],
                supportedUseCasesSet: new Set(item.supportedUseCases ? [item.supportedUseCases] : []),
                inclusivityRankingSet: new Set(item.inclusivityRanking ? [item.inclusivityRanking] : []), // ✅ ADDED
              };
            }
            return acc;
          }, {} as Record<string, any>);

          enrichedData = Object.values(groupedData).map((item: any) => ({
            category: item.category,
            geography: item.geography,
            countryCode: item.countryCode,
            volumes2024: item.volumes2024,
            values2024: item.values2024,
            ipsNames: item.ipsNames,
            supportedUseCases: Array.from(item.supportedUseCasesSet),
            inclusivityRanking: Array.from(item.inclusivityRankingSet), // ✅ ADDED
          }));
          break;
        }

        // ✅ Domestic in development + no domestic
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
        // ✅ Regional categories
        case 'LIVE: REGIONAL IPS':
        case 'REGIONAL: IN DEVELOPMENT':
        case 'IN PILOT PHASE': {
          let filteredIpsList = ipsList;

          // ✅ Apply filters same as Domestic
          if (filters && Object.keys(filters).length > 0) {
            const filterQueries: any[] = [];
            for (const [field, values] of Object.entries(filters)) {
              if (!Array.isArray(values)) continue;

              if (field === 'governanceTypology') {
                const orConditions: any[] = [];
                for (const value of values) {
                  const cleanedValue = String(value).trim();
                  if (cleanedValue === 'Scheme rules publicly available') {
                    orConditions.push({ schemeRulesPublic: { $regex: '^yes$', $options: 'i' } });
                  } else if (cleanedValue === 'Indirect Participation') {
                    orConditions.push({ nonBankingFIsSponsorship: { $regex: '^yes$', $options: 'i' } });
                  } else {
                    const normalizedValue =
                      cleanedValue === 'Public Private Partnership (PPP)'
                        ? 'Public Private Partnership'
                        : cleanedValue;
                    orConditions.push({ governanceTypology: { $regex: normalizedValue, $options: 'i' } });
                  }
                }
                if (orConditions.length > 0) filterQueries.push({ $or: orConditions });
                continue;
              }

              if (field === 'IPSFunctionality') {
                const orConditions: any[] = [];
                for (const val of values) {
                  const normalized = String(val).trim().toLowerCase();
                  if (['qr code', 'ussd', 'app', 'browser'].includes(normalized)) {
                    orConditions.push({ supportedChannels: { $regex: normalized, $options: 'i' } });
                  }
                  if (normalized === 'apiusefunction') {
                    orConditions.push({ apiUseFunction: { $regex: '^yes$', $options: 'i' } });
                  }
                  if (normalized === 'thirdpartyconnectionsenabled') {
                    orConditions.push({ thirdPartyConnectionsEnabled: { $regex: '^yes$', $options: 'i' } });
                  }
                  if (normalized === 'realtimepaymentconfirmation') {
                    orConditions.push({ realTimePaymentConfirmation: { $regex: '^yes$', $options: 'i' } });
                  }
                  if (normalized === 'pullrequesttopayenabled') {
                    orConditions.push({ pullRequestToPayEnabled: { $regex: '^yes$', $options: 'i' } });
                  }
                }
                if (orConditions.length > 0) filterQueries.push({ $or: orConditions });
              } else {
                const regexConditions = values.map((v) => ({
                  [field]: { $regex: String(v).trim(), $options: 'i' },
                }));
                filterQueries.push({ $or: regexConditions });
              }
            }
            const query: any = filterQueries.length > 0 ? { $and: filterQueries } : {};
            const matchingGeneral = await this.generalDataModel.find(query).select('systemName').lean();
            const matchingNames = new Set(matchingGeneral.map((g) => g.systemName));
            filteredIpsList = ipsList.filter((ips) => matchingNames.has(ips.ipsName));
          }

          // ✅ Apply ipsNameFilter
          if (ipsNameFilter) {
            const filterNames = Array.isArray(ipsNameFilter)
              ? ipsNameFilter.map((v: string) => String(v).trim().toLowerCase())
              : [String(ipsNameFilter).trim().toLowerCase()];

            filteredIpsList = filteredIpsList.filter((ips) =>
              ips.ipsName && filterNames.includes(String(ips.ipsName).trim().toLowerCase())
            );
          }

          // ✅ Enrich with inclusivityRanking & flatten result
          const nestedData = await Promise.all(
            filteredIpsList.map(async (ips) => {
              const general = await this.generalDataModel.findOne({ systemName: ips.ipsName }).lean();
              const countries = this.splitCountries(ips.geographyCountries);
              return countries.map((country) => ({
                category,
                country: String(country).trim(),
                countryCode: this.getCountryCode(String(country).trim()),
                ipsName: String(ips.ipsName || '').trim(),
                inclusivityRanking: general?.inclusivityRanking || null,
                ...(category !== 'LIVE: REGIONAL IPS' && {
                  region: String(ips.region || '').trim() || null,
                }),
              }));
            })
          );

          enrichedData = nestedData.flat(); // ✅ flatten into a single array
          break;
        }
        // ✅ Countries with no regional IPS activity
        case 'Countries with no regional IPS activity':
          enrichedData = ipsList.map((ips) => ({
            category,
            geography: String(ips.geography || '').trim(),
            countryCode: this.getCountryCode(String(ips.geography || '').trim()),
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
      "Burkina Faso ": 'BF',
      'Burundi': 'BI',
      'Cabo Verde': 'CV',
      'Cape Verde': 'CV',
      'Cameroon': 'CM',
      'Central African Republic': 'CF',
      'Chad': 'TD',
      'Comoros': 'KM',
      'Congo': 'CG',
      'Democratic Republic of the Congo': 'CD',
      "Dem. Rep. ": 'CD',
      "Dem Rep.": 'CD',
      "Dem. Rep.": 'CD',
      "Republic of the Congo": 'CG',
      "Congo, Dem. Rep. ": 'CD',
      "Congo, Dem. Rep.": 'CD',
      'Congo, The Democratic Republic of the': 'CD',
      'Côte d\'Ivoire': 'CI',
      "Cote d'Ivoire": 'CI',
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
      "the Gambia": 'GM',
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
      "Somiland": 'SO',
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

  async findAll(): Promise<IpsActivity[]> {
    const results = await this.ipsActivityModel
      .find()
      .collation({ locale: 'en', strength: 2 }) // Case-insensitive sort
      // .sort({ ipsName: 1 })
      .sort({ geography: 1 })

      .exec();

    // ✅ Trim ipsName for each document
    return results.map((doc) => {
      if (doc.ipsName) {
        doc.ipsName = doc.ipsName.trim();
      }
      return doc;
    });
  }


  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  private getCountryCodeFrench(nomPays?: string) {
    if (!nomPays) return null;

    const nomNettoye = nomPays.trim();

    // Mapping manuel des pays africains (noms français et anglais)
    const codePaysMap: { [key: string]: string } = {
      'Algérie': 'DZ',
      'Angola': 'AO',
      'Bénin': 'BJ',
      'Botswana': 'BW',
      'Burkina Faso': 'BF',
      'Burundi': 'BI',
      'Cabo Verde': 'CV',
      'Cap-Vert': 'CV',
      'Cameroun': 'CM',
      'République centrafricaine': 'CF',
      'Tchad': 'TD',
      'Comores': 'KM',
      'Congo': 'CG',
      'République du Congo': 'CG',
      'République démocratique du Congo': 'CD',
      'Congo, Rép. dém.': 'CD',
      'Congo, Rép. dém. Démocratique': 'CD',
      "Congo, Dem. Rep.": 'CD',
      "Dem. Rep. ": 'CD',
      "Dem Rep.": 'CD',
      'Côte d\'Ivoire': 'CI',
      'Cote d\'Ivoire': 'CI',
      'Djibouti': 'DJ',
      'Égypte': 'EG',
      'Egypt': 'EG',
      'Guinée équatoriale': 'GQ',
      'Érythrée': 'ER',
      'Eswatini': 'SZ',
      'Swaziland': 'SZ',
      'Éthiopie': 'ET',
      'Gabon': 'GA',
      'Gambie': 'GM',
      'Ghana': 'GH',
      'Guinée': 'GN',
      'Guinée-Bissau': 'GW',
      'Kenya': 'KE',
      'Lesotho': 'LS',
      'Liberia': 'LR',
      'Libye': 'LY',
      'Madagascar': 'MG',
      'Malawi': 'MW',
      'Mali': 'ML',
      'Mauritanie': 'MR',
      'Maurice': 'MU',
      'Maroc': 'MA',
      'Mozambique': 'MZ',
      'Namibie': 'NA',
      'Niger': 'NE',
      'Nigeria': 'NG',
      'Rwanda': 'RW',
      'São Tomé et Príncipe': 'ST',
      'Sao Tome and Principe': 'ST',
      'Sénégal': 'SN',
      'Seychelles': 'SC',
      'Sierra Leone': 'SL',
      'Somalie': 'SO',
      'Somaliland': 'SO',
      'Afrique du Sud': 'ZA',
      'Soudan du Sud': 'SS',
      'Soudan': 'SD',
      'Tanzanie': 'TZ',
      'République-Unie de Tanzanie': 'TZ',
      'Togo': 'TG',
      'Tunisie': 'TN',
      'Ouganda': 'UG',
      'Zambie': 'ZM',
      'Zimbabwe': 'ZW',
    };

    // Recherche directe dans le mapping
    if (codePaysMap[nomNettoye]) {
      return codePaysMap[nomNettoye];
    }

    // Recherche floue si non trouvé
    const resultatFlou = this.frenchAfricanCountriesFuse.search(nomNettoye);
    if (resultatFlou.length > 0 && resultatFlou[0].score <= 0.3) {
      const paysCorrespondant = resultatFlou[0].item;
      if (codePaysMap[paysCorrespondant]) {
        return codePaysMap[paysCorrespondant];
      }
    }

    // Recherche via la librairie en dernier recours
    try {
      const lookup = countryCodeLookup.byCountry(nomNettoye);
      if (lookup?.iso2) return lookup.iso2;
    } catch { }

    return null;
  }
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  private frenchSplitCountries(geoPays?: string) {
    if (!geoPays) return [];
    return geoPays.split(',').map((c) => c.trim()).filter(Boolean);
  }
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  private frenchAfricanCountries = [
    'Afrique du Sud', 'Algérie', 'Angola', 'Bénin', 'Botswana', 'Burkina Faso',
    'Burundi', 'Cabo Verde', 'Cameroun', 'République centrafricaine', 'Tchad',
    'Comores', 'Congo', 'République démocratique du Congo', 'Côte d\'Ivoire',
    'Djibouti', 'Égypte', 'Guinée équatoriale', 'Érythrée', 'Eswatini',
    'Éthiopie', 'Gabon', 'Gambie', 'Ghana', 'Guinée', 'Guinée-Bissau',
    'Kenya', 'Lesotho', 'Liberia', 'Libye', 'Madagascar', 'Malawi', 'Mali',
    'Mauritanie', 'Maurice', 'Maroc', 'Mozambique', 'Namibie', 'Niger',
    'Nigeria', 'Rwanda', 'São Tomé et Príncipe', 'Sénégal', 'Seychelles',
    'Sierra Leone', 'Somalie', 'Afrique du Sud', 'Soudan du Sud', 'Soudan',
    'Tanzanie', 'Togo', 'Tunisie', 'Ouganda', 'Zambie', 'Zimbabwe'
  ];

  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  //////////////////////////////////////FRENCH METHODS////////////////////////////////////////////
  private frenchAfricanCountriesFuse = new (Fuse as any)(this.frenchAfricanCountries, {
    includeScore: true,
    threshold: 0.3
  });





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

      // Helper function to clean whitespace from values
      const cleanValue = (value: any): string => {
        if (value == null || value === '') {
          return '';
        }
        // Convert to string, trim whitespace, and replace multiple spaces with single space
        return String(value).trim().replace(/\s+/g, ' ');
      };

      // Helper function to clean entire object
      const cleanObject = (obj: any): any => {
        const cleaned: any = {};
        Object.keys(obj).forEach(key => {
          cleaned[key] = cleanValue(obj[key]);
        });
        return cleaned;
      };

      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: 'UNFORMATTED_VALUE', // Get raw values to avoid truncation
        dateTimeRenderOption: 'FORMATTED_STRING'
      });
      const rawRows = res.data.values || [];

      if (!rawRows.length) {
        this.logger.warn('No IPS Activity data found.');
        return;
      }

      // Clean all cell values in the rows
      const rows = rawRows.map(row =>
        row.map(cell => cleanValue(cell))
      );

      this.logger.log(`Fetched ${rows.length} rows from IPS Activity sheet`);

      // Define structure for categories
      const categoriesConfig = [
        {
          category: 'LIVE: DOMESTIC IPS',
          headers: ['ipsName', 'geography', 'region', 'ipsType'],
          start: 2,
          end: 34,
        },
        {
          category: 'DOMESTIC: IN DEVELOPMENT',
          headers: ['geography', 'status'],
          start: 38,
          end: 56,
        },
        {
          category: 'Countries with no domestic IPS activity',
          headers: ['geography'],
          start: 58,
          end: 67,
        },
        {
          category: 'LIVE: REGIONAL IPS',
          headers: ['ipsName', 'geographyCountries', 'region', 'ipsType'],
          start: 69,
          end: 72,
        },
        {
          category: 'REGIONAL: IN DEVELOPMENT',
          headers: ['ipsName', 'geographyCountries', 'region'],
          start: 74,
          end: 77,
        },
        {
          category: 'IN PILOT PHASE',
          headers: ['ipsName', 'geographyCountries', 'region'],
          start: 79,
          end: 80,
        },
        {
          category: 'Countries with no regional IPS activity',
          headers: ['geography'],
          start: 82,
          end: 85,
        },
      ];

      const ops = [];
      let totalProcessed = 0;
      let skippedEmpty = 0;

      for (const config of categoriesConfig) {
        this.logger.log(`Processing category: ${config.category} (rows ${config.start}-${config.end})`);

        for (let i = config.start; i <= config.end; i++) {
          const row = rows[i] || [];

          // Check if row is completely empty after cleaning
          if (row.every(cell => !cell || cell === '')) {
            skippedEmpty++;
            continue;
          }

          const doc: any = { category: cleanValue(config.category) };

          // Map headers to row data with cleaning
          config.headers.forEach((header, idx) => {
            const cellValue = cleanValue(row[idx] || '');
            doc[header] = cellValue;

            // Log long values with commas for debugging (similar to main sync)
            if (cellValue.includes(',') && cellValue.length > 30) {
              this.logger.log(`Long comma-separated value in ${config.category}, ${header}: "${cellValue}"`);
            }
          });

          // Clean the entire document object
          const cleanedDoc = cleanObject(doc);

          // Build a dynamic unique filter with cleaned values
          const filter: any = { category: cleanedDoc.category };

          if (cleanedDoc.ipsName) filter.ipsName = cleanedDoc.ipsName;
          if (cleanedDoc.geography) filter.geography = cleanedDoc.geography;
          if (cleanedDoc.geographyCountries) filter.geographyCountries = cleanedDoc.geographyCountries;

          // Clean the filter as well
          const cleanedFilter = cleanObject(filter);

          // Log sample data for debugging (first few records per category)
          if (totalProcessed < 5 || (totalProcessed % 20 === 0)) {
            this.logger.log(`Sample record ${totalProcessed + 1}:`, JSON.stringify(cleanedDoc, null, 2));
          }

          ops.push({
            updateOne: {
              filter: cleanedFilter,
              update: { $set: cleanedDoc },
              upsert: true,
            },
          });

          totalProcessed++;
        }
      }

      this.logger.log(`Processed ${totalProcessed} records, skipped ${skippedEmpty} empty rows`);

      if (ops.length) {
        const bulkRes = await this.ipsActivityModel.bulkWrite(ops);
        this.logger.log(`IPS Activity data synced successfully:`);
        this.logger.log(`  - Matched: ${bulkRes.matchedCount}`);
        this.logger.log(`  - Modified: ${bulkRes.modifiedCount}`);
        this.logger.log(`  - Upserted: ${bulkRes.upsertedCount}`);
        this.logger.log(`  - Total operations: ${ops.length}`);
      } else {
        this.logger.log('No valid IPS Activity rows to upsert.');
      }
    } catch (error) {
      this.logger.error('Error fetching IPS Activity from Google Sheets:', error.message);
      if (error.stack) {
        this.logger.error('Stack trace:', error.stack);
      }
    }
  }


  /////////////////////////////////////FRENCH SYNC///////////////////////////////////////
  /////////////////////////////////////FRENCH SYNC///////////////////////////////////////
  /////////////////////////////////////FRENCH SYNC///////////////////////////////////////
  /////////////////////////////////////FRENCH SYNC///////////////////////////////////////
  /////////////////////////////////////FRENCH SYNC///////////////////////////////////////
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async FrenchfetchAndSyncIpsActivity() {
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
      const spreadsheetId = '1igYm2eCWELDu8FAutbJmQtfaw1ZCDo_PtPQWZiaTdjE';
      const range = 'Liste des IPS en service!B1:ZZ';

      const cleanValue = (value: any): string =>
        value == null || value === ''
          ? ''
          : String(value).trim().replace(/\s+/g, ' ');

      const cleanObject = (obj: any): any => {
        const cleaned: any = {};
        Object.keys(obj).forEach((key) => (cleaned[key] = cleanValue(obj[key])));
        return cleaned;
      };

      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      });

      const rawRows = res.data.values || [];
      if (!rawRows.length) {
        this.logger.warn('No IPS Activity data found.');
        return;
      }

      const rows = rawRows.map((row) => row.map((cell) => cleanValue(cell)));
      this.logger.log(`[FrenchfetchAndSyncIpsActivity] Fetched ${rows.length} rows`);

      // 🧭 Define categories with row index ranges (maintained as requested)
      const categoriesConfig = [
        {
          category: 'EN SERVICE : IPS NATIONAUX',
          start: 2,
          end: 34,
          map: (row: string[]) => ({
            country: row[1] || '', // Géographie
            category: 'EN SERVICE : IPS NATIONAUX',
            ipsName: row[0] || '', // Nom de l'IPS
            geography: row[1] || '',
            region: row[2] || '',
            ipsType: row[3] || '',
          }),
        },
        {
          category: 'DOMESTIQUE : EN DÉVELOPPEMENT ( JUILLET 2024 À MARS 2025)',
          start: 38,
          end: 56,
          map: (row: string[]) => ({
            country: row[0] || '', // Géographie
            category: 'DOMESTIQUE : EN DÉVELOPPEMENT ( JUILLET 2024 À MARS 2025)',
            geography: row[0] || '',
            status: row[1] || '',
          }),
        },
        {
          category: `Pays n'ayant pas d'activité IPS au niveau national`,
          start: 58,
          end: 67,
          map: (row: string[]) => ({
            country: row[0] || '',
            category: `Pays n'ayant pas d'activité IPS au niveau national`,
            geography: row[0] || '',
          }),
        },
        {
          category: 'EN SERVICE: IPS RÉGIONAL',
          start: 69,
          end: 72,
          map: (row: string[]) => ({
            country: row[1] || '', // Géographie (Pays)
            category: 'EN SERVICE: IPS RÉGIONAL',
            ipsName: row[0] || '',
            geography: row[1] || '',
            region: row[2] || '',
            ipsType: row[3] || '',
          }),
        },
        {
          category: 'RÉGIONAL : EN DÉVELOPPEMENT ( JUILLET 2024 À MARS 2025)',
          start: 74,
          end: 77,
          map: (row: string[]) => ({
            country: row[1] || '',
            category: 'RÉGIONAL : EN DÉVELOPPEMENT ( JUILLET 2024 À MARS 2025)',
            ipsName: row[0] || '',
            geography: row[1] || '',
            region: row[2] || '',
          }),
        },
        {
          category: 'EN PHASE PILOTE',
          start: 79,
          end: 80,
          map: (row: string[]) => ({
            country: row[1] || '',
            category: 'EN PHASE PILOTE',
            ipsName: row[0] || '',
            geography: row[1] || '',
            region: row[2] || '',
          }),
        },
        {
          category: `Pays n'ayant pas d'activité régionale en matière d'IPS`,
          start: 82,
          end: 85,
          map: (row: string[]) => ({
            country: row[0] || '',
            category: `Pays n'ayant pas d'activité régionale en matière d'IPS`,
            geographyCountries: row[0] || '',
          }),
        },
      ];

      const ops = [];
      let totalProcessed = 0;
      let skippedEmpty = 0;

      for (const config of categoriesConfig) {
        this.logger.log(`[FrenchfetchAndSyncIpsActivity] Processing ${config.category} (rows ${config.start}-${config.end})`);

        for (let i = config.start; i <= config.end; i++) {
          const row = rows[i] || [];

          // Skip empty rows
          if (row.every((cell) => !cell || cell === '')) {
            skippedEmpty++;
            continue;
          }

          const doc = cleanObject(config.map(row));
          if (!doc.country) doc.country = doc.geography || doc.geographyCountries || '';

          const filter = cleanObject({
            category: doc.category,
            country: doc.country,
            ipsName: doc.ipsName || undefined,
          });

          if (totalProcessed < 3) {
            this.logger.debug(`[Sample ${totalProcessed + 1}] ${doc.category}: ${JSON.stringify(doc)}`);
          }

          ops.push({
            updateOne: {
              filter,
              update: { $set: doc },
              upsert: true,
            },
          });

          totalProcessed++;
        }
      }

      this.logger.log(`[FrenchfetchAndSyncIpsActivity] Processed ${totalProcessed} records. Skipped ${skippedEmpty} empty rows.`);

      if (ops.length > 0) {
        const bulkRes = await this.frenchipsActivityModel.bulkWrite(ops);
        this.logger.log(`[FrenchfetchAndSyncIpsActivity] ✅ Sync complete.`);
        this.logger.log(`Matched: ${bulkRes.matchedCount}, Modified: ${bulkRes.modifiedCount}, Upserted: ${bulkRes.upsertedCount}`);
      } else {
        this.logger.log(`[FrenchfetchAndSyncIpsActivity] No valid data to upsert.`);
      }
    } catch (error) {
      this.logger.error('[FrenchfetchAndSyncIpsActivity] ❌ Error fetching IPS Activity data:', error.message);
      if (error.stack) this.logger.error(error.stack);
    }
  }


}

