import { PartialType } from '@nestjs/swagger';
import { CreateGeneraldatumDto } from './generaldatum.dto';

export class UpdateGeneraldatumDto extends PartialType(CreateGeneraldatumDto) {}
