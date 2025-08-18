import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { GoogleSheetService } from './google-sheet.service';
import { CreateGoogleSheetDto } from './dto/create-google-sheet.dto';
import { UpdateGoogleSheetDto } from './dto/update-google-sheet.dto';

@Controller('google-sheet')
export class GoogleSheetController {
  constructor(private readonly googleSheetService: GoogleSheetService) {}
}
