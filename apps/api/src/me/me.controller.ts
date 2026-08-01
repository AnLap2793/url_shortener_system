import { Controller, Get, Header, Req, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { SessionGuard, type AuthenticatedRequest } from "../auth/session.guard.js";
import { MeResponseDto } from "./me-response.dto.js";

/** The canonical protected endpoint: session-gated actor identity (AC3). */
@Controller("api/me")
export class MeController {
  @Get()
  @UseGuards(SessionGuard)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "getMe", summary: "Resolve the authenticated actor" })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ description: "No valid session." })
  me(@Req() request: AuthenticatedRequest): MeResponseDto {
    return { actorId: request.actorId! };
  }
}
