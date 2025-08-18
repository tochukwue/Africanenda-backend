import { PartialType } from '@nestjs/swagger';
import { CreateIpslistDto } from './ipslist.dto';

export class UpdateIpslistDto extends PartialType(CreateIpslistDto) {}
