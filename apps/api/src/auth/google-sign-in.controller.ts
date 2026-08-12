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
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { registrationProblem } from "../registration/registration-problem.js";
import type { ApiConfig } from "../config.js";
import { API_CONFIG } from "../tokens.js";
import { GoogleSignInEnabledDto, StartGoogleSignInDto } from "./authentication.dto.js";
import { safeAuthRedirect } from "@url-shortener/domain";
import { AuthenticationService } from "./authentication.service.js";

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

@Controller("api/authentication")
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
  async googleFailure(@Req() request: { query: { redirectTo?: string } }, @Res() response: ResponseLike): Promise<void> {
    const redirectTo = safeAuthRedirect(request.query.redirectTo, this.config.publicOrigin);
    response.redirect(303, `/sign-in?google=unavailable&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  @Post("sign-in/google")
  @HttpCode(303)
  @ApiOperation({ operationId: "startGoogleSignIn" })
  @ApiResponse({ status: 303, headers: {
    "Cache-Control": { schema: { type: "string", example: "no-store" } },
    Location: { schema: { type: "string", format: "uri" } },
  } })
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
    } catch {
      response.setHeader("Cache-Control", "no-store");
      response.redirect(303, "/sign-in?google=unavailable");
    }
  }
}
