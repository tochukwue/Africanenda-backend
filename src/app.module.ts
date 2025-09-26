import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MulterModule } from '@nestjs/platform-express';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { VolumedataModule } from './volumedata/volumedata.module';
import { ValuedataModule } from './valuedata/valuedata.module';
import { IpslistModule } from './ipslist/ipslist.module';
import { GeneraldataModule } from './generaldata/generaldata.module';
import { GoogleSheetModule } from './google-sheet/google-sheet.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { UserModule } from './user/user.module';




@Module({
  imports: [
    MulterModule.register({ dest: './uploads' }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({ ttl: 60, limit: 40 }),
    // MongooseModule.forRoot(String(process.env.MONGODB_URL).trim()),
    // MongooseModule.forRoot("mongodb+srv://monumentaleworks:Z5fFLVBTsFA7bQPm@adficluster.nqi19.mongodb.net/africanenda?retryWrites=true&w=majority&appName=ADFICluster"),
    VolumedataModule,
    ValuedataModule,
    IpslistModule,
    GeneraldataModule,
    GoogleSheetModule,
    AnalyticsModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
