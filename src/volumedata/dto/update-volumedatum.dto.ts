import { PartialType } from '@nestjs/swagger';
import { CreateVolumedatumDto } from './create-volumedatum.dto';

export class UpdateVolumedatumDto extends PartialType(CreateVolumedatumDto) {}
