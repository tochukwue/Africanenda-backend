import { PartialType } from '@nestjs/swagger';
import { CreateGoogleSheetDto } from './create-google-sheet.dto';

export class UpdateGoogleSheetDto extends PartialType(CreateGoogleSheetDto) {}
