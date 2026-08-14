import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  Req,
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
import { registrationProblem } from "../registration/registration-problem.js";
import type { ApiConfig } from "../config.js";
import { API_CONFIG } from "../tokens.js";
import { GoogleSignInEnabledDto, ProblemDto, StartGoogleSignInDto } from "./authentication.dto.js";
import { safeAuthRedirect } from "@url-shortener/domain";
import {
  AuthenticationService,
  GoogleSignInThrottledError,
} from "./authentication.service.js";
import { AuthenticationProblemFilter } from "./authentication-problem.filter.js";

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

interface ResponseLike {
  setHeader(name: string, value: string | string[]): void;
  redirect(status: number, url: string): void;
}

const validationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  exceptionFactory: () => registrationProblem(400, "Invalid request", "VALIDATION_FAILED", "/api/authentication"),
});

const noStoreHeaders = {
  "Cache-Control": { schema: { type: "string", example: "no-store" } },
};

@Controller("api/authentication")
@ApiExtraModels(ProblemDto)
@UseFilters(AuthenticationProblemFilter)
@UsePipes(validationPipe)
export class GoogleSignInController {
  constructor(
    private readonly authentication: AuthenticationService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  @Get("google")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "getGoogleSignInAvailability" })
  @ApiOkResponse({ type: GoogleSignInEnabledDto })
  googleAvailability(): GoogleSignInEnabledDto {
    return { enabled: this.authentication.isGoogleSignInEnabled() };
  }

  @Get("sign-in/google/error")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "googleSignInFailure" })
  @ApiResponse({ status: 303, headers: { ...noStoreHeaders, Location: { schema: { type: "string", format: "uri" } } } })
  async googleFailure(
    @Req() request: { query: { error?: string | string[]; redirectTo?: string | string[] } },
    @Res() response: ResponseLike,
  ): Promise<void> {
    const redirectTo = safeAuthRedirect(
      typeof request.query.redirectTo === "string" ? request.query.redirectTo : undefined,
      this.config.publicOrigin,
    );
    const error = typeof request.query.error === "string" ? request.query.error : undefined;
    const status = error === "account_not_linked"
      ? "collision"
      : error === "access_denied"
        ? "cancelled"
        : "unavailable";
    response.redirect(303, `/sign-in?google=${status}&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  @Post("sign-in/google")
  @HttpCode(303)
  @ApiOperation({ operationId: "startGoogleSignIn" })
  @ApiResponse({ status: 303, headers: {
    ...noStoreHeaders,
    Location: { schema: { type: "string", format: "uri" } },
  } })
  @ApiResponse({
    status: 400,
    content: { "application/problem+json": { schema: { $ref: getSchemaPath(ProblemDto) } } },
    headers: noStoreHeaders,
  })
  async startGoogleSignIn(
    @Req() request: RequestLike,
    @Body() body: StartGoogleSignInDto,
    @Res() response: ResponseLike,
  ): Promise<void> {
    try {
      const result = await this.authentication.startGoogleSignIn(request, body.redirectTo);
      if (result.cookies.length) response.setHeader("Set-Cookie", result.cookies);
      response.setHeader("Cache-Control", "no-store");
      response.redirect(303, result.url);
    } catch (error) {
      const redirectTo = safeAuthRedirect(body.redirectTo, this.config.publicOrigin);
      const status = error instanceof GoogleSignInThrottledError ? "throttled" : "unavailable";
      response.setHeader("Cache-Control", "no-store");
      response.redirect(303, `/sign-in?google=${status}&redirectTo=${encodeURIComponent(redirectTo)}`);
    }
  }
}
