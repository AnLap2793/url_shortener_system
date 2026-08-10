import {
  Body,
  Controller,
  Header,
  HttpCode,
  type HttpException,
  Post,
  Res,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import {
  ProblemDto,
  RegistrationPendingDto,
  RegistrationVerifiedDto,
  ResendRegistrationVerificationDto,
  SignUpRegistrationDto,
  VerifyRegistrationEmailDto,
} from "./registration.dto.js";
import {
  InvalidVerificationError,
  RegistrationService,
  VerificationCooldownError,
} from "./registration.service.js";
import { RegistrationProblemFilter } from "./registration-problem.filter.js";
import { registrationProblem } from "./registration-problem.js";

interface ResponseLike {
  setHeader(name: string, value: string): void;
}

const validationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  exceptionFactory: () => registrationProblem(
    400,
    "Invalid request",
    "VALIDATION_FAILED",
    "/api/registration",
  ),
});

const problemContent = {
  "application/problem+json": { schema: { $ref: getSchemaPath(ProblemDto) } },
};

@Controller("api/registration")
@ApiExtraModels(ProblemDto)
@UseFilters(RegistrationProblemFilter)
@UsePipes(validationPipe)
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  @Post("sign-up")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "signUpRegistration" })
  @ApiOkResponse({ type: RegistrationPendingDto, headers: { "Cache-Control": { schema: { type: "string", example: "no-store" } } } })
  @ApiResponse({ status: 400, content: problemContent })
  @ApiResponse({ status: 413, content: problemContent })
  @ApiResponse({ status: 429, content: problemContent, headers: { "Retry-After": { schema: { type: "integer" } } } })
  @ApiResponse({ status: 503, content: problemContent })
  signUp(@Body() body: SignUpRegistrationDto, @Res({ passthrough: true }) response: ResponseLike) {
    return this.handle(
      () => this.registration.signUp(body.email, body.password),
      response,
      "/api/registration/sign-up",
    );
  }

  @Post("resend-verification")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "resendRegistrationVerification" })
  @ApiOkResponse({ type: RegistrationPendingDto, headers: { "Cache-Control": { schema: { type: "string", example: "no-store" } } } })
  @ApiResponse({ status: 400, content: problemContent })
  @ApiResponse({ status: 413, content: problemContent })
  @ApiResponse({ status: 429, content: problemContent, headers: { "Retry-After": { schema: { type: "integer" } } } })
  @ApiResponse({ status: 503, content: problemContent })
  resend(@Body() body: ResendRegistrationVerificationDto, @Res({ passthrough: true }) response: ResponseLike) {
    return this.handle(
      () => this.registration.resend(body.email),
      response,
      "/api/registration/resend-verification",
    );
  }

  @Post("verify-email")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "verifyRegistrationEmail" })
  @ApiOkResponse({ type: RegistrationVerifiedDto, headers: { "Cache-Control": { schema: { type: "string", example: "no-store" } } } })
  @ApiResponse({ status: 400, content: problemContent })
  @ApiResponse({ status: 413, content: problemContent })
  @ApiResponse({ status: 503, content: problemContent })
  async verify(@Body() body: VerifyRegistrationEmailDto) {
    try {
      return await this.registration.verify(body.token);
    } catch (error) {
      if (error instanceof InvalidVerificationError) {
        throw this.problem(400, "Invalid verification link", "INVALID_VERIFICATION", "/api/registration/verify-email");
      }
      throw this.problem(503, "Service temporarily unavailable", "REGISTRATION_UNAVAILABLE", "/api/registration/verify-email");
    }
  }

  async handle<T>(
    operation: () => Promise<T>,
    response: ResponseLike,
    instance: string,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof VerificationCooldownError) {
        response.setHeader("Retry-After", String(error.retryAfterSeconds));
        throw this.problem(429, "Verification email cooldown", "VERIFICATION_COOLDOWN", instance);
      }
      throw this.problem(503, "Service temporarily unavailable", "REGISTRATION_UNAVAILABLE", instance);
    }
  }

  problem(status: number, title: string, code: string, instance: string): HttpException {
    return registrationProblem(status, title, code, instance);
  }
}
