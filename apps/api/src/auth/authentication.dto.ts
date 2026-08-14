import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, Length, Matches } from "class-validator";
import { ProblemDto } from "../registration/registration.dto.js";

const betterAuthEmailPattern =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+\-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

export class SignInAuthenticationDto {
  @ApiProperty({ format: "email", example: "marketer@example.com" })
  @Matches(betterAuthEmailPattern)
  email!: string;

  @ApiProperty({ minLength: 1, maxLength: 128, writeOnly: true })
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class SignInAuthenticationSuccessDto {
  @ApiProperty({ enum: ["signed-in"] })
  status!: "signed-in";
}

export class SignOutAuthenticationSuccessDto {
  @ApiProperty({ enum: ["signed-out"] })
  status!: "signed-out";
}

export class StartGoogleSignInDto {
  @ApiProperty({ required: false, example: "/dashboard" })
  @IsOptional()
  @IsString()
  @Length(1, 2_048)
  redirectTo?: string;
}

export class GoogleSignInEnabledDto {
  @ApiProperty()
  enabled!: boolean;
}

export { ProblemDto };
