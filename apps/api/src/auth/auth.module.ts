import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUserService } from './current-user.service';

@Module({
  controllers: [AuthController],
  providers: [AuthGuard, AuthService, CurrentUserService],
  exports: [AuthGuard, CurrentUserService],
})
export class AuthModule {}
