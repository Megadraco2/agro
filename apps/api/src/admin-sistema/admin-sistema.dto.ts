import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class AdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  senha!: string;
}

export class CreateOrganizacaoDto {
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsInt()
  @Min(1)
  maxUsuarios!: number;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(8)
  adminSenha!: string;
}

export class CriarPrimeiroUsuarioDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  senha!: string;
}
