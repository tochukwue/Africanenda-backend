export enum NODE_ENVIRONMENT {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
}
export const NODE_ENV = process.env.NODE_ENV ?? NODE_ENVIRONMENT.DEVELOPMENT;

export const DefaultPassportLink = {
  male: 'https://ik.imagekit.io/cmz0p5kwiyok/public-images/male-icon_LyevsSXsx.png?updatedAt=1641364918016',
  female:
    'https://ik.imagekit.io/cmz0p5kwiyok/public-images/female-icon_MeVg4u34xW.png?updatedAt=1641364923710',
};

export enum DecodedTokenKey {
  USER_ID = 'id',
  EMAIL = 'email',
  ROLE = 'role',
  AUTH_PROVIDER = 'authProvider',
  TOKEN_INITIALIZED_ON = 'iat',
  TOKEN_EXPIRES_IN = 'exp',
  USER = 'user',
}

export enum PaymentStatus {
  SUCCESSFUL = 'SUCCESSFUL',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}

export enum RequestStatus {
  SUCCESSFUL = 'SUCCESSFUL',
  FAILED = 'FAILED',
}

export enum AuthProvider {
  LOCAL = 'LOCAL',
  FACEBOOK = 'FACEBOOK',
  GOOGLE = 'GOOGLE',
}

export enum AppRole {
  ADMIN = 'ADMIN',
  INSTRUCTOR = 'INSTRUCTOR',
  USER = 'USER',

}


export enum AssignmentStatus {
  Pend= 'Pending',
  Approved = 'Approved',

}



export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}
