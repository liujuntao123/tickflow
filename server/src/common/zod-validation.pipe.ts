import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';
import { AppException } from './errors';

/**
 * 基于 zod 的请求体/查询参数校验管道。
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppException(400, 'VALIDATION_ERROR', '请求参数校验失败', result.error.flatten());
    }
    return result.data;
  }
}