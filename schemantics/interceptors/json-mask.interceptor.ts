import {
    Injectable,
    Logger,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
  } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { map } from 'rxjs/operators';
  import * as url from 'url';
  import * as mask from 'json-mask';
  import { Response } from './iresponse.interface';
  
  @Injectable()
  export class JsonMaskInterceptor<T> implements NestInterceptor<T, Response<T>> {
    private readonly logger: Logger = new Logger(JsonMaskInterceptor.name);
  
    intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Observable<Response<T>> {
      try {
        const [contextArgs] = context.getArgs();
        const reqUrl: string = contextArgs.originalUrl;
        const queryParamsObj: any = contextArgs.query;
        const queryParams: any = url.parse(reqUrl, true).query.fields;
  
        return next.handle().pipe(
          map((value) => {
            if ('fields' in queryParamsObj) {
              // ? Use Query params to enable field selection using JSON-MASK
              return mask(value, queryParams);
            }
            return value;
          }),
        );
      } catch (ex) {
        this.logger.debug(ex);
        throw ex;
      }
    }
  }
  