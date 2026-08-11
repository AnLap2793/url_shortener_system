import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, Matches } from "class-validator";
import { ProblemDto } from "../registration/registration.dto.js";

const betterAuthEmailPattern =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+\-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

export class SignInAuthenticationDto {
  @ApiProperty({ format: "email", example: "marketer@example.com" })
  @Matches(betterAuthEmailPattern)
  email!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @Length(12, 128)
  password!: string;
}

export class AuthenticationSuccessDto {
  @ApiProperty({ enum: ["signed-in", "signed-out"] })
  status!: "signed-in" | "signed-out";
}

export { ProblemDto };
