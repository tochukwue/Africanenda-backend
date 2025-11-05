import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { google } from 'googleapis';
import { GeneralData, GeneralDataDocument } from 'src/generaldata/schema/generaldatum.schema';
import * as path from 'path';
import * as fs from 'fs';
import { VolumeData, VolumeDataDocument } from 'src/volumedata/schema/volumedatum.schema';
import { ValueData, ValueDataDocument } from 'src/valuedata/schema/valuedatum.schema';
import { FrenchGeneralData, FrenchGeneralDataDocument } from 'src/generaldata/schema/frgeneraldatum.schema';
import { FrenchVolumeData, FrenchVolumeDataDocument } from 'src/volumedata/schema/frvolumedatum.schema';
import { FrenchValueData, FrenchValueDataDocument } from 'src/valuedata/schema/frvaluedatum.schema';

@Injectable()
export class GoogleSheetService {
  private readonly logger = new Logger(GoogleSheetService.name);

  constructor(
    @InjectModel(GeneralData.name) private generalDataModel: Model<GeneralDataDocument>,

    @InjectModel(FrenchGeneralData.name) private frenchgeneralDataModel: Model<FrenchGeneralDataDocument>,

    @InjectModel(VolumeData.name)
    private readonly volumeDataModel: Model<VolumeDataDocument>,

    @InjectModel(FrenchVolumeData.name)
    private readonly frenchvolumeDataModel: Model<FrenchVolumeDataDocument>,

    @InjectModel(ValueData.name)
    private readonly valueDataModel: Model<ValueDataDocument>,

    @InjectModel(FrenchValueData.name)
    private readonly frenchvalueDataModel: Model<FrenchValueDataDocument>
  ) { }

  private camelCase(str: string) {
    return str
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .replace(/\s(.)/g, (match, group1) => group1.toUpperCase())
      .replace(/\s/g, '')
      .replace(/^(.)/, (match, group1) => group1.toLowerCase());
  }


  async fetchAndSyncGeneralData() {
    try {
      const credentials = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, '../../../config/authentication-411609-dcd87bcd1c0b.json'),
          'utf8'
        )
      );

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const spreadsheetId = '1VBLgF2JRCHh4RKPHhTB66yCD-Zc5Ru0wCxX3ZEDtTR0';

      // Helper function to clean and normalize system names for comparison
      const cleanSystemName = (name) => {
        if (!name) return '';
        return String(name)
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/['"'""`]/g, '"') // Normalize quotes
          .replace(/[–—]/g, '-') // Normalize dashes
          .replace(/\u00A0/g, ' ') // Replace non-breaking spaces
          .toLowerCase();
      };

      // Helper function for fuzzy matching
      const fuzzyMatch = (str1, str2, threshold = 0.9) => {
        const clean1 = cleanSystemName(str1);
        const clean2 = cleanSystemName(str2);

        if (clean1 === clean2) return true;

        // Check if one contains the other (for partial matches)
        if (clean1.includes(clean2) || clean2.includes(clean1)) {
          return true;
        }

        // Simple similarity check
        const longer = clean1.length > clean2.length ? clean1 : clean2;
        const shorter = clean1.length > clean2.length ? clean2 : clean1;

        if (longer.length === 0) return false;

        const similarity = (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
        return similarity >= threshold;
      };

      // Simple Levenshtein distance function
      const levenshteinDistance = (str1, str2) => {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
          matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
          matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
          for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
              matrix[i][j] = matrix[i - 1][j - 1];
            } else {
              matrix[i][j] = Math.min(
                matrix[i - 1][j - 1] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1
              );
            }
          }
        }

        return matrix[str2.length][str1.length];
      };

      /** ✅ First: Sync "2025 data" sheet */
      const rangeMain = '2025 data!A:ZZ';

      const approaches = [
        {
          name: 'UNFORMATTED_VALUE',
          params: {
            spreadsheetId,
            range: rangeMain,
            valueRenderOption: 'UNFORMATTED_VALUE',
            dateTimeRenderOption: 'FORMATTED_STRING'
          }
        },
        {
          name: 'FORMATTED_VALUE',
          params: {
            spreadsheetId,
            range: rangeMain,
            valueRenderOption: 'FORMATTED_VALUE',
            dateTimeRenderOption: 'FORMATTED_STRING'
          }
        }
      ];

      let rowsMain = null;
      let bestApproach = null;

      for (const approach of approaches) {
        try {
          this.logger.log(`Trying approach: ${approach.name}`);
          const resMain = await sheets.spreadsheets.values.get(approach.params);
          const testRows = resMain.data.values;

          if (testRows && testRows.length > 1) {
            let maxCellLength = 0;
            let longestCell = '';

            testRows.slice(1, 6).forEach((row) => {
              row.forEach((cell) => {
                if (cell != null) {
                  const cellStr = String(cell);
                  if (cellStr.length > maxCellLength) {
                    maxCellLength = cellStr.length;
                    longestCell = cellStr;
                  }
                }
              });
            });

            this.logger.log(`${approach.name} - Longest cell: ${maxCellLength} chars`);

            if (!bestApproach || maxCellLength > bestApproach.maxLength) {
              bestApproach = {
                approach: approach.name,
                data: testRows,
                maxLength: maxCellLength
              };
            }
          }
        } catch (error) {
          this.logger.warn(`Approach ${approach.name} failed:`, error.message);
        }
      }

      if (!bestApproach) {
        this.logger.error('All approaches failed to fetch data');
        return;
      }

      this.logger.log(`Using best approach: ${bestApproach.approach}`);
      rowsMain = bestApproach.data;

      // Store all system names from main data for comparison later
      const mainSystemNames = new Set();

      if (!rowsMain || rowsMain.length < 2) {
        this.logger.warn('No data found in "2025 data" sheet.');
      } else {
        const headersMain = rowsMain[0];
        const dataRowsMain = rowsMain.slice(1);

        const headerMap: Record<string, string> = {
          'system name': 'systemName',
          'geographic reach': 'geographicReach',
          'gender': 'gender',
          'geographic region': 'geographicRegion',
          'coverage (domestic/regional)': 'coverage',
          'year of establishment': 'yearOfEstablishment',
          'ips type': 'ipsType',
          'interoperability arrangement (bilateral/multilateral)': 'interoperabilityArrangement',
          'governance typology (industry, ppp, central bank led)': 'governanceTypology',
          'ownership model': 'ownershipModel',
          'system owner': 'systemOwner',
          'overseer': 'overseer',
          'system governance': 'systemGovernance',
          'operator': 'operator',
          'settlement agent': 'settlementAgent',
          'number of unique ips end users': 'numberOfUniqueIpsEndUsers',
          'total number of participants (2025)': 'totalNumberOfParticipants2025',
          'number of direct participants - commercial banks': 'numberOfDirectParticipantsCommercialBanks',
          'number of direct participants - e-money issuers': 'numberOfDirectParticipantsEMoneyIssuers',
          'number of direct participants - mfis': 'numberOfDirectParticipantsMFIs',
          'number of direct participants - other': 'numberOfDirectParticipantsOther',
          'number of direct participants - post office': 'numberOfDirectParticipantsPostOffice',
          'indirect participants (type)': 'indirectParticipantsType',
          'number of indirect participants': 'numberOfIndirectParticipants',
          'supported use cases': 'supportedUseCases',
          'supported instruments': 'supportedInstruments',
          'primary local channel': 'primaryLocalChannel',
          'supported channels': 'supportedChannels',
          'if qr code enabled:  static/dynamic/both': 'qrCodeEnabledType',
          'messaging standard': 'messagingStandard',
          'proxy id': 'proxyId',
          "if 'other' proxy id, type": 'otherProxyIdType',
          'business model': 'businessModel',
          'pricing structure': 'pricingStructure',
          'scheme rules shared or publically available?': 'schemeRulesPublic',
          'additional recourse requirements': 'additionalRecourseRequirements',
          'dispute resolution mechanism': 'disputeResolutionMechanism',
          'api use function': 'apiUseFunction',
          'startup funding source': 'startupFundingSource',
          'participation in decision-making process (y/n)': 'participationInDecisionMaking',
          'mechanism for participation in decision-making': 'mechanismForDecisionMaking',
          'ability to become direct participants in the system (y/n)': 'abilityToBecomeDirectParticipants',
          'entities that cannot participate': 'entitiesThatCannotParticipate',
          'non-banking financial institutions ability to participate by sponsorship (y/n)': 'nonBankingFIsSponsorship',
          'min. value for transactions processed (local currency)': 'minValueForTransactions',
          'corporate structure of system': 'corporateStructure',
          'if other corporate structure, please specify': 'otherCorporateStructure',
          'pull "request to pay" enabled (y/n)': 'pullRequestToPayEnabled',
          'third party connections enabled (y/n)': 'thirdPartyConnectionsEnabled',
          'real-time payment confirmation message enabled (y/n)': 'realTimePaymentConfirmation',
          'transaction validation enabled (y/n)': 'transactionValidationEnabled',
          // Extra schema field not in sheet (but kept in schema)
          'inclusivity ranking': 'inclusivityRanking',
        };

        for (let i = 0; i < Math.min(dataRowsMain.length, 1000); i++) {
          const row = dataRowsMain[i];

          if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
            continue;
          }

          const rowData: any = {};

          headersMain.forEach((header, index) => {
            if (!header) return;

            const cleanedHeader = String(header).trim().toLowerCase();
            const normalizedHeader = headerMap[cleanedHeader] || this.camelCase(cleanedHeader);

            const rawValue = (index < row.length) ? row[index] : '';
            let cellValue = rawValue != null ? String(rawValue) : '';

            // Clean whitespace
            cellValue = cellValue.trim().replace(/\s+/g, ' ');

            rowData[normalizedHeader] = cellValue;
          });

          const cleanedSystemName = String(rowData.systemName || '').trim().replace(/\s+/g, ' ');
          if (!cleanedSystemName) {
            continue;
          }

          // Store the cleaned system name
          mainSystemNames.add(cleanedSystemName);
          rowData.systemName = cleanedSystemName;

          // Clean all data before saving
          const cleanedRowData: any = {};
          Object.keys(rowData).forEach(key => {
            const value = rowData[key];
            if (value != null && value !== '') {
              cleanedRowData[key] = String(value).trim().replace(/\s+/g, ' ');
            } else {
              cleanedRowData[key] = '';
            }
          });

          await this.generalDataModel.updateOne(
            { systemName: cleanedRowData.systemName },
            { $set: cleanedRowData },
            { upsert: true }
          );
        }

        this.logger.log(`Synced ${dataRowsMain.length} rows from "2025 data" sheet.`);
        this.logger.log(`Total unique system names: ${mainSystemNames.size}`);
      }

      /** ✅ Second: Enhanced Inclusivity Spectrum Analysis sync with detailed debugging */
      const rangeInclusivity = 'Inclusivity Spectrum Analysis!A:ZZ';

      const resInclusivity = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: rangeInclusivity,
        valueRenderOption: bestApproach.approach,
        dateTimeRenderOption: 'FORMATTED_STRING'
      });

      const rowsInclusivity = resInclusivity.data.values;

      if (!rowsInclusivity || rowsInclusivity.length < 6) {
        this.logger.warn('No data found in "Inclusivity Spectrum Analysis" sheet.');
      } else {
        this.logger.log(`Inclusivity sheet total rows: ${rowsInclusivity.length}`);

        if (rowsInclusivity.length <= 4) {
          this.logger.error('Inclusivity Spectrum Analysis sheet does not have enough rows for headers at row 5');
          return;
        }

        const headersInc = rowsInclusivity[4];
        const dataRowsInc = rowsInclusivity.slice(5);

        // Find system name and status columns
        const systemNameIndex = headersInc.findIndex(h => {
          if (h == null) return false;
          const headerStr = String(h).trim().toLowerCase();
          return headerStr === 'system name' || headerStr === 'systemname' || headerStr.includes('system');
        });

        const statusIndexes = headersInc
          .map((h, i) => {
            if (h == null) return -1;
            const headerStr = String(h).trim().toLowerCase();
            return (headerStr === 'status' || headerStr.includes('status')) ? i : -1;
          })
          .filter(i => i !== -1);

        this.logger.log(`System name column index: ${systemNameIndex}`);
        this.logger.log(`Status column indexes: ${JSON.stringify(statusIndexes)}`);

        if (systemNameIndex === -1 || statusIndexes.length === 0) {
          this.logger.error('Required columns not found in Inclusivity Spectrum Analysis sheet.');
          this.logger.log('Available headers:', headersInc.map((h, i) => `${i}: "${h}"`));
          return;
        }

        const statusIndex = statusIndexes[0];

        let updatedCount = 0;
        let processedCount = 0;
        const unmatchedSystems = [];
        const matchedSystems = [];

        // Get all existing system names from database for comparison
        const existingSystemNames = await this.generalDataModel.find({}, { systemName: 1, _id: 0 }).lean();
        const dbSystemNames = existingSystemNames.map(doc => doc.systemName);

        this.logger.log(`Found ${dbSystemNames.length} system names in database`);

        for (let i = 0; i < dataRowsInc.length; i++) {
          const row = dataRowsInc[i];

          if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
            continue;
          }

          if (row.length <= Math.max(systemNameIndex, statusIndex)) {
            continue;
          }

          // Clean the system name and status
          let systemName = row[systemNameIndex] != null ? String(row[systemNameIndex]).trim().replace(/\s+/g, ' ') : '';
          const statusValue = row[statusIndex] != null ? String(row[statusIndex]).trim().replace(/\s+/g, ' ') : '';

          if (!systemName) {
            continue;
          }

          processedCount++;

          // Debug specific system names
          if (systemName.includes('Virement') || systemName.includes('Somalia') || systemName.includes('SIPS')) {
            this.logger.log(`🔍 DEBUGGING TARGET SYSTEM: "${systemName}"`);
            this.logger.log(`🔍 Original raw value: "${row[systemNameIndex]}"`);
            this.logger.log(`🔍 Status value: "${statusValue}"`);
            this.logger.log(`🔍 Cleaned system name: "${systemName}"`);
            this.logger.log(`🔍 System name length: ${systemName.length}`);
            this.logger.log(`🔍 Character codes: ${systemName.split('').map(c => c.charCodeAt(0)).join(', ')}`);
          }

          // Try exact match first
          const updateResult = await this.generalDataModel.updateOne(
            { systemName: systemName },
            { $set: { inclusivityRanking: statusValue || '' } },
            { upsert: false }
          );

          if (updateResult.matchedCount > 0) {
            updatedCount++;
            matchedSystems.push(systemName);

            if (systemName.includes('Virement') || systemName.includes('Somalia') || systemName.includes('SIPS')) {
              this.logger.log(`✅ EXACT MATCH FOUND for: "${systemName}"`);
            }
          } else {
            // Try fuzzy matching
            let foundMatch = false;

            for (const dbSystemName of dbSystemNames) {
              if (fuzzyMatch(systemName, dbSystemName, 0.85)) {
                this.logger.log(`🔄 FUZZY MATCH: "${systemName}" -> "${dbSystemName}"`);

                const fuzzyUpdateResult = await this.generalDataModel.updateOne(
                  { systemName: dbSystemName },
                  { $set: { inclusivityRanking: statusValue || '' } },
                  { upsert: false }
                );

                if (fuzzyUpdateResult.matchedCount > 0) {
                  updatedCount++;
                  matchedSystems.push(`${systemName} -> ${dbSystemName}`);
                  foundMatch = true;
                  break;
                }
              }
            }

            if (!foundMatch) {
              unmatchedSystems.push({
                original: systemName,
                status: statusValue,
                rowNumber: i + 6
              });

              // For debugging specific systems, show similar matches
              if (systemName.includes('Virement') || systemName.includes('Somalia') || systemName.includes('SIPS')) {
                this.logger.log(`❌ NO MATCH FOUND for: "${systemName}"`);

                // Find similar system names in database
                const similarNames = dbSystemNames.filter(dbName => {
                  const similarity = 1 - (levenshteinDistance(cleanSystemName(systemName), cleanSystemName(dbName)) / Math.max(systemName.length, dbName.length));
                  return similarity > 0.5;
                }).slice(0, 5);

                this.logger.log(`🔍 Similar names in DB: ${JSON.stringify(similarNames)}`);
              }
            }
          }
        }

        // Detailed reporting
        this.logger.log(`\n📊 INCLUSIVITY SYNC RESULTS:`);
        this.logger.log(`  Processed: ${processedCount}`);
        this.logger.log(`  Updated: ${updatedCount}`);
        this.logger.log(`  Unmatched: ${unmatchedSystems.length}`);

        if (unmatchedSystems.length > 0) {
          this.logger.log(`\n❌ UNMATCHED SYSTEMS:`);
          unmatchedSystems.forEach(item => {
            this.logger.log(`  Row ${item.rowNumber}: "${item.original}" (status: ${item.status})`);
          });
        }

        // Log first few matched systems for verification
        if (matchedSystems.length > 0) {
          this.logger.log(`\n✅ MATCHED SYSTEMS (first 10):`);
          matchedSystems.slice(0, 10).forEach(match => {
            this.logger.log(`  ${match}`);
          });
        }
      }

    } catch (error) {
      this.logger.error('Error fetching data from Google Sheets:', error.message);
      if (error.stack) {
        this.logger.error('Stack trace:', error.stack);
      }
    }
  }


  ////////////////////////////////FRENCH GENERAL DATA SYNC/////////////////////////////////
  ////////////////////////////////FRENCH GENERAL DATA SYNC/////////////////////////////////
  ////////////////////////////////FRENCH GENERAL DATA SYNC/////////////////////////////////
  ////////////////////////////////FRENCH GENERAL DATA SYNC/////////////////////////////////
  ////////////////////////////////FRENCH GENERAL DATA SYNC/////////////////////////////////
  ////////////////////////////////FRENCH GENERAL DATA SYNC/////////////////////////////////

  async FrenchfetchAndSyncGeneralData() {
    try {
      const credentials = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, '../../../config/authentication-411609-dcd87bcd1c0b.json'),
          'utf8'
        )
      );

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const spreadsheetId = '1igYm2eCWELDu8FAutbJmQtfaw1ZCDo_PtPQWZiaTdjE';

      // Helper function to clean and normalize system names for comparison
      const cleanSystemName = (name) => {
        if (!name) return '';
        return String(name)
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/['"'""`]/g, '"') // Normalize quotes
          .replace(/[–—]/g, '-') // Normalize dashes
          .replace(/\u00A0/g, ' ') // Replace non-breaking spaces
          .toLowerCase();
      };

      // Helper function for fuzzy matching
      const fuzzyMatch = (str1, str2, threshold = 0.9) => {
        const clean1 = cleanSystemName(str1);
        const clean2 = cleanSystemName(str2);

        if (clean1 === clean2) return true;

        // Check if one contains the other (for partial matches)
        if (clean1.includes(clean2) || clean2.includes(clean1)) {
          return true;
        }

        // Simple similarity check
        const longer = clean1.length > clean2.length ? clean1 : clean2;
        const shorter = clean1.length > clean2.length ? clean2 : clean1;

        if (longer.length === 0) return false;

        const similarity = (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
        return similarity >= threshold;
      };

      // Simple Levenshtein distance function
      const levenshteinDistance = (str1, str2) => {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
          matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
          matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
          for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
              matrix[i][j] = matrix[i - 1][j - 1];
            } else {
              matrix[i][j] = Math.min(
                matrix[i - 1][j - 1] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1
              );
            }
          }
        }

        return matrix[str2.length][str1.length];
      };

      /** ✅ First: Sync "2025 data" sheet */
      const rangeMain = 'Données 2025!A:ZZ';

      const approaches = [
        {
          name: 'UNFORMATTED_VALUE',
          params: {
            spreadsheetId,
            range: rangeMain,
            valueRenderOption: 'UNFORMATTED_VALUE',
            dateTimeRenderOption: 'FORMATTED_STRING'
          }
        },
        {
          name: 'FORMATTED_VALUE',
          params: {
            spreadsheetId,
            range: rangeMain,
            valueRenderOption: 'FORMATTED_VALUE',
            dateTimeRenderOption: 'FORMATTED_STRING'
          }
        }
      ];

      let rowsMain = null;
      let bestApproach = null;

      for (const approach of approaches) {
        try {
          this.logger.log(`Trying approach: ${approach.name}`);
          const resMain = await sheets.spreadsheets.values.get(approach.params);
          const testRows = resMain.data.values;

          if (testRows && testRows.length > 1) {
            let maxCellLength = 0;
            let longestCell = '';

            testRows.slice(1, 6).forEach((row) => {
              row.forEach((cell) => {
                if (cell != null) {
                  const cellStr = String(cell);
                  if (cellStr.length > maxCellLength) {
                    maxCellLength = cellStr.length;
                    longestCell = cellStr;
                  }
                }
              });
            });

            this.logger.log(`${approach.name} - Longest cell: ${maxCellLength} chars`);

            if (!bestApproach || maxCellLength > bestApproach.maxLength) {
              bestApproach = {
                approach: approach.name,
                data: testRows,
                maxLength: maxCellLength
              };
            }
          }
        } catch (error) {
          this.logger.warn(`Approach ${approach.name} failed:`, error.message);
        }
      }

      if (!bestApproach) {
        this.logger.error('All approaches failed to fetch data');
        return;
      }

      this.logger.log(`Using best approach: ${bestApproach.approach}`);
      rowsMain = bestApproach.data;

      // Store all system names from main data for comparison later
      const mainSystemNames = new Set();

      if (!rowsMain || rowsMain.length < 2) {
        this.logger.warn('No data found in "2025 data" sheet.');
      } else {
        const headersMain = rowsMain[0];
        const dataRowsMain = rowsMain.slice(1);

        const headerMap: Record<string, string> = {
          'nom du système': 'systemName',
          'portée géographique': 'geographicReach',
          'genre': 'gender',
          'région géographique': 'geographicRegion',
          'couverture (nationale/régionale)': 'coverage',
          'année de création': 'yearOfEstablishment',
          "type d'ips": 'ipsType',
          "accord d'interopérabilité (bilatéral/multilatéral)": 'interoperabilityArrangement',
          'typologie de gouvernance (industrie, ppp, dirigé par la banque centrale)': 'governanceTypology',
          "modèle de propriété": 'ownershipModel',
          'propriétaire du système': 'systemOwner',
          'superviseur': 'overseer',
          'gouvernance du système': 'systemGovernance',
          'opérateur': 'operator',
          'agent de règlement': 'settlementAgent',
          "nombre d'utilisateurs finaux uniques de l'ips": 'numberOfUniqueIpsEndUsers',
          'nombre total de participants (2025)': 'totalNumberOfParticipants2025',
          'nombre de participants directs - banques commerciales': 'numberOfDirectParticipantsCommercialBanks',
          'nombre de participants directs - émetteurs de monnaie électronique': 'numberOfDirectParticipantsEMoneyIssuers',
          'nombre de participants directs - imf': 'numberOfDirectParticipantsMFIs',
          'nombre de participants directs - autres': 'numberOfDirectParticipantsOther',
          'nombre de participants directs - postes': 'numberOfDirectParticipantsPostOffice',
          'participants indirects (type)': 'indirectParticipantsType',
          'nombre de participants indirects': 'numberOfIndirectParticipants',
          "cas d'utilisation pris en charge": 'supportedUseCases',
          'instruments pris en charge': 'supportedInstruments',
          'canal local principal': 'primaryLocalChannel',
          'canaux pris en charge': 'supportedChannels',
          'si le code qr est activé :  statique/dynamique/les deux': 'qrCodeEnabledType',
          'norme de messagerie': 'messagingStandard',
          'id du proxy': 'proxyId',
          'si "autre" id proxy, type': 'otherProxyIdType',
          "modèle d'entreprise": 'businessModel',
          'structure de tarification': 'pricingStructure',
          'règles du système partagées ou accessibles au public ?': 'schemeRulesPublic',
          'exigences supplémentaires en matière de recours': 'additionalRecourseRequirements',
          'mécanisme de résolution des litiges': 'disputeResolutionMechanism',
          "fonction d'utilisation de l'api": 'apiUseFunction',
          "source de financement de la création d'entreprise": 'startupFundingSource',
          'participation au processus décisionnel (o/n)': 'participationInDecisionMaking',
          'mécanisme de participation à la prise de décision': 'mechanismForDecisionMaking',
          'possibilité de participer directement au système (o/n)': 'abilityToBecomeDirectParticipants',
          'entités qui ne peuvent pas participer': 'entitiesThatCannotParticipate',
          'capacité des institutions financières non bancaires à participer par le biais d\'un parrainage (o/n)': 'nonBankingFIsSponsorship',
          'valeur minimale des transactions traitées (monnaie locale)': 'minValueForTransactions',
          'structure du système': 'corporateStructure',
          'si autre structure d\'entreprise, veuillez préciser': 'otherCorporateStructure',
          'possibilité de tirer des "demandes de paiement" (o/n)': 'pullRequestToPayEnabled',
          'possibilité d\'établir des connexions avec des tiers (o/n)': 'thirdPartyConnectionsEnabled',
          'activation du message de confirmation de paiement en temps réel (o/n)': 'realTimePaymentConfirmation',
          'validation des transactions activée (o/n)': 'transactionValidationEnabled',
          // Extra schema field not in sheet (but kept in schema)
          'inclusivity ranking': 'inclusivityRanking',
        };

        for (let i = 0; i < Math.min(dataRowsMain.length, 1000); i++) {
          const row = dataRowsMain[i];

          if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
            continue;
          }

          const rowData: any = {};

          headersMain.forEach((header, index) => {
            if (!header) return;

            const cleanedHeader = String(header).trim().toLowerCase();
            const normalizedHeader = headerMap[cleanedHeader] || this.camelCase(cleanedHeader);

            const rawValue = (index < row.length) ? row[index] : '';
            let cellValue = rawValue != null ? String(rawValue) : '';

            // Clean whitespace
            cellValue = cellValue.trim().replace(/\s+/g, ' ');

            rowData[normalizedHeader] = cellValue;
          });

          const cleanedSystemName = String(rowData.systemName || '').trim().replace(/\s+/g, ' ');
          if (!cleanedSystemName) {
            continue;
          }

          // Store the cleaned system name
          mainSystemNames.add(cleanedSystemName);
          rowData.systemName = cleanedSystemName;

          // Clean all data before saving
          const cleanedRowData: any = {};
          Object.keys(rowData).forEach(key => {
            const value = rowData[key];
            if (value != null && value !== '') {
              cleanedRowData[key] = String(value).trim().replace(/\s+/g, ' ');
            } else {
              cleanedRowData[key] = '';
            }
          });

          await this.frenchgeneralDataModel.updateOne(
            { systemName: cleanedRowData.systemName },
            { $set: cleanedRowData },
            { upsert: true }
          );
        }

        this.logger.log(`Synced ${dataRowsMain.length} rows from "2025 data" sheet.`);
        this.logger.log(`Total unique system names: ${mainSystemNames.size}`);
      }

      /** ✅ Second: Enhanced Inclusivity Spectrum Analysis sync with detailed debugging */
      const rangeInclusivity = `Analyse du spectre de l'inclusivité!A:ZZ`;

      const resInclusivity = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: rangeInclusivity,
        valueRenderOption: bestApproach.approach,
        dateTimeRenderOption: 'FORMATTED_STRING'
      });

      const rowsInclusivity = resInclusivity.data.values;




      if (!rowsInclusivity || rowsInclusivity.length < 6) {
        this.logger.warn('No data found in "Inclusivity Spectrum Analysis" sheet.');
      } else {
        this.logger.log(`Inclusivity sheet total rows: ${rowsInclusivity.length}`);

        if (rowsInclusivity.length <= 4) {
          this.logger.error('Inclusivity Spectrum Analysis sheet does not have enough rows for headers at row 5');
          return;
        }

        const headersInc = rowsInclusivity[4];
        const dataRowsInc = rowsInclusivity.slice(5);

        // Helper to normalize accents and case
        const normalize = (str) =>
          String(str)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // remove accents
            .trim()
            .toLowerCase();

        // Find system name column
        const systemNameIndex = headersInc.findIndex(h => {
          if (!h) return false;
          const headerStr = normalize(h);
          return headerStr === 'nom du systeme' || headerStr === 'du systeme' || headerStr.includes('systeme');
        });

        // Find status column (État d'avancement)
        const statusIndexes = headersInc
          .map((h, i) => {
            if (!h) return -1;
            const headerStr = normalize(h);
            return (headerStr === "etat d'avancement" || headerStr.includes("etat d'avancement")) ? i : -1;
          })
          .filter(i => i !== -1);

        this.logger.log(`System name column index: ${systemNameIndex}`);
        this.logger.log(`Status column indexes: ${JSON.stringify(statusIndexes)}`);

        if (systemNameIndex === -1 || statusIndexes.length === 0) {
          this.logger.error('Required columns not found in Inclusivity Spectrum Analysis sheet.');
          this.logger.log('Available headers:', headersInc.map((h, i) => `${i}: "${h}"`));
          return;
        }

        const statusIndex = statusIndexes[0];

        let updatedCount = 0;
        let processedCount = 0;
        const unmatchedSystems = [];
        const matchedSystems = [];

        // Get all existing system names from database for comparison
        const existingSystemNames = await this.frenchgeneralDataModel.find({}, { systemName: 1, _id: 0 }).lean();
        const dbSystemNames = existingSystemNames.map(doc => doc.systemName);

        this.logger.log(`Found ${dbSystemNames.length} system names in database`);

        for (let i = 0; i < dataRowsInc.length; i++) {
          const row = dataRowsInc[i];

          if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
            continue;
          }

          if (row.length <= Math.max(systemNameIndex, statusIndex)) {
            continue;
          }

          // Clean and normalize values
          let systemName = row[systemNameIndex] != null ? String(row[systemNameIndex]).trim().replace(/\s+/g, ' ') : '';
          const statusValue = row[statusIndex] != null ? String(row[statusIndex]).trim().replace(/\s+/g, ' ') : '';

          if (!systemName) {
            continue;
          }

          processedCount++;

          // Debugging for key systems
          if (systemName.includes('Virement') || systemName.includes('Somalia') || systemName.includes('SIPS')) {
            this.logger.log(`🔍 DEBUGGING TARGET SYSTEM: "${systemName}"`);
            this.logger.log(`🔍 Original raw value: "${row[systemNameIndex]}"`);
            this.logger.log(`🔍 Status value: "${statusValue}"`);
            this.logger.log(`🔍 Cleaned system name: "${systemName}"`);
            this.logger.log(`🔍 System name length: ${systemName.length}`);
            this.logger.log(`🔍 Character codes: ${systemName.split('').map(c => c.charCodeAt(0)).join(', ')}`);
          }

          // Try exact match first
          const updateResult = await this.frenchgeneralDataModel.updateOne(
            { systemName: systemName },
            { $set: { inclusivityRanking: statusValue || '' } },
            { upsert: false }
          );

          if (updateResult.matchedCount > 0) {
            updatedCount++;
            matchedSystems.push(systemName);

            if (systemName.includes('Virement') || systemName.includes('Somalia') || systemName.includes('SIPS')) {
              this.logger.log(`✅ EXACT MATCH FOUND for: "${systemName}"`);
            }
          } else {
            // Try fuzzy matching
            let foundMatch = false;

            for (const dbSystemName of dbSystemNames) {
              if (fuzzyMatch(systemName, dbSystemName, 0.85)) {
                this.logger.log(`🔄 FUZZY MATCH: "${systemName}" -> "${dbSystemName}"`);

                const fuzzyUpdateResult = await this.frenchgeneralDataModel.updateOne(
                  { systemName: dbSystemName },
                  { $set: { inclusivityRanking: statusValue || '' } },
                  { upsert: false }
                );

                if (fuzzyUpdateResult.matchedCount > 0) {
                  updatedCount++;
                  matchedSystems.push(`${systemName} -> ${dbSystemName}`);
                  foundMatch = true;
                  break;
                }
              }
            }

            if (!foundMatch) {
              unmatchedSystems.push({
                original: systemName,
                status: statusValue,
                rowNumber: i + 6
              });

              if (systemName.includes('Virement') || systemName.includes('Somalia') || systemName.includes('SIPS')) {
                this.logger.log(`❌ NO MATCH FOUND for: "${systemName}"`);

                const similarNames = dbSystemNames.filter(dbName => {
                  const similarity = 1 - (levenshteinDistance(cleanSystemName(systemName), cleanSystemName(dbName)) / Math.max(systemName.length, dbName.length));
                  return similarity > 0.5;
                }).slice(0, 5);

                this.logger.log(`🔍 Similar names in DB: ${JSON.stringify(similarNames)}`);
              }
            }
          }
        }

        // Final summary
        this.logger.log(`\n📊 INCLUSIVITY SYNC RESULTS:`);
        this.logger.log(`  Processed: ${processedCount}`);
        this.logger.log(`  Updated: ${updatedCount}`);
        this.logger.log(`  Unmatched: ${unmatchedSystems.length}`);

        if (unmatchedSystems.length > 0) {
          this.logger.log(`\n❌ UNMATCHED SYSTEMS:`);
          unmatchedSystems.forEach(item => {
            this.logger.log(`  Row ${item.rowNumber}: "${item.original}" (status: ${item.status})`);
          });
        }

        if (matchedSystems.length > 0) {
          this.logger.log(`\n✅ MATCHED SYSTEMS (first 10):`);
          matchedSystems.slice(0, 10).forEach(match => {
            this.logger.log(`  ${match}`);
          });
        }
      }


    } catch (error) {
      this.logger.error('Error fetching data from Google Sheets:', error.message);
      if (error.stack) {
        this.logger.error('Stack trace:', error.stack);
      }
    }
  }




  async fetchAndSyncVolumeData() {
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
      const range = 'Volume data!A3:ZZ'; // header starts at row 3

      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      const rows = res.data.values;

      if (!rows || rows.length === 0) {
        this.logger.warn('No volume data found (no rows).');
        return;
      }

      const headers = rows[0];

      // --- Normalizer ---
      const normalize = (h?: string) =>
        (h || '')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/[^a-z0-9 ]/gi, '')
          .trim()
          .toLowerCase();

      const headersNorm = headers.map((h) => normalize(h));
      const findIndexByNorm = (target: string) =>
        headersNorm.findIndex((h) => h === target.toLowerCase());

      const systemNameIndex = findIndexByNorm('system name');
      const geoReachIndex = findIndexByNorm('geographic reach');
      const ipsTypeIndex = findIndexByNorm('ips type');

      if (systemNameIndex === -1) {
        this.logger.error('Could not find "System name" header. Headers found:', headers);
        return;
      }

      // Detect year-specific columns dynamically
      const yearColumns: Record<number, number> = {};
      const yearRegex = /^volumes\s*(\d{4})\s*ips transactions$/i;
      headersNorm.forEach((h, idx) => {
        const match = h.match(yearRegex);
        if (match) {
          const year = parseInt(match[1], 10);
          yearColumns[year] = idx;
        }
      });

      this.logger.log(
        `Found IPS Transactions columns for years: ${Object.keys(yearColumns).join(', ') || 'none'
        }`
      );

      const dataRows = rows.slice(1);
      const ops: any[] = [];

      for (const row of dataRows) {
        const systemName = (row[systemNameIndex] || '').toString().trim();
        if (!systemName) continue;

        const doc: any = {
          systemName,
          geographicReach:
            geoReachIndex !== -1 ? (row[geoReachIndex] || '').toString().trim() : '',
          ipsType: ipsTypeIndex !== -1 ? (row[ipsTypeIndex] || '').toString().trim() : '',
        };

        for (const [yearStr, idx] of Object.entries(yearColumns)) {
          const raw = row[idx];
          if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
            // Convert to number, stripping commas
            const num = Number(String(raw).replace(/,/g, '').trim());
            doc[`volumes${yearStr}`] = isNaN(num) ? null : num;
          } else {
            doc[`volumes${yearStr}`] = null;
          }
        }

        ops.push({
          updateOne: {
            filter: { systemName: doc.systemName },
            update: { $set: doc },
            upsert: true,
          },
        });
      }

      if (ops.length === 0) {
        this.logger.log('No data rows to upsert.');
        return;
      }

      const bulkRes = await this.volumeDataModel.bulkWrite(ops);
      this.logger.log(`Volume data synced. bulkWrite result: ${JSON.stringify(bulkRes)}`);
    } catch (error) {
      this.logger.error('Error fetching Volume Data from Google Sheets', error);
    }
  }



  async fetchAndSyncValueData() {
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
      const range = 'Value data ($US 2022)!A3:ZZ';

      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      const rows = res.data.values;

      if (!rows || rows.length === 0) {
        this.logger.warn('No Value Data found.');
        return;
      }

      const headers = rows[0];

      const normalize = (h?: string) =>
        (h || '')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/[^a-z0-9 ()$]/gi, '')
          .trim()
          .toLowerCase();

      const headersNorm = headers.map(normalize);
      const findIndexByNorm = (target: string) =>
        headersNorm.findIndex((h) => h === target.toLowerCase());

      const systemNameIndex = findIndexByNorm('system name');
      const geoReachIndex = findIndexByNorm('geographic reach');
      const ipsTypeIndex = findIndexByNorm('ips type');
      const exchangeRateIndex = headersNorm.findIndex((h) => h.startsWith('exchange rate'));

      if (systemNameIndex === -1) {
        this.logger.error('Could not find "System name" column.');
        return;
      }

      const yearColumns: Record<number, number> = {};
      const yearRegex = /^value\(\$us\)\s*(\d{4})\s*ips transactions$/i;

      headersNorm.forEach((h, idx) => {
        const match = h.match(yearRegex);
        if (match) {
          const year = parseInt(match[1], 10);
          yearColumns[year] = idx;
        }
      });

      this.logger.log(`Found Value($US) IPS Transactions columns for years: ${Object.keys(yearColumns).join(', ') || 'none'}`);

      const dataRows = rows.slice(1);
      const ops: any[] = [];

      for (const row of dataRows) {
        const systemName = (row[systemNameIndex] || '').toString().trim();
        if (!systemName) continue;

        const doc: any = {
          systemName,
          geographicReach: geoReachIndex !== -1 ? (row[geoReachIndex] || '').toString().trim() : '',
          ipsType: ipsTypeIndex !== -1 ? (row[ipsTypeIndex] || '').toString().trim() : '',
          exchangeRate: exchangeRateIndex !== -1 ? (row[exchangeRateIndex] || '').toString().trim() : '',
        };

        for (const [year, idx] of Object.entries(yearColumns)) {
          const val = row[idx];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            const num = Number(String(val).replace(/,/g, '').trim());
            doc[`values${year}`] = isNaN(num) ? null : num;
          } else {
            doc[`values${year}`] = null;
          }
        }

        ops.push({
          updateOne: {
            filter: { systemName: doc.systemName },
            update: { $set: doc },
            upsert: true,
          },
        });
      }

      if (ops.length === 0) {
        this.logger.log('No Value Data rows to upsert.');
        return;
      }

      const bulkRes = await this.valueDataModel.bulkWrite(ops);
      this.logger.log(`Value Data synced. bulkWrite result: ${JSON.stringify(bulkRes)}`);
    } catch (error) {
      this.logger.error('Error fetching Value Data from Google Sheets', error);
    }
  }


  ///////////////////////////////////FRENCH VOULUMEDATA///////////////////////////////////
  ///////////////////////////////////FRENCH VOULUMEDATA///////////////////////////////////
  ///////////////////////////////////FRENCH VOULUMEDATA///////////////////////////////////
async FrenchfetchAndSyncVolumeData() {
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
    const range = 'Données en volume!A3:ZZ'; // French volume data tab

    this.logger.log(`[FrenchfetchAndSyncVolumeData] Fetching data from: ${range}`);

    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = res.data.values;

    if (!rows || rows.length === 0) {
      this.logger.warn('[FrenchfetchAndSyncVolumeData] No volume data found (no rows).');
      return;
    }

    const headers = rows[0];
    this.logger.debug(`[FrenchfetchAndSyncVolumeData] Raw headers: ${JSON.stringify(headers)}`);

    // --- Normalize headers with accent + newline handling ---
    const normalize = (h?: string) =>
      (h || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/\n/g, ' ') // join multi-line headers
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9 ()$]/gi, '') // keep alphanumeric and parentheses
        .trim()
        .toLowerCase();

    const headersNorm = headers.map((h) => normalize(h));
    this.logger.debug(`[FrenchfetchAndSyncVolumeData] Normalized headers: ${JSON.stringify(headersNorm)}`);

    const findIndexByIncludes = (targets: string[]) =>
      headersNorm.findIndex((h) => targets.some((t) => h.includes(t)));

    // --- Identify key column indexes ---
    const systemNameIndex = findIndexByIncludes(['nom du systeme', 'systeme', 'système']);
    const geoReachIndex = findIndexByIncludes(['portee geographique', 'portée geographique']);
    const ipsTypeIndex = findIndexByIncludes(["type d'ips", 'type dips', 'ips']);

    if (systemNameIndex === -1) {
      this.logger.error(
        '[FrenchfetchAndSyncVolumeData] ❌ Could not find "Nom du système" header. Headers found:',
        headersNorm,
      );
      return;
    }

    this.logger.debug(
      `[FrenchfetchAndSyncVolumeData] Found indices — systemNameIndex: ${systemNameIndex}, geoReachIndex: ${geoReachIndex}, ipsTypeIndex: ${ipsTypeIndex}`,
    );

    // --- Detect year-specific columns dynamically ---
    const yearColumns: Record<number, number> = {};

    // ✅ Match "Volumes 2020 Transactions IPS" or "Volume 2020 Transactions IPS"
    const yearRegex = /volumes?\s*(\d{4})\s*transactions\s*ips/i;

    headersNorm.forEach((h, idx) => {
      const match = h.match(yearRegex);
      if (match) {
        const year = parseInt(match[1], 10);
        yearColumns[year] = idx;
      }
    });

    if (Object.keys(yearColumns).length === 0) {
      this.logger.warn(
        '[FrenchfetchAndSyncVolumeData] ⚠️ No year columns matched. Check header patterns:',
        headersNorm,
      );
    } else {
      this.logger.log(
        `[FrenchfetchAndSyncVolumeData] 📅 Found Volumes IPS Transactions columns for years: ${Object.keys(yearColumns).join(', ')}`,
      );
    }

    const dataRows = rows.slice(1);
    const ops: any[] = [];

    // --- Process each row ---
    for (const [i, row] of dataRows.entries()) {
      const systemName = (row[systemNameIndex] || '').toString().trim();
      if (!systemName) {
        this.logger.debug(`[Row ${i + 3}] Skipped (no system name).`);
        continue;
      }

      const doc: any = {
        systemName,
        geographicReach: geoReachIndex !== -1 ? (row[geoReachIndex] || '').toString().trim() : '',
        ipsType: ipsTypeIndex !== -1 ? (row[ipsTypeIndex] || '').toString().trim() : '',
      };

      for (const [yearStr, idx] of Object.entries(yearColumns)) {
        const raw = row[idx];
        if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
          const num = Number(String(raw).replace(/,/g, '').trim());
          doc[`volumes${yearStr}`] = isNaN(num) ? null : num;
        } else {
          doc[`volumes${yearStr}`] = null;
        }
      }

      ops.push({
        updateOne: {
          filter: { systemName: doc.systemName },
          update: { $set: doc },
          upsert: true,
        },
      });

      if (i < 5) {
        this.logger.debug(`[FrenchfetchAndSyncVolumeData] Sample doc row ${i + 3}: ${JSON.stringify(doc)}`);
      }
    }

    if (ops.length === 0) {
      this.logger.log('[FrenchfetchAndSyncVolumeData] No data rows to upsert.');
      return;
    }

    const bulkRes = await this.frenchvolumeDataModel.bulkWrite(ops);
    this.logger.log(`[FrenchfetchAndSyncVolumeData] ✅ Volume data synced successfully. bulkWrite result: ${JSON.stringify(bulkRes)}`);
  } catch (error) {
    this.logger.error('[FrenchfetchAndSyncVolumeData] ❌ Error fetching Volume Data from Google Sheets', error);
  }
}

  /////////////////////////////////FRENCH VALUE DATA///////////////////////////////
  /////////////////////////////////FRENCH VALUE DATA///////////////////////////////
  /////////////////////////////////FRENCH VALUE DATA///////////////////////////////
async FrenchfetchAndSyncValueData() {
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
    const range = 'Données en valeur ($US 2022)!A3:ZZ';

    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = res.data.values;

    if (!rows || rows.length === 0) {
      this.logger.warn('No Value Data found.');
      return;
    }

    const headers = rows[0];

    // ✅ Normalize headers properly (keep accents consistent and lowercase)
    const normalize = (h?: string) =>
      (h || '')
        .normalize('NFD') // Split accented characters
        .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    const headersNorm = headers.map(normalize);

    this.logger.log('🔎 Headers found (normalized):', headersNorm);

    // Helper to find indexes by normalized header
    const findIndexByIncludes = (targets: string[]) =>
      headersNorm.findIndex((h) => targets.some(t => h.includes(t)));

    const systemNameIndex = findIndexByIncludes(['nom du systeme', 'systeme', 'système']);
    const geoReachIndex = findIndexByIncludes(['portee geographique', 'portée geographique']);
    const ipsTypeIndex = findIndexByIncludes(["type d'ips", 'type dips', 'ips']);
    const exchangeRateIndex = headersNorm.findIndex((h) => h.startsWith('taux de change'));

    if (systemNameIndex === -1) {
      this.logger.error('❌ Could not find "System name" column.');
      this.logger.error('Headers found:', headers);
      return;
    }

    const yearColumns: Record<number, number> = {};
    const yearRegex = /valeur\s*\(\$us\)\s*(\d{4})\s*transactions\s*ips/i;

    headersNorm.forEach((h, idx) => {
      const match = h.match(yearRegex);
      if (match) {
        const year = parseInt(match[1], 10);
        yearColumns[year] = idx;
      }
    });

    this.logger.log(
      `📅 Found Value($US) IPS Transactions columns for years: ${
        Object.keys(yearColumns).join(', ') || 'none'
      }`,
    );

    const dataRows = rows.slice(1);
    const ops: any[] = [];

    for (const row of dataRows) {
      const systemName = (row[systemNameIndex] || '').toString().trim();
      if (!systemName) continue;

      const doc: any = {
        systemName,
        geographicReach: geoReachIndex !== -1 ? (row[geoReachIndex] || '').toString().trim() : '',
        ipsType: ipsTypeIndex !== -1 ? (row[ipsTypeIndex] || '').toString().trim() : '',
        exchangeRate: exchangeRateIndex !== -1 ? (row[exchangeRateIndex] || '').toString().trim() : '',
      };

      for (const [year, idx] of Object.entries(yearColumns)) {
        const val = row[idx];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const num = Number(String(val).replace(/,/g, '').trim());
          doc[`values${year}`] = isNaN(num) ? null : num;
        } else {
          doc[`values${year}`] = null;
        }
      }

      ops.push({
        updateOne: {
          filter: { systemName: doc.systemName },
          update: { $set: doc },
          upsert: true,
        },
      });
    }

    if (ops.length === 0) {
      this.logger.log('No Value Data rows to upsert.');
      return;
    }

    const bulkRes = await this.frenchvalueDataModel.bulkWrite(ops);
    this.logger.log(`✅ Value Data synced. bulkWrite result: ${JSON.stringify(bulkRes)}`);
  } catch (error) {
    this.logger.error('❌ Error fetching Value Data from Google Sheets', error);
  }
}


}


