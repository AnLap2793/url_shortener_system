import {
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { HealthService } from "./health.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get("live")
  @Header("Cache-Control", "no-store")
  live() {
    return this.health.live();
  }

  @Get("ready")
  @Header("Cache-Control", "no-store")
  async ready() {
    const result = await this.health.ready();
    if (result.status === "unavailable")
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
