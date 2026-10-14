import { Module } from '@nestjs/common';
import { CurrentOrganizationService } from './current-organization.service';

@Module({
  providers: [CurrentOrganizationService],
  exports: [CurrentOrganizationService],
})
export class OrganizacaoModule {}
