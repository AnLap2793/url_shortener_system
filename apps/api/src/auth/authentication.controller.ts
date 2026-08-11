import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Req,
  Res,
  UseFilters,
  UsePipes,
  ValidationPipe,
  type HttpException,
} from "@nestjs/common";
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import { registrationProblem } from "../registration/registration-problem.js";
import {
  AuthenticationSuccessDto,
  ProblemDto,
  SignInAuthenticationDto,
} from "./authentication.dto.js";
import { AuthenticationProblemFilter } from "./authentication-problem.filter.js";
import {
  AuthenticationService,
  EmailVerificationRequiredError,
  InvalidCredentialsError,
  LoginThrottledError,
} from "./authentication.service.js";

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

interface ResponseLike {
  setHeader(name: string, value: string | string[]): void;
}

const validationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  exceptionFactory: () => registrationProblem(400, "Invalid request", "VALIDATION_FAILED", "/api/authentication"),
});

const problemContent = {
  "application/problem+json": { schema: { $ref: getSchemaPath(ProblemDto) } },
};

@Controller("api/authentication")
@ApiExtraModels(ProblemDto)
@UseFilters(AuthenticationProblemFilter)
@UsePipes(validationPipe)
export class AuthenticationController {
  constructor(private readonly authentication: AuthenticationService) {}

  @Post("sign-in")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "signInAuthentication" })
  @ApiOkResponse({ type: AuthenticationSuccessDto })
  @ApiResponse({ status: 400, content: problemContent })
  @ApiResponse({ status: 401, content: problemContent })
  @ApiResponse({ status: 403, content: problemContent })
  @ApiResponse({ status: 413, content: problemContent })
  @ApiResponse({ status: 429, content: problemContent, headers: { "Retry-After": { schema: { type: "integer" } } } })
  @ApiResponse({ status: 503, content: problemContent })
  async signIn(
    @Req() request: RequestLike,
    @Body() body: SignInAuthenticationDto,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    try {
      const cookies = await this.authentication.signIn(request, body.email, body.password);
      if (cookies.length) response.setHeader("Set-Cookie", cookies);
      return { status: "signed-in" as const };
    } catch (error) {
      if (error instanceof LoginThrottledError) {
        response.setHeader("Retry-After", String(error.retryAfterSeconds));
        throw this.problem(429, "Too many sign-in attempts", "LOGIN_THROTTLED");
      }
      if (error instanceof EmailVerificationRequiredError) {
        throw this.problem(403, "Email verification required", "EMAIL_VERIFICATION_REQUIRED");
      }
      if (error instanceof InvalidCredentialsError) {
        throw this.problem(401, "Invalid email or password", "INVALID_CREDENTIALS");
      }
      throw this.problem(503, "Service temporarily unavailable", "AUTHENTICATION_UNAVAILABLE");
    }
  }

  @Post("sign-out")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "signOutAuthentication" })
  @ApiOkResponse({ type: AuthenticationSuccessDto })
  @ApiResponse({ status: 503, content: problemContent })
  async signOut(@Req() request: RequestLike, @Res({ passthrough: true }) response: ResponseLike) {
    try {
      const cookies = await this.authentication.signOut(request);
      if (cookies.length) response.setHeader("Set-Cookie", cookies);
      return { status: "signed-out" as const };
    } catch {
      throw this.problem(503, "Service temporarily unavailable", "AUTHENTICATION_UNAVAILABLE");
    }
  }

  problem(status: number, title: string, code: string): HttpException {
    return registrationProblem(status, title, code, "/api/authentication");
  }
}
