import { BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios, { type AxiosResponse } from 'axios';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import { AES, enc } from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import { FindManyOptions, Repository } from 'typeorm';
import {
  BaseResponseTypeDTO,
  PaginationRequestType,
  PaginationResponseType,
} from './utils.types';
import fetch, { Headers, Response, Request } from 'node-fetch';

dotenv.config();

const logger = new Logger('UtilFunctions');

export const encryptData = <T>(rawData: T, encryptionKey: string): string => {
  let data: any = rawData;
  if (typeof rawData !== 'string') {
    data = JSON.stringify(rawData);
  }
  return AES.encrypt(data, encryptionKey).toString();
};

export const decryptData = (
  encryptedData: string,
  encryptionKey: string,
): string => AES.decrypt(encryptedData, encryptionKey).toString(enc.Utf8);

export const generateUniqueKey = (length = 5) =>
  (uuidv4() as string).slice(0, length);

export const arrayIncludesAny = <T>(arr: T[], values: T[]) =>
  values.some((v) => arr.includes(v));

export const generateUniqueCode = (length = 4): string =>
  (uuidv4() as string).substring(0, length);

export const compareEnumValues = (value: string, checkAgainst: string[]) => {
  return checkAgainst.includes(value);
};

export const compareEnumValueFields = (
  value: string,
  checkAgainst: string[],
  fieldName?: string,
): void => {
  if (!compareEnumValues(value, checkAgainst)) {
    const message = `Field '${
      fieldName ?? value
    }' Can only contain values: ${checkAgainst}`;
    throw new BadRequestException(message);
  }
};

export const checkForRequiredFields = (
  requiredFields: string[],
  requestPayload: any,
): void => {
  const missingFields = requiredFields.filter(
    (field: string) =>
      Object.keys(requestPayload).indexOf(field) < 0 ||
      Object.values(requestPayload)[
        Object.keys(requestPayload).indexOf(field)
      ] === '',
  );
  if (missingFields.length) {
    throw new BadRequestException(
      `Missing required field(s): '${[...missingFields]}'`,
    );
  }
};

export const validateEmailField = (email: string): void => {
  if (!validateEmail(email)) {
    throw new BadRequestException('Field email has invalid format');
  }
};

export const hashPassword = async (rawPassword: string): Promise<string> => {
  return await new Promise((resolve, reject) => {
    bcrypt.hash(rawPassword, 10, (err, hash) => {
      if (err) {
        reject(err);
      }
      resolve(hash);
    });
  });
};

export const verifyPasswordHash = async (
  rawPassword: string,
  encryptedPassword: string,
): Promise<string> => {
  return await new Promise((resolve, reject) => {
    bcrypt.compare(rawPassword, encryptedPassword, (err, passwordMatch) => {
      if (err) {
        reject(err);
      }
      resolve(passwordMatch);
    });
  });
};


export const uploadFileToS3 = async (
  filePath: string,
  deleteAfterUpload = false,
): Promise<string> => {
  try {

    const s3Client = new S3Client({
      region: String(process.env.AWS_REGION).trim(), // Replace with your desired AWS region
      credentials: {
        accessKeyId: String(process.env.AWS_ACCESS_KEY_ID).trim(),
        secretAccessKey: String(process.env.AWS_SECRET_ACCESS_KEY).trim(),
      },
    });
    const createdReadStream = fs.createReadStream(filePath);
    const s3UploadParams = {
      Bucket: String(process.env.AWS_BUCKET_NAME).trim(),
      Key: `${String(process.env.AWS_KEY_NAME).trim()}/${filePath}`,
      Body: Readable.from(createdReadStream),
      ACL: 'public-read',
    };
    const upload = new Upload({
      client: s3Client,
      params: s3UploadParams,
    });
    const result = await upload.done();
    if (result && deleteAfterUpload) {
      fs.unlinkSync(filePath);
    }
    return result['Location'];
  } catch (ex) {
    logger.error(ex);
    throw ex;
  }
};

// export const uploadFileToS3 = async (s
//   filePath: string,
//   deleteAfterUpload = false,
// ): Promise<string> => {
//   try {

//     const s3Client = new S3Client({
//       region: 'eu-north-1', // Replace with your desired AWS region
//       credentials: {
//         accessKeyId: String(process.env.AWS_ACCESS_KEY_ID).trim(),
//         secretAccessKey: String(process.env.AWS_SECRET_ACCESS_KEY).trim(),
//       },
//     });
//     const createdReadStream = fs.createReadStream(filePath);
//     const s3UploadParams = {
//       Bucket: String(process.env.AWS_BUCKET_NAME).trim(),
//       Key: `${String(process.env.AWS_KEY_NAME).trim()}/${filePath}`,
//       Body: Readable.from(createdReadStream),
//       ACL: 'public-read',
//     };
//     const upload = new Upload({
//       client: s3Client,
//       params: s3UploadParams,
//     });
//     const result = await upload.done();
//     if (result && deleteAfterUpload) {
//       fs.unlinkSync(filePath);
//     }
//     return result['Location'];
//   } catch (ex) {
//     logger.error(ex);
//     throw ex;
//   }
// };

export const removeKeyFromObject = (obj: any, keys: string[]): any => {
  for (const prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      switch (typeof obj[prop]) {
        case 'object':
          if (keys.indexOf(prop) > -1) {
            delete obj[prop];
          } else {
            //? this handle nested objects
            //? throws Range call stack exceed error
            //? Todo, find a fix for this
            removeKeyFromObject(obj[prop], keys);
          }
          break;
        default:
          if (keys.indexOf(prop) > -1) {
            delete obj[prop];
          }
          break;
      }
    }
  }
  return obj;
};

export const convertEnumToArray = <T, U>(enumData: U): T[] =>
  Object.values(enumData);

export const shuffleArray = <T>(array: T[]): T[] => {
  return array.length > 0 ? array.sort(() => Math.random() - 0.5) : array;
};

export const groupBy = <T>(list: T[], key: string): any => {
  return list.reduce(function (rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

export const validateURL = (url: string): boolean => {
  const regEx =
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
  return regEx.test(url);
};

export const validateURLField = (url: string, field = 'url'): void => {
  if (!validateURL(url)) {
    throw new BadRequestException(`Field '${field}' has invalid url format`);
  }
};

export const validateEmail = (email: string): boolean => {
  const regExp =
    /^[a-zA-Z0-9.!#$%&’*+\/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  return regExp.test(email);
};

export const calculatePaginationControls = async <T>(
  repository: Repository<T>,
  options: FindManyOptions<T>,
  payload: PaginationRequestType,
): Promise<{ paginationControl: PaginationResponseType; response: T[] }> => {
  const [response, total] = await repository.findAndCount(options);
  return {
    paginationControl: {
      totalPages: Math.ceil(total / payload?.pageSize),
      currentPage: payload?.pageNumber,
      pageSize: payload?.pageSize,
      hasNext: payload?.pageNumber < Math.ceil(total / payload?.pageSize),
      hasPrevious: payload?.pageNumber > 1,
      totalCount: total,
    },
    response,
  };
};

export const calculatePagination = <T>(
  fullArrayItems: T[],
  payload: PaginationRequestType,
): { paginationControl: PaginationResponseType; response: T[] } => {
  const total = fullArrayItems.length ?? 0;
  const response = fullArrayItems.slice(
    (payload.pageNumber - 1) * payload.pageSize,
    payload.pageNumber * payload.pageSize,
  );
  return {
    paginationControl: {
      totalPages: Math.ceil(total / payload?.pageSize),
      currentPage: payload?.pageNumber,
      pageSize: payload?.pageSize,
      hasNext: payload?.pageNumber < Math.ceil(total / payload?.pageSize),
      hasPrevious: payload?.pageNumber > 1,
      totalCount: total,
    },
    response,
  };
};

export const createLogFile = (path: string): void => {
  const pathSegments = path.split('/');
  if (pathSegments?.length <= 1) {
    if (!fs.existsSync(path)) {
      fs.writeFileSync(path, '');
    }
  } else {
    const dir = pathSegments.slice(0, pathSegments.length - 1).join('/');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(path)) {
      fs.writeFileSync(path, '');
    }
  }
};

export const saveLogToFile = (error: any) => {
  try {
    const fileName = 'logs/response-log.txt';
    createLogFile(fileName);

    const errorData = typeof error === 'object' ? JSON.stringify(error) : error;
    const file = fs.createWriteStream(fileName, { flags: 'a' });
    const formattedData = `
      ========${new Date().toISOString()}=============\n
      ${errorData}
      ===============================================\n
    `;
    file.write(formattedData);
  } catch (ex) {
    throw ex;
  }
};

// Set up global fetch for Resend compatibility
// if (!global.fetch) {
//   global.fetch = fetch as unknown as typeof global.fetch;
//   global.Headers = Headers as unknown as typeof global.Headers;
//   global.Response = Response as unknown as typeof global.Response;
//   global.Request = Request as unknown as typeof global.Request;
// }

// Initialize the Resend instance with API key
// const resend = new Resend(process.env.RENDEREMAIL_API_KEY);

// export async function sendRenderEmail(
//   // recipient: string[],
//   // subject: string,
//   // message: string,
//   html: string,
//   subject: string,
//   recipientEmails: string[],
// ): Promise<any> {
//   try {
//     const { data, error } = await resend.emails.send({
//       from: 'Kai <hey@adswswsmin.kswswsaijego.com>',
//       to: recipientEmails,
//       subject: subject,
//       html: html,
//     });

//     if (error) {
//       console.error('Error sending email:', error);
//       throw new HttpException(
//         { message: 'Failed to send email', error },
//         HttpStatus.BAD_REQUEST,
//       );
//     }

//     return data;
//   } catch (error) {
//     console.error('Internal Server Error:', error);
//     throw new HttpException(
//       { message: 'Internal Server Error', error },
//       HttpStatus.INTERNAL_SERVER_ERROR,
//     );
//   }
// }

export const sendEmail = async (
  html: string,
  subject: string,
  recipientEmails: string[],
  // attachments?: EmailAttachmentDTO[],
): Promise<BaseResponseTypeDTO> => {
  const serverHost = 'smtp.gmail.com';
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: serverHost,
    port: 465,
    auth: {
      user: process.env.EMAIL_ADMIN,
      pass: process.env.EMAIL_PASS,
    },
  });
  console.log(process.env.EMAIL_ADMIN)
  console.log(recipientEmails)
  const mailOptions: any = {
    // from: `"Golden Rdp App" <${process.env.EMAIL_ADMIN}>`,
    from: `${process.env.EMAIL_ADMIN}`,
    to: recipientEmails.join(','),
    subject,
    html,
  };
  // if (attachments?.length > 0) {
  //   mailOptions.attachments = attachments;
  // }
  try {
    const response: any = await new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          reject(error);
        }
        resolve(info);
      });
    });
    if (response?.messageId) {
      return {
        message: `Nodemailer sent message: ${response.messageId}`,
        code: HttpStatus.OK,
        success: true,
      };
    }
  } catch (ex) {
    logger.error(ex);
    // console.log(ex)
    return {
      success: false,
      message: 'Email not sent',
      code: HttpStatus.BAD_GATEWAY,
    };
  }
};

// export const sendEmail = async (
//   html: string,
//   subject: string,
//   recipientEmails: string[],
// ): Promise<BaseResponseTypeDTO> => {
//   const serverHost = 'smtp.gmail.com';
//   // eslint-disable-next-line @typescript-eslint/no-var-requires
//   const nodemailer = require('nodemailer');
//   const transporter = nodemailer.createTransport({
//     host: 'mail.privateemail.com',
//     port: 587,
//     secure: false,
//     // host: serverHost,
//     // port: 465,
//     auth: {
//       user: process.env.EMAIL_ADMIN,
//       pass: process.env.EMAIL_PASS,
//     },
//     // tls: {
//     //   rejectUnauthorized: false
//     // }
//   });
//   const mailOptions = {
//     from: `"Jupita Academy" <${process.env.EMAIL_ADMIN}>`,
//     to: recipientEmails.join(','),
//     subject,
//     html,
//   };

//   try {
//     const response: any = await new Promise((resolve, reject) => {
//       transporter.sendMail(mailOptions, (error, info) => {
//         if (error) {
//           reject(error);
//         }
//         resolve(info);
//       });
//     });
//     if (response?.messageId) {
//       return {
//         message: `Nodemailer sent message: ${response.messageId}`,
//         code: HttpStatus.OK,
//         success: true,
//       };
//     }
//   } catch (ex) {
//     logger.error(ex);
//     return {
//       success: false,
//       message: 'Email not sent',
//       code: HttpStatus.BAD_GATEWAY,
//     };
//   }
// };

export const validateUUID = (uuid: string): boolean => {
  const regExp =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return regExp.test(uuid);
};

export const validateUUIDField = (uuid: string, field = 'id'): void => {
  if (!validateUUID(uuid)) {
    throw new BadRequestException(`Field ${field} has invalid UUID format`);
  }
};

export const countWords = (text: string): number => text.split(' ').length ?? 0;

export const findMatchInArray = (
  arrayOne: string[],
  arrayTwo: string[],
  filter: 'IN' | 'NOT_IN',
): string[] => {
  const mergedArray = [];
  // for array1
  if (filter === 'IN') {
    for (const i in arrayOne) {
      if (arrayTwo.indexOf(arrayOne[i]) !== -1) mergedArray.push(arrayOne[i]);
    }
  } else {
    for (const i in arrayOne) {
      if (arrayTwo.indexOf(arrayOne[i]) === -1) mergedArray.push(arrayOne[i]);
    }
  }
  return mergedArray.sort((x, y) => x - y);
};

/**
 *
 * @param coords1 [longitude, latitude]
 * @param coords2 [longitude, latitude]
 * @returns Number
 */
export const haversineDistance = (
  coords1: number[],
  coords2: number[],
): number => {
  const toRad = (x) => (x * Math.PI) / 180;

  const lon1 = coords1[0];
  const lat1 = coords1[1];

  const lon2 = coords2[0];
  const lat2 = coords2[1];

  const R = 6371; // km

  const x1 = lat2 - lat1;
  const dLat = toRad(x1);
  const x2 = lon2 - lon1;
  const dLon = toRad(x2);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  return Number(d);
};

// console.log(haversineDistance([-73.935242, 40.73061], [-73.934142, 40.731642]));

export const countPattern = (str: string, pattern: RegExp): number => {
  let count = 0;
  let match;
  while ((match = pattern.exec(str)) !== null) {
    count += 1;
  }
  return count;
};

export const findMatchingPattern = (str: string, pattern: RegExp): string[] => {
  let count = 0;
  let match;
  const matchedExp = [];
  while ((match = pattern.exec(str)) !== null) {
    matchedExp.push(match[0]);
    count += 1;
  }
  return matchedExp;
};

export const findFileExtension = (url: string): string => {
  const lastPath = url.split('/').pop();
  if (lastPath?.includes('.')) {
    const [, ext] = lastPath.split('.');
    return ext;
  }
};

export const httpGet = async <T>(url: string, headers = {}): Promise<T> => {
  const response: AxiosResponse = await axios.get(url, { headers });
  return response.data as T;
};

export const httpPost = async <U, T>(
  url: string,
  payload: T,
  headers = {},
): Promise<U> => {
  const response: AxiosResponse = await axios.post(url, payload, { headers });
  return response.data as U;
};

export const httpPatch = async <U, T>(
  url: string,
  payload: T,
  headers = {},
): Promise<U> => {
  const response: AxiosResponse = await axios.patch(url, payload, { headers });
  return response.data as U;
};

export const httpDelete = async <U>(url: string, headers = {}): Promise<U> => {
  const response: AxiosResponse = await axios.delete(url, { headers });
  return response.data as U;
};

export const appendPrefixToString = (prefix: string, word: string): string =>
  word.startsWith(prefix) ? word : `${prefix}${word}`;
