import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { google } from 'googleapis';
import { GeneralData, GeneralDataDocument } from 'src/generaldata/schema/generaldatum.schema';
import * as path from 'path';
import * as fs from 'fs';
import { VolumeData, VolumeDataDocument } from 'src/volumedata/schema/volumedatum.schema';
import { ValueData, ValueDataDocument } from 'src/valuedata/schema/valuedatum.schema';

@Injectable()
export class GoogleSheetService {
  private readonly logger = new Logger(GoogleSheetService.name);

  constructor(
    @InjectModel(GeneralData.name) private generalDataModel: Model<GeneralDataDocument>,
    @InjectModel(VolumeData.name)
    private readonly volumeDataModel: Model<VolumeDataDocument>,

    @InjectModel(ValueData.name)
    private readonly valueDataModel: Model<ValueDataDocument>,
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

    /** ✅ First: Sync "2025 data" sheet with enhanced debugging */
    const rangeMain = '2025 data!A:ZZ'; // Use entire columns instead of limited range
    
    // Try multiple approaches to get the data
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
      },
      {
        name: 'FORMULA',
        params: {
          spreadsheetId,
          range: rangeMain,
          valueRenderOption: 'FORMULA',
          dateTimeRenderOption: 'FORMATTED_STRING'
        }
      }
    ];

    let rowsMain = null;
    let bestApproach = null;

    // Try different value render options to see which gives us complete data
    for (const approach of approaches) {
      try {
        this.logger.log(`Trying approach: ${approach.name}`);
        const resMain = await sheets.spreadsheets.values.get(approach.params);
        const testRows = resMain.data.values;
        
        if (testRows && testRows.length > 1) {
          // Test if this approach gives us more complete data
          let maxCellLength = 0;
          let longestCell = '';
          
          testRows.slice(1, 6).forEach((row, rowIndex) => { // Check first 5 data rows
            row.forEach((cell, cellIndex) => {
              if (cell != null) {
                const cellStr = String(cell);
                if (cellStr.length > maxCellLength) {
                  maxCellLength = cellStr.length;
                  longestCell = cellStr;
                }
              }
            });
          });
          
          this.logger.log(`${approach.name} - Longest cell: ${maxCellLength} chars - "${longestCell.substring(0, 100)}${longestCell.length > 100 ? '...' : ''}"`);
          
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

    this.logger.log(`Using best approach: ${bestApproach.approach} with max cell length: ${bestApproach.maxLength}`);
    rowsMain = bestApproach.data;

    if (!rowsMain || rowsMain.length < 2) {
      this.logger.warn('No data found in "2025 data" sheet.');
    } else {
      const headersMain = rowsMain[0];
      const dataRowsMain = rowsMain.slice(1);

      this.logger.log(`Headers found: ${headersMain.length}`);
      this.logger.log(`Data rows found: ${dataRowsMain.length}`);

      // Log all headers for debugging
      headersMain.forEach((header, index) => {
        if (header && String(header).toLowerCase().includes('type')) {
          this.logger.log(`Header ${index}: "${header}"`);
        }
      });

      const headerMap: Record<string, string> = {
        'ips type': 'ipsType',
        'governance typology (industry, ppp, central bank led)': 'governanceTypology',
        'api use function': 'apiUseFunction',
        'third party connections enabled (y/n)': 'thirdPartyConnectionsEnabled',
        'real-time payment confirmation message enabled (y/n)': 'realTimePaymentConfirmation',
        'pull "request to pay" enabled (y/n)': 'pullRequestToPayEnabled',
        // "governance typology (industry, ppp, central bank led)": "governanceTypology"
      };

      for (let i = 0; i < Math.min(dataRowsMain.length, 1000); i++) { // Limit to 1000 rows for safety
        const row = dataRowsMain[i];
        
        // Skip completely empty rows
        if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
          continue;
        }
        
        const rowData: any = {};

        headersMain.forEach((header, index) => {
          if (!header) return; // Skip empty headers
          
          const cleanedHeader = String(header).trim().toLowerCase();
          const normalizedHeader = headerMap[cleanedHeader] || this.camelCase(cleanedHeader);
          
          // Safely convert to string and handle null/undefined values
          const rawValue = (index < row.length) ? row[index] : '';
          const cellValue = rawValue != null ? String(rawValue).trim() : '';
          
          // Enhanced debugging for comma-separated values and specific patterns
          if (cellValue && cellValue.includes(',')) {
            this.logger.log(`Row ${i + 1}, Column "${cleanedHeader}": FULL VALUE = "${cellValue}"`);
            this.logger.log(`Row ${i + 1}, Column "${cleanedHeader}": LENGTH = ${cellValue.length} chars`);
            
            // Check if it contains the pattern we're looking for
            if (cellValue.includes('P2P') || cellValue.includes('B2B') || cellValue.includes('Cross border')) {
              this.logger.log(`🎯 FOUND TARGET PATTERN in row ${i + 1}: "${cellValue}"`);
            }
          }
          
          // Look for truncation indicators
          if (cellValue.endsWith('...') || cellValue.endsWith('…')) {
            this.logger.warn(`⚠️  POSSIBLE TRUNCATION detected in row ${i + 1}, column "${cleanedHeader}": "${cellValue}"`);
          }
          
          rowData[normalizedHeader] = cellValue;
        });

        // Only process rows with system names
        if (!rowData.systemName || String(rowData.systemName).trim() === '') {
          continue;
        }

        // Log complete row data for first few rows to debug
        if (i < 3) {
          this.logger.log(`Sample row ${i + 1} data:`, JSON.stringify(rowData, null, 2));
        }

        await this.generalDataModel.updateOne(
          { systemName: rowData.systemName },
          { $set: rowData },
          { upsert: true }
        );
      }

      this.logger.log(`Synced ${dataRowsMain.length} rows from "2025 data" sheet.`);
    }

    /** ✅ Second: Sync "Inclusivity Spectrum Analysis" sheet */
    const rangeInclusivity = 'Inclusivity Spectrum Analysis!A:ZZ'; // Use entire columns
    
    const resInclusivity = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rangeInclusivity,
      valueRenderOption: bestApproach.approach, // Use the same approach that worked best
      dateTimeRenderOption: 'FORMATTED_STRING'
    });

    const rowsInclusivity = resInclusivity.data.values;

    if (!rowsInclusivity || rowsInclusivity.length < 6) {
      this.logger.warn('No data found in "Inclusivity Spectrum Analysis" sheet.');
    } else {
      this.logger.log(`Inclusivity sheet total rows: ${rowsInclusivity.length}`);
      
      // Check if row 4 (index 4) exists and has headers
      if (rowsInclusivity.length <= 4) {
        this.logger.error('Inclusivity Spectrum Analysis sheet does not have enough rows for headers at row 5 (index 4)');
        return;
      }

      const headersInc = rowsInclusivity[4]; // Headers are at row 5 (index 4)
      const dataRowsInc = rowsInclusivity.slice(5); // Data starts from row 6 (index 5)

      this.logger.log(`Inclusivity headers: ${JSON.stringify(headersInc.slice(0, 10))}`);
      this.logger.log(`Inclusivity data rows: ${dataRowsInc.length}`);

      // Find system name column with more flexible matching
      const systemNameIndex = headersInc.findIndex(h => {
        if (h == null) return false;
        const headerStr = String(h).trim().toLowerCase();
        return headerStr === 'system name' || headerStr === 'systemname' || headerStr.includes('system');
      });

      // Find all status columns with more flexible matching
      const statusIndexes = headersInc
        .map((h, i) => {
          if (h == null) return -1;
          const headerStr = String(h).trim().toLowerCase();
          return (headerStr === 'status' || headerStr.includes('status')) ? i : -1;
        })
        .filter(i => i !== -1);

      this.logger.log(`System name column index: ${systemNameIndex}`);
      this.logger.log(`Status column indexes: ${JSON.stringify(statusIndexes)}`);

      if (systemNameIndex === -1) {
        this.logger.error('"System name" column not found in Inclusivity Spectrum Analysis sheet.');
        this.logger.log('Available headers:', headersInc.map((h, i) => `${i}: "${h}"`));
        return;
      }

      if (statusIndexes.length === 0) {
        this.logger.error('"Status" column not found in Inclusivity Spectrum Analysis sheet.');
        this.logger.log('Available headers:', headersInc.map((h, i) => `${i}: "${h}"`));
        return;
      }

      const statusIndex = statusIndexes[0]; // Use the first status column

      let updatedCount = 0;
      let processedCount = 0;
      
      for (let i = 0; i < dataRowsInc.length; i++) {
        const row = dataRowsInc[i];
        
        // Skip completely empty rows
        if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
          continue;
        }
        
        // Ensure row has enough columns
        if (row.length <= Math.max(systemNameIndex, statusIndex)) {
          this.logger.warn(`Row ${i + 6} is too short:`, JSON.stringify(row));
          continue;
        }

        // Safely convert to string
        const systemName = row[systemNameIndex] != null ? String(row[systemNameIndex]).trim() : '';
        const statusValue = row[statusIndex] != null ? String(row[statusIndex]).trim() : '';

        if (!systemName) {
          continue;
        }

        processedCount++;
        
        if (processedCount <= 5) { // Log first few for debugging
          this.logger.log(`Processing system: "${systemName}" with status: "${statusValue}"`);
        }

        const updateResult = await this.generalDataModel.updateOne(
          { systemName },
          { $set: { inclusivityRanking: statusValue || '' } },
          { upsert: false }
        );

        if (updateResult.matchedCount > 0) {
          updatedCount++;
        } else if (processedCount <= 10) { // Log first few mismatches
          this.logger.warn(`No matching system found for: "${systemName}"`);
        }
      }

      this.logger.log(`Updated inclusivityRanking for ${updatedCount} out of ${processedCount} processed rows from "Inclusivity Spectrum Analysis".`);
    }

  } catch (error) {
    this.logger.error('Error fetching data from Google Sheets:', error.message);
    if (error.stack) {
      this.logger.error('Stack trace:', error.stack);
    }
  }
}
  // async fetchAndSyncGeneralData() {
  //   try {
  //     const credentials = JSON.parse(
  //       fs.readFileSync(
  //         path.resolve(__dirname, '../../../config/authentication-411609-dcd87bcd1c0b.json'),
  //         'utf8'
  //       )
  //     );

  //     const auth = new google.auth.GoogleAuth({
  //       credentials,
  //       scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  //     });

  //     const sheets = google.sheets({ version: 'v4', auth });
  //     const spreadsheetId = '1VBLgF2JRCHh4RKPHhTB66yCD-Zc5Ru0wCxX3ZEDtTR0';

  //     /** ✅ First: Sync "2025 data" sheet */
  //     const rangeMain = '2025 data!A1:AZ';
  //     const resMain = await sheets.spreadsheets.values.get({ spreadsheetId, range: rangeMain });
  //     const rowsMain = resMain.data.values;

  //     if (!rowsMain || rowsMain.length < 2) {
  //       this.logger.warn('No data found in "2025 data" sheet.');
  //     } else {
  //       const headersMain = rowsMain[0];
  //       const dataRowsMain = rowsMain.slice(1);

  //       const headerMap: Record<string, string> = {
  //         'ips type': 'ipsType',
  //         'governance typology (industry, ppp, central bank led)': 'governanceTypology',
  //         'api use function': 'apiUseFunction',
  //         'third party connections enabled (y/n)': 'thirdPartyConnectionsEnabled',
  //         'real-time payment confirmation message enabled (y/n)': 'realTimePaymentConfirmation',
  //         'pull "request to pay" enabled (y/n)': 'pullRequestToPayEnabled',
  //         "Governance typology (Industry, PPP, Central Bank led)" :"governanceTypology"
  //       };

  //       for (const row of dataRowsMain) {
  //         const rowData: any = {};
  //         headersMain.forEach((header, index) => {
  //           const cleanedHeader = header.trim().toLowerCase();
  //           const normalizedHeader = headerMap[cleanedHeader] || this.camelCase(cleanedHeader);
  //           rowData[normalizedHeader] = row[index] || '';
  //         });

  //         await this.generalDataModel.updateOne(
  //           { systemName: rowData.systemName },
  //           { $set: rowData },
  //           { upsert: true }
  //         );
  //       }

  //       this.logger.log(`Synced ${dataRowsMain.length} rows from "2025 data" sheet.`);
  //     }

  //     /** ✅ Second: Sync "Inclusivity Spectrum Analysis" sheet */
  //     const rangeInclusivity = 'Inclusivity Spectrum Analysis!A1:AZ';
  //     const resInclusivity = await sheets.spreadsheets.values.get({ spreadsheetId, range: rangeInclusivity });
  //     const rowsInclusivity = resInclusivity.data.values;

  //     if (!rowsInclusivity || rowsInclusivity.length < 6) {
  //       this.logger.warn('No data found in "Inclusivity Spectrum Analysis" sheet.');
  //     } else {
  //       const headersInc = rowsInclusivity[4];
  //       const dataRowsInc = rowsInclusivity.slice(5);

  //       const systemNameIndex = headersInc.findIndex(h => h.trim().toLowerCase() === 'system name');
  //       const statusIndexes = headersInc
  //         .map((h, i) => (h.trim().toLowerCase() === 'status' ? i : -1))
  //         .filter(i => i !== -1);

  //       if (systemNameIndex === -1 || statusIndexes.length === 0) {
  //         throw new Error('"System name" or "Status" column not found in Inclusivity Spectrum Analysis sheet.');
  //       }

  //       const statusIndex = statusIndexes[0];

  //       for (const row of dataRowsInc) {
  //         const systemName = row[systemNameIndex]?.trim();
  //         const statusValue = row[statusIndex]?.trim();

  //         if (!systemName) continue;

  //         await this.generalDataModel.updateOne(
  //           { systemName },
  //           { $set: { inclusivityRanking: statusValue || '' } },
  //           { upsert: false }
  //         );
  //       }

  //       this.logger.log(`Updated inclusivityRanking for ${dataRowsInc.length} rows from "Inclusivity Spectrum Analysis".`);
  //     }
  //   } catch (error) {
  //     this.logger.error('Error fetching data from Google Sheets', error);
  //   }
  // }




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


  // async fetchAndSyncValueData() {
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
  //     const range = 'Value data ($US 2022)!A3:ZZ'; // header row is 3

  //     const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  //     const rows = res.data.values;

  //     if (!rows || rows.length === 0) {
  //       this.logger.warn('No Value Data found.');
  //       return;
  //     }

  //     const headers = rows[0];

  //     // --- Normalize headers ---
  //     const normalize = (h?: string) =>
  //       (h || '')
  //         .replace(/\n/g, ' ')           // remove newlines
  //         .replace(/\s+/g, ' ')           // collapse spaces
  //         .replace(/[^a-z0-9 ()$]/gi, '') // strip most punctuation except ($)
  //         .trim()
  //         .toLowerCase();

  //     const headersNorm = headers.map(normalize);

  //     const findIndexByNorm = (target: string) =>
  //       headersNorm.findIndex((h) => h === target.toLowerCase());

  //     // locate fixed columns
  //     const systemNameIndex = findIndexByNorm('system name');
  //     const geoReachIndex = findIndexByNorm('geographic reach');
  //     const ipsTypeIndex = findIndexByNorm('ips type');
  //     const exchangeRateIndex = headersNorm.findIndex((h) => h.startsWith('exchange rate'));

  //     if (systemNameIndex === -1) {
  //       this.logger.error('Could not find "System name" column.');
  //       return;
  //     }

  //     // detect all "value($us) <year> ips transactions" columns dynamically
  //     const yearColumns: Record<number, number> = {};
  //     const yearRegex = /^value\(\$us\)\s*(\d{4})\s*ips transactions$/i;

  //     headersNorm.forEach((h, idx) => {
  //       const match = h.match(yearRegex);
  //       if (match) {
  //         const year = parseInt(match[1], 10);
  //         yearColumns[year] = idx;
  //       }
  //     });

  //     this.logger.log(`Found Value($US) IPS Transactions columns for years: ${Object.keys(yearColumns).join(', ') || 'none'}`);

  //     const dataRows = rows.slice(1);
  //     const ops: any[] = [];

  //     for (const row of dataRows) {
  //       const systemName = (row[systemNameIndex] || '').toString().trim();
  //       if (!systemName) continue;

  //       const doc: any = {
  //         systemName,
  //         geographicReach: (geoReachIndex !== -1 ? (row[geoReachIndex] || '').toString().trim() : ''),
  //         ipsType: (ipsTypeIndex !== -1 ? (row[ipsTypeIndex] || '').toString().trim() : ''),
  //         exchangeRate: (exchangeRateIndex !== -1 ? (row[exchangeRateIndex] || '').toString().trim() : ''),
  //       };

  //       for (const [year, idx] of Object.entries(yearColumns)) {
  //         const val = row[idx];
  //         doc[`values${year}`] =
  //           val !== undefined && val !== null && String(val).trim() !== ''
  //             ? String(val).trim()
  //             : null;
  //       }

  //       ops.push({
  //         updateOne: {
  //           filter: { systemName: doc.systemName },
  //           update: { $set: doc },
  //           upsert: true,
  //         },
  //       });
  //     }

  //     if (ops.length === 0) {
  //       this.logger.log('No Value Data rows to upsert.');
  //       return;
  //     }

  //     const bulkRes = await this.valueDataModel.bulkWrite(ops);
  //     this.logger.log(`Value Data synced. bulkWrite result: ${JSON.stringify(bulkRes)}`);
  //   } catch (error) {
  //     this.logger.error('Error fetching Value Data from Google Sheets', error);
  //   }
  // }


}


