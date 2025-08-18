import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UseInterceptors,
} from '@nestjs/common';
import { TimeoutInterceptor } from 'schematics/interceptors/timeout.interceptor';
import { DecodedTokenKey } from 'utils/utils.constant';


export const CurrentUser = createParamDecorator(
  (data: DecodedTokenKey, ctx: ExecutionContext) => {
    const requestData = ctx.switchToHttp().getRequest();
    const { userData } = requestData;
    return data ? userData[data] : userData;
  },
);
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

export const MustBeSubscribed = (status: boolean) =>
  SetMetadata('isSubscribed', status);

export const SetHttpTimeoutDuration = (timeout: number) =>
  SetMetadata('request-timeout', timeout);

export const SetRequestTimeout = (timeout = 30000) => {
  return applyDecorators(
    SetHttpTimeoutDuration(timeout),
    UseInterceptors(TimeoutInterceptor),
  );
};
///   Add Decorator For AdminVerified
