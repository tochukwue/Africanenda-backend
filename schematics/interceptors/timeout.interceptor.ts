import { Injectable, RequestTimeoutException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor {
  constructor(private readonly reflector?: Reflector) {}

  intercept(context, next) {
    const timeoutDuration =
      this.reflector.get<number>('request-timeout', context.getHandler()) ??
      30000;
    return next.handle().pipe(
      // Set timeout for http responses
      timeout(timeoutDuration),
      catchError((error) => {
        if (error instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => error);
      }),
    );
  }
}
