import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CurrentOrganizationService } from './current-organization.service';

@Module({
  imports: [AuthModule],
  providers: [CurrentOrganizationService],
  exports: [CurrentOrganizationService],
})
export class OrganizacaoModule {}
