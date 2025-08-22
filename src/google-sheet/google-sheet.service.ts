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
    const range = '2025 data!A1:AZ'; // adjust range if needed

    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = res.data.values;

    if (!rows || rows.length < 2) {
      this.logger.warn('No data found in the sheet.');
      return;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Map sheet headers to schema field names
    const headerMap: Record<string, string> = {
      'IPS type': 'ipsType',
      'Governance typology (Industry, PPP, Central Bank led)': 'governanceTypology',
      // Add more mappings if required
    };

    for (const row of dataRows) {
      const rowData: any = {};
      headers.forEach((header, index) => {
        const normalizedHeader = headerMap[header] || this.camelCase(header);
        rowData[normalizedHeader] = row[index] || '';
      });

      // Use systemName as unique identifier for upsert
      await this.generalDataModel.updateOne(
        { systemName: rowData.systemName },
        { $set: rowData },
        { upsert: true }
      );
    }

    this.logger.log(`Synced ${dataRows.length} rows from Google Sheets.`);
  } catch (error) {
    this.logger.error('Error fetching data from Google Sheets', error);
  }
}

  // async fetchAndSyncGeneralData() {
  //   try {

  //     const credentials = JSON.parse(
  //       fs.readFileSync(
  //         path.resolve(
  //           __dirname,
  //           '../../../config/authentication-411609-dcd87bcd1c0b.json',
  //         ),
  //         'utf8',
  //       ),
  //     );

  //     const auth = new google.auth.GoogleAuth({
  //       credentials,
  //       scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  //     });

  //     const sheets = google.sheets({ version: 'v4', auth });

  //     const spreadsheetId = '1VBLgF2JRCHh4RKPHhTB66yCD-Zc5Ru0wCxX3ZEDtTR0';
  //     const range = '2025 data!A1:AZ'; // adjust columns range

  //     const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  //     const rows = res.data.values;

  //     if (!rows || rows.length < 2) {
  //       this.logger.warn('No data found in the sheet.');
  //       return;
  //     }

  //     const headers = rows[0];
  //     const dataRows = rows.slice(1);

  //     for (const row of dataRows) {
  //       const rowData: any = {};
  //       headers.forEach((header, index) => {
  //         rowData[this.camelCase(header)] = row[index] || '';
  //       });

  //       // Use systemName as unique identifier for upsert
  //       await this.generalDataModel.updateOne(
  //         { systemName: rowData.systemName },
  //         { $set: rowData },
  //         { upsert: true }
  //       );
  //     }

  //     this.logger.log(`Synced ${dataRows.length} rows from Google Sheets.`);
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


