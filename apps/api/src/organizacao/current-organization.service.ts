import { Injectable, Scope } from '@nestjs/common';
import { CurrentUserService } from '../auth/current-user.service';

@Injectable({ scope: Scope.REQUEST })
export class CurrentOrganizationService {
  constructor(private readonly currentUser: CurrentUserService) {}

  async getId(): Promise<string> {
    return this.currentUser.get().organizacaoId;
  }
}
