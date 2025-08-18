import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    UnauthorizedException,
  } from '@nestjs/common';
  import { Reflector } from '@nestjs/core';
  import { decode } from 'jsonwebtoken';
  import { Observable } from 'rxjs';
import { AppRole } from 'utils/utils.constant';
import { decryptData } from 'utils/utils.function';

  
  @Injectable()
  export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}
  
    canActivate(
      context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
      const request: any = context.switchToHttp().getRequest();
      const requiredRoles: AppRole = this.reflector.get<AppRole>(
        'roles',
        context.getHandler(),
      );
      const isSubscribed = this.reflector.get<boolean>(
        'isSubscribed',
        context.getHandler(),
      );
      console.log({ isSubscribed, requiredRoles });
      return this.validateRequest(request, isSubscribed, requiredRoles);
    }
  
    private validateRequest(
      request: any,
      isSubscribed = false,
      requiredRoles?: AppRole,
    ): Observable<boolean> | Promise<boolean> | boolean {
      let returnValue = false;
      const extractedHeaders: any = request.headers;
  
      if (extractedHeaders.authorization) {
        const rawToken: string = (extractedHeaders.authorization as string)
          .split(' ')
          .pop();
        let decodedToken: any = decode(rawToken);
        decodedToken = {
          iat: decodedToken.iat,
          exp: decodedToken.exp,
          ...JSON.parse(
            decryptData(decodedToken.data, process.env.ENCRYPTION_KEY),
          ),
        };
        if (decodedToken) {
          const { exp, role } = decodedToken;
          if (Date.now() <= exp * 1000) {
            request.userData = { ...decodedToken };
            if (requiredRoles) {
              returnValue = this.matchRoles(role, requiredRoles);
  
              if (!returnValue) {
                throw new UnauthorizedException(
                  `Unauthorized...Allows Only: ${[...requiredRoles]} `,
                );
              }
            } else {
              if (isSubscribed === true) {
                if (decodedToken.isSubscribed) {
                  // user has a subscription
                  returnValue = true;
                } else {
                  returnValue = false;
                }
              }
              else {
              returnValue = true;
              }
            }
          } else
            throw new ForbiddenException(
              'Forbidden...You are using an expired token',
            );
        } else {
          throw new ForbiddenException(
            'Forbidden...Authorization headers were not set',
          );
        }
      }
      return returnValue;
    }
  
    private matchRoles(role: AppRole, permittedRoles: AppRole): boolean {
      return permittedRoles.includes(role);
    }
  }
  