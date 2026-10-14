import {
  Inject,
  Injectable,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthContext } from './auth-context';

@Injectable({ scope: Scope.REQUEST })
export class CurrentUserService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  get(): AuthContext {
    if (!this.request.auth) {
      throw new UnauthorizedException('Sessão não autenticada');
    }
    return this.request.auth;
  }
}
