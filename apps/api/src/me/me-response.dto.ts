import { ApiProperty } from "@nestjs/swagger";

export class MeResponseDto {
  @ApiProperty({ description: "Canonical actor id — the Better Auth user id string." })
  actorId!: string;
}
