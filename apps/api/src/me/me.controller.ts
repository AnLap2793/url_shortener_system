import { Controller, Get, Header, Req, UseGuards } from "@nestjs/common";
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import { SessionGuard, type AuthenticatedRequest } from "../auth/session.guard.js";
import { ProblemDto } from "../registration/registration.dto.js";
import { MeResponseDto } from "./me-response.dto.js";

/** The canonical protected endpoint: session-gated actor identity (AC3). */
@Controller("api/me")
@ApiExtraModels(ProblemDto)
export class MeController {
  @Get()
  @UseGuards(SessionGuard)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "getMe", summary: "Resolve the authenticated actor" })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({
    description: "No valid session.",
    content: {
      "application/problem+json": {
        schema: { $ref: getSchemaPath(ProblemDto) },
      },
    },
  })
  me(@Req() request: AuthenticatedRequest): MeResponseDto {
    return { actorId: request.actorId! };
  }
}
