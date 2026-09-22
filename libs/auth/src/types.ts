export interface JwtTokenClaims {
  sub: string; // User principal / Customer ID
  roles: string[]; // ['CUSTOMER'], ['OPERATOR'], ['ADMIN'], etc.
  permissions: string[]; // ['account:freeze', 'ledger:audit', etc.]
  iat: number;
  exp: number;
}
