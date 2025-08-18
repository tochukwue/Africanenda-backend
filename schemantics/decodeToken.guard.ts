import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { decode } from 'jsonwebtoken';
import { Observable } from 'rxjs';
import { decryptData } from 'utils/utils.function';


@Injectable()
export class DecodeTokenGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request: any = context.switchToHttp().getRequest();
    return this.validateRequest(request);
  }

  private validateRequest(
    request: any,
  ): Observable<boolean> | Promise<boolean> | boolean {
    let returnValue = false;
    //Change to Authorization in your own
    const extractedHeaders: any = request.headers;

    if (extractedHeaders.authorization) {
      const rawToken: string = (extractedHeaders.authorization as string)
        .split(' ')
        .pop();
      let decodedToken: any = decode(rawToken);
      console.log({ decodedToken });
      decodedToken = {
        iat: decodedToken.iat,
        exp: decodedToken.exp,
        ...JSON.parse(
          decryptData(decodedToken.data, process.env.ENCRYPTION_KEY),
        ),
      };

      if (Date.now() <= decodedToken.exp * 1000) {
        console.log({ decodedToken });
        request.userData = { ...decodedToken };
        returnValue = true;
      } else
        throw new ForbiddenException(
          'Forbidden...You are using an expired token',
        );

    } else {
      throw new ForbiddenException(
        'Forbidden...Authorization headers were not set',
      );
    }
    return returnValue;
  }
}
