import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";

interface RequestLike {
  path: string;
}

interface ResponseLike {
  status(code: number): ResponseLike;
  type(contentType: string): ResponseLike;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

@Catch(HttpException)
export class AuthenticationProblemFilter implements ExceptionFilter {
  catch(error: HttpException, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<ResponseLike>();
    const request = http.getRequest<RequestLike>();
    const body = error.getResponse();
    const problem = typeof body === "object" && body !== null ? { ...body, instance: request.path } : body;
    response.setHeader("Cache-Control", "no-store");
    response.status(error.getStatus()).type("application/problem+json").json(problem);
  }
}
