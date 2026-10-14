import { IsEmail, IsEnum, IsOptional, MinLength } from 'class-validator';
import { PapelUsuario } from '../generated/prisma/client';

export class CreateUsuarioDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  senha!: string;

  @IsOptional()
  @IsEnum(PapelUsuario)
  papel?: PapelUsuario;
}
