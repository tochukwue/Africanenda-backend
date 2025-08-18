import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { RequestStatus } from './utils.constant';
import { IsInt, IsNotEmpty, Max, Min } from 'class-validator';

export const ApiMessageList = {
  GENERIC_ERROR_MESSAGE: 'An error occured',
  BAD_REQUEST:
    'This request payload, was entered wrongly. Check the Docs for confirmation',
  UNAUTHORIZED_REQUEST: 'You are not authorized to view this resource',
  NOT_FOUND: 'This resource was not found',
  CONFLICT_ERROR_MESSAGE: (field?: string) => {
    const fieldValue = field ? field : 'value';
    return `A conflict occurred. This '${fieldValue}' already exists`;
  },
  GENERIC_SUCCESS_MESSAGE: `Successful`,
  FORBIDDEN_ERROR_MESSAGE: `Activate your account before logging in`,
  BAD_NUMERIC_ERROR_MESSAGE: 'Any numerical data must be > 0',
};

export class DefaultResponseType<T> {
  message: string;
  status: RequestStatus;
  payload?: T;
}

export interface StatusMessageType {
  [key: string]: {
    [key: string]: {
      statusCode: HttpStatus;
      customMessage: string;
      type?: string;
    };
  };
}

export class UpdateHistoryTrackDto {
  @ApiProperty({
    description: 'Submission ID',
    example: '65f2c1a4d2e3f7b9c2a4e5d6',
  })
  @IsNotEmpty()
  submissionId: string;

  @ApiProperty({
    description: 'Index of the history entry to update (1-4)',
    example: 1,
    minimum: 1,
    maximum: 4,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(4)
  historyIndex: number;
}

export class SendEmailDto {
  @ApiProperty()
  html: string;

  @ApiProperty()
  subject: string;
}

export class UpdatePasswordDTO {
  @ApiProperty()
  uniqueVerificationCode: string;

  @ApiProperty()
  newPassword: string;
}

export class BaseResponseTypeDTO {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ enum: HttpStatus, default: HttpStatus.OK })
  code: HttpStatus;

  @ApiProperty()
  message: string;

  data?: any;
}

export class PaginationResponseType {
  @ApiProperty()
  currentPage: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  hasPrevious: boolean;

  @ApiProperty()
  hasNext: boolean;
}

export class PaginationRequestType {
  @ApiProperty()
  pageNumber: number;

  @ApiProperty()
  pageSize: number;
}

export class EmailInputType {
  html: string;
  subject: string;
  recipientEmail: string;
  recipientName?: string;
}

export class MailJetEmailInputType {
  html: string;
  text: string;
  subject: string;
  recipientEmail: string;
  recipientName: string;
}

export class FileResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [String] })
  data: string[];
}
