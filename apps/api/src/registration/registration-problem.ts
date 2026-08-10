import { HttpException } from "@nestjs/common";

export function registrationProblem(
  status: number,
  title: string,
  code: string,
  instance: string,
): HttpException {
  return new HttpException({
    type: "about:blank",
    title,
    status,
    detail: title,
    instance,
    code,
  }, status);
}
