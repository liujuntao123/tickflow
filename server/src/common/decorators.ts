import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** 标记路由无需鉴权。 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export interface AuthUser {
  userId: string;
  /** 当前 access token 绑定的 refresh token id（会话 id）。 */
  sid: string;
}

/** 取当前登录用户，可传字段名直接取某个属性。 */
export const CurrentUser = createParamDecorator((data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
  const user = req.user;
  if (!user) return undefined;
  return data ? user[data] : user;
});