import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, Matches } from "class-validator";

const betterAuthEmailPattern =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+\-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

export class SignUpRegistrationDto {
  @ApiProperty({ format: "email", example: "marketer@example.com" })
  @Matches(betterAuthEmailPattern)
  email!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @Length(12, 128)
  password!: string;
}

export class ResendRegistrationVerificationDto {
  @ApiProperty({ format: "email", example: "marketer@example.com" })
  @Matches(betterAuthEmailPattern)
  email!: string;
}

export class VerifyRegistrationEmailDto {
  @ApiProperty({ minLength: 1, maxLength: 4096, writeOnly: true })
  @IsString()
  @Length(1, 4096)
  token!: string;
}

export class RegistrationPendingDto {
  @ApiProperty({ enum: ["verification-pending"] })
  status!: "verification-pending";
}

export class RegistrationVerifiedDto {
  @ApiProperty({ enum: ["verified"] })
  status!: "verified";
}

export class ProblemDto {
  @ApiProperty() type!: string;
  @ApiProperty() title!: string;
  @ApiProperty() status!: number;
  @ApiProperty() detail!: string;
  @ApiProperty() instance!: string;
  @ApiProperty() code!: string;
  @ApiProperty({ required: false, additionalProperties: { type: "array", items: { type: "string" } } })
  fieldErrors?: Record<string, string[]>;
}
