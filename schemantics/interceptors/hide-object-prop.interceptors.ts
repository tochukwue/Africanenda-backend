import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
  } from '@nestjs/common';

  import { Observable } from 'rxjs';
  import { map } from 'rxjs/operators';
import { removeKeyFromObject } from 'utils/utils.function';

  
  @Injectable()
  export class HideObjectPropertyInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      console.log();
      return next
        .handle()
        .pipe(map((value) => removeKeyFromObject(value, ['logger', 'password','uniqueVerificationCode'])));
    }
  }
  