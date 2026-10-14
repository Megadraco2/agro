import {
  IsISO8601,
  IsNotEmpty,
  IsString,
  MaxLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'DataFimAposDataInicio', async: false })
class DataFimAposDataInicioConstraint implements ValidatorConstraintInterface {
  validate(dataFim: string, args: ValidationArguments) {
    const object = args.object as { dataInicio?: string };
    if (!object.dataInicio) return true;
    return new Date(dataFim).getTime() > new Date(object.dataInicio).getTime();
  }
  defaultMessage() {
    return 'dataFim deve ser posterior a dataInicio';
  }
}

export class CreateSafraDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  cultura!: string;

  @IsISO8601()
  dataInicio!: string;

  @IsISO8601()
  @Validate(DataFimAposDataInicioConstraint)
  dataFim!: string;
}

export class UpdateSafraDto extends CreateSafraDto {}
