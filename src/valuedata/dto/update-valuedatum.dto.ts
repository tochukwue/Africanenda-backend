import { PartialType } from '@nestjs/swagger';
import { CreateValuedatumDto } from './create-valuedatum.dto';

export class UpdateValuedatumDto extends PartialType(CreateValuedatumDto) {}
